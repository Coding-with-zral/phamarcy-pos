export interface User {
  id: number
  name?: string
  username: string
  email: string
  full_name: string
  role: 'admin' | 'pharmacist' | 'cashier' | 'manager'
  phone: string
  is_active: boolean
  created_at: string
}

export interface Medicine {
  id: number
  name: string
  brand_name: string
  generic_name: string
  strength: string
  dosage_form: string
  category_id: number
  category: string
  category_name: string
  manufacturer: string
  barcode: string
  unit: string
  unit_price: number
  default_selling_price: number
  purchase_price: number
  requires_prescription: boolean
  prescription_required: boolean
  controlled_drug: boolean
  total_stock: number
  current_stock: number
  reorder_level: number
  description: string
  batches: Batch[]
  storage_requirements: string
  alternative_brands: string
  vat_rate: number
  is_active: boolean
}

export interface Batch {
  id: number
  medicine_id: number
  medicine_name: string
  batch_number: string
  quantity: number
  initial_quantity: number
  purchase_price: number
  selling_price: number
  expiry_date: string
  supplier_id: number
  supplier_name: string
  status: string
}

export interface Supplier {
  id: number
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
  city: string
  outstanding_balance: number
  payment_terms: string
}

export interface Customer {
  id: number
  name: string
  phone: string
  email: string
  address: string
  date_of_birth: string
  medical_notes: string
  allergies: string
  loyalty_points: number
  insurance_provider: string
  insurance_number: string
  total_purchases: number
}

export interface SaleItem {
  id: number
  sale_id: number
  medicine_id: number
  medicine_name: string
  batch_id: number
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
  brand_name: string
  generic_name: string
  strength: string
  dosage_form: string
}

export interface Sale {
  id: number
  customer_id: number
  customer_name: string
  cashier_name: string
  user_id: number
  items: SaleItem[]
  subtotal: number
  vat_amount: number
  discount_amount: number
  total_amount: number
  payment_method: string
  amount_paid: number
  change_amount: number
  status: string
  created_at: string
  notes: string
}

export interface PrescriptionItem {
  id: number
  medicine_id: number
  dosage: string
  frequency: string
  duration: string
  quantity_prescribed: number
  quantity_dispensed: number
  notes: string
  brand_name: string
  generic_name: string
  strength: string
  dosage_form: string
}

export interface Prescription {
  id: number
  customer_id: number
  customer_name: string
  doctor_name: string
  doctor_license: string
  hospital: string
  prescription_date: string
  diagnosis: string
  status: string
  items: PrescriptionItem[]
}

export interface Expense {
  id: number
  category: string
  description: string
  amount: number
  date: string
  created_by: number
}

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  message: string
  is_read: boolean
  priority: string
  created_at: string
}

export interface Setting {
  key: string
  value: string
}
