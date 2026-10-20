export type Size = 'M' | 'L'

export interface Business {
  id: string
  name: string
  slug: string
  timezone: string
  currency_code: string
  logo_url: string | null
  is_demo: boolean
}

export interface Category {
  id: string
  business_id: string
  name: string
  sort_order: number
}

export interface ModifierOption {
  id: string
  modifier_id: string
  name: string
  price_delta: number
  sort_order: number
  is_available: boolean
}

export interface Modifier {
  id: string
  name: string
  is_required: boolean
  modifier_options: ModifierOption[]
}

export interface MenuItem {
  id: string
  business_id: string
  category_id: string
  name: string
  description: string | null
  base_price: number
  // null = one size. Set = base_price is the Medium, this is the Large.
  large_price: number | null
  image_url: string | null
  is_available: boolean
  sort_order: number
  menu_item_modifiers: { modifier_id: string }[]
}

export interface MenuData {
  categories: Category[]
  items: MenuItem[]
  modifiers: Modifier[]
}

export interface OrderItemModifier {
  option_name: string
  price_delta: number
}

export interface OrderItem {
  id: string
  item_name: string
  item_category: string | null
  unit_price: number
  quantity: number
  line_total: number
  notes: string | null
  order_item_modifiers: OrderItemModifier[]
}

export interface Order {
  id: string
  business_id: string
  order_number: string
  source: 'walk_in' | 'messenger' | 'phone' | 'online'
  status: 'pending' | 'brewing' | 'ready' | 'picked_up' | 'cancelled'
  customer_name: string | null
  customer_contact: string | null
  notes: string | null
  subtotal: number
  total_amount: number
  payment_method: string | null
  payment_status: 'unpaid' | 'paid' | 'refunded'
  created_at: string
  order_items: OrderItem[]
}

export interface QueueData {
  pending: Order[]
  brewing: Order[]
  ready: Order[]
}

export interface CartItem {
  menu_item_id: string
  item_name: string
  item_category: string | null
  // Base price + add-ons, for display only. The backend recomputes the real
  // price from the live menu; never send this to the API.
  estimated_unit_price: number
  quantity: number
  notes: string
  // Chosen for an item with a large_price; null for a one-size item.
  size: Size | null
  modifiers: {
    modifier_option_id: string
    option_name: string
    price_delta: number
  }[]
}
