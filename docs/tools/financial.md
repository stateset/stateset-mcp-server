# Financial Tools

Tools for managing invoices, payments, and financial transactions in StateSet.

## Invoice Operations

### stateset_create_invoice
Generates an invoice for a customer order.

**Parameters:**
- `order_id` (required): Associated order identifier
- `customer_id` (required): Customer identifier
- `line_items` (required): Invoice line items
  - `description`: Item description
  - `quantity`: Quantity
  - `unit_price`: Price per unit
  - `tax_rate`: Tax rate percentage
- `due_date`: Payment due date
- `terms`: Payment terms
- `notes`: Additional notes

**Returns:** Invoice ID and PDF URL

**Example:**
```json
{
  "order_id": "ORDER-123",
  "customer_id": "CUST-456",
  "line_items": [
    {
      "description": "Premium Widget",
      "quantity": 2,
      "unit_price": 49.99,
      "tax_rate": 8.5
    },
    {
      "description": "Shipping",
      "quantity": 1,
      "unit_price": 15.00,
      "tax_rate": 0
    }
  ],
  "due_date": "2025-12-31",
  "terms": "Net 30",
  "notes": "Thank you for your business"
}
```

### stateset_update_invoice
Updates invoice details.

**Parameters:**
- `invoice_id` (required): Invoice identifier
- `status`: Invoice status (draft, sent, paid, overdue, cancelled)
- `paid_date`: Date payment received
- `notes`: Updated notes

**Returns:** Updated invoice details

### stateset_get_invoice
Retrieves invoice details.

**Parameters:**
- `invoice_id` (required): Invoice identifier

**Returns:** Complete invoice with line items and payment status

### stateset_list_invoices
Lists invoices with filtering.

**Parameters:**
- `page`: Page number
- `per_page`: Results per page
- `status`: Filter by status
- `customer_id`: Filter by customer
- `from_date`: Start date for date range
- `to_date`: End date for date range

**Returns:** Array of invoices with pagination

## Payment Operations

### stateset_create_payment
Records a payment transaction.

**Parameters:**
- `order_id` (required): Order being paid
- `amount` (required): Payment amount
- `payment_method` (required): Payment method (credit_card, bank_transfer, check, paypal, stripe)
- `reference_number`: External transaction reference
- `notes`: Payment notes

**Returns:** Payment ID and confirmation

**Example:**
```json
{
  "order_id": "ORDER-123",
  "amount": 114.97,
  "payment_method": "credit_card",
  "reference_number": "CH_1234567890",
  "notes": "Processed via Stripe"
}
```

### stateset_update_payment
Updates payment status.

**Parameters:**
- `payment_id` (required): Payment identifier
- `status`: Payment status (pending, completed, failed, refunded)
- `notes`: Additional notes

**Returns:** Updated payment details

### stateset_get_payment
Retrieves payment details.

**Parameters:**
- `payment_id` (required): Payment identifier

**Returns:** Complete payment information including method and status

### stateset_list_payments
Lists payments with filtering.

**Parameters:**
- `customer_id`: Filter by customer
- `order_id`: Filter by order
- `status`: Filter by status
- `from_date`: Start date
- `to_date`: End date
- `min_amount`: Minimum amount
- `max_amount`: Maximum amount

**Returns:** Array of payments with totals

## Sales Order Operations

### stateset_create_sales_order
Creates a formal sales order (B2B).

**Parameters:**
- `customer_id` (required): Customer identifier
- `items` (required): Order line items
- `po_number`: Customer purchase order number
- `shipping_address`: Shipping details
- `billing_address`: Billing details
- `terms`: Payment terms
- `delivery_date`: Requested delivery date

**Returns:** Sales order ID

**Example:**
```json
{
  "customer_id": "CUST-B2B-123",
  "items": [
    {
      "product_id": "PROD-789",
      "quantity": 100,
      "unit_price": 25.00,
      "discount_percent": 10
    }
  ],
  "po_number": "PO-2025-001",
  "terms": "Net 60",
  "delivery_date": "2025-12-15"
}
```

