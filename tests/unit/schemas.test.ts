import * as schemas from '../../src/tools/schemas';

describe('Tool Schemas Validation', () => {
  // Helper to generate valid UUIDs for tests
  const validUUID = '123e4567-e89b-12d3-a456-426614174000';
  const invalidUUID = 'not-a-uuid';

  // Helper for valid address
  const validAddress = {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    postal_code: '10001',
    country: 'US',
  };

  describe('RMA Schemas', () => {
    describe('CreateRMAArgsSchema', () => {
      it('should accept valid RMA creation args', () => {
        const validArgs = {
          order_id: validUUID,
          reason: 'Product defective',
          notes: 'Customer reported issue',
        };

        const result = schemas.CreateRMAArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject invalid order_id', () => {
        const invalidArgs = {
          order_id: invalidUUID,
          reason: 'Product defective',
        };

        const result = schemas.CreateRMAArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject missing reason', () => {
        const invalidArgs = {
          order_id: validUUID,
        };

        const result = schemas.CreateRMAArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should accept optional notes', () => {
        const validArgs = {
          order_id: validUUID,
          reason: 'Product defective',
        };

        const result = schemas.CreateRMAArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });

    describe('UpdateRMAArgsSchema', () => {
      it('should accept valid RMA update args', () => {
        const validArgs = {
          rma_id: validUUID,
          status: 'approved',
          notes: 'Approved by manager',
        };

        const result = schemas.UpdateRMAArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject invalid status values', () => {
        const invalidArgs = {
          rma_id: validUUID,
          status: 'invalid_status',
        };

        const result = schemas.UpdateRMAArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should accept restocked status', () => {
        const validArgs = {
          rma_id: validUUID,
          status: 'restocked',
        };

        const result = schemas.UpdateRMAArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });

    describe('GetRMAArgsSchema', () => {
      it('should accept valid RMA ID', () => {
        const result = schemas.GetRMAArgsSchema.safeParse({ rma_id: validUUID });
        expect(result.success).toBe(true);
      });

      it('should reject invalid RMA ID', () => {
        const result = schemas.GetRMAArgsSchema.safeParse({ rma_id: invalidUUID });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Order Schemas', () => {
    describe('CreateOrderArgsSchema', () => {
      it('should accept valid order creation args', () => {
        const validArgs = {
          customer_id: validUUID,
          items: [
            { product_id: 'PROD-001', quantity: 2, unit_price: 29.99 },
          ],
          shipping_address: validAddress,
        };

        const result = schemas.CreateOrderArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject empty items array', () => {
        const invalidArgs = {
          customer_id: validUUID,
          items: [],
        };

        const result = schemas.CreateOrderArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject negative quantity', () => {
        const invalidArgs = {
          customer_id: validUUID,
          items: [
            { product_id: 'PROD-001', quantity: -1 },
          ],
        };

        const result = schemas.CreateOrderArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject zero quantity', () => {
        const invalidArgs = {
          customer_id: validUUID,
          items: [
            { product_id: 'PROD-001', quantity: 0 },
          ],
        };

        const result = schemas.CreateOrderArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject negative unit_price', () => {
        const invalidArgs = {
          customer_id: validUUID,
          items: [
            { product_id: 'PROD-001', quantity: 1, unit_price: -10 },
          ],
        };

        const result = schemas.CreateOrderArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should accept multiple items', () => {
        const validArgs = {
          customer_id: validUUID,
          items: [
            { product_id: 'PROD-001', quantity: 2 },
            { product_id: 'PROD-002', quantity: 1, unit_price: 49.99 },
            { product_id: 'PROD-003', quantity: 5, unit_price: 9.99, tax_rate: 0.08 },
          ],
        };

        const result = schemas.CreateOrderArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });

    describe('UpdateOrderArgsSchema', () => {
      it('should accept valid order update args', () => {
        const validArgs = {
          order_id: validUUID,
          shipping_address: validAddress,
          notes: 'Updated shipping address',
        };

        const result = schemas.UpdateOrderArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should accept order_id only', () => {
        const validArgs = {
          order_id: validUUID,
        };

        const result = schemas.UpdateOrderArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Product Schemas', () => {
    describe('CreateProductArgsSchema', () => {
      it('should accept valid product creation args', () => {
        const validArgs = {
          name: 'Widget Pro',
          sku: 'WIDGET-PRO-001',
          description: 'A professional-grade widget',
          price: 99.99,
        };

        const result = schemas.CreateProductArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject missing name', () => {
        const invalidArgs = {
          sku: 'WIDGET-001',
          price: 99.99,
        };

        const result = schemas.CreateProductArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject zero price', () => {
        const invalidArgs = {
          name: 'Free Widget',
          sku: 'FREE-001',
          price: 0,
        };

        const result = schemas.CreateProductArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject negative price', () => {
        const invalidArgs = {
          name: 'Discount Widget',
          sku: 'DISC-001',
          price: -10,
        };

        const result = schemas.CreateProductArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should accept optional description', () => {
        const validArgs = {
          name: 'Simple Widget',
          sku: 'SIMPLE-001',
          price: 19.99,
        };

        const result = schemas.CreateProductArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });

    describe('UpdateProductArgsSchema', () => {
      it('should accept partial updates', () => {
        const validArgs = {
          product_id: 'PROD-001',
          price: 149.99,
        };

        const result = schemas.UpdateProductArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should accept full updates', () => {
        const validArgs = {
          product_id: 'PROD-001',
          name: 'Updated Widget',
          sku: 'WIDGET-V2',
          description: 'New and improved',
          price: 149.99,
        };

        const result = schemas.UpdateProductArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Customer Schemas', () => {
    describe('CreateCustomerArgsSchema', () => {
      it('should accept valid customer creation args', () => {
        const validArgs = {
          email: 'customer@example.com',
          name: 'John Doe',
          address: validAddress,
        };

        const result = schemas.CreateCustomerArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email', () => {
        const invalidArgs = {
          email: 'not-an-email',
          name: 'John Doe',
          address: validAddress,
        };

        const result = schemas.CreateCustomerArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject missing address', () => {
        const invalidArgs = {
          email: 'customer@example.com',
          name: 'John Doe',
        };

        const result = schemas.CreateCustomerArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject incomplete address', () => {
        const invalidArgs = {
          email: 'customer@example.com',
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'New York',
            // Missing state, postal_code, country
          },
        };

        const result = schemas.CreateCustomerArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });
    });

    describe('UpdateCustomerArgsSchema', () => {
      it('should accept email-only update', () => {
        const validArgs = {
          customer_id: 'CUST-001',
          email: 'newemail@example.com',
        };

        const result = schemas.UpdateCustomerArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email in update', () => {
        const invalidArgs = {
          customer_id: 'CUST-001',
          email: 'invalid-email',
        };

        const result = schemas.UpdateCustomerArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Inventory Schemas', () => {
    describe('CreateInventoryArgsSchema', () => {
      it('should accept valid inventory creation args', () => {
        const validArgs = {
          item_number: 'INV-001',
          location_id: 1,
          quantity_on_hand: 100,
        };

        const result = schemas.CreateInventoryArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should accept negative quantity (for adjustments)', () => {
        const validArgs = {
          item_number: 'INV-001',
          location_id: 1,
          quantity_on_hand: -5,
          reason: 'Damaged items',
        };

        const result = schemas.CreateInventoryArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject invalid location_id', () => {
        const invalidArgs = {
          item_number: 'INV-001',
          location_id: 0,
          quantity_on_hand: 100,
        };

        const result = schemas.CreateInventoryArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });
    });

    describe('UpdateInventoryArgsSchema', () => {
      it('should accept valid inventory update', () => {
        const validArgs = {
          inventory_id: validUUID,
          location_id: 2,
          on_hand: 50,
          reason: 'Stock transfer',
        };

        const result = schemas.UpdateInventoryArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Shipment Schemas', () => {
    describe('CreateShipmentArgsSchema', () => {
      it('should accept valid shipment creation args', () => {
        const validArgs = {
          order_id: validUUID,
          shipping_address: '123 Main St, New York, NY 10001',
          shipping_method: 'express',
          tracking_number: '1Z999AA10123456784',
          recipient_name: 'John Doe',
        };

        const result = schemas.CreateShipmentArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject missing tracking_number', () => {
        const invalidArgs = {
          order_id: validUUID,
          shipping_address: '123 Main St',
          shipping_method: 'express',
          recipient_name: 'John Doe',
        };

        const result = schemas.CreateShipmentArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });
    });

    describe('UpdateShipmentArgsSchema', () => {
      it('should accept partial shipment update', () => {
        const validArgs = {
          shipment_id: validUUID,
          tracking_number: 'NEW-TRACKING-123',
        };

        const result = schemas.UpdateShipmentArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('List Schema', () => {
    describe('ListArgsSchema', () => {
      it('should accept empty args for default pagination', () => {
        const result = schemas.ListArgsSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should accept valid pagination', () => {
        const validArgs = {
          page: 1,
          per_page: 20,
        };

        const result = schemas.ListArgsSchema.safeParse(validArgs);
        expect(result.success).toBe(true);
      });

      it('should reject zero page', () => {
        const invalidArgs = {
          page: 0,
        };

        const result = schemas.ListArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });

      it('should reject negative per_page', () => {
        const invalidArgs = {
          per_page: -10,
        };

        const result = schemas.ListArgsSchema.safeParse(invalidArgs);
        expect(result.success).toBe(false);
      });
    });
  });
});
