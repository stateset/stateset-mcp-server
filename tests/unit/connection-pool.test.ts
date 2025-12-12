import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';

// Mock logger to avoid loading real config in tests
jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(),
}));
const mockedAxios = axios as unknown as { create: jest.Mock };

// Import after mocks
import { ConnectionPool } from '../../src/core/connection-pool';

describe('ConnectionPool', () => {
  let pool: ConnectionPool;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    const mockConfig = {
      api: {
        key: 'test-api-key',
        baseUrl: 'https://api.test.com',
        timeout: 5,
      },
      rateLimit: {
        requestsPerHour: 1000,
        retryAttempts: 3,
        retryDelay: 1,
      },
      server: {
        name: 'test-server',
        version: '1.0.0',
      },
    };

    pool = new ConnectionPool(mockConfig as any);
  });

  afterEach(() => {
    pool.destroy();
  });

  it('should execute requests and return data', async () => {
    mockAxiosInstance.request.mockResolvedValueOnce({ data: { success: true }, config: {} });

    const result = await pool.request({ method: 'GET', url: '/test' });

    expect(mockAxiosInstance.request).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('should retry on retryable errors', async () => {
    mockAxiosInstance.request
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: { success: true }, config: {} });

    const result = await pool.request({ method: 'GET', url: '/test' });

    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  });

  it('should not retry on non-retryable errors', async () => {
    mockAxiosInstance.request.mockRejectedValueOnce({ response: { status: 400 } });

    await expect(pool.request({ method: 'GET', url: '/test' })).rejects.toBeDefined();
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
  });
});

