// Export main API types
export type {
  StateSetResponse,
  CreateRMAArgs,
  UpdateRMAArgs,
  DeleteRMAArgs,
  CreateOrderArgs,
  UpdateOrderArgs,
  DeleteOrderArgs,
  CreateCustomerArgs,
  UpdateCustomerArgs,
  DeleteCustomerArgs,
  CreateInventoryArgs,
  UpdateInventoryArgs,
  DeleteInventoryArgs,
  CreateWarrantyArgs,
  UpdateWarrantyArgs,
  DeleteWarrantyArgs,
} from './api';

// Export common types with aliases to avoid conflicts
export type {
  Address,
  BaseItem,
  PricedItem,
  TrackedItem,
} from './common';

// Re-export with aliases for conflicting types
export type {
  ListArgs as CommonListArgs,
  ApiMetrics as CommonApiMetrics,
  WarrantyItem as CommonWarrantyItem,
} from './common'; 