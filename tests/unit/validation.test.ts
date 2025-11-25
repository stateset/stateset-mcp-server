import {
  sanitizeString,
  sanitizeEmail,
  sanitizeId,
  sanitizeUrl,
  validateContentLength,
  validateNoSqlInjection,
  SanitizedStringSchema,
  SanitizedEmailSchema,
  SanitizedIdSchema,
  PaginationSchema,
} from '../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>hello')).toBe('hello');
    });

    it('should remove dangerous attributes', () => {
      expect(sanitizeString('<div onclick="evil()">text</div>')).toBe('text');
    });

    it('should throw for non-string input', () => {
      expect(() => sanitizeString(123 as any)).toThrow('Input must be a string');
    });
  });

  describe('sanitizeEmail', () => {
    it('should lowercase email', () => {
      expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com');
    });

    it('should validate email format', () => {
      expect(() => sanitizeEmail('invalid-email')).toThrow('Invalid email format');
    });

    it('should accept valid emails', () => {
      expect(sanitizeEmail('user@domain.com')).toBe('user@domain.com');
    });
  });

  describe('sanitizeId', () => {
    it('should allow alphanumeric characters', () => {
      expect(sanitizeId('ABC123')).toBe('ABC123');
    });

    it('should allow hyphens and underscores', () => {
      expect(sanitizeId('id-123_test')).toBe('id-123_test');
    });

    it('should reject special characters', () => {
      expect(() => sanitizeId('id@#$')).toThrow('Invalid ID format');
    });

    it('should reject IDs over 100 characters', () => {
      const longId = 'a'.repeat(101);
      expect(() => sanitizeId(longId)).toThrow('ID too long');
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid HTTP URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    });

    it('should accept valid HTTPS URLs', () => {
      expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
    });

    it('should reject non-HTTP protocols', () => {
      expect(() => sanitizeUrl('javascript:alert(1)')).toThrow('Invalid URL protocol');
    });

    it('should reject invalid URLs', () => {
      expect(() => sanitizeUrl('not-a-url')).toThrow('Invalid URL format');
    });
  });

  describe('validateContentLength', () => {
    it('should accept content within limit', () => {
      expect(() => validateContentLength('short content', 100)).not.toThrow();
    });

    it('should reject content exceeding limit', () => {
      const longContent = 'a'.repeat(101);
      expect(() => validateContentLength(longContent, 100)).toThrow('Content too long');
    });

    it('should use default limit of 10000', () => {
      const content = 'a'.repeat(9999);
      expect(() => validateContentLength(content)).not.toThrow();
    });
  });

  describe('validateNoSqlInjection', () => {
    it('should accept normal text', () => {
      expect(() => validateNoSqlInjection('normal text content')).not.toThrow();
    });

    it('should detect SELECT statements', () => {
      expect(() => validateNoSqlInjection('SELECT * FROM users')).toThrow('Potentially malicious');
    });

    it('should detect DROP statements', () => {
      expect(() => validateNoSqlInjection('DROP TABLE users')).toThrow('Potentially malicious');
    });

    it('should detect comment patterns', () => {
      expect(() => validateNoSqlInjection('value -- comment')).toThrow('Potentially malicious');
    });

    it('should detect OR injection patterns', () => {
      expect(() => validateNoSqlInjection("' OR 1=1")).toThrow('Potentially malicious');
    });
  });

  describe('Zod Schemas', () => {
    describe('SanitizedStringSchema', () => {
      it('should transform and validate strings', () => {
        const result = SanitizedStringSchema.parse('  <b>test</b>  ');
        expect(result).toBe('test');
      });

      it('should reject empty strings after sanitization', () => {
        expect(() => SanitizedStringSchema.parse('   ')).toThrow();
      });
    });

    describe('SanitizedEmailSchema', () => {
      it('should transform and validate emails', () => {
        const result = SanitizedEmailSchema.parse('Test@Example.COM');
        expect(result).toBe('test@example.com');
      });
    });

    describe('SanitizedIdSchema', () => {
      it('should transform and validate IDs', () => {
        const result = SanitizedIdSchema.parse('valid-id_123');
        expect(result).toBe('valid-id_123');
      });
    });

    describe('PaginationSchema', () => {
      it('should apply defaults', () => {
        const result = PaginationSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.per_page).toBe(20);
      });

      it('should accept valid pagination', () => {
        const result = PaginationSchema.parse({ page: 5, per_page: 50 });
        expect(result.page).toBe(5);
        expect(result.per_page).toBe(50);
      });

      it('should enforce maximum page', () => {
        expect(() => PaginationSchema.parse({ page: 1001 })).toThrow();
      });

      it('should enforce maximum per_page', () => {
        expect(() => PaginationSchema.parse({ per_page: 101 })).toThrow();
      });
    });
  });
});
