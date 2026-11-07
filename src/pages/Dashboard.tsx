import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  AlertTriangle,
  TrendingDown,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  AlertOctagon,
  Truck,
  Building2,
  Sparkles,
  X,
  ShieldAlert,
  Barcode,
  Pill,
  Check,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { get, post } from '../utils/api'
import { useAuth } from '../context/AuthContext'

interface LowStockItem {
  id: number
  brand_name: string
  generic_name: string
  strength: string
  dosage_form: string
  unit: string
  unit_price: number
  purchase_price: number
  barcode: string
  category_name: string
  supplier_name: string
  supplier_phone: string
  supplier_id: number
  total_stock: number
  threshold: number
  urgency: 'out_of_stock' | 'critical' | 'low'
  suggested_reorder: number
  reorder_cost: number
}

interface ExpiringBatch {
  id: number
  batch_number: string
  quantity: number
  expiry_date: string
  medicine_id: number
  brand_name: string
  generic_name: string
  strength: string
  supplier_name: string
  days_to_expiry: number
}

interface DashboardData {
  today: { sales_count: number; revenue: number }
  all_time: { sales_count: number; revenue: number }
  customers: number
  medicines: number
  threshold: number
  low_stock_count: number
  out_of_stock_count: number
  critical_count: number
  expiring_soon_count: number
  low_stock_items: LowStockItem[]
  expiring_batches: ExpiringBatch[]
  recent_sales: any[]
  top_medicines: any[]
}

interface Category {
  id: number
  name: string
}

interface Supplier {
  id: number
  name: string
  phone: string
}

