import { describe, it, expect } from '@jest/globals';
import { tools, resourceTemplates } from '../../src/tools/definitions';

describe('Tool Definitions', () => {
  describe('Tools array', () => {
    it('should export tools as an array', () => {
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should have at least 50 tools defined', () => {
      expect(tools.length).toBeGreaterThan(50);
    });

    it('should have unique tool names', () => {
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    it('should have all tools with name property', () => {
      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(typeof tool.name).toBe('string');
      });
    });

    it('should have all tool names starting with stateset_', () => {
      tools.forEach((tool) => {
        expect(tool.name.startsWith('stateset_')).toBe(true);
      });
    });

    it('should have inputSchema for most tools', () => {
      const toolsWithSchema = tools.filter((t) => t.inputSchema !== undefined);
      expect(toolsWithSchema.length).toBeGreaterThan(50);
    });
  });

  describe('RMA tools', () => {
    it('should have RMA tools', () => {
      const rmaTools = tools.filter((t) => t.name.includes('rma'));
      expect(rmaTools.length).toBeGreaterThanOrEqual(3);

      const rmaToolNames = rmaTools.map((t) => t.name);
      expect(rmaToolNames).toContain('stateset_create_rma');
      expect(rmaToolNames).toContain('stateset_get_rma');
      expect(rmaToolNames).toContain('stateset_list_rmas');
    });
  });

  describe('Order tools', () => {
    it('should have order tools', () => {
      const orderTools = tools.filter(
        (t) =>
          t.name.includes('order') &&
          !t.name.includes('purchase') &&
          !t.name.includes('sales') &&
          !t.name.includes('work') &&
          !t.name.includes('manufacturer') &&
          !t.name.includes('fulfillment')
      );
      expect(orderTools.length).toBeGreaterThanOrEqual(3);

      const orderToolNames = orderTools.map((t) => t.name);
      expect(orderToolNames).toContain('stateset_create_order');
      expect(orderToolNames).toContain('stateset_get_order');
      expect(orderToolNames).toContain('stateset_list_orders');
    });
  });

  describe('Inventory tools', () => {
    it('should have inventory management tools', () => {
      const inventoryTools = tools.filter((t) => t.name.includes('inventory'));
      expect(inventoryTools.length).toBeGreaterThanOrEqual(3);

      const inventoryToolNames = inventoryTools.map((t) => t.name);
      expect(inventoryToolNames).toContain('stateset_create_inventory');
      expect(inventoryToolNames).toContain('stateset_update_inventory');
    });
  });

  describe('Admin tools', () => {
    it('should have health check tool', () => {
      const healthTool = tools.find((t) => t.name === 'stateset_health_check');
      expect(healthTool).toBeDefined();
    });

    it('should have metrics tool', () => {
      const metricsTool = tools.find((t) => t.name === 'stateset_get_api_metrics');
      expect(metricsTool).toBeDefined();
    });

    it('should have cache tools', () => {
      const cacheStatsTool = tools.find((t) => t.name === 'stateset_cache_stats');
      const clearCacheTool = tools.find((t) => t.name === 'stateset_clear_cache');
      expect(cacheStatsTool).toBeDefined();
      expect(clearCacheTool).toBeDefined();
    });
  });

  describe('Search tools', () => {
    it('should have advanced search tool', () => {
      const searchTool = tools.find((t) => t.name === 'stateset_advanced_search');
      expect(searchTool).toBeDefined();
    });

    it('should have full text search tool', () => {
      const searchTool = tools.find((t) => t.name === 'stateset_full_text_search');
      expect(searchTool).toBeDefined();
    });
  });

  describe('Batch tools', () => {
    it('should have batch operation tools', () => {
      const batchTools = tools.filter((t) => t.name.includes('batch'));
      expect(batchTools.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Resource Templates', () => {
  describe('Templates array', () => {
    it('should export resourceTemplates as an array', () => {
      expect(Array.isArray(resourceTemplates)).toBe(true);
    });

    it('should have resource templates defined', () => {
      expect(resourceTemplates.length).toBeGreaterThan(5);
    });

    it('should have all required template properties', () => {
      resourceTemplates.forEach((template) => {
        expect(template).toHaveProperty('uriTemplate');
        expect(template).toHaveProperty('name');
        expect(typeof template.uriTemplate).toBe('string');
        expect(typeof template.name).toBe('string');
      });
    });

    it('should have unique URI templates', () => {
      const uris = resourceTemplates.map((t) => t.uriTemplate);
      const uniqueUris = new Set(uris);
      expect(uris.length).toBe(uniqueUris.size);
    });

    it('should have URI templates following stateset-* pattern', () => {
      resourceTemplates.forEach((template) => {
        expect(template.uriTemplate.startsWith('stateset-')).toBe(true);
      });
    });
  });

  describe('Core resource templates', () => {
    it('should have order resource template', () => {
      const orderTemplate = resourceTemplates.find(
        (t) =>
          t.uriTemplate.includes('order') &&
          !t.uriTemplate.includes('purchase') &&
          !t.uriTemplate.includes('sales') &&
          !t.uriTemplate.includes('work') &&
          !t.uriTemplate.includes('fulfillment')
      );
      expect(orderTemplate).toBeDefined();
    });

    it('should have product resource template', () => {
      const productTemplate = resourceTemplates.find((t) => t.uriTemplate.includes('product'));
      expect(productTemplate).toBeDefined();
    });

    it('should have customer resource template', () => {
      const customerTemplate = resourceTemplates.find((t) => t.uriTemplate.includes('customer'));
      expect(customerTemplate).toBeDefined();
    });
  });
});
