import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { config } from '../config';
import type { IncomingMessage } from 'http';

const logger = createLogger('websocket');

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'update' | 'error';
  channel?: string;
  data?: any;
  error?: string;
}

export interface WebSocketSubscription {
  id: string;
  channels: Set<string>;
  ws: WebSocket;
}

export class WebSocketManager extends EventEmitter {
  private static instance: WebSocketManager;
  private wss?: WebSocketServer;
  private subscriptions: Map<string, WebSocketSubscription> = new Map();
  private channels: Map<string, Set<string>> = new Map(); // channel -> subscription IDs

  private constructor() {
    super();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Start the WebSocket server
   */
  start(port: number = 8080): void {
    if (!config.features.websocket) {
      logger.info('WebSocket support is disabled');
      return;
    }

    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const subscriptionId = this.generateSubscriptionId();
      logger.info('New WebSocket connection', { subscriptionId, ip: req.socket.remoteAddress });

      const subscription: WebSocketSubscription = {
        id: subscriptionId,
        channels: new Set(),
        ws,
      };

      this.subscriptions.set(subscriptionId, subscription);

      // Handle messages
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(subscriptionId, message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        logger.info('WebSocket connection closed', { subscriptionId });
        this.removeSubscription(subscriptionId);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        logger.error('WebSocket error', error, { subscriptionId });
      });

      // Send welcome message
      this.send(ws, {
        type: 'update',
        data: { message: 'Connected to StateSet real-time updates', subscriptionId },
      });
    });

    logger.info(`WebSocket server started on port ${port}`);
  }

  /**
   * Stop the WebSocket server
   */
  stop(): void {
    if (this.wss) {
      // Close all connections
      this.subscriptions.forEach((subscription) => {
        subscription.ws.close();
      });

      this.wss.close(() => {
        logger.info('WebSocket server stopped');
      });
    }
  }

  /**
   * Broadcast an update to all subscribers of a channel
   */
  broadcast(channel: string, data: any): void {
    const subscriptionIds = this.channels.get(channel) || new Set();

    subscriptionIds.forEach((subscriptionId) => {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription && subscription.ws.readyState === WebSocket.OPEN) {
        this.send(subscription.ws, {
          type: 'update',
          channel,
          data,
        });
      }
    });

    logger.debug('Broadcasted update', { channel, subscriberCount: subscriptionIds.size });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(subscriptionId: string, message: WebSocketMessage): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          this.subscribe(subscriptionId, message.channel);
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          this.unsubscribe(subscriptionId, message.channel);
        }
        break;

      default:
        this.sendError(subscription.ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Subscribe to a channel
   */
  private subscribe(subscriptionId: string, channel: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Add to subscription's channels
    subscription.channels.add(channel);

    // Add to channel's subscriptions
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(subscriptionId);

    // Send confirmation
    this.send(subscription.ws, {
      type: 'update',
      data: { action: 'subscribed', channel },
    });

    logger.debug('Client subscribed to channel', { subscriptionId, channel });
  }

  /**
   * Unsubscribe from a channel
   */
  private unsubscribe(subscriptionId: string, channel: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove from subscription's channels
    subscription.channels.delete(channel);

    // Remove from channel's subscriptions
    const channelSubs = this.channels.get(channel);
    if (channelSubs) {
      channelSubs.delete(subscriptionId);
      if (channelSubs.size === 0) {
        this.channels.delete(channel);
      }
    }

    // Send confirmation
    this.send(subscription.ws, {
      type: 'update',
      data: { action: 'unsubscribed', channel },
    });

    logger.debug('Client unsubscribed from channel', { subscriptionId, channel });
  }

  /**
   * Remove a subscription (on disconnect)
   */
  private removeSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove from all channels
    subscription.channels.forEach((channel) => {
      const channelSubs = this.channels.get(channel);
      if (channelSubs) {
        channelSubs.delete(subscriptionId);
        if (channelSubs.size === 0) {
          this.channels.delete(channel);
        }
      }
    });

    // Remove subscription
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Send a message to a WebSocket
   */
  private send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send an error message
   */
  private sendError(ws: WebSocket, error: string): void {
    this.send(ws, {
      type: 'error',
      error,
    });
  }

  /**
   * Generate a unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics about WebSocket connections
   */
  getStats(): {
    connections: number;
    channels: number;
    subscriptions: { [channel: string]: number };
  } {
    const subscriptions: { [channel: string]: number } = {};
    this.channels.forEach((subs, channel) => {
      subscriptions[channel] = subs.size;
    });

    return {
      connections: this.subscriptions.size,
      channels: this.channels.size,
      subscriptions,
    };
  }
}

// Export singleton instance
export const wsManager = WebSocketManager.getInstance();