function formatKSh(amount: number): string {
  return `KSh ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const cardVariants: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' },
  }),
}

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Suspension', 'Inhaler', 'Eye Drops', 'Vial']
const UNITS = ['tablet', 'capsule', 'bottle', 'vial', 'tube', 'sachet', 'box', 'ampoule']

export default function Dashboard() {
  const { user, refreshNotifications } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [threshold, setThreshold] = useState<number>(20)
  const [activeTab, setActiveTab] = useState<'low_stock' | 'expiring'>('low_stock')
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'out_of_stock' | 'critical' | 'low'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Quick Reorder Modal
  const [reorderItem, setReorderItem] = useState<LowStockItem | null>(null)
  const [reorderQuantity, setReorderQuantity] = useState<number>(50)
  const [reorderSubmitting, setReorderSubmitting] = useState(false)

  // Admin Add Medicine Modal
  const [showAddMedicineModal, setShowAddMedicineModal] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [addMedicineLoading, setAddMedicineLoading] = useState(false)
  const [newMedForm, setNewMedForm] = useState({
    brand_name: '',
    generic_name: '',
    strength: '',
    dosage_form: 'Tablet',
    category_id: '',
    supplier_id: '',
    unit: 'tablet',
    unit_price: '',
    purchase_price: '',
    initial_stock: '50',
    batch_number: '',
    expiry_date: '',
    barcode: '',
    prescription_required: false,
    controlled_drug: false,
    storage_requirements: 'Store below 25°C',
    description: '',
  })

  // Load dashboard data with dynamic threshold
  const fetchDashboard = useCallback(async (currentThreshold: number) => {
    try {
      const res = await get<DashboardData>(`/reports/dashboard?threshold=${currentThreshold}`)
      setData(res)
    } catch {
      toast.error('Failed to load dashboard inventory data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard(threshold)
  }, [threshold, fetchDashboard])

  // Load categories and suppliers for admin add medicine
  useEffect(() => {
    async function loadMeta() {
      try {
        const [catsRes, supsRes] = await Promise.all([
          get<Category[]>('/medicines/categories'),
          get<Supplier[]>('/suppliers'),
        ])
        if (Array.isArray(catsRes)) setCategories(catsRes)
        if (Array.isArray(supsRes)) setSuppliers(supsRes)
      } catch {
        // silent
      }
    }
    loadMeta()
  }, [])

  // Auto-generate barcode helper
  const generateBarcode = () => {
    const code = 'PH' + Math.floor(10000000 + Math.random() * 89999999)
    setNewMedForm(prev => ({ ...prev, barcode: code }))
    toast.success(`Generated Barcode: ${code}`)
  }

  // Handle Admin Add Medicine submit
  const handleAddMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMedForm.brand_name.trim() || !newMedForm.unit_price) {
      toast.error('Brand name and selling price are required')
      return
    }

    setAddMedicineLoading(true)
    try {
      const sellingPrice = parseFloat(newMedForm.unit_price)
      const purchasePrice = newMedForm.purchase_price
        ? parseFloat(newMedForm.purchase_price)
        : Math.round(sellingPrice * 0.65)

      const payload = {
        brand_name: newMedForm.brand_name.trim(),
        generic_name: newMedForm.generic_name.trim() || newMedForm.brand_name.trim(),
        strength: newMedForm.strength.trim(),
        dosage_form: newMedForm.dosage_form,
        category_id: newMedForm.category_id ? parseInt(newMedForm.category_id) : undefined,
        supplier_id: newMedForm.supplier_id ? parseInt(newMedForm.supplier_id) : undefined,
        unit: newMedForm.unit,
        unit_price: sellingPrice,
        purchase_price: purchasePrice,
        initial_stock: parseInt(newMedForm.initial_stock) || 0,
        batch_number: newMedForm.batch_number.trim() || `BN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        expiry_date: newMedForm.expiry_date || new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        barcode: newMedForm.barcode.trim() || undefined,
        prescription_required: newMedForm.prescription_required,
        controlled_drug: newMedForm.controlled_drug,
        storage_requirements: newMedForm.storage_requirements,
        description: newMedForm.description.trim() || undefined,
      }

      await post('/medicines', payload)
      toast.success(`Medicine "${newMedForm.brand_name}" added and stocked successfully!`)
      setShowAddMedicineModal(false)
      // Reset form
      setNewMedForm({
        brand_name: '',
        generic_name: '',
        strength: '',
        dosage_form: 'Tablet',
        category_id: '',
        supplier_id: '',
        unit: 'tablet',
        unit_price: '',
        purchase_price: '',
        initial_stock: '50',
        batch_number: '',
        expiry_date: '',
        barcode: '',
        prescription_required: false,
        controlled_drug: false,
        storage_requirements: 'Store below 25°C',
        description: '',
      })
      fetchDashboard(threshold)
      refreshNotifications()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add medicine')
    } finally {
      setAddMedicineLoading(false)
    }
  }

  // Handle Quick Reorder execute
  const handleExecuteReorder = async () => {
    if (!reorderItem) return
    setReorderSubmitting(true)
    try {
      const res: any = await post('/inventory/quick-reorder', {
        medicine_id: reorderItem.id,
        quantity: reorderQuantity,
        supplier_id: reorderItem.supplier_id,
        purchase_price: reorderItem.purchase_price,
      })

      toast.success(res.message || `Replenished ${reorderQuantity} units of ${reorderItem.brand_name}`)
      setReorderItem(null)
      fetchDashboard(threshold)
      refreshNotifications()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reorder stock')
    } finally {
      setReorderSubmitting(false)
    }
  }

  // Filtered low stock items
  const filteredLowStockItems = useMemo(() => {
    if (!data?.low_stock_items) return []
    return data.low_stock_items.filter((item) => {
      const matchesSearch =
        item.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category_name && item.category_name.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesUrgency = filterUrgency === 'all' || item.urgency === filterUrgency
      return matchesSearch && matchesUrgency
    })
  }, [data?.low_stock_items, searchQuery, filterUrgency])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        <p className="text-sm text-slate-500 font-medium">Scanning live inventory & reorder levels...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No dashboard data available
      </div>
    )
  }

  const statCards = [
    { label: "Today's Sales", val: `${data.today.sales_count} txns`, icon: ShoppingCart, bg: 'from-emerald-600 to-teal-700' },
    { label: "Today's Revenue", val: formatKSh(data.today.revenue), icon: DollarSign, bg: 'from-blue-600 to-indigo-700' },
    { label: 'Active Medicines', val: `${data.medicines.toLocaleString()} items`, icon: Package, bg: 'from-purple-600 to-violet-700' },
    { label: 'Registered Patients', val: `${data.customers.toLocaleString()} patients`, icon: Users, bg: 'from-amber-600 to-orange-700' },
  ]

  const isAdminOrPharmacist = user?.role === 'admin' || user?.role === 'pharmacist'

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto pb-16">
      <Toaster position="top-right" />

      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hauzral Pharmacy Dispensary</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 capitalize">
              {user?.role || 'Staff'} Mode
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time inventory levels, dynamic reordering triggers, and dispensary sales analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh button */}
          <button
            onClick={() => {
              setRefreshing(true)
              fetchDashboard(threshold)
              refreshNotifications()
            }}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Refresh inventory count"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Quick POS Launch */}
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <span>Open POS Register</span>
          </button>

          {/* Admin Add Medicine Button */}
          {isAdminOrPharmacist && (
            <button
              onClick={() => setShowAddMedicineModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Medicine</span>
            </button>
          )}
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
            <div className={`rounded-2xl bg-gradient-to-br ${card.bg} p-5 text-white shadow-lg shadow-slate-200/50`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/80">{card.label}</p>
                  <p className="text-2xl font-black tracking-tight mt-1">{card.val}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-xl p-3">
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ============================================================== */}
      {/* CORE FEATURE: INVENTORY LEVEL MONITORING & REORDER SYSTEM */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Section Header with Alert Pills & Threshold Selector */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Inventory Level & Reorder Monitoring Center</h2>
                  <p className="text-xs text-slate-500">
                    Continuously scans stock across all active medicines against your defined safety buffer.
                  </p>
                </div>
              </div>
            </div>

            {/* Threshold Selector Control */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold text-slate-700">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>Reorder Alert Threshold:</span>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="font-bold text-emerald-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value={10}>10 units (Lean)</option>
                  <option value={15}>15 units (Standard)</option>
                  <option value={20}>20 units (Recommended)</option>
                  <option value={30}>30 units (High Buffer)</option>
                  <option value={50}>50 units (Wholesale)</option>
                </select>
              </div>

              {/* Alert Counts */}
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  {data.out_of_stock_count} Out of Stock
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {data.critical_count} Critical (&le;5)
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {data.expiring_soon_count} Near Expiry
                </span>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-200/70">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('low_stock')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'low_stock'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Low Stock Items ({data.low_stock_count})</span>
              </button>

              <button
                onClick={() => setActiveTab('expiring')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'expiring'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Near Expiry Batches ({data.expiring_soon_count})</span>
              </button>
            </div>

            {/* Filter Pills for Low Stock */}
            {activeTab === 'low_stock' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search low stock..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
                  />
                </div>

                <select
                  value={filterUrgency}
                  onChange={(e: any) => setFilterUrgency(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Urgencies</option>
                  <option value="out_of_stock">Out of Stock (0)</option>
                  <option value="critical">Critical (&le; 5)</option>
                  <option value="low">Low Stock (&le; {threshold})</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Low Stock Items List */}
        {activeTab === 'low_stock' && (
          <div>
            {filteredLowStockItems.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">Inventory Levels Optimal!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  All monitored medicines are currently above your threshold of {threshold} units. No immediate reordering required.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Medicine & Formulation</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Current Stock</th>
                      <th className="py-3 px-4">Stock Status & Fuel Meter</th>
                      <th className="py-3 px-4">Suggested Reorder</th>
                      <th className="py-3 px-4">Supplier & Lead</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredLowStockItems.map((item) => {
                      const isOutOfStock = item.total_stock <= 0
                      const isCritical = item.total_stock > 0 && item.total_stock <= 5
                      const percentage = Math.min(100, Math.round((item.total_stock / threshold) * 100))

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-sm">{item.brand_name}</div>
                            <div className="text-slate-500 text-[11px]">
                              {item.generic_name} {item.strength ? `• ${item.strength}` : ''} ({item.dosage_form})
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                              {item.category_name || 'General Medicine'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-extrabold text-sm text-slate-900">
                              {item.total_stock} <span className="font-normal text-slate-500 text-[11px]">{item.unit}s</span>
                            </div>
                            <div className="text-[10px] text-slate-400">Threshold: {threshold}</div>
                          </td>

                          <td className="py-3 px-4 w-48">
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isOutOfStock
                                    ? 'bg-red-100 text-red-800'
                                    : isCritical
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {isOutOfStock ? 'Depleted (0)' : isCritical ? 'Urgent Reorder' : 'Low Buffer'}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500">{percentage}%</span>
                            </div>
                            {/* Visual meter */}
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOutOfStock ? 'bg-red-600' : isCritical ? 'bg-amber-500' : 'bg-yellow-500'
                                }`}
                                style={{ width: `${Math.max(6, percentage)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-emerald-700">+{item.suggested_reorder} {item.unit}s</div>
                            <div className="text-[10px] text-slate-500">
                              Est. {formatKSh(item.reorder_cost)}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{item.supplier_name || 'Phillips Pharmaceuticals'}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-slate-400" />
                              {item.supplier_phone || '+254 700 888 999'}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setReorderItem(item)
                                setReorderQuantity(item.suggested_reorder)
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold rounded-xl text-xs transition-colors border border-emerald-200 inline-flex items-center gap-1.5 shadow-sm"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Reorder</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Near Expiry Batches List */}
        {activeTab === 'expiring' && (
          <div>
            {data.expiring_batches.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Imminent Expiry Risks!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  All stored batches have valid expiry dates beyond 90 days. FEFO protocols remain healthy.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Medicine</th>
                      <th className="py-3 px-4">Batch Number</th>
                      <th className="py-3 px-4">Batch Quantity</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Days Left</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4 text-right">FEFO Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {data.expiring_batches.map((batch) => {
                      const isExpired = batch.days_to_expiry <= 0
                      const isUrgent = batch.days_to_expiry <= 30

                      return (
                        <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {batch.brand_name} {batch.strength && `(${batch.strength})`}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700">{batch.batch_number}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{batch.quantity} units</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{batch.expiry_date}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                isExpired
                                  ? 'bg-red-100 text-red-800'
                                  : isUrgent
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {isExpired ? 'Expired' : `${batch.days_to_expiry} days remaining`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{batch.supplier_name || 'Standard Distributor'}</td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
                              Prioritize for POS dispensing
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Analytics & Quick Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Medicines */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base">Top Dispensed Medicines</h3>
            <span className="text-xs text-slate-400">By Sales Quantity</span>
          </div>
          {data.top_medicines.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">No sales registered yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.top_medicines} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="brand_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [name === 'total_sold' ? val : formatKSh(Number(val) || 0), name === 'total_sold' ? 'Quantity' : 'Revenue']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="total_sold" fill="#059669" radius={[6, 6, 0, 0]} name="total_sold" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Transactions Feed */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base">Recent Register Sales</h3>
            <button onClick={() => navigate('/reports')} className="text-xs text-emerald-600 font-semibold hover:underline">
              View Reports
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent_sales.map((sale: any) => (
              <div key={sale.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    Sale #{sale.id} &bull; <span className="font-normal text-slate-500 capitalize">{sale.payment_method}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Cashier: {sale.user_name || 'Staff'} &bull; {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 text-sm">{formatKSh(sale.total_amount)}</div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Completed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: 1-CLICK QUICK REORDER RESTOCK MODAL */}
      {/* ============================================================== */}
      <AnimatePresence>
        {reorderItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Quick Restock Order</h3>
                    <p className="text-xs text-slate-500">Replenish stock for this depleted medication</p>
                  </div>
                </div>
                <button onClick={() => setReorderItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Medicine:</span>
                  <span className="font-bold text-slate-900">{reorderItem.brand_name} {reorderItem.strength}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Current Stock:</span>
                  <span className="font-bold text-red-600">{reorderItem.total_stock} {reorderItem.unit}s</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-semibold text-slate-800">{reorderItem.supplier_name || 'Cosmos Pharmaceuticals'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Unit Purchase Cost:</span>
                  <span className="font-semibold text-slate-800">{formatKSh(reorderItem.purchase_price || reorderItem.unit_price * 0.65)}</span>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reorder Quantity ({reorderItem.unit}s)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={reorderQuantity}
                      onChange={(e) => setReorderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setReorderQuantity(reorderItem.suggested_reorder)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl whitespace-nowrap"
                    >
                      Suggested ({reorderItem.suggested_reorder})
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-800">Total Purchase Commitment:</span>
                  <span className="text-sm font-extrabold text-emerald-900">
                    {formatKSh(reorderQuantity * (reorderItem.purchase_price || reorderItem.unit_price * 0.65))}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReorderItem(null)}
                  className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reorderSubmitting}
                  onClick={handleExecuteReorder}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                >
                  {reorderSubmitting ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Restock</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL 2: ADMIN ADD MEDICINE MODAL */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showAddMedicineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-100 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Pill className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Add New Medicine to Formulary</h3>
                    <p className="text-xs text-slate-500">Admin entry &bull; Auto-seeds batch &amp; creates barcode</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMedicineModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddMedicineSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
                    <input
                      type="text"
                      required
                      value={newMedForm.brand_name}
                      onChange={(e) => setNewMedForm({ ...newMedForm, brand_name: e.target.value })}
                      placeholder="e.g. Augmentin, Cataflam"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Generic Name</label>
                    <input
                      type="text"
                      value={newMedForm.generic_name}
                      onChange={(e) => setNewMedForm({ ...newMedForm, generic_name: e.target.value })}
                      placeholder="e.g. Amoxicillin + Clavulanate"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Strength</label>
                    <input
                      type="text"
                      value={newMedForm.strength}
                      onChange={(e) => setNewMedForm({ ...newMedForm, strength: e.target.value })}
                      placeholder="e.g. 625mg, 500mg"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dosage Form</label>
                    <select
                      value={newMedForm.dosage_form}
                      onChange={(e) => setNewMedForm({ ...newMedForm, dosage_form: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {DOSAGE_FORMS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                    <select
                      value={newMedForm.unit}
                      onChange={(e) => setNewMedForm({ ...newMedForm, unit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Therapeutic Category</label>
                    <select
                      value={newMedForm.category_id}
                      onChange={(e) => setNewMedForm({ ...newMedForm, category_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Supplier</label>
                    <select
                      value={newMedForm.supplier_id}
                      onChange={(e) => setNewMedForm({ ...newMedForm, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">Select Supplier...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Pricing & Stock Details */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Pricing & Initial Inventory Batch
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (KSh) *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={newMedForm.unit_price}
                        onChange={(e) => setNewMedForm({ ...newMedForm, unit_price: e.target.value })}
                        placeholder="e.g. 25.00"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price (KSh)</label>
                      <input
                        type="number"
                        step="any"
                        value={newMedForm.purchase_price}
                        onChange={(e) => setNewMedForm({ ...newMedForm, purchase_price: e.target.value })}
                        placeholder="Auto ~65% if empty"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Stock Units</label>
                      <input
                        type="number"
                        value={newMedForm.initial_stock}
                        onChange={(e) => setNewMedForm({ ...newMedForm, initial_stock: e.target.value })}
                        placeholder="e.g. 50"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Number</label>
                      <input
                        type="text"
                        value={newMedForm.batch_number}
                        onChange={(e) => setNewMedForm({ ...newMedForm, batch_number: e.target.value })}
                        placeholder="Auto-generated if empty"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Expiry Date</label>
                      <input
                        type="date"
                        value={newMedForm.expiry_date}
                        onChange={(e) => setNewMedForm({ ...newMedForm, expiry_date: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Barcode & Compliance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMedForm.barcode}
                        onChange={(e) => setNewMedForm({ ...newMedForm, barcode: e.target.value })}
                        placeholder="Scan or auto-generate"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={generateBarcode}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1"
                      >
                        <Barcode className="w-3.5 h-3.5" />
                        <span>Gen</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Requirements</label>
                    <input
                      type="text"
                      value={newMedForm.storage_requirements}
                      onChange={(e) => setNewMedForm({ ...newMedForm, storage_requirements: e.target.value })}
                      placeholder="e.g. Store below 25°C"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Flags */}
                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMedForm.prescription_required}
                      onChange={(e) => setNewMedForm({ ...newMedForm, prescription_required: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">Requires Prescription (Rx Only)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMedForm.controlled_drug}
                      onChange={(e) => setNewMedForm({ ...newMedForm, controlled_drug: e.target.checked })}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-red-700">Controlled Substance</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddMedicineModal(false)}
                    className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addMedicineLoading}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                  >
                    {addMedicineLoading ? (
                      <span>Adding to formulary...</span>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Save &amp; Stock Medicine</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
