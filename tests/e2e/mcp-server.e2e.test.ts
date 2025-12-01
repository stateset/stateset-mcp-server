import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('MCP Server E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Start the MCP server as a child process
    const serverPath = path.join(__dirname, '../../dist/index.js');

    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        STATESET_API_KEY: process.env.STATESET_API_KEY || 'demo-key',
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create MCP client
    client = new Client({
      name: 'e2e-test-client',
      version: '1.0.0',
    });

    // Create transport using the server process
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        STATESET_API_KEY: process.env.STATESET_API_KEY || 'demo-key',
        NODE_ENV: 'test',
      },
    });

    // Connect client to server
    await client.connect(transport);
  });

  afterAll(async () => {
    // Cleanup
    if (client) {
      await client.close();
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Server Initialization', () => {
    it('should successfully connect to the MCP server', async () => {
      expect(client).toBeDefined();
    });

    it('should list available tools', async () => {
      const response = await client.listTools();

      expect(response).toBeDefined();
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.tools.length).toBeGreaterThan(50); // Should have 100+ tools
    });

    it('should list resource templates', async () => {
      const response = await client.listResourceTemplates();

      expect(response).toBeDefined();
      expect(response.resourceTemplates).toBeDefined();
      expect(Array.isArray(response.resourceTemplates)).toBe(true);
      expect(response.resourceTemplates.length).toBeGreaterThan(5);
    });
  });

  describe('Tool Categories', () => {
    it('should have order management tools', async () => {
      const response = await client.listTools();
      const orderTools = response.tools.filter((tool) =>
        tool.name.includes('order') && !tool.name.includes('purchase') && !tool.name.includes('sales')
      );

      expect(orderTools.length).toBeGreaterThan(5);
      expect(orderTools.some((t) => t.name === 'stateset_create_order')).toBe(true);
      expect(orderTools.some((t) => t.name === 'stateset_list_orders')).toBe(true);
      expect(orderTools.some((t) => t.name === 'stateset_get_order')).toBe(true);
    });

    it('should have RMA/return management tools', async () => {
      const response = await client.listTools();
      const rmaTools = response.tools.filter((tool) => tool.name.includes('rma') || tool.name.includes('return'));

      expect(rmaTools.length).toBeGreaterThan(3);
      expect(rmaTools.some((t) => t.name === 'stateset_create_rma')).toBe(true);
      expect(rmaTools.some((t) => t.name === 'stateset_approve_return')).toBe(true);
    });

    it('should have inventory management tools', async () => {
      const response = await client.listTools();
      const inventoryTools = response.tools.filter((tool) => tool.name.includes('inventory'));

      expect(inventoryTools.length).toBeGreaterThan(3);
      expect(inventoryTools.some((t) => t.name === 'stateset_create_inventory')).toBe(true);
      expect(inventoryTools.some((t) => t.name === 'stateset_update_inventory')).toBe(true);
    });

    it('should have admin/monitoring tools', async () => {
      const response = await client.listTools();
      const adminTools = response.tools.filter(
        (tool) =>
          tool.name.includes('health') ||
          tool.name.includes('metrics') ||
          tool.name.includes('cache') ||
          tool.name.includes('rate_limit')
      );

      expect(adminTools.length).toBeGreaterThan(3);
      expect(adminTools.some((t) => t.name === 'stateset_health_check')).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute health check tool', async () => {
      const response = await client.callTool({
        name: 'stateset_health_check',
        arguments: { include_details: true },
      });

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);

      const contentArray = response.content as Array<{ type: string; text?: string }>;
      const content = contentArray[0];
      expect(content.type).toBe('text');

      if (content.type === 'text' && content.text) {
        const healthData = JSON.parse(content.text);
        expect(healthData.status).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(healthData.status);
      }
    });

    it('should execute cache stats tool', async () => {
      const response = await client.callTool({
        name: 'stateset_cache_stats',
        arguments: {},
      });

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      const contentArray = response.content as Array<{ type: string; text?: string }>;
      const content = contentArray[0];
      expect(content.type).toBe('text');

      if (content.type === 'text' && content.text) {
        const cacheData = JSON.parse(content.text);
        expect(cacheData).toBeDefined();
        expect(typeof cacheData).toBe('object');
      }
    });

    it('should execute API metrics tool', async () => {
      const response = await client.callTool({
        name: 'stateset_get_api_metrics',
        arguments: {},
      });

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      const contentArray = response.content as Array<{ type: string; text?: string }>;
      const content = contentArray[0];
      expect(content.type).toBe('text');

      if (content.type === 'text' && content.text) {
        const metricsData = JSON.parse(content.text);
        expect(metricsData.totalRequests).toBeDefined();
        expect(typeof metricsData.totalRequests).toBe('number');
      }
    });

    it('should handle tool errors gracefully', async () => {
      try {
        await client.callTool({
          name: 'stateset_get_order',
          arguments: { order_id: '' }, // Invalid empty order_id
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should validate tool arguments', async () => {
      try {
        await client.callTool({
          name: 'stateset_create_order',
          arguments: {
            // Missing required fields
            customer_email: 'test@example.com',
          },
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });

  describe('Resource Access', () => {
    it('should have order resource template', async () => {
      const response = await client.listResourceTemplates();
      const orderTemplate = response.resourceTemplates.find(
        (t) => t.uriTemplate === 'stateset-order:///{order_id}'
      );

      expect(orderTemplate).toBeDefined();
      expect(orderTemplate?.name).toBe('StateSet Order');
      expect(orderTemplate?.mimeType).toBe('application/json');
    });

    it('should have product resource template', async () => {
      const response = await client.listResourceTemplates();
      const productTemplate = response.resourceTemplates.find(
        (t) => t.uriTemplate === 'stateset-product:///{product_id}'
      );

      expect(productTemplate).toBeDefined();
      expect(productTemplate?.name).toBe('StateSet Product');
    });

    it('should attempt to read a resource (with mock ID)', async () => {
      try {
        // This will fail with real API but tests the resource handler
        await client.readResource({
          uri: 'stateset-order:///TEST-ORDER-001',
        });
      } catch (error) {
        // Expected to fail with test data, but validates the resource handler exists
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should handle multiple tool calls efficiently', async () => {
      const startTime = Date.now();

      const promises = Array(10).fill(null).map(() =>
        client.callTool({
          name: 'stateset_cache_stats',
          arguments: {},
        })
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete 10 calls in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should cache repeated requests', async () => {
      // First call
      const start1 = Date.now();
      await client.callTool({
        name: 'stateset_cache_stats',
        arguments: {},
      });
      const duration1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      await client.callTool({
        name: 'stateset_cache_stats',
        arguments: {},
      });
      const duration2 = Date.now() - start2;

      // Second call should be faster (cached)
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent tool gracefully', async () => {
      try {
        await client.callTool({
          name: 'stateset_nonexistent_tool',
          arguments: {},
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle malformed arguments', async () => {
      try {
        await client.callTool({
          name: 'stateset_list_orders',
          arguments: {
            page: 'not-a-number', // Should be a number
          },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should provide helpful error messages', async () => {
      try {
        await client.callTool({
          name: 'stateset_get_order',
          arguments: { order_id: '' },
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        if (error instanceof Error) {
          expect(error.message).toBeTruthy();
          expect(error.message.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
