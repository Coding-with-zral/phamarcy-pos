import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, CreditCard, Smartphone,
  Banknote, FileText, User, ChevronDown, Printer, CheckCircle, AlertTriangle,
  Package, Clock, Receipt, DollarSign, Percent, ArrowRight,
  RotateCcw, Search as SearchIcon, Users, Pill
} from 'lucide-react';
import { get, post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Medicine } from '../types';
import toast from 'react-hot-toast';
import POSNavigation from '../components/POSNavigation';

interface CartItem {
  id: string;
  medicine_id: number;
  batch_id: number;
  batch_number: string;
  medicine_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  max_quantity: number;
}

interface Category {
  id: number;
  name: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
}

interface Prescription {
  id: number;
  doctor_name: string;
  patient_name: string;
  date: string;
  medicines?: any[];
}

interface SaleResult {
  id: number;
  invoice_number: string;
  total: number;
  amount_paid: number;
  change_amount: number;
  payment_method: string;
  items: CartItem[];
  created_at: string;
}

type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'insurance' | 'credit';

const POS: React.FC = () => {
  const { user } = useAuth();

  // Product search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [holdedSales, setHoldedSales] = useState<CartItem[][]>([]);

  // Customer state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Prescription state
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [prescriptionSearch, setPrescriptionSearch] = useState('');
  const [prescriptionResults, setPrescriptionResults] = useState<Prescription[]>([]);
  const [showPrescriptionDropdown, setShowPrescriptionDropdown] = useState(false);

  // Payment state
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [processing, setProcessing] = useState(false);

  // Sale result modal
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);

  // Search debounce ref
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vatRate = 0.16; // 16% VAT

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await get<Category[]>('/medicines/categories');
        setCategories(Array.isArray(res) ? res : (res as any).data || []);
      } catch (err) {
        // silent
      }
    };
    fetchCategories();
  }, []);

  // Search medicines with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(async () => {
      if (query.length < 1) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        let url = `/medicines?search=${encodeURIComponent(query)}&limit=20`;
        if (selectedCategory) {
          url += `&category_id=${encodeURIComponent(selectedCategory)}`;
        }
        const res = await get<any>(url);
        setSearchResults(Array.isArray(res) ? res : res?.medicines || []);
      } catch (err) {
        toast.error('Failed to search medicines');
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [selectedCategory]);

  // Fetch all medicines when category changes
  useEffect(() => {
    const fetchMedicines = async () => {
      setSearchLoading(true);
      try {
        let url = '/medicines?limit=50';
        if (selectedCategory) {
          url += `&category_id=${encodeURIComponent(selectedCategory)}`;
        }
        if (searchQuery) {
          url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        const res = await get<any>(url);
        setSearchResults(Array.isArray(res) ? res : res?.medicines || []);
      } catch (err) {
        // silent
      } finally {
        setSearchLoading(false);
      }
    };
    fetchMedicines();
  }, [selectedCategory]);

  // Customer search
  const handleCustomerSearch = async (query: string) => {
    setCustomerSearch(query);
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    try {
      const res = await get<Customer[]>(`/customers?search=${encodeURIComponent(query)}`);
      setCustomerResults(Array.isArray(res) ? res : (res as any).data || []);
      setShowCustomerDropdown(true);
    } catch (err) {
      // silent
    }
  };

  // Prescription search
  const handlePrescriptionSearch = async (query: string) => {
    setPrescriptionSearch(query);
    if (query.length < 2) {
      setPrescriptionResults([]);
      return;
    }
    try {
      const res = await get<Prescription[]>(`/prescriptions?search=${encodeURIComponent(query)}`);
      setPrescriptionResults(Array.isArray(res) ? res : (res as any).data || []);
      setShowPrescriptionDropdown(true);
    } catch (err) {
      // silent
    }
  };

  // Add to cart
  const addToCart = (medicine: Medicine) => {
    if ((medicine.total_stock ?? 0) <= 0) {
      toast.error('This medicine is out of stock');
      return;
    }

    // Find the best batch (FEFO - server handles this, but we need a batch_id)
    const existingItem = cartItems.find((item) => item.medicine_id === medicine.id);

    if (existingItem) {
      if (existingItem.quantity >= existingItem.max_quantity) {
        toast.error('Maximum available stock reached');
        return;
      }
      setCartItems((items) =>
        items.map((item) =>
          item.medicine_id === medicine.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unit_price,
              }
            : item
        )
      );
      toast.success(`Added ${medicine.name} to cart`);
      return;
    }

    // For new items, we'll use the medicine data and let the server resolve batches
    const cartItem: CartItem = {
      id: `cart-${medicine.id}-${Date.now()}`,
      medicine_id: medicine.id,
      batch_id: (medicine as any).batches?.[0]?.id || 0,
      batch_number: (medicine as any).batches?.[0]?.batch_number || 'N/A',
      medicine_name: medicine.name,
      generic_name: medicine.generic_name || '',
      strength: medicine.strength || '',
      dosage_form: medicine.dosage_form || '',
      quantity: 1,
      unit_price: Number(medicine.unit_price),
      subtotal: Number(medicine.unit_price),
      max_quantity: medicine.total_stock ?? 0,
    };
    setCartItems((items) => [...items, cartItem]);
    toast.success(`Added ${medicine.name} to cart`);
  };

  // Update quantity
  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCartItems((items) =>
      items.map((item) => {
        if (item.id === itemId) {
          if (newQty > item.max_quantity) {
            toast.error('Cannot exceed available stock');
            return item;
          }
          return { ...item, quantity: newQty, subtotal: newQty * item.unit_price };
        }
        return item;
      })
    );
  };

  // Remove from cart
  const removeFromCart = (itemId: string) => {
    setCartItems((items) => items.filter((item) => item.id !== itemId));
  };

  // Clear cart
  const clearCart = () => {
    setCartItems([]);
    setCustomer(null);
    setCustomerSearch('');
    setPrescription(null);
    setPrescriptionSearch('');
    setDiscount(0);
    setAmountPaid('');
    setPaymentMethod('cash');
  };

  // Hold sale
  const holdSale = () => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setHoldedSales((prev) => [...prev, cartItems]);
    clearCart();
    toast.success('Sale held successfully');
  };

  // Recall held sale
  const recallHeldSale = (index: number) => {
    const heldItems = holdedSales[index];
    if (cartItems.length > 0) {
      toast.error('Clear current cart first');
      return;
    }
    setCartItems(heldItems);
    setHoldedSales((prev) => prev.filter((_, i) => i !== index));
    toast.success('Sale recalled');
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

  const discountAmount = discountType === 'percent'
    ? subtotal * (discount / 100)
    : Math.min(discount, subtotal);

  const taxableAmount = subtotal - discountAmount;
  const vat = taxableAmount * vatRate;
  const total = taxableAmount + vat;

  const amountPaidNum = parseFloat(amountPaid) || 0;
  const change = amountPaidNum > total ? amountPaidNum - total : 0;

  // Auto-fill amount paid with total
  useEffect(() => {
    if (total > 0 && paymentMethod === 'cash') {
      setAmountPaid(total.toFixed(2));
    }
  }, [total, paymentMethod]);

  // Complete sale
  const completeSale = async () => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (paymentMethod === 'cash' && amountPaidNum < total) {
      toast.error('Amount paid is less than total');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        items: cartItems.map((item) => ({
          medicine_id: item.medicine_id,
          batch_id: item.batch_id || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        customer_id: customer?.id || undefined,
        prescription_id: prescription?.id || undefined,
        payment_method: paymentMethod,
        discount: discountAmount,
        discount_type: discountType,
        amount_paid: amountPaidNum || total,
        vat: vat,
      };

      const result = await post<SaleResult>('/pos/sale', payload);
      setSaleResult({
        ...(result as any),
        id: (result as any).id || (result as any).data?.id || 0,
        invoice_number: (result as any).invoice_number || (result as any).data?.invoice_number || `INV-${Date.now()}`,
        total,
        amount_paid: amountPaidNum || total,
        change_amount: change,
        payment_method: paymentMethod,
        items: cartItems,
        created_at: new Date().toISOString(),
      });
      setShowSaleModal(true);
      clearCart();
      toast.success('Sale completed successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  // Print receipt
  const printReceipt = () => {
    if (!saleResult) return;
    try {
      window.print();
    } catch (e) {
      toast.success('Receipt details ready on screen');
    }
  };

  const copyReceiptText = () => {
    if (!saleResult) return;
    const lines = [
      '==================================',
      'HAUZRAL PHARMACY & HEALTHCARE POS',
      'Kenyatta Avenue, Nairobi',
      'PPB Reg Lic: PPB/RET/2026/04918',
      '==================================',
      `Invoice #: ${saleResult.invoice_number}`,
      `Date: ${new Date(saleResult.created_at).toLocaleString('en-KE')}`,
      `Cashier: ${user?.full_name || user?.username || 'Staff'}`,
      '----------------------------------',
      ...saleResult.items.map(
        (it) => `${it.medicine_name} (${it.strength || ''}) x${it.quantity} @ KSh ${it.unit_price} = KSh ${it.subtotal}`
      ),
      '----------------------------------',
      `Subtotal: KSh ${subtotal.toFixed(2)}`,
      `VAT (16%): KSh ${vat.toFixed(2)}`,
      discountAmount > 0 ? `Discount: -KSh ${discountAmount.toFixed(2)}` : '',
      `TOTAL: KSh ${total.toFixed(2)}`,
      `Payment: ${saleResult.payment_method.toUpperCase()}`,
      `Amount Tendered: KSh ${(saleResult.amount_paid || total).toFixed(2)}`,
      change > 0 ? `Change: KSh ${change.toFixed(2)}` : '',
      '==================================',
      'Thank you for visiting Hauzral Pharmacy!',
      'Wishing you a quick and full recovery.',
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Thermal receipt text copied to clipboard!');
  };

  // Format KSh
  const formatKSh = (amount: number) => {
    return `KSh ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-100">
      <POSNavigation />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ============ LEFT SIDE - Products ============ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-blue-600" size={24} />
            <h1 className="text-xl font-bold text-gray-900">Point of Sale</h1>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search medicines by name, generic name, or brand..."
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Category & Stock Alert Filters */}
        <div className="bg-white border-b border-gray-200 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-2xl">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name === selectedCategory ? '' : cat.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Quick Stock Alert Toggles */}
            <div className="flex items-center gap-1.5 text-xs bg-gray-50 p-1 rounded-lg border border-gray-200">
              <span className="text-gray-500 font-medium px-1.5 hidden sm:inline">Stock Status:</span>
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className={`px-2 py-1 rounded font-medium transition-all ${
                  stockFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200 font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('low')}
                className={`px-2 py-1 rounded font-medium flex items-center gap-1 transition-all ${
                  stockFilter === 'low'
                    ? 'bg-amber-500 text-white shadow-sm font-semibold'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <AlertTriangle size={12} />
                <span>Low Stock</span>
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('out')}
                className={`px-2 py-1 rounded font-medium flex items-center gap-1 transition-all ${
                  stockFilter === 'out'
                    ? 'bg-red-600 text-white shadow-sm font-semibold'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                <span>🚨</span>
                <span>Depleted</span>
              </button>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {(() => {
            const displayedResults = searchResults.filter((med) => {
              const stock = med.total_stock ?? 0;
              const threshold = med.reorder_level ?? 10;
              if (stockFilter === 'low') return stock > 0 && stock <= threshold;
              if (stockFilter === 'out') return stock <= 0;
              return true;
            });

            const lowStockCount = searchResults.filter(
              (m) => (m.total_stock ?? 0) > 0 && (m.total_stock ?? 0) <= (m.reorder_level ?? 10)
            ).length;
            const outOfStockCount = searchResults.filter((m) => (m.total_stock ?? 0) <= 0).length;

            return (
              <>
                {(lowStockCount > 0 || outOfStockCount > 0) && stockFilter === 'all' && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                      <span>
                        <strong>Inventory Notice:</strong> {outOfStockCount > 0 ? `${outOfStockCount} items depleted` : ''}
                        {outOfStockCount > 0 && lowStockCount > 0 ? ', and ' : ''}
                        {lowStockCount > 0 ? `${lowStockCount} items running low` : ''}.
                      </span>
                    </div>
                    <button
                      onClick={() => setStockFilter('low')}
                      className="text-amber-700 underline font-semibold hover:text-amber-900"
                    >
                      Filter Low Stock
                    </button>
                  </div>
                )}

                {displayedResults.length === 0 && !searchLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Package size={48} className="mb-3 text-gray-300" />
                    <p className="text-lg font-medium">No medicines match criteria</p>
                    <p className="text-sm">
                      {stockFilter !== 'all' ? 'Try resetting the stock status filter.' : 'Search for a medicine or select another category.'}
                    </p>
                    {stockFilter !== 'all' && (
                      <button
                        onClick={() => setStockFilter('all')}
                        className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100"
                      >
                        Show All Medicines
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {displayedResults.map((medicine) => {
                      const stock = medicine.total_stock ?? 0;
                      const outOfStock = stock <= 0;
                      const lowStock = stock > 0 && stock <= (medicine.reorder_level ?? 10);

                      return (
                        <div
                          key={medicine.id}
                          className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md relative ${
                            outOfStock
                              ? 'border-red-200 bg-red-50/20 opacity-80'
                              : lowStock
                              ? 'border-amber-300 hover:border-amber-400'
                              : 'border-gray-200 hover:border-blue-300 cursor-pointer'
                          }`}
                        >
                          {/* Stock Status Badge Bar */}
                          {outOfStock && (
                            <div className="bg-red-600 text-white text-[10px] font-bold text-center py-0.5 tracking-wider uppercase">
                              Out of Stock
                            </div>
                          )}
                          {!outOfStock && lowStock && (
                            <div className="bg-amber-500 text-white text-[10px] font-bold text-center py-0.5 tracking-wider uppercase flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              Low Stock Alert
                            </div>
                          )}

                          {/* Medicine Image Placeholder */}
                          <div className={`h-20 flex items-center justify-center ${
                            outOfStock ? 'bg-red-50' : lowStock ? 'bg-amber-50' : 'bg-gradient-to-br from-blue-50 to-blue-100'
                          }`}>
                            <Pill size={28} className={outOfStock ? 'text-red-300' : lowStock ? 'text-amber-400' : 'text-blue-300'} />
                          </div>

                          <div className="p-3">
                            {/* Name */}
                            <h3 className="text-sm font-semibold text-gray-900 truncate" title={medicine.brand_name || medicine.name}>
                              {medicine.brand_name || medicine.name}
                            </h3>
                            {medicine.generic_name && (
                              <p className="text-xs text-gray-500 truncate">{medicine.generic_name}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {medicine.strength} {medicine.dosage_form}
                            </p>

                            {/* Price and Stock Status */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                              <span className="text-sm font-bold text-blue-600">
                                {formatKSh(medicine.unit_price)}
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  outOfStock
                                    ? 'bg-red-100 text-red-700'
                                    : lowStock
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {outOfStock ? '0 units' : `${stock} left`}
                              </span>
                            </div>

                            {/* Add to Cart Button */}
                            <button
                              onClick={() => addToCart(medicine)}
                              disabled={outOfStock}
                              className={`w-full mt-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                outOfStock
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                  : lowStock
                                  ? 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                              }`}
                            >
                              {outOfStock ? 'Depleted' : 'Add to Cart'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* ============ RIGHT SIDE - Cart ============ */}
      <div className="w-[420px] bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        {/* Cart Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-gray-700" />
              <span className="font-semibold text-gray-900">
                Cart ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Holded sales count */}
              {holdedSales.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                    <Clock size={14} />
                    {holdedSales.length} Held
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 hidden group-hover:block">
                    {holdedSales.map((held, idx) => (
                      <button
                        key={idx}
                        onClick={() => recallHeldSale(idx)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span>Sale #{idx + 1}</span>
                        <span className="text-gray-500">{held.length} items</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={holdSale}
                disabled={cartItems.length === 0}
                className="flex items-center gap-1 px-2 py-1 bg-yellow-500 text-white rounded text-xs font-medium hover:bg-yellow-600 disabled:opacity-50"
              >
                <Clock size={14} />
                Hold
              </button>
              <button
                onClick={clearCart}
                disabled={cartItems.length === 0}
                className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart size={48} className="mb-3 text-gray-200" />
              <p className="font-medium">Cart is empty</p>
              <p className="text-sm">Add medicines from the product grid</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cartItems.map((item) => (
                <div key={item.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{item.medicine_name}</h4>
                      <p className="text-xs text-gray-500">
                        {item.strength} {item.dosage_form}
                        {item.batch_number !== 'N/A' && ` • Batch: ${item.batch_number}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatKSh(item.unit_price)} each
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    {/* Quantity Controls */}
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-l-lg"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-3 py-1 text-sm font-medium text-gray-900 min-w-[40px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.max_quantity}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-r-lg disabled:opacity-50"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <span className="text-sm font-bold text-gray-900">{formatKSh(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer & Prescription (Collapsible) */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-3 space-y-3 bg-gray-50">
            {/* Customer */}
            <div className="relative">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Customer (Optional)</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={customer ? `${customer.name} (${customer.phone})` : customerSearch}
                  onChange={(e) => {
                    setCustomer(null);
                    handleCustomerSearch(e.target.value);
                  }}
                  onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  placeholder="Search customer..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500"
                />
                {customer && (
                  <button
                    onClick={() => { setCustomer(null); setCustomerSearch(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCustomer(c);
                        setCustomerSearch('');
                        setShowCustomerDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Prescription */}
            <div className="relative">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Prescription (Optional)</label>
              <div className="relative">
                <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={prescription ? `Rx #${prescription.id} - ${prescription.doctor_name}` : prescriptionSearch}
                  onChange={(e) => {
                    setPrescription(null);
                    handlePrescriptionSearch(e.target.value);
                  }}
                  onFocus={() => prescriptionSearch.length >= 2 && setShowPrescriptionDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPrescriptionDropdown(false), 200)}
                  placeholder="Search prescription..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500"
                />
                {prescription && (
                  <button
                    onClick={() => { setPrescription(null); setPrescriptionSearch(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showPrescriptionDropdown && prescriptionResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {prescriptionResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPrescription(p);
                        setPrescriptionSearch('');
                        setShowPrescriptionDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium">Rx #{p.id} - Dr. {p.doctor_name}</div>
                      <div className="text-xs text-gray-500">{p.patient_name} | {new Date(p.date).toLocaleDateString('en-KE')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary & Payment */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-3 space-y-3">
            {/* Discount */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Discount</label>
                <div className="flex">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-r-0 border-gray-300 rounded-l-lg text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percent')}
                    className="px-2 py-2 border border-gray-300 rounded-r-lg text-sm bg-gray-50 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="amount">KSh</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatKSh(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatKSh(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>VAT (16%)</span>
                <span>{formatKSh(vat)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-lg pt-1 border-t border-gray-200">
                <span>Total</span>
                <span>{formatKSh(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Payment Method</label>
              <div className="grid grid-cols-5 gap-1">
                {([
                  { key: 'cash', label: 'Cash', icon: Banknote },
                  { key: 'mpesa', label: 'M-Pesa', icon: Smartphone },
                  { key: 'card', label: 'Card', icon: CreditCard },
                  { key: 'insurance', label: 'Insurance', icon: FileText },
                  { key: 'credit', label: 'Credit', icon: Clock },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setPaymentMethod(key)}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-xs font-medium transition-colors ${
                      paymentMethod === key
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid */}
            {(paymentMethod === 'cash' || paymentMethod === 'credit') && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Amount Paid</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">KSh</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full pl-12 pr-3 py-2.5 border border-gray-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Change */}
            {paymentMethod === 'cash' && change > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex justify-between items-center">
                <span className="text-sm font-medium text-green-700">Change</span>
                <span className="text-lg font-bold text-green-700">{formatKSh(change)}</span>
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              onClick={completeSale}
              disabled={processing || cartItems.length === 0}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Complete Sale - {formatKSh(total)}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ============ SALE SUCCESS MODAL ============ */}
      {showSaleModal && saleResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Success Header */}
              <div className="bg-green-600 px-6 py-8 text-center">
                <CheckCircle size={64} className="mx-auto text-green-100 mb-3" />
                <h2 className="text-2xl font-bold text-white">Sale Complete!</h2>
                <p className="text-green-100 mt-1">{saleResult.invoice_number}</p>
              </div>

              {/* Sale Details */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Payment Method</span>
                    <p className="font-semibold text-gray-900 capitalize">{saleResult.payment_method}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Items Sold</span>
                    <p className="font-semibold text-gray-900">{saleResult.items.length} items</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total</span>
                    <p className="font-bold text-gray-900 text-lg">{formatKSh(total)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount Paid</span>
                    <p className="font-semibold text-gray-900">{formatKSh(saleResult.amount_paid || total)}</p>
                  </div>
                  {change > 0 && (
                    <div className="col-span-2 bg-green-50 rounded-lg p-3">
                      <span className="text-green-600 text-sm font-medium">Change to give</span>
                      <p className="font-bold text-green-700 text-2xl">{formatKSh(change)}</p>
                    </div>
                  )}
                </div>

                {/* Items Summary */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Items</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {saleResult.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700 truncate mr-2">
                          {item.medicine_name} ({item.quantity}x)
                        </span>
                        <span className="text-gray-900 font-medium whitespace-nowrap">{formatKSh(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={copyReceiptText}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                  >
                    <Receipt size={16} />
                    Copy Receipt
                  </button>
                  <button
                    onClick={printReceipt}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-xl text-sm font-medium hover:bg-emerald-100"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    onClick={() => setShowSaleModal(false)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
                  >
                    <CheckCircle size={16} />
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default POS;
