/**
 * Common address structure used across the API
 */
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

/**
 * Common item structure with quantity
 */
export interface BaseItem {
  item_id: string;
  quantity: number;
}

/**
 * Item with price information
 */
export interface PricedItem extends BaseItem {
  price: number;
}

/**
 * Item with tracking information
 */
export interface TrackedItem extends BaseItem {
  tracking_number?: string;
}

/**
 * Warranty item with serial number and period
 */
export interface WarrantyItem extends BaseItem {
  serial_number?: string;
  warranty_period_months: number;
}

/**
 * Common list arguments for pagination
 */
export interface ListArgs {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filter?: Record<string, unknown>;
}

/**
 * Common response metadata
 */
export interface ResponseMetadata {
  request_id?: string;
  timestamp: string;
  duration_ms: number;
  api_metrics?: ApiMetrics;
}

/**
 * API metrics information
 */
export interface ApiMetrics {
  total_requests: number;
  requests_in_last_hour: number;
  average_request_time: number;
  queue_length: number;
  last_request_time: string;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: ResponseMetadata;
}

/**
 * Standard success response
 */
export interface SuccessResponse<T = unknown> {
  data: T;
  metadata?: ResponseMetadata;
}

/**
 * List response with pagination
 */
export interface ListResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  metadata?: ResponseMetadata;
}