### stateset_update_sales_order
Updates sales order details.

**Parameters:**
- `sales_order_id` (required): Sales order identifier
- `status`: Order status
- `delivery_date`: Updated delivery date
- `notes`: Additional notes

**Returns:** Updated sales order

### stateset_get_sales_order
Retrieves sales order details.

**Parameters:**
- `sales_order_id` (required): Sales order identifier

**Returns:** Complete sales order with all details

## Cash Sale Operations

### stateset_create_cash_sale
Creates a cash sale (immediate payment).

**Parameters:**
- `customer_id`: Customer identifier (optional for walk-in sales)
- `items` (required): Items sold
- `payment_method` (required): How payment was received
- `payment_amount` (required): Amount paid

**Returns:** Sale ID and receipt

**Use Cases:**
- Point of sale transactions
- Walk-in customers
- Immediate payment scenarios

## Transaction Management

### stateset_list_transactions
Lists all financial transactions.

**Parameters:**
- `type`: Transaction type (payment, refund, adjustment)
- `customer_id`: Filter by customer
- `from_date`: Start date
- `to_date`: End date

**Returns:** Array of transactions with running balances

### stateset_get_customer_balance
Retrieves customer's current balance.

**Parameters:**
- `customer_id` (required): Customer identifier

**Returns:** Current balance and aging report

**Example Response:**
```json
{
  "customer_id": "CUST-123",
  "current_balance": 5432.10,
  "aging": {
    "current": 1200.00,
    "30_days": 2500.00,
    "60_days": 1500.00,
    "90_days": 232.10,
    "over_90": 0
  }
}
```

## Reporting

### stateset_financial_summary
Gets financial summary for a period.

**Parameters:**
- `from_date` (required): Start date
- `to_date` (required): End date
- `group_by`: Grouping (day, week, month)

**Returns:** Revenue, payments, outstanding balances

### stateset_accounts_receivable
Gets accounts receivable aging report.

**Parameters:**
- `as_of_date`: Report date (default: today)

**Returns:** AR aging by customer

## Best Practices

1. **Invoice Immediately**: Generate invoices as soon as orders are fulfilled
2. **Payment Matching**: Always link payments to specific invoices/orders
3. **Reference Numbers**: Store external payment processor references
4. **Reconciliation**: Regularly reconcile StateSet records with accounting system
5. **Aging Reports**: Monitor accounts receivable aging weekly
6. **Payment Terms**: Clearly define payment terms on all invoices
7. **Tax Calculation**: Ensure accurate tax rates for all jurisdictions

## Payment Methods

Supported payment methods:
- `credit_card`: Credit card payments
- `debit_card`: Debit card payments
- `bank_transfer`: ACH/wire transfers
- `check`: Physical checks
- `paypal`: PayPal payments
- `stripe`: Stripe payments
- `cash`: Cash payments
- `crypto`: Cryptocurrency payments

## Financial Workflows

### Standard B2B Sale
1. Create sales order: `stateset_create_sales_order`
2. Generate invoice: `stateset_create_invoice`
3. Send invoice to customer
4. Record payment when received: `stateset_create_payment`
5. Update invoice status: `stateset_update_invoice`

### Retail/POS Sale
1. Create cash sale: `stateset_create_cash_sale`
2. Payment recorded automatically
3. Generate receipt

### Refund Processing
1. Create credit memo
2. Process refund payment
3. Update original invoice
4. Track refund transaction

## Rate Limits

Financial operations rate limits:
- Invoice operations: 60 requests/minute
- Payment operations: 30 requests/minute (security limited)
- Report operations: 10 requests/minute

## Security

- Never log complete payment card numbers
- Use tokenized payment references
- Implement proper access controls for financial data
- Enable audit logging for all financial transactions
- Encrypt sensitive financial data at rest and in transit

## Compliance

Ensure compliance with:
- PCI DSS for payment card data
- SOX for financial reporting
- GDPR/CCPA for customer financial data
- Tax regulations in your jurisdiction
