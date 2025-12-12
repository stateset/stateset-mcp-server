import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { metrics } from './metrics';

const logger = createLogger('batch-processor');

interface BatchOperation<T, R> {
  id: string;
  data: T;
  operation: string;
  priority: number;
  timestamp: number;
  retries: number;
  maxRetries: number;
  timeout: number;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

interface BatchResult<R> {
  id: string;
  success: boolean;
  result?: R;
  error?: Error;
  processingTime: number;
}

interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  maxConcurrency: number;
  defaultTimeout: number;
  defaultMaxRetries: number;
  enablePrioritization: boolean;
  enableAdaptiveBatching: boolean;
}

interface ProcessorStats {
  totalProcessed: number;
  successfulOperations: number;
  failedOperations: number;
  averageProcessingTime: number;
  currentQueueSize: number;
  averageBatchSize: number;
  throughputPerSecond: number;
}

export class BatchProcessor<T, R> extends EventEmitter {
  private queue: BatchOperation<T, R>[] = [];
  private processing = false;
  private config: BatchConfig;
  private stats: ProcessorStats;
  private batchTimer: NodeJS.Timeout | null = null;
  private lastProcessTime = Date.now();
  private recentBatchSizes: number[] = [];
  private recentProcessingTimes: number[] = [];

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    config: Partial<BatchConfig> = {},
  ) {
    super();

    this.config = {
      maxBatchSize: 100,
      maxWaitTime: 1000, // 1 second
      maxConcurrency: 5,
      defaultTimeout: 30000, // 30 seconds
      defaultMaxRetries: 3,
      enablePrioritization: true,
      enableAdaptiveBatching: true,
      ...config,
    };

    this.stats = {
      totalProcessed: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      currentQueueSize: 0,
      averageBatchSize: 0,
      throughputPerSecond: 0,
    };

    logger.info('Batch processor initialized', { config: this.config });
  }

  async add(
    data: T,
    options: {
      operation?: string;
      priority?: number;
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const operation: BatchOperation<T, R> = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data,
        operation: options.operation || 'default',
        priority: options.priority || 0,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: options.maxRetries || this.config.defaultMaxRetries,
        timeout: options.timeout || this.config.defaultTimeout,
        resolve,
        reject,
      };

      this.queue.push(operation);
      this.updateStats();

      metrics.incrementCounter('batch_operations_queued', 1, {
        operation: operation.operation,
      });

      logger.debug('Operation queued', {
        id: operation.id,
        operation: operation.operation,
        queueSize: this.queue.length,
      });

      this.scheduleProcessing();
    });
  }

  async addBatch(
    items: Array<{
      data: T;
      options?: {
        operation?: string;
        priority?: number;
        timeout?: number;
        maxRetries?: number;
      };
    }>,
  ): Promise<R[]> {
    const promises = items.map(({ data, options }) => this.add(data, options));
    return Promise.all(promises);
  }

  private scheduleProcessing(): void {
    if (this.processing) return;

    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Process immediately if queue is full or adaptive conditions are met
    if (this.shouldProcessImmediately()) {
      this.processBatch();
      return;
    }

    // Schedule processing based on wait time
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.getAdaptiveWaitTime());
  }

  private shouldProcessImmediately(): boolean {
    if (this.queue.length >= this.getAdaptiveBatchSize()) {
      return true;
    }

    // Check for high-priority operations
    if (this.config.enablePrioritization) {
      const highPriorityCount = this.queue.filter((op) => op.priority > 0.8).length;
      if (highPriorityCount >= Math.min(10, this.config.maxBatchSize * 0.1)) {
        return true;
      }
    }

    // Check for operations approaching timeout
    const now = Date.now();
    const urgentCount = this.queue.filter((op) => now - op.timestamp > op.timeout * 0.8).length;

    return urgentCount > 0;
  }

  private getAdaptiveBatchSize(): number {
    if (!this.config.enableAdaptiveBatching) {
      return this.config.maxBatchSize;
    }

    // Adaptive batch sizing based on recent performance
    const avgProcessingTime = this.getAverageProcessingTime();
    const avgBatchSize = this.getAverageBatchSize();

    // If processing is fast, increase batch size
    if (avgProcessingTime < 100 && avgBatchSize > 0) {
      // < 100ms
      return Math.min(this.config.maxBatchSize, Math.floor(avgBatchSize * 1.2));
    }

    // If processing is slow, decrease batch size
    if (avgProcessingTime > 1000) {
      // > 1s
      return Math.max(10, Math.floor(avgBatchSize * 0.8));
    }

    return this.config.maxBatchSize;
  }

  private getAdaptiveWaitTime(): number {
    if (!this.config.enableAdaptiveBatching) {
      return this.config.maxWaitTime;
    }

    // Adaptive wait time based on queue size and recent throughput
    const queueRatio = this.queue.length / this.config.maxBatchSize;
    const basewaitTime = this.config.maxWaitTime;

    // Reduce wait time if queue is filling up
    if (queueRatio > 0.5) {
      return Math.max(100, basewaitTime * (1 - queueRatio));
    }

    return basewaitTime;
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const startTime = Date.now();
    let currentBatch: BatchOperation<T, R>[] = [];

    try {
      // Sort by priority if enabled
      if (this.config.enablePrioritization) {
        this.queue.sort((a, b) => b.priority - a.priority);
      }

      // Take batch from queue
      const batchSize = Math.min(this.queue.length, this.getAdaptiveBatchSize());
      const batch = this.queue.splice(0, batchSize);

      logger.debug('Processing batch', {
        batchSize,
        remainingQueue: this.queue.length,
      });

      // Check for timed-out operations
      const now = Date.now();
      const timedOut = batch.filter((op) => now - op.timestamp > op.timeout);
      const valid = batch.filter((op) => now - op.timestamp <= op.timeout);
      currentBatch = valid;

      // Reject timed-out operations
      timedOut.forEach((op) => {
        op.reject(new Error(`Operation timed out after ${op.timeout}ms`));
        metrics.incrementCounter('batch_operations_timeout', 1, {
          operation: op.operation,
        });
      });

      if (valid.length === 0) {
        this.processing = false;
        this.scheduleProcessing();
        return;
      }

      // Process the batch
      const profileOperation = valid[0]?.operation ?? 'default';
      const results = await metrics.profile(`batch_process_${profileOperation}`, () =>
        this.processor(valid.map((op) => op.data)),
      );

      // Handle results
      const batchResults: BatchResult<R>[] = [];

      for (let i = 0; i < valid.length; i++) {
        const operation = valid[i];
        if (!operation) continue;
        const processingTime = Date.now() - operation.timestamp;

        if (i < results.length && results[i] !== undefined) {
          // Success
          operation.resolve(results[i] as R);
          batchResults.push({
            id: operation.id,
            success: true,
            result: results[i],
            processingTime,
          });

          this.stats.successfulOperations++;
          metrics.incrementCounter('batch_operations_success', 1, {
            operation: operation.operation,
          });
        } else {
          // Handle missing result (should not happen with well-behaved processors)
          const error = new Error('No result returned for operation');
          operation.reject(error);
          batchResults.push({
            id: operation.id,
            success: false,
            error,
            processingTime,
          });

          this.stats.failedOperations++;
          metrics.incrementCounter('batch_operations_error', 1, {
            operation: operation.operation,
          });
        }
      }

      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(batchSize, processingTime);

      metrics.recordHistogram('batch_processing_duration_seconds', processingTime / 1000);
      metrics.setGauge('batch_queue_size', this.queue.length);

      this.emit('batchProcessed', {
        batchSize: valid.length,
        results: batchResults,
        processingTime,
      });
    } catch (error) {
      logger.error('Batch processing failed', { error });

      // Handle batch failure - retry eligible operations from the current batch
      for (const operation of currentBatch) {
        if (operation.retries < operation.maxRetries) {
          operation.retries++;
          this.queue.unshift(operation); // Add back to front for retry

          metrics.incrementCounter('batch_operations_retry', 1, {
            operation: operation.operation,
          });
        } else {
          operation.reject(error as Error);
          this.stats.failedOperations++;

          metrics.incrementCounter('batch_operations_failed', 1, {
            operation: operation.operation,
          });
        }
      }
    } finally {
      this.processing = false;
      this.updateStats();

      // Schedule next batch if queue is not empty
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  private updateProcessingStats(batchSize: number, processingTime: number): void {
    this.stats.totalProcessed += batchSize;

    // Update recent batch sizes and processing times
    this.recentBatchSizes.push(batchSize);
    this.recentProcessingTimes.push(processingTime);

    // Keep only last 100 measurements
    if (this.recentBatchSizes.length > 100) {
      this.recentBatchSizes.splice(0, this.recentBatchSizes.length - 100);
    }
    if (this.recentProcessingTimes.length > 100) {
      this.recentProcessingTimes.splice(0, this.recentProcessingTimes.length - 100);
    }

    // Update averages
    this.stats.averageBatchSize = this.getAverageBatchSize();
    this.stats.averageProcessingTime = this.getAverageProcessingTime();

    // Update throughput
    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessTime;
    if (timeSinceLastProcess > 0) {
      this.stats.throughputPerSecond = (batchSize / timeSinceLastProcess) * 1000;
    }
    this.lastProcessTime = now;
  }

  private updateStats(): void {
    this.stats.currentQueueSize = this.queue.length;
  }

  private getAverageBatchSize(): number {
    if (this.recentBatchSizes.length === 0) return 0;
    return this.recentBatchSizes.reduce((a, b) => a + b, 0) / this.recentBatchSizes.length;
  }

  private getAverageProcessingTime(): number {
    if (this.recentProcessingTimes.length === 0) return 0;
    return (
      this.recentProcessingTimes.reduce((a, b) => a + b, 0) / this.recentProcessingTimes.length
    );
  }

  // Queue management
  getQueueSize(): number {
    return this.queue.length;
  }

  getQueuedOperations(): Array<{
    id: string;
    operation: string;
    priority: number;
    age: number;
    retries: number;
  }> {
    const now = Date.now();
    return this.queue.map((op) => ({
      id: op.id,
      operation: op.operation,
      priority: op.priority,
      age: now - op.timestamp,
      retries: op.retries,
    }));
  }

  clearQueue(): number {
    const count = this.queue.length;

    // Reject all queued operations
    this.queue.forEach((op) => {
      op.reject(new Error('Queue cleared'));
    });

    this.queue = [];
    this.updateStats();

    metrics.incrementCounter('batch_operations_cleared', count);

    logger.info('Queue cleared', { clearedOperations: count });
    return count;
  }

  // Priority management
  reprioritize(
    predicate: (operation: BatchOperation<T, R>) => boolean,
    newPriority: number,
  ): number {
    let updated = 0;

    for (const operation of this.queue) {
      if (predicate(operation)) {
        operation.priority = newPriority;
        updated++;
      }
    }

    if (updated > 0 && this.config.enablePrioritization) {
      this.queue.sort((a, b) => b.priority - a.priority);
      logger.debug('Operations reprioritized', { updated, newPriority });
    }

    return updated;
  }

  // Statistics and monitoring
  getStats(): ProcessorStats {
    return { ...this.stats };
  }

  getHealthStatus(): {
    healthy: boolean;
    queueUtilization: number;
    averageWaitTime: number;
    errorRate: number;
    issues: string[];
  } {
    const issues: string[] = [];

    const queueUtilization = this.queue.length / this.config.maxBatchSize;
    const totalOps = this.stats.successfulOperations + this.stats.failedOperations;
    const errorRate = totalOps > 0 ? this.stats.failedOperations / totalOps : 0;

    // Check for issues
    if (queueUtilization > 0.8) {
      issues.push('High queue utilization');
    }

    if (errorRate > 0.1) {
      issues.push('High error rate');
    }

    if (this.stats.averageProcessingTime > 5000) {
      issues.push('High processing latency');
    }

    const now = Date.now();
    const oldestOperation = this.queue.reduce(
      (oldest, op) => (op.timestamp < oldest ? op.timestamp : oldest),
      now,
    );
    const averageWaitTime = this.queue.length > 0 ? now - oldestOperation : 0;

    if (averageWaitTime > 10000) {
      issues.push('Operations waiting too long');
    }

    return {
      healthy: issues.length === 0,
      queueUtilization,
      averageWaitTime,
      errorRate,
      issues,
    };
  }

  // Lifecycle management
  async drain(): Promise<void> {
    logger.info('Draining batch processor', { queueSize: this.queue.length });

    // Process remaining batches
    while (this.queue.length > 0 && !this.processing) {
      await this.processBatch();
    }

    // Wait for current processing to finish
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info('Batch processor drained');
  }

  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Reject all remaining operations
    this.queue.forEach((op) => {
      op.reject(new Error('Processor destroyed'));
    });

    this.queue = [];
    this.removeAllListeners();

    logger.info('Batch processor destroyed');
  }
}
