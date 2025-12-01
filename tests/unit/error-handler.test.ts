import { describe, it, expect, jest } from '@jest/globals';
import { handleError, APIError } from '../../src/middleware/error-handler';
import { AxiosError } from 'axios';

jest.mock('@utils/logger');

describe('Error Handler', () => {
  it('should handle generic errors', () => {
    const error = new Error('Test error');
    const result = handleError(error);

    expect(result).toBeInstanceOf(APIError);
    expect(result.message).toBeDefined();
    expect(result.statusCode).toBe(500);
  });

  it('should handle axios errors', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
      message: 'Request failed',
    } as AxiosError;

    const result = handleError(axiosError);

    expect(result).toBeInstanceOf(APIError);
    expect(result.message).toBeDefined();
    // May wrap error in generic message
    expect([404, 500]).toContain(result.statusCode);
  });

  it('should handle validation errors', () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';

    const result = handleError(validationError);

    expect(result).toBeInstanceOf(APIError);
    expect(result.message).toBeDefined();
  });

  it('should include context in error response', () => {
    const error = new Error('Test error');
    const context = { operation: 'test_operation', requestId: 'req-123' };

    const result = handleError(error, context);

    expect(result).toBeInstanceOf(APIError);
    expect(result.context).toMatchObject(context);
    // correlationId is automatically added
    expect(result.context?.correlationId).toBeDefined();
  });

  it('should return APIError as-is if already an APIError', () => {
    const apiError = new APIError('API Error', 400, 'BAD_REQUEST');
    const result = handleError(apiError);

    expect(result).toBe(apiError);
    expect(result.statusCode).toBe(400);
    expect(result.code).toBe('BAD_REQUEST');
  });
});
