import { OpenAPIToMCPConverter } from '../../src/core/openapi-converter';
import type { OpenAPIV3 } from 'openapi-types';

describe('OpenAPIToMCPConverter', () => {
  const mockSpec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    paths: {
      '/orders': {
        post: {
          operationId: 'createOrder',
          summary: 'Create a new order',
          description: 'Creates a new order in the system',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customerId: { type: 'string' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          productId: { type: 'string' },
                          quantity: { type: 'number' },
                        },
                        required: ['productId', 'quantity'],
                      },
                    },
                  },
                  required: ['customerId', 'items'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Order created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid request',
            },
          },
        },
        get: {
          operationId: 'listOrders',
          summary: 'List all orders',
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer' },
              required: false,
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer' },
              required: false,
            },
          ],
          responses: {
            '200': {
              description: 'List of orders',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Order',
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/orders/{orderId}': {
        get: {
          operationId: 'getOrder',
          summary: 'Get order by ID',
          parameters: [
            {
              name: 'orderId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Order details',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Order',
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            customerId: { type: 'string' },
            status: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  };

  let converter: OpenAPIToMCPConverter;

  beforeEach(() => {
    converter = new OpenAPIToMCPConverter(mockSpec);
  });

  describe('convertToMCPTools', () => {
    it('should convert OpenAPI operations to MCP tools', () => {
      const { tools, openApiLookup } = converter.convertToMCPTools();

      expect(tools).toHaveProperty('API');
      expect(tools.API.methods).toHaveLength(3);

      const createOrderTool = tools.API.methods.find(m => m.name === 'createOrder');
      expect(createOrderTool).toBeDefined();
      expect(createOrderTool?.description).toContain('Creates a new order');
      expect(createOrderTool?.inputSchema.type).toBe('object');
      expect(createOrderTool?.inputSchema.properties).toHaveProperty('customerId');
      expect(createOrderTool?.inputSchema.properties).toHaveProperty('items');
    });

    it('should include error responses in descriptions', () => {
      const { tools } = converter.convertToMCPTools();
      const createOrderTool = tools.API.methods.find(m => m.name === 'createOrder');
      
      expect(createOrderTool?.description).toContain('Error Responses:');
      expect(createOrderTool?.description).toContain('400: Invalid request');
    });

    it('should handle path parameters correctly', () => {
      const { tools } = converter.convertToMCPTools();
      const getOrderTool = tools.API.methods.find(m => m.name === 'getOrder');
      
      expect(getOrderTool?.inputSchema.properties).toHaveProperty('orderId');
      expect(getOrderTool?.inputSchema.required).toContain('orderId');
    });

    it('should handle query parameters correctly', () => {
      const { tools } = converter.convertToMCPTools();
      const listOrdersTool = tools.API.methods.find(m => m.name === 'listOrders');
      
      expect(listOrdersTool?.inputSchema.properties).toHaveProperty('page');
      expect(listOrdersTool?.inputSchema.properties).toHaveProperty('limit');
      expect(listOrdersTool?.inputSchema.required).toHaveLength(0);
    });

    it('should extract response schemas', () => {
      const { tools } = converter.convertToMCPTools();
      const createOrderTool = tools.API.methods.find(m => m.name === 'createOrder');
      
      expect(createOrderTool?.returnSchema).toBeDefined();
      expect(createOrderTool?.returnSchema?.type).toBe('object');
      expect(createOrderTool?.returnSchema?.properties).toHaveProperty('id');
      expect(createOrderTool?.returnSchema?.properties).toHaveProperty('status');
    });
  });

  describe('convertToOpenAITools', () => {
    it('should convert to OpenAI function calling format', () => {
      const tools = converter.convertToOpenAITools();

      expect(tools).toHaveLength(3);
      
      const createOrderTool = tools.find(t => t.function.name === 'createOrder');
      expect(createOrderTool).toBeDefined();
      expect(createOrderTool?.type).toBe('function');
      expect(createOrderTool?.function.description).toContain('Creates a new order');
      expect(createOrderTool?.function.parameters?.type).toBe('object');
    });
  });

  describe('convertToAnthropicTools', () => {
    it('should convert to Anthropic tool format', () => {
      const tools = converter.convertToAnthropicTools();

      expect(tools).toHaveLength(3);
      
      const createOrderTool = tools.find(t => t.name === 'createOrder');
      expect(createOrderTool).toBeDefined();
      expect(createOrderTool?.description).toContain('Creates a new order');
      expect(createOrderTool?.input_schema.type).toBe('object');
    });
  });

  describe('schema conversion', () => {
    it('should handle $ref references', () => {
      const { tools } = converter.convertToMCPTools();
      const getOrderTool = tools.API.methods.find(m => m.name === 'getOrder');
      
      expect(getOrderTool?.returnSchema?.$defs).toHaveProperty('Order');
      expect(getOrderTool?.returnSchema?.$defs?.Order).toMatchObject({
        type: 'object',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          status: { type: 'string' },
        },
      });
    });

    it('should convert binary format to uri-reference', () => {
      const binarySpec: OpenAPIV3.Document = {
        ...mockSpec,
        paths: {
          '/upload': {
            post: {
              operationId: 'uploadFile',
              requestBody: {
                content: {
                  'multipart/form-data': {
                    schema: {
                      type: 'object',
                      properties: {
                        file: {
                          type: 'string',
                          format: 'binary',
                        },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const binaryConverter = new OpenAPIToMCPConverter(binarySpec);
      const { tools } = binaryConverter.convertToMCPTools();
      const uploadTool = tools.API.methods.find(m => m.name === 'uploadFile');
      
      expect(uploadTool?.inputSchema.properties?.file).toMatchObject({
        type: 'string',
        format: 'uri-reference',
        description: expect.stringContaining('absolute paths to local files'),
      });
    });
  });

  describe('name truncation', () => {
    it('should truncate long operation IDs', () => {
      const longNameSpec: OpenAPIV3.Document = {
        ...mockSpec,
        paths: {
          '/test': {
            post: {
              operationId: 'a'.repeat(100), // 100 character name
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const longNameConverter = new OpenAPIToMCPConverter(longNameSpec);
      const { tools } = longNameConverter.convertToMCPTools();
      const tool = tools.API.methods[0];
      
      expect(tool?.name.length).toBeLessThanOrEqual(64);
      expect(tool?.name).toMatch(/^a+-\d{4}$/);
    });
  });
}); 