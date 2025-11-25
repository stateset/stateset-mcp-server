import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { createServer, IncomingMessage } from 'http';
import { logger } from '../utils/logger';
import { AdvancedMetrics } from './advanced-metrics';
import { validateAndSanitizeInput, SanitizedIdSchema } from '../utils/validation';

interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: number;
    lastActivity: number;
    messageCount: number;
  };
}

interface SubscriptionFilter {
  resourceType?: string;
  resourceId?: string;
  eventType?: string;
  userId?: string;
}

interface RealtimeMessage {
  type: 'event' | 'subscription' | 'heartbeat' | 'error';
  channel?: string;
  data?: any;
  timestamp: number;
  id: string;
}

interface EventData {
  resourceType: string;
  resourceId: string;
  eventType: 'created' | 'updated' | 'deleted';
  data: any;
  userId?: string;
  timestamp: number;
}

interface RealtimeStats {
  totalConnections: number;
  activeConnections: number;
  totalSubscriptions: number;
  messagesPerSecond: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  averageConnectionDuration: number;
  channels: Map<string, number>;
}

export class RealtimeManager extends EventEmitter {
  private wss: WebSocket.Server;
  private connections = new Map<string, WebSocketConnection>();
  private channels = new Map<string, Set<string>>(); // channel -> connectionIds
  private subscriptions = new Map<string, SubscriptionFilter>(); // subscriptionId -> filter
  private metrics: AdvancedMetrics;
  private stats: RealtimeStats;
  private heartbeatInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private messageBuffer = new Map<string, RealtimeMessage[]>(); // For offline users

  constructor(port: number = 8080, metrics?: AdvancedMetrics) {
    super();
    
    this.metrics = metrics || new AdvancedMetrics();
    
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalSubscriptions: 0,
      messagesPerSecond: 0,
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      averageConnectionDuration: 0,
      channels: new Map(),
    };

    // Create WebSocket server
    this.wss = new WebSocket.Server({
      port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 1, // Faster compression
          concurrencyLimit: 10,
        },
        threshold: 1024,
      },
      maxPayload: 16 * 1024, // 16KB max message size
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startCleanup();
    
