import { describe, it, expect, jest } from '@jest/globals';

// Mock all dependencies
jest.mock('../../src/services/mcp-client');
jest.mock('../../src/utils/broadcast');
jest.mock('../../src/core/websocket');
jest.mock('../../src/core/server-rate-limiter');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Import after mocks
import { toolHandlers } from '../../src/tools/registry';

describe('Tool Registry', () => {
  describe('Registry Structure', () => {
    it('should export toolHandlers as a Map', () => {
      expect(toolHandlers).toBeInstanceOf(Map);
    });

    it('should have registered tool handlers', () => {
      expect(toolHandlers.size).toBeGreaterThan(50);
    });
  });

  describe('RMA Operations', () => {
    it('should have RMA tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_rma')).toBe(true);
      expect(toolHandlers.has('stateset_update_rma')).toBe(true);
      expect(toolHandlers.has('stateset_delete_rma')).toBe(true);
      expect(toolHandlers.has('stateset_get_rma')).toBe(true);
      expect(toolHandlers.has('stateset_list_rmas')).toBe(true);
    });
  });

  describe('Order Operations', () => {
    it('should have order tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_order')).toBe(true);
      expect(toolHandlers.has('stateset_update_order')).toBe(true);
      expect(toolHandlers.has('stateset_delete_order')).toBe(true);
      expect(toolHandlers.has('stateset_get_order')).toBe(true);
      expect(toolHandlers.has('stateset_list_orders')).toBe(true);
    });
  });

  describe('Inventory Operations', () => {
    it('should have inventory tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_inventory')).toBe(true);
      expect(toolHandlers.has('stateset_update_inventory')).toBe(true);
      expect(toolHandlers.has('stateset_get_inventory')).toBe(true);
      expect(toolHandlers.has('stateset_list_inventories')).toBe(true);
    });
  });

  describe('Shipment Operations', () => {
    it('should have shipment tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_shipment')).toBe(true);
      expect(toolHandlers.has('stateset_update_shipment')).toBe(true);
      expect(toolHandlers.has('stateset_delete_shipment')).toBe(true);
      expect(toolHandlers.has('stateset_get_shipment')).toBe(true);
      expect(toolHandlers.has('stateset_list_shipments')).toBe(true);
    });
  });

  describe('Customer Operations', () => {
    it('should have customer tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_customer')).toBe(true);
      expect(toolHandlers.has('stateset_update_customer')).toBe(true);
      expect(toolHandlers.has('stateset_delete_customer')).toBe(true);
      expect(toolHandlers.has('stateset_get_customer')).toBe(true);
      expect(toolHandlers.has('stateset_list_customers')).toBe(true);
    });
  });

  describe('Product Operations', () => {
    it('should have product tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_product')).toBe(true);
      expect(toolHandlers.has('stateset_update_product')).toBe(true);
      expect(toolHandlers.has('stateset_delete_product')).toBe(true);
      expect(toolHandlers.has('stateset_get_product')).toBe(true);
      expect(toolHandlers.has('stateset_list_products')).toBe(true);
    });
  });

  describe('Manufacturing Operations', () => {
    it('should have work order tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_work_order')).toBe(true);
      expect(toolHandlers.has('stateset_update_work_order')).toBe(true);
      expect(toolHandlers.has('stateset_get_work_order')).toBe(true);
      expect(toolHandlers.has('stateset_list_work_orders')).toBe(true);
    });

    it('should have bill of materials tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_bill_of_materials')).toBe(true);
      expect(toolHandlers.has('stateset_update_bill_of_materials')).toBe(true);
      expect(toolHandlers.has('stateset_get_bill_of_materials')).toBe(true);
      expect(toolHandlers.has('stateset_list_bill_of_materials')).toBe(true);
    });

    it('should have purchase order tool handlers registered', () => {
      expect(toolHandlers.has('stateset_create_purchase_order')).toBe(true);
      expect(toolHandlers.has('stateset_update_purchase_order')).toBe(true);
      expect(toolHandlers.has('stateset_get_purchase_order')).toBe(true);
      expect(toolHandlers.has('stateset_list_purchase_orders')).toBe(true);
    });
  });

  describe('Admin Operations', () => {
    it('should have admin tool handlers registered', () => {
      expect(toolHandlers.has('stateset_health_check')).toBe(true);
      expect(toolHandlers.has('stateset_get_api_metrics')).toBe(true);
      expect(toolHandlers.has('stateset_cache_stats')).toBe(true);
      expect(toolHandlers.has('stateset_clear_cache')).toBe(true);
    });
  });

  describe('Search Operations', () => {
    it('should have search tool handlers registered', () => {
      expect(toolHandlers.has('stateset_advanced_search')).toBe(true);
      expect(toolHandlers.has('stateset_full_text_search')).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should have batch tool handlers registered', () => {
      expect(toolHandlers.has('stateset_batch_operations')).toBe(true);
      expect(toolHandlers.has('stateset_batch_create_orders')).toBe(true);
    });
  });

  describe('Handler Functions', () => {
    it('should have all handlers as functions', () => {
      toolHandlers.forEach((handler) => {
        expect(typeof handler).toBe('function');
      });
    });
  });
});
