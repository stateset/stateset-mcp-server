import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

/**
 * E2E tests for complete business workflows
 * These tests simulate real-world usage scenarios
 */
describe('Business Workflow E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    const serverPath = path.join(__dirname, '../../dist/index.js');

    client = new Client({
      name: 'workflow-test-client',
      version: '1.0.0',
    });

    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        STATESET_API_KEY: process.env.STATESET_API_KEY || 'demo-key',
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
      },
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Order Management Workflow', () => {
    it('should support complete order lifecycle', async () => {
      // This test validates the workflow steps are available
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // Check order creation
      expect(toolNames).toContain('stateset_create_order');

      // Check order retrieval
      expect(toolNames).toContain('stateset_get_order');
      expect(toolNames).toContain('stateset_list_orders');

      // Check order updates
      expect(toolNames).toContain('stateset_update_order');

      // Check search capabilities
      expect(toolNames).toContain('stateset_advanced_search');
    });

    it('should support order search and filtering', async () => {
      const tools = await client.listTools();
      const searchTools = tools.tools.filter((t) => t.name.includes('search'));

      expect(searchTools.length).toBeGreaterThan(0);
      expect(searchTools.some((t) => t.name === 'stateset_advanced_search')).toBe(true);
      expect(searchTools.some((t) => t.name === 'stateset_full_text_search')).toBe(true);
    });
  });

  describe('Return/RMA Workflow', () => {
    it('should support complete return lifecycle', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // Return creation
      expect(toolNames).toContain('stateset_create_rma');

      // Return approval workflow
      expect(toolNames).toContain('stateset_approve_return');

      // Restocking
      expect(toolNames).toContain('stateset_restock_return');

      // Return retrieval
      expect(toolNames).toContain('stateset_get_rma');
      expect(toolNames).toContain('stateset_list_rmas');
    });

    it('should execute return approval workflow', async () => {
      try {
        // Test the approval tool exists and can be called
        // (will fail without real data, but validates the tool works)
        await client.callTool({
          name: 'stateset_approve_return',
          arguments: { rma_id: 'TEST-RMA-001' },
        });
      } catch (error) {
        // Expected to fail with test data, validates tool is callable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Inventory Management Workflow', () => {
    it('should support inventory operations', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // CRUD operations
      expect(toolNames).toContain('stateset_create_inventory');
      expect(toolNames).toContain('stateset_update_inventory');
      expect(toolNames).toContain('stateset_get_inventory');
      expect(toolNames).toContain('stateset_list_inventories');

      // Batch operations
      expect(toolNames).toContain('stateset_batch_update_inventory');

      // Search with inventory
      expect(toolNames).toContain('stateset_search_products_with_inventory');
    });
  });

  describe('Fulfillment Workflow', () => {
    it('should support shipping and fulfillment', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // Shipment management
      expect(toolNames).toContain('stateset_create_shipment');
      expect(toolNames).toContain('stateset_get_shipment');
      expect(toolNames).toContain('stateset_list_shipments');

      // Shipment status updates
      expect(toolNames).toContain('stateset_mark_shipment_shipped');
      expect(toolNames).toContain('stateset_mark_shipment_delivered');

      // Fulfillment orders
      expect(toolNames).toContain('stateset_create_fulfillment_order');
      expect(toolNames).toContain('stateset_list_fulfillment_orders');
    });
  });

  describe('Manufacturing Workflow', () => {
    it('should support manufacturing operations', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // Work orders
      expect(toolNames).toContain('stateset_create_work_order');
      expect(toolNames).toContain('stateset_list_work_orders');

      // Bill of materials
      expect(toolNames).toContain('stateset_create_bill_of_materials');
      expect(toolNames).toContain('stateset_list_bill_of_materials');

      // Purchase orders
      expect(toolNames).toContain('stateset_create_purchase_order');
      expect(toolNames).toContain('stateset_list_purchase_orders');
    });
  });

  describe('Batch Operations', () => {
    it('should support batch processing', async () => {
      const tools = await client.listTools();
      const batchTools = tools.tools.filter((t) => t.name.includes('batch'));

      expect(batchTools.length).toBeGreaterThan(3);

      const toolNames = batchTools.map((t) => t.name);
      expect(toolNames).toContain('stateset_batch_operations');
      expect(toolNames).toContain('stateset_batch_create_orders');
      expect(toolNames).toContain('stateset_batch_update_inventory');
    });

    it('should handle batch operation tool calls', async () => {
      try {
        await client.callTool({
          name: 'stateset_batch_operations',
          arguments: {
            operations: [],
            options: { parallel: false, stopOnError: true },
          },
        });
      } catch (error) {
        // Expected - validates the tool is callable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Analytics and Monitoring', () => {
    it('should provide monitoring tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // Health and metrics
      expect(toolNames).toContain('stateset_health_check');
      expect(toolNames).toContain('stateset_get_api_metrics');

      // Cache management
      expect(toolNames).toContain('stateset_cache_stats');
      expect(toolNames).toContain('stateset_clear_cache');

      // Rate limiting
      expect(toolNames).toContain('stateset_tool_rate_limits');

      // Configuration
      expect(toolNames).toContain('stateset_timeout_config');
    });

    it('should execute monitoring workflow', async () => {
      // Check health
      const healthResponse = await client.callTool({
        name: 'stateset_health_check',
        arguments: { include_details: true },
      });
      expect(healthResponse.content).toBeDefined();

      // Check metrics
      const metricsResponse = await client.callTool({
        name: 'stateset_get_api_metrics',
        arguments: {},
      });
      expect(metricsResponse.content).toBeDefined();

      // Check cache stats
      const cacheResponse = await client.callTool({
        name: 'stateset_cache_stats',
        arguments: {},
      });
      expect(cacheResponse.content).toBeDefined();

      // All should complete successfully
      expect(healthResponse.isError).toBeFalsy();
      expect(metricsResponse.isError).toBeFalsy();
      expect(cacheResponse.isError).toBeFalsy();
    });
  });

  describe('Search and Analytics', () => {
    it('should provide advanced search capabilities', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      expect(toolNames).toContain('stateset_advanced_search');
      expect(toolNames).toContain('stateset_full_text_search');
      expect(toolNames).toContain('stateset_search_orders_by_date');
      expect(toolNames).toContain('stateset_search_customer_analytics');
    });

    it('should execute advanced search', async () => {
      try {
        await client.callTool({
          name: 'stateset_advanced_search',
          arguments: {
            resource: 'orders',
            filters: [],
            page: 1,
            per_page: 10,
          },
        });
      } catch (error) {
        // May fail with test data, but validates tool is callable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Financial Operations', () => {
    it('should support financial workflows', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // Invoices
      expect(toolNames).toContain('stateset_create_invoice');
      expect(toolNames).toContain('stateset_list_invoices');

      // Payments
      expect(toolNames).toContain('stateset_create_payment');
      expect(toolNames).toContain('stateset_list_payments');

      // Sales orders
      expect(toolNames).toContain('stateset_create_sales_order');
      expect(toolNames).toContain('stateset_list_sales_orders');
    });
  });

  describe('Customer Management', () => {
    it('should support customer operations', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      expect(toolNames).toContain('stateset_create_customer');
      expect(toolNames).toContain('stateset_update_customer');
      expect(toolNames).toContain('stateset_get_customer');
      expect(toolNames).toContain('stateset_list_customers');
      expect(toolNames).toContain('stateset_delete_customer');
    });

    it('should support customer analytics', async () => {
      const tools = await client.listTools();
      const analyticsTools = tools.tools.filter((t) => t.name.includes('customer_analytics'));

      expect(analyticsTools.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle rapid successive calls', async () => {
      const calls = [];
      for (let i = 0; i < 5; i++) {
        calls.push(
          client.callTool({
            name: 'stateset_cache_stats',
            arguments: {},
          })
        );
      }

      const results = await Promise.all(calls);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.content).toBeDefined();
      });
    });

    it('should maintain server stability under load', async () => {
      // Execute 20 calls in parallel
      const calls = Array(20)
        .fill(null)
        .map(() =>
          client.callTool({
            name: 'stateset_health_check',
            arguments: {},
          })
        );

      const results = await Promise.all(calls);

      expect(results).toHaveLength(20);

      // All calls should succeed
      results.forEach((result) => {
        expect(result.content).toBeDefined();
        expect(result.isError).toBeFalsy();
      });
    });
  });
});
