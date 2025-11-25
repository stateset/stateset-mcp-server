# OpenAPI to MCP Converter

The StateSet MCP Server includes a powerful OpenAPI to MCP converter that allows you to dynamically generate MCP tools from any OpenAPI 3.0 specification. This feature enables seamless integration with APIs that provide OpenAPI documentation.

## Features

- **Dynamic Tool Generation**: Automatically convert OpenAPI operations to MCP tools
- **Multi-Format Support**: Convert to MCP, OpenAI, or Anthropic tool formats
- **Schema Conversion**: Automatic conversion of OpenAPI schemas to JSON Schema
- **Binary File Support**: Handle file uploads through multipart/form-data
- **Response Type Extraction**: Capture response schemas for type safety
- **Error Response Documentation**: Include error responses in tool descriptions

## Installation

The OpenAPI converter is included in the StateSet MCP Server. Ensure you have the required dependencies:

```bash
npm install openapi-types json-schema @anthropic-ai/sdk openai
```

## Configuration

Enable the OpenAPI converter by setting the environment variable:

```bash
FEATURE_OPEN_API_CONVERTER=true
```

## Usage

### Basic Example

```typescript
import { OpenAPIToMCPConverter } from '@core/openapi-converter';
import { loadOpenAPISpec } from '@tools/openapi-tools';

// Load an OpenAPI specification
const spec = await loadOpenAPISpec('https://api.example.com/openapi.json');

// Create converter instance
const converter = new OpenAPIToMCPConverter(spec);

// Convert to MCP tools
const { tools, openApiLookup, zip } = converter.convertToMCPTools();

// Extract individual tools
for (const [apiName, api] of Object.entries(tools)) {
  for (const method of api.methods) {
    console.log(`Tool: ${method.name}`);
    console.log(`Description: ${method.description}`);
    console.log(`Input Schema:`, method.inputSchema);
  }
}
```

### Loading OpenAPI Specifications

The `loadOpenAPISpec` function supports both URLs and local files:

```typescript
// From URL
const specFromUrl = await loadOpenAPISpec('https://api.stateset.com/openapi.json');

// From local file
const specFromFile = await loadOpenAPISpec('./openapi/api-spec.json');
```

### Converting to Different Formats

The converter supports multiple output formats:

```typescript
const converter = new OpenAPIToMCPConverter(spec);

// Convert to MCP tools
const mcpResult = converter.convertToMCPTools();

// Convert to OpenAI function calling format
const openAITools = converter.convertToOpenAITools();

// Convert to Anthropic tool format
const anthropicTools = converter.convertToAnthropicTools();
```

### Dynamic Tool Execution

Execute OpenAPI-based tools dynamically:

```typescript
import { handleOpenAPITool } from '@tools/openapi-tools';

const result = await handleOpenAPITool(
  'API_createOrder',
  {
    customer_email: 'customer@example.com',
    items: [{ item_id: 'PROD-123', quantity: 2 }]
  },
  spec,
  'https://api.example.com'
);
```

### Integration with StateSet MCP Server

The converter can be integrated with the existing StateSet MCP Server:

```typescript
import { getMergedTools } from '../examples/openapi-integration';
import { tools as predefinedTools } from '@tools/definitions';

// Merge predefined tools with OpenAPI-generated tools
const allTools = await getMergedTools(predefinedTools);

// Register tools with MCP server
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools
}));
```

## Schema Conversion

The converter handles complex OpenAPI schemas:

### Object Schemas
```yaml
# OpenAPI Schema
components:
  schemas:
    Order:
      type: object
      properties:
        id:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
      required: [id, items]
```

Converts to:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "items": {
      "type": "array",
      "items": { "$ref": "#/$defs/OrderItem" }
    }
  },
  "required": ["id", "items"],
  "$defs": {
    "OrderItem": { ... }
  }
}
```

### File Uploads
Binary file uploads are automatically converted:

```yaml
# OpenAPI Schema
requestBody:
  content:
    multipart/form-data:
      schema:
        type: object
        properties:
          file:
            type: string
            format: binary
```

Converts to:
```json
{
  "type": "object",
  "properties": {
    "file": {
      "type": "string",
      "format": "uri-reference",
      "description": "absolute paths to local files"
    }
  }
}
```

## Advanced Features

### Custom Descriptions

The converter adds a prefix to all descriptions for easy identification:

```typescript
private getDescription(description: string): string {
  return "Notion | " + description;
}
```

### Name Truncation

Long operation IDs are automatically truncated to fit MCP's 64-character limit:

```typescript
private ensureUniqueName(name: string): string {
  if (name.length <= 64) {
    return name;
  }
  const truncatedName = name.slice(0, 59);
  const uniqueSuffix = this.generateUniqueSuffix();
  return `${truncatedName}-${uniqueSuffix}`;
}
```

### Error Response Documentation

Error responses are automatically included in tool descriptions:

```
Description: Create a new order
Error Responses:
400: Bad Request - Invalid input data
401: Unauthorized - Missing or invalid API key
500: Internal Server Error
```

## Best Practices

1. **Cache Specifications**: Load and parse OpenAPI specs once and reuse the converter instance
2. **Validate Schemas**: Ensure your OpenAPI spec is valid before conversion
3. **Handle Authentication**: Add proper authentication headers when executing tools
4. **Monitor Performance**: Large OpenAPI specs may take time to convert
5. **Test Generated Tools**: Verify that generated tools work correctly with your API

## Troubleshooting

### Common Issues

1. **Missing Operation IDs**: All operations must have an `operationId` for conversion
2. **Circular References**: The converter handles circular `$ref` references gracefully
3. **Unsupported Formats**: Some OpenAPI-specific formats may need manual handling

### Debug Logging

Enable debug logging to troubleshoot conversion issues:

```bash
LOG_LEVEL=debug npm start
```

## Example: StateSet API Integration

Here's a complete example of integrating StateSet's OpenAPI spec:

```typescript
import { OpenAPIToMCPConverter } from '@core/openapi-converter';
import { loadOpenAPISpec } from '@tools/openapi-tools';
import { config } from '@config/index';

async function setupStateSetTools() {
  // Load StateSet's OpenAPI spec
  const spec = await loadOpenAPISpec(`${config.api.baseUrl}/openapi.json`);
  
  // Convert to MCP tools
  const converter = new OpenAPIToMCPConverter(spec);
  const { tools } = converter.convertToMCPTools();
  
  // Register tool handlers
  for (const [apiName, api] of Object.entries(tools)) {
    for (const method of api.methods) {
      const toolName = `${apiName}_${method.name}`;
      
      // Register handler
      registerToolHandler(toolName, async (args) => {
        return handleOpenAPITool(toolName, args, spec, config.api.baseUrl);
      });
    }
  }
  
  console.log(`Registered ${Object.values(tools).flatMap(t => t.methods).length} tools from OpenAPI spec`);
}
```

## Limitations

- Only supports OpenAPI 3.0 and 3.1 specifications
- Binary file downloads are not directly supported (return as base64)
- WebSocket operations are not supported
- Callbacks and links are not converted

## Future Enhancements

- Support for OpenAPI 2.0 (Swagger) specifications
- Automatic retry and error handling based on OpenAPI definitions
- Response validation against schemas
- Mock data generation for testing
- GraphQL schema conversion 