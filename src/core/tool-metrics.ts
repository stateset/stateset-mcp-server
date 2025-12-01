import { metrics } from './metrics';
import { createLogger } from '@utils/logger';
import { getCorrelationId, addBreadcrumb } from './request-context';

const logger = createLogger('tool-metrics');

/**
 * Tool execution metrics
 */
export interface ToolExecutionMetrics {
  toolName: string;
  category: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorType?: string;
  cacheHit?: boolean;
  retryCount?: number;
  correlationId: string;
}

/**
 * Aggregated tool statistics
 */
export interface ToolStats {
  toolName: string;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  cacheHitRate: number;
  errorRate: number;
  lastCalled: number;
}

/**
 * Tool category for grouping metrics
 */
export type ToolCategory =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'workflow'
  | 'search'
  | 'batch'
  | 'analytics'
  | 'admin';

/**
 * Determines tool category from tool name
 */
export function getToolCategory(toolName: string): ToolCategory {
  if (toolName.includes('_create_') || toolName.includes('_add_')) return 'create';
  if (toolName.includes('_get_')) return 'read';
  if (toolName.includes('_update_') || toolName.includes('_mark_')) return 'update';
  if (toolName.includes('_delete_') || toolName.includes('_remove_')) return 'delete';
  if (toolName.includes('_list_')) return 'list';
  if (
    toolName.includes('_approve_') ||
    toolName.includes('_cancel_') ||
    toolName.includes('_complete_') ||
    toolName.includes('_start_') ||
    toolName.includes('_hold_') ||
    toolName.includes('_assign_') ||
    toolName.includes('_restock_') ||
    toolName.includes('_reserve_') ||
    toolName.includes('_release_') ||
    toolName.includes('_refund_') ||
    toolName.includes('_extend_') ||
    toolName.includes('_receive_')
  ) return 'workflow';
  if (toolName.includes('_search_') || toolName.includes('_advanced_')) return 'search';
  if (toolName.includes('_batch_') || toolName.includes('_csv_')) return 'batch';
  if (
    toolName.includes('_metrics') ||
    toolName.includes('_trends') ||
    toolName.includes('_dashboard')
  ) return 'analytics';
  if (
    toolName.includes('_health_') ||
    toolName.includes('_cache_') ||
    toolName.includes('_rate_') ||
    toolName.includes('_timeout_') ||
    toolName.includes('_websocket_')
  ) return 'admin';

  return 'read'; // Default
}

/**
 * Tool metrics collector singleton
 */
class ToolMetricsCollector {
  private executionHistory: Map<string, ToolExecutionMetrics[]> = new Map();
  private readonly maxHistoryPerTool = 1000;

  /**
   * Records the start of a tool execution
   */
  startExecution(toolName: string): ToolExecutionMetrics {
    const execution: ToolExecutionMetrics = {
      toolName,
      category: getToolCategory(toolName),
      startTime: Date.now(),
      success: false,
      correlationId: getCorrelationId(),
    };

    addBreadcrumb('tool', `Starting ${toolName}`, 'info', { category: execution.category });

    metrics.increment('tool_executions_started_total', 1, {
      tool: toolName,
      category: execution.category,
    });

    return execution;
  }

  /**
   * Records the completion of a tool execution
   */
  completeExecution(
    execution: ToolExecutionMetrics,
    options: {
      success: boolean;
      errorType?: string;
      cacheHit?: boolean;
      retryCount?: number;
    },
  ): void {
    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;
    execution.success = options.success;
    execution.errorType = options.errorType;
    execution.cacheHit = options.cacheHit;
    execution.retryCount = options.retryCount;

    // Record metrics
    metrics.observe('tool_execution_duration_ms', execution.duration, {
      tool: execution.toolName,
      category: execution.category,
      status: execution.success ? 'success' : 'error',
    });

    metrics.increment('tool_executions_total', 1, {
      tool: execution.toolName,
      category: execution.category,
      status: execution.success ? 'success' : 'error',
    });

    if (!execution.success && execution.errorType) {
      metrics.increment('tool_errors_total', 1, {
        tool: execution.toolName,
        category: execution.category,
        error_type: execution.errorType,
      });
    }

    if (execution.cacheHit !== undefined) {
      metrics.increment('tool_cache_total', 1, {
        tool: execution.toolName,
        hit: execution.cacheHit ? 'true' : 'false',
      });
    }

    if (execution.retryCount && execution.retryCount > 0) {
      metrics.observe('tool_retry_count', execution.retryCount, {
        tool: execution.toolName,
      });
    }

    // Store in history
    this.addToHistory(execution);

    // Log completion
    const level = execution.success ? 'debug' : 'warn';
    logger[level]('Tool execution completed', {
      tool: execution.toolName,
      category: execution.category,
      durationMs: execution.duration,
      success: execution.success,
      errorType: execution.errorType,
      cacheHit: execution.cacheHit,
      retryCount: execution.retryCount,
      correlationId: execution.correlationId,
    });

    addBreadcrumb(
      'tool',
      `Completed ${execution.toolName}`,
      execution.success ? 'info' : 'error',
      {
        durationMs: execution.duration,
        success: execution.success,
      },
    );
  }

