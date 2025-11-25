import { OpenAPIToMCPConverter } from '../src/core/openapi-converter';
import { loadOpenAPISpec } from '../src/tools/openapi-tools';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { config } from '../src/config';
import { logger } from '../src/utils/logger';

/**
 * Example of how to integrate OpenAPI specifications with the StateSet MCP server
 */

async function integrateOpenAPISpec() {
  // Check if OpenAPI converter is enabled
  if (!config.features.openApiConverter) {
    logger.info('OpenAPI converter is disabled. Enable it by setting FEATURE_OPEN_API_CONVERTER=true');
    return [];
  }

  try {
    // Load an OpenAPI specification
    // This could be from a URL or local file
    const openApiSpec = await loadOpenAPISpec('./openapi/stateset-api.json');
    
    // Create converter instance
    const converter = new OpenAPIToMCPConverter(openApiSpec);
    
    // Convert to MCP tools
    const { tools, openApiLookup, zip } = converter.convertToMCPTools();
    
    // Extract MCP tools
    const mcpTools: Tool[] = [];
    for (const [apiName, api] of Object.entries(tools)) {
      for (const method of api.methods) {
        const tool: Tool = {
          name: `${apiName}_${method.name}`,
          description: method.description,
          inputSchema: method.inputSchema as any,
        };
        mcpTools.push(tool);
      }
    }
    
    logger.info(`Loaded ${mcpTools.length} tools from OpenAPI spec`);
    
    // You can also convert to OpenAI or Anthropic formats
    const openAITools = converter.convertToOpenAITools();
    const anthropicTools = converter.convertToAnthropicTools();
    
    logger.info(`Converted to ${openAITools.length} OpenAI tools`);
    logger.info(`Converted to ${anthropicTools.length} Anthropic tools`);
    
    return mcpTools;
  } catch (error) {
    logger.error('Failed to load OpenAPI spec', error);
    return [];
  }
}

/**
 * Example of dynamic tool handling for OpenAPI-based tools
 */
async function handleDynamicOpenAPITool(
  toolName: string,
  args: any
): Promise<any> {
  try {
    const openApiSpec = await loadOpenAPISpec('./openapi/stateset-api.json');
    const converter = new OpenAPIToMCPConverter(openApiSpec);
    const { openApiLookup } = converter.convertToMCPTools();
    
    const operation = openApiLookup[toolName];
    if (!operation) {
      throw new Error(`Tool ${toolName} not found in OpenAPI spec`);
    }
    
    // Use the StateSet API base URL from config
    const baseUrl = config.api.baseUrl;
    
    // Build request based on operation
    const { method, path } = operation;
    
    // This is a simplified example - in production, you'd handle
    // path parameters, query parameters, request bodies, etc.
    const axios = (await import('axios')).default;
    
    const response = await axios({
      method: method.toLowerCase() as any,
      url: `${baseUrl}${path}`,
      headers: {
        'Authorization': `Bearer ${config.api.key}`,
        'Content-Type': 'application/json',
      },
      data: args,
    });
    
    return response.data;
  } catch (error) {
    logger.error('Failed to execute dynamic OpenAPI tool', error, { toolName });
    throw error;
  }
}

/**
 * Example: Merge predefined tools with OpenAPI-generated tools
 */
export async function getMergedTools(predefinedTools: Tool[]): Promise<Tool[]> {
  const openApiTools = await integrateOpenAPISpec();
  
  // Merge tools, with predefined tools taking precedence
  const toolMap = new Map<string, Tool>();
  
  // Add OpenAPI tools first
  for (const tool of openApiTools) {
    toolMap.set(tool.name, tool);
  }
  
  // Override with predefined tools
  for (const tool of predefinedTools) {
    toolMap.set(tool.name, tool);
  }
  
  return Array.from(toolMap.values());
}

// Export for use in server
export { integrateOpenAPISpec, handleDynamicOpenAPITool }; 