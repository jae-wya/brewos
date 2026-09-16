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
  unit_price: number
  quantity: number
  notes: string
  modifiers: {
    modifier_option_id: string
    option_name: string
    price_delta: number
  }[]
}