  /**
   * Creates a wrapper to track tool execution
   */
  trackExecution<T>(
    toolName: string,
    fn: () => Promise<T>,
    options: { cacheHit?: boolean } = {},
  ): Promise<T> {
    const execution = this.startExecution(toolName);

    return fn()
      .then((result) => {
        this.completeExecution(execution, {
          success: true,
          cacheHit: options.cacheHit,
        });
        return result;
      })
      .catch((error) => {
        this.completeExecution(execution, {
          success: false,
          errorType: error?.constructor?.name || 'UnknownError',
          cacheHit: options.cacheHit,
        });
        throw error;
      });
  }

  /**
   * Gets statistics for a specific tool
   */
  getToolStats(toolName: string): ToolStats | null {
    const history = this.executionHistory.get(toolName);
    if (!history || history.length === 0) {
      return null;
    }

    const successful = history.filter((e) => e.success);
    const failed = history.filter((e) => !e.success);
    const cached = history.filter((e) => e.cacheHit === true);
    const durations = history.filter((e) => e.duration !== undefined).map((e) => e.duration!);

    // Sort for percentiles
    durations.sort((a, b) => a - b);

    return {
      toolName,
      totalCalls: history.length,
      successCount: successful.length,
      errorCount: failed.length,
      avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p50DurationMs: this.percentile(durations, 0.5),
      p95DurationMs: this.percentile(durations, 0.95),
      p99DurationMs: this.percentile(durations, 0.99),
      cacheHitRate: history.length > 0 ? cached.length / history.length : 0,
      errorRate: history.length > 0 ? failed.length / history.length : 0,
      lastCalled: Math.max(...history.map((e) => e.startTime)),
    };
  }

  /**
   * Gets statistics for all tools
   */
  getAllToolStats(): ToolStats[] {
    const stats: ToolStats[] = [];
    for (const toolName of this.executionHistory.keys()) {
      const toolStats = this.getToolStats(toolName);
      if (toolStats) {
        stats.push(toolStats);
      }
    }
    return stats.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * Gets statistics grouped by category
   */
  getCategoryStats(): Record<ToolCategory, {
    totalCalls: number;
    successRate: number;
    avgDurationMs: number;
    errorRate: number;
  }> {
    const categoryData: Record<string, { calls: number; success: number; durations: number[] }> = {};

    for (const history of this.executionHistory.values()) {
      for (const execution of history) {
        if (!categoryData[execution.category]) {
          categoryData[execution.category] = { calls: 0, success: 0, durations: [] };
        }
        const catData = categoryData[execution.category]!;
        catData.calls++;
        if (execution.success) catData.success++;
        if (execution.duration) catData.durations.push(execution.duration);
      }
    }

    const result: Record<string, any> = {};
    for (const [category, data] of Object.entries(categoryData)) {
      result[category] = {
        totalCalls: data.calls,
        successRate: data.calls > 0 ? data.success / data.calls : 0,
        avgDurationMs: data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : 0,
        errorRate: data.calls > 0 ? (data.calls - data.success) / data.calls : 0,
      };
    }

    return result as Record<ToolCategory, any>;
  }

  /**
   * Gets slow tools (above threshold)
   */
  getSlowTools(thresholdMs: number = 5000): ToolStats[] {
    return this.getAllToolStats().filter((stats) => stats.p95DurationMs > thresholdMs);
  }

  /**
   * Gets error-prone tools (above threshold)
   */
  getErrorProneTools(thresholdRate: number = 0.1): ToolStats[] {
    return this.getAllToolStats().filter((stats) => stats.errorRate > thresholdRate);
  }

  /**
   * Clears all history
   */
  clear(): void {
    this.executionHistory.clear();
  }

  /**
   * Exports metrics in a format suitable for dashboards
   */
  exportMetrics(): {
    summary: {
      totalExecutions: number;
      successRate: number;
      avgDurationMs: number;
      uniqueTools: number;
    };
    byTool: ToolStats[];
    byCategory: Record<ToolCategory, any>;
    slowTools: ToolStats[];
    errorProneTools: ToolStats[];
  } {
    const allStats = this.getAllToolStats();
    const totalExecutions = allStats.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalSuccess = allStats.reduce((sum, s) => sum + s.successCount, 0);
    const totalDuration = allStats.reduce((sum, s) => sum + s.avgDurationMs * s.totalCalls, 0);

    return {
      summary: {
        totalExecutions,
        successRate: totalExecutions > 0 ? totalSuccess / totalExecutions : 0,
        avgDurationMs: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
        uniqueTools: allStats.length,
      },
      byTool: allStats,
      byCategory: this.getCategoryStats(),
      slowTools: this.getSlowTools(),
      errorProneTools: this.getErrorProneTools(),
    };
  }

  /**
   * Adds execution to history with size limit
   */
  private addToHistory(execution: ToolExecutionMetrics): void {
    if (!this.executionHistory.has(execution.toolName)) {
      this.executionHistory.set(execution.toolName, []);
    }

    const history = this.executionHistory.get(execution.toolName)!;
    history.push(execution);

    // Trim to max size
    if (history.length > this.maxHistoryPerTool) {
      history.splice(0, history.length - this.maxHistoryPerTool);
    }
  }

  /**
   * Calculates percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(p * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)] ?? 0;
  }
}

// Singleton instance
export const toolMetrics = new ToolMetricsCollector();

/**
 * Decorator for tracking tool execution
 */
export function TrackToolExecution(toolName?: string) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const name = toolName || propertyKey;

    descriptor.value = async function (...args: any[]) {
      return toolMetrics.trackExecution(name, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