    logger.info('Realtime manager initialized', { port });
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error });
      this.metrics.incrementCounter('websocket_server_errors');
    });
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userAgent = request.headers['user-agent'];
    const ip = this.getClientIP(request);

    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      subscriptions: new Set(),
      metadata: {
        userAgent,
        ip,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
      },
    };

    this.connections.set(connectionId, connection);
    this.updateStats();
    
    logger.info('WebSocket connection established', {
      connectionId,
      ip,
      userAgent,
      totalConnections: this.connections.size,
    });

    this.metrics.incrementCounter('websocket_connections_total');
    this.metrics.setGauge('websocket_active_connections', this.connections.size);

    // Send welcome message
    this.sendMessage(connection, {
      type: 'subscription',
      data: { message: 'Connected to StateSet realtime API', connectionId },
      timestamp: Date.now(),
      id: this.generateMessageId(),
    });

    // Setup message handler
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(connection, data);
    });

    // Setup close handler
    ws.on('close', (code: number, reason: string) => {
      this.handleDisconnection(connectionId, code, reason);
    });

    // Setup error handler
    ws.on('error', (error: Error) => {
      logger.error('WebSocket connection error', {
        connectionId,
        error: error.message,
      });
      this.metrics.incrementCounter('websocket_connection_errors');
    });

    // Setup ping/pong
    ws.on('pong', () => {
      connection.metadata.lastActivity = Date.now();
    });

    this.emit('connectionEstablished', { connectionId, metadata: connection.metadata });
  }

  private handleMessage(connection: WebSocketConnection, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      connection.metadata.lastActivity = Date.now();
      connection.metadata.messageCount++;
      
      this.stats.totalMessagesReceived++;
      this.metrics.incrementCounter('websocket_messages_received');

      logger.debug('WebSocket message received', {
        connectionId: connection.id,
        type: message.type,
      });

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(connection, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(connection, message);
          break;
        case 'heartbeat':
          this.handleHeartbeat(connection, message);
          break;
        default:
          this.sendError(connection, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.warn('Invalid WebSocket message', {
        connectionId: connection.id,
        error: (error as Error).message,
      });
      this.sendError(connection, 'Invalid message format');
      this.metrics.incrementCounter('websocket_invalid_messages');
    }
  }

  private handleSubscribe(connection: WebSocketConnection, message: any): void {
    try {
      const { channel, filter } = message;
      
      if (!channel || typeof channel !== 'string') {
        this.sendError(connection, 'Channel name is required');
        return;
      }

      const sanitizedChannel = validateAndSanitizeInput(SanitizedIdSchema, channel, 'channel');
      const subscriptionId = `${connection.id}:${sanitizedChannel}`;

      // Add to subscriptions
      if (filter) {
        this.subscriptions.set(subscriptionId, filter);
      }

      // Add to channel
      if (!this.channels.has(sanitizedChannel)) {
        this.channels.set(sanitizedChannel, new Set());
      }
      this.channels.get(sanitizedChannel)!.add(connection.id);
      connection.subscriptions.add(sanitizedChannel);

      this.updateStats();
      
      logger.debug('WebSocket subscription added', {
        connectionId: connection.id,
        channel: sanitizedChannel,
        filter,
      });

      this.metrics.incrementCounter('websocket_subscriptions_total');
      this.metrics.setGauge('websocket_active_subscriptions', this.stats.totalSubscriptions);

      // Send confirmation
      this.sendMessage(connection, {
        type: 'subscription',
        channel: sanitizedChannel,
        data: { status: 'subscribed', channel: sanitizedChannel },
        timestamp: Date.now(),
        id: this.generateMessageId(),
      });

      // Send buffered messages for this channel
      this.deliverBufferedMessages(connection.id, sanitizedChannel);

    } catch (error) {
      this.sendError(connection, `Subscription failed: ${(error as Error).message}`);
    }
  }

  private handleUnsubscribe(connection: WebSocketConnection, message: any): void {
    try {
      const { channel } = message;
      
      if (!channel || typeof channel !== 'string') {
        this.sendError(connection, 'Channel name is required');
        return;
      }

      const sanitizedChannel = validateAndSanitizeInput(SanitizedIdSchema, channel, 'channel');
      const subscriptionId = `${connection.id}:${sanitizedChannel}`;

      // Remove from subscriptions
      this.subscriptions.delete(subscriptionId);

      // Remove from channel
      const channelConnections = this.channels.get(sanitizedChannel);
      if (channelConnections) {
        channelConnections.delete(connection.id);
        if (channelConnections.size === 0) {
          this.channels.delete(sanitizedChannel);
        }
      }

      connection.subscriptions.delete(sanitizedChannel);
      this.updateStats();

      logger.debug('WebSocket subscription removed', {
        connectionId: connection.id,
        channel: sanitizedChannel,
      });

      this.metrics.incrementCounter('websocket_unsubscriptions_total');

      // Send confirmation
      this.sendMessage(connection, {
        type: 'subscription',
        channel: sanitizedChannel,
        data: { status: 'unsubscribed', channel: sanitizedChannel },
        timestamp: Date.now(),
        id: this.generateMessageId(),
      });

    } catch (error) {
      this.sendError(connection, `Unsubscription failed: ${(error as Error).message}`);
    }
  }

  private handleHeartbeat(connection: WebSocketConnection, message: any): void {
    // Respond to heartbeat
    this.sendMessage(connection, {
      type: 'heartbeat',
      data: { timestamp: Date.now() },
      timestamp: Date.now(),
      id: this.generateMessageId(),
    });
  }

  private handleDisconnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const duration = Date.now() - connection.metadata.connectedAt;

    logger.info('WebSocket connection closed', {
      connectionId,
      code,
      reason,
      duration,
      messageCount: connection.metadata.messageCount,
    });

    // Remove from channels
    for (const channel of connection.subscriptions) {
      const channelConnections = this.channels.get(channel);
      if (channelConnections) {
        channelConnections.delete(connectionId);
        if (channelConnections.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    // Remove subscriptions
    for (const channel of connection.subscriptions) {
      this.subscriptions.delete(`${connectionId}:${channel}`);
    }

    this.connections.delete(connectionId);
    this.updateStats();

    this.metrics.incrementCounter('websocket_disconnections_total');
    this.metrics.setGauge('websocket_active_connections', this.connections.size);
    this.metrics.recordHistogram('websocket_connection_duration_seconds', duration / 1000);

    this.emit('connectionClosed', { connectionId, code, reason, duration });
  }

  // Public API for broadcasting events
  broadcastEvent(eventData: EventData): void {
    const channel = this.getEventChannel(eventData);
    const message: RealtimeMessage = {
      type: 'event',
      channel,
      data: eventData,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    this.broadcastToChannel(channel, message, eventData);
    
    logger.debug('Event broadcasted', {
      channel,
      eventType: eventData.eventType,
      resourceType: eventData.resourceType,
      resourceId: eventData.resourceId,
    });

    this.metrics.incrementCounter('websocket_events_broadcasted', 1, {
      resourceType: eventData.resourceType,
      eventType: eventData.eventType,
    });
  }

  private broadcastToChannel(
    channel: string, 
    message: RealtimeMessage, 
    eventData?: EventData
  ): void {
    const connectionIds = this.channels.get(channel);
    if (!connectionIds || connectionIds.size === 0) {
      // Buffer message for offline users if it's an important event
      if (eventData && this.shouldBufferEvent(eventData)) {
        this.bufferMessage(channel, message);
      }
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (!connection) continue;

      // Check if message matches subscription filter
      const subscriptionId = `${connectionId}:${channel}`;
      const filter = this.subscriptions.get(subscriptionId);
      
      if (filter && eventData && !this.matchesFilter(eventData, filter)) {
        continue;
      }

      if (this.sendMessage(connection, message)) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    logger.debug('Channel broadcast completed', {
      channel,
      successCount,
      failureCount,
      totalConnections: connectionIds.size,
    });
  }

  private sendMessage(connection: WebSocketConnection, message: RealtimeMessage): boolean {
    try {
      if (connection.ws.readyState !== WebSocket.OPEN) {
        return false;
      }

      const messageStr = JSON.stringify(message);
      connection.ws.send(messageStr);
      
      this.stats.totalMessagesSent++;
      this.metrics.incrementCounter('websocket_messages_sent');
      
      return true;
    } catch (error) {
      logger.warn('Failed to send WebSocket message', {
        connectionId: connection.id,
        error: (error as Error).message,
      });
      this.metrics.incrementCounter('websocket_send_errors');
      return false;
    }
  }

  private sendError(connection: WebSocketConnection, errorMessage: string): void {
    this.sendMessage(connection, {
      type: 'error',
      data: { error: errorMessage },
      timestamp: Date.now(),
      id: this.generateMessageId(),
    });
  }

  private getEventChannel(eventData: EventData): string {
    // Create hierarchical channels for efficient filtering
    return `${eventData.resourceType}:${eventData.resourceId}`;
  }

  private matchesFilter(eventData: EventData, filter: SubscriptionFilter): boolean {
    if (filter.resourceType && filter.resourceType !== eventData.resourceType) {
      return false;
    }
    
    if (filter.resourceId && filter.resourceId !== eventData.resourceId) {
      return false;
    }
    
    if (filter.eventType && filter.eventType !== eventData.eventType) {
      return false;
    }
    
    if (filter.userId && filter.userId !== eventData.userId) {
      return false;
    }
    
    return true;
  }

  private shouldBufferEvent(eventData: EventData): boolean {
    // Buffer important events like order updates, payment status changes
    const importantResources = ['order', 'payment', 'shipment', 'invoice'];
    return importantResources.includes(eventData.resourceType);
  }

  private bufferMessage(channel: string, message: RealtimeMessage): void {
    if (!this.messageBuffer.has(channel)) {
      this.messageBuffer.set(channel, []);
    }
    
    const buffer = this.messageBuffer.get(channel)!;
    buffer.push(message);
    
    // Keep only last 100 messages per channel
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 100);
    }
  }

  private deliverBufferedMessages(connectionId: string, channel: string): void {
    const buffer = this.messageBuffer.get(channel);
    if (!buffer || buffer.length === 0) return;

    const connection = this.connections.get(connectionId);
    if (!connection) return;

    logger.debug('Delivering buffered messages', {
      connectionId,
      channel,
      messageCount: buffer.length,
    });

    for (const message of buffer) {
      this.sendMessage(connection, message);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, 30000); // Every 30 seconds
  }

  private performHeartbeat(): void {
    const now = Date.now();
    let pingCount = 0;

    for (const connection of this.connections.values()) {
      // Check if connection is stale
      const timeSinceActivity = now - connection.metadata.lastActivity;
      
      if (timeSinceActivity > 60000) { // 1 minute without activity
        // Send ping to check if connection is still alive
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
          pingCount++;
        }
      }
    }

    if (pingCount > 0) {
      logger.debug('Heartbeat pings sent', { count: pingCount });
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 300000); // Every 5 minutes
  }

  private performCleanup(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    // Find stale connections
    for (const [connectionId, connection] of this.connections) {
      const timeSinceActivity = now - connection.metadata.lastActivity;
      
      if (timeSinceActivity > 300000 || // 5 minutes without activity
          connection.ws.readyState !== WebSocket.OPEN) {
        staleConnections.push(connectionId);
      }
    }

    // Clean up stale connections
    for (const connectionId of staleConnections) {
      this.handleDisconnection(connectionId, 1000, 'Cleanup: stale connection');
    }

    // Clean up old buffered messages
    for (const [channel, buffer] of this.messageBuffer) {
      const filtered = buffer.filter(msg => (now - msg.timestamp) < 3600000); // Keep last hour
      this.messageBuffer.set(channel, filtered);
    }

    if (staleConnections.length > 0) {
      logger.debug('Cleanup completed', { removedConnections: staleConnections.length });
    }
  }

  private getClientIP(request: IncomingMessage): string {
    return (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           request.connection.remoteAddress ||
           'unknown';
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateStats(): void {
    this.stats.activeConnections = this.connections.size;
    this.stats.totalSubscriptions = Array.from(this.connections.values())
      .reduce((total, conn) => total + conn.subscriptions.size, 0);
    
    // Update channel stats
    this.stats.channels.clear();
    for (const [channel, connectionIds] of this.channels) {
      this.stats.channels.set(channel, connectionIds.size);
    }
  }

  // Public API
  getStats(): RealtimeStats {
    return { ...this.stats };
  }

  getConnectionDetails(): Array<{
    id: string;
    subscriptions: string[];
    metadata: WebSocketConnection['metadata'];
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      subscriptions: Array.from(conn.subscriptions),
      metadata: { ...conn.metadata },
    }));
  }

  getChannelInfo(): Array<{ channel: string; subscribers: number }> {
    return Array.from(this.channels.entries()).map(([channel, connectionIds]) => ({
      channel,
      subscribers: connectionIds.size,
    }));
  }

  // Administrative functions
  disconnectClient(connectionId: string, reason = 'Administrative disconnect'): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.ws.close(1000, reason);
    return true;
  }

  broadcastToAll(message: Omit<RealtimeMessage, 'timestamp' | 'id'>): void {
    const fullMessage: RealtimeMessage = {
      ...message,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    let successCount = 0;
    for (const connection of this.connections.values()) {
      if (this.sendMessage(connection, fullMessage)) {
        successCount++;
      }
    }

    logger.info('Broadcast to all connections', {
      type: message.type,
      successCount,
      totalConnections: this.connections.size,
    });
  }

  destroy(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutdown');
    }

    this.wss.close();
    this.removeAllListeners();
    
    logger.info('Realtime manager destroyed');
  }
}