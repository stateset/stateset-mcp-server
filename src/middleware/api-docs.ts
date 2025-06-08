import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';
import { createLogger } from '@utils/logger';

const logger = createLogger('api-docs');

// OpenAPI specification
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'StateSet MCP Server API',
    version: '1.0.0',
    description: 'A world-class Model Context Protocol server for StateSet API integration',
    contact: {
      name: 'StateSet Support',
      email: 'support@stateset.io',
      url: 'https://stateset.io',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.stateset.io',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Metrics',
      description: 'Metrics and monitoring endpoints',
    },
    {
      name: 'Tools',
      description: 'MCP tool operations',
    },
  ],
  paths: {
    '/health/live': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Check if the server is alive',
        responses: {
          '200': {
            description: 'Server is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['ok'],
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Server is not healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Check if the server is ready to accept requests',
        responses: {
          '200': {
            description: 'Server is ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['ok'],
                    },
                    checks: {
                      type: 'object',
                      properties: {
                        api: {
                          type: 'boolean',
                        },
                        cache: {
                          type: 'boolean',
                        },
                        rateLimit: {
                          type: 'boolean',
                        },
                      },
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Server is not ready',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Metrics'],
        summary: 'Get Prometheus metrics',
        description: 'Export metrics in Prometheus format',
        responses: {
          '200': {
            description: 'Metrics exported successfully',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: '# HELP api_requests_total Total number of API requests\n# TYPE api_requests_total counter\napi_requests_total{method="GET",status="200"} 1234',
                },
              },
            },
          },
        },
      },
    },
    '/tools': {
      get: {
        tags: ['Tools'],
        summary: 'List available tools',
        description: 'Get a list of all available MCP tools',
        security: [
          {
            apiKey: [],
          },
        ],
        responses: {
          '200': {
            description: 'Tools listed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tools: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Tool',
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/tools/{toolName}/execute': {
      post: {
        tags: ['Tools'],
        summary: 'Execute a tool',
        description: 'Execute a specific MCP tool with provided arguments',
        security: [
          {
            apiKey: [],
          },
        ],
        parameters: [
          {
            name: 'toolName',
            in: 'path',
            required: true,
            description: 'Name of the tool to execute',
            schema: {
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  arguments: {
                    type: 'object',
                    description: 'Tool-specific arguments',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tool executed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      description: 'Tool execution result',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Tool not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
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
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error type',
          },
          message: {
            type: 'string',
            description: 'Error message',
          },
          code: {
            type: 'string',
            description: 'Error code',
          },
          details: {
            type: 'object',
            description: 'Additional error details',
          },
        },
        required: ['error', 'message'],
      },
      Tool: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Tool name',
          },
          description: {
            type: 'string',
            description: 'Tool description',
          },
          inputSchema: {
            type: 'object',
            description: 'JSON Schema for tool input',
          },
          category: {
            type: 'string',
            description: 'Tool category',
            enum: ['orders', 'inventory', 'customers', 'financial', 'shipping'],
          },
        },
        required: ['name', 'description', 'inputSchema'],
      },
    },
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'StateSet API key',
      },
    },
  },
};

// Create API documentation router
export function createApiDocsRouter(): Router {
  const router = Router();

  // Serve OpenAPI spec
  router.get('/openapi.json', (req, res) => {
    res.json(openApiSpec);
  });

  // Serve Swagger UI
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'StateSet MCP Server API Documentation',
      customfavIcon: '/favicon.ico',
    })
  );

  logger.info('API documentation available at /api-docs');

  return router;
}

// Export the OpenAPI spec for other uses
export { openApiSpec }; 