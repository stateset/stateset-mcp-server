import { OpenAPIToMCPConverter } from '../core/openapi-converter';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../utils/logger';
import axios from 'axios';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

const logger = createLogger('openapi-tools');

/**
 * Load an OpenAPI specification from a URL or file path
 */
export async function loadOpenAPISpec(source: string): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
  try {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Load from URL
      const response = await axios.get(source);
      return response.data;
    } else {
      // Load from file
      const fs = await import('fs/promises');
      const content = await fs.readFile(source, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    logger.error('Failed to load OpenAPI spec', error, { source });
    throw new Error(`Failed to load OpenAPI spec from ${source}`);
  }
}

/**
 * Convert an OpenAPI spec to MCP tools
 */
export function convertOpenAPIToMCPTools(spec: OpenAPIV3.Document | OpenAPIV3_1.Document): Tool[] {
  const converter = new OpenAPIToMCPConverter(spec);
  const { tools } = converter.convertToMCPTools();
  
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
  
  return mcpTools;
}

/**
 * Dynamic tool handler for OpenAPI-based tools
 */
export async function handleOpenAPITool(
  toolName: string,
  args: any,
  spec: OpenAPIV3.Document | OpenAPIV3_1.Document,
  baseUrl?: string
): Promise<any> {
  const converter = new OpenAPIToMCPConverter(spec);
  const { openApiLookup } = converter.convertToMCPTools();
  
  const operation = openApiLookup[toolName];
  if (!operation) {
    throw new Error(`Tool ${toolName} not found in OpenAPI spec`);
  }
  
  // Build the request
  const url = (baseUrl || spec.servers?.[0]?.url || '') + operation.path;
  const method = operation.method.toLowerCase();
  
  // Separate path, query, and body parameters
  const pathParams: Record<string, any> = {};
  const queryParams: Record<string, any> = {};
  let body: any = undefined;
  
  if (operation.parameters) {
    for (const param of operation.parameters) {
      const resolvedParam = resolveParameter(param, spec);
      if (!resolvedParam) continue;
      
      const value = args[resolvedParam.name];
      if (value === undefined && resolvedParam.required) {
        throw new Error(`Required parameter ${resolvedParam.name} not provided`);
      }
      
      if (value !== undefined) {
        switch (resolvedParam.in) {
          case 'path':
            pathParams[resolvedParam.name] = value;
            break;
          case 'query':
            queryParams[resolvedParam.name] = value;
            break;
          case 'header':
            // Handle headers separately if needed
            break;
        }
      }
    }
  }
  
  // Handle request body
  if (operation.requestBody) {
    const resolvedBody = resolveRequestBody(operation.requestBody, spec);
    if (resolvedBody?.content?.['application/json']) {
      // Extract body parameters from args
      body = {};
      for (const [key, value] of Object.entries(args)) {
        if (!pathParams[key] && !queryParams[key]) {
          body[key] = value;
        }
      }
    }
  }
  
  // Replace path parameters
  let finalUrl = url;
  for (const [param, value] of Object.entries(pathParams)) {
    finalUrl = finalUrl.replace(`{${param}}`, encodeURIComponent(String(value)));
  }
  
  // Make the request
  try {
    const response = await axios({
      method,
      url: finalUrl,
      params: queryParams,
      data: body,
    });
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('OpenAPI tool request failed', error, {
        toolName,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(`API request failed: ${error.response?.status} ${error.response?.statusText}`);
    }
    throw error;
  }
}

// Helper functions
function resolveParameter(
  param: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject,
  spec: OpenAPIV3.Document | OpenAPIV3_1.Document
): OpenAPIV3.ParameterObject | null {
  if ('$ref' in param) {
    const resolved = resolveRef(param.$ref, spec);
    return resolved as OpenAPIV3.ParameterObject;
  }
  return param;
}

function resolveRequestBody(
  body: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject,
  spec: OpenAPIV3.Document | OpenAPIV3_1.Document
): OpenAPIV3.RequestBodyObject | null {
  if ('$ref' in body) {
    const resolved = resolveRef(body.$ref, spec);
    return resolved as OpenAPIV3.RequestBodyObject;
  }
  return body;
}

function resolveRef(ref: string, spec: OpenAPIV3.Document | OpenAPIV3_1.Document): any {
  if (!ref.startsWith('#/')) return null;
  
  const parts = ref.replace(/^#\//, '').split('/');
  let current: any = spec;
  for (const part of parts) {
    current = current[part];
    if (!current) return null;
  }
  return current;
}

/**
 * Example: Load StateSet's OpenAPI spec and convert to tools
 */
export async function loadStateSetOpenAPITools(): Promise<Tool[]> {
  try {
    // This is an example - replace with actual StateSet OpenAPI URL
    const spec = await loadOpenAPISpec('https://api.stateset.com/openapi.json');
    return convertOpenAPIToMCPTools(spec);
  } catch (error) {
    logger.warn('Could not load StateSet OpenAPI spec, using predefined tools', error);
    return [];
  }
} 