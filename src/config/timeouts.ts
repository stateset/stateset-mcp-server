// Operation Timeout Configuration
export type OperationType =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'batch'
  | 'search'
  | 'default';

export interface OperationTimeoutConfig {
  timeouts: Record<OperationType, number>;
  getTimeout(operationName: string): number;
}

export function createOperationTimeoutConfig(defaultTimeoutMs: number): OperationTimeoutConfig {
  const timeouts: Record<OperationType, number> = {
    read: defaultTimeoutMs, // Standard read operations
    create: defaultTimeoutMs * 1.5, // Create operations may take longer
    update: defaultTimeoutMs * 1.5, // Update operations may take longer
    delete: defaultTimeoutMs, // Delete operations are usually quick
    batch: defaultTimeoutMs * 5, // Batch operations need much more time
    search: defaultTimeoutMs * 2, // Search operations may involve complex queries
    default: defaultTimeoutMs,
  };

  return {
    timeouts,
    getTimeout(operationName: string): number {
      const lowerName = operationName.toLowerCase();

      if (lowerName.includes('batch') || lowerName.includes('csv')) {
        return timeouts.batch;
      }
      if (lowerName.includes('delete')) {
        return timeouts.delete;
      }
      if (lowerName.includes('create')) {
        return timeouts.create;
      }
      if (lowerName.includes('update')) {
        return timeouts.update;
      }
      if (lowerName.includes('get') || lowerName.includes('list')) {
        return timeouts.read;
      }
      if (lowerName.includes('search')) {
        return timeouts.search;
      }

      return timeouts.default;
    },
  };
}
