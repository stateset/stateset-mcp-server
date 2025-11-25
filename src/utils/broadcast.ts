import { wsManager } from '../core/websocket';
import { logger } from './logger';

export function broadcastResourceUpdate(
  resourceType: string,
  resourceId: string,
  action: 'created' | 'updated' | 'deleted',
  data: any
): void {
  // Broadcast to resource-specific channel (e.g., "orders" or "orders:123")
  wsManager.broadcast(resourceType, {
    action,
    resourceId,
    data,
    timestamp: new Date().toISOString(),
  });

  // Also broadcast to the specific resource channel
  wsManager.broadcast(`${resourceType}:${resourceId}`, {
    action,
    resourceId,
    data,
    timestamp: new Date().toISOString(),
  });

  logger.debug('Real-time update broadcasted', {
    resourceType,
    resourceId,
    action,
  });
}
