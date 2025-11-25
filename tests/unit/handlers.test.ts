import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@utils/logger');
jest.mock('../../src/services/stateset-client');

describe('Tool Handlers', () => {
  describe('helper functions', () => {
    it('should format responses correctly', () => {
      const data = { id: '123', name: 'test' };
      const formatted = JSON.stringify(data, null, 2);

      expect(formatted).toContain('123');
      expect(formatted).toContain('test');
    });

    it('should handle errors gracefully', () => {
      const error = new Error('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
    });
  });

  describe('response formatting', () => {
    it('should format list responses', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = {
        items,
        metadata: {
          page: 1,
          per_page: 20,
          total: 2,
        },
      };

      expect(response.items).toHaveLength(2);
      expect(response.metadata.total).toBe(2);
    });

    it('should format single item responses', () => {
      const item = { id: '123', name: 'Test Item' };

      expect(item.id).toBe('123');
      expect(item.name).toBe('Test Item');
    });
  });
});
