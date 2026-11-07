import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  X,
  Eye,
  Edit,
  Trash2,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Loader2,
  Banknote,
  FileText,
  DollarSign,
  AlertTriangle,
  Receipt,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { get, post, put, del } from '../utils/api'
import type { Supplier, Sale } from '../types'

interface SupplierWithDetails extends Supplier {
  recent_purchases?: Sale[]
  payment_history?: SupplierPayment[]
}

interface SupplierPayment {
  id: number
  supplier_id: number
  amount: number
  payment_method: string
  reference_number: string
  created_at: string
}

interface SupplierFormData {
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
  city: string
  payment_terms: string
}

interface PaymentFormData {
  amount: string
  payment_method: string
  reference_number: string
}

const emptyForm: SupplierFormData = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  payment_terms: '',
}

const emptyPayment: PaymentFormData = {
  amount: '',
  payment_method: 'Cash',
  reference_number: '',
}

function formatKSh(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const backdrop: any = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
const modal: any = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithDetails | null>(null)
  const [formData, setFormData] = useState<SupplierFormData>(emptyForm)
  const [paymentData, setPaymentData] = useState<PaymentFormData>(emptyPayment)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await get<Supplier[]>('/suppliers')
      setSuppliers(res)
    } catch {
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_person.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search) ||
      (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  )

  const openAddModal = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setShowFormModal(true)
  }

  const openEditModal = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      payment_terms: supplier.payment_terms || '',
    })
    setEditingId(supplier.id)
    setShowFormModal(true)
  }

  const openProfile = async (supplier: Supplier) => {
    try {
      const res = await get<SupplierWithDetails>(`/suppliers/${supplier.id}`)
      setSelectedSupplier({
        ...res,
        recent_purchases: res.recent_purchases || [],
        payment_history: res.payment_history || [],
      })
    } catch {
      setSelectedSupplier({ ...supplier, recent_purchases: [], payment_history: [] })
    }
    setShowProfileModal(true)
  }

  const openPaymentModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier as SupplierWithDetails)
    setPaymentData(emptyPayment)
    setShowPaymentModal(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    if (!formData.contact_person.trim()) {
      toast.error('Contact person is required')
      return
    }
    if (!formData.phone.trim()) {
      toast.error('Phone number is required')
      return
    }
    try {
      setSubmitting(true)
      if (editingId) {
        await put(`/suppliers/${editingId}`, formData)
        toast.success('Supplier updated successfully')
      } else {
        await post('/suppliers', formData)
        toast.success('Supplier added successfully')
      }
      setShowFormModal(false)
      fetchSuppliers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupplier) return
    const amount = parseFloat(paymentData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }
    if (amount > selectedSupplier.outstanding_balance) {
      toast.error('Payment amount exceeds outstanding balance')
      return
    }
    try {
      setPaying(true)
      await post(`/suppliers/${selectedSupplier.id}/payment`, {
        amount,
        payment_method: paymentData.payment_method,
        reference_number: paymentData.reference_number,
      })
      toast.success('Payment recorded successfully')
      setShowPaymentModal(false)
      setSelectedSupplier(null)
      fetchSuppliers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      toast.error(message)
    } finally {
      setPaying(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedSupplier) return
    try {
      setDeleting(true)
      await del(`/suppliers/${selectedSupplier.id}`)
      toast.success('Supplier deleted successfully')
      setShowDeleteConfirm(false)
      setShowProfileModal(false)
      setSelectedSupplier(null)
      fetchSuppliers()
    } catch {
      toast.error('Failed to delete supplier')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your pharmaceutical suppliers</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, contact, phone, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No suppliers found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Contact Person</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">City</th>
                    <th className="px-5 py-3 font-medium text-right">Outstanding</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{supplier.contact_person}</td>
                      <td className="px-5 py-3 text-gray-600">{supplier.phone}</td>
                      <td className="px-5 py-3 text-gray-600">{supplier.email || '-'}</td>
                      <td className="px-5 py-3 text-gray-600">{supplier.city || '-'}</td>
                      <td className="px-5 py-3 text-right">
                        {supplier.outstanding_balance > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            {formatKSh(supplier.outstanding_balance)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openProfile(supplier)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(supplier)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {supplier.outstanding_balance > 0 && (
                            <button
                              onClick={() => openPaymentModal(supplier)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Make Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedSupplier(supplier as SupplierWithDetails)
                              setShowDeleteConfirm(true)
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((supplier) => (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                    <p className="text-sm text-gray-500">{supplier.contact_person}</p>
                  </div>
                  {supplier.outstanding_balance > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {formatKSh(supplier.outstanding_balance)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <span className="ml-1 text-gray-700">{supplier.phone}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">City:</span>
                    <span className="ml-1 text-gray-700">{supplier.city || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-1 text-gray-700">{supplier.email || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => openProfile(supplier)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-emerald-600 hover:bg-emerald-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button
                    onClick={() => openEditModal(supplier)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  {supplier.outstanding_balance > 0 && (
                    <button
                      onClick={() => openPaymentModal(supplier)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-amber-600 hover:bg-amber-50 py-1.5 rounded-lg transition-colors"
                    >
                      <DollarSign className="w-4 h-4" /> Pay
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedSupplier(supplier as SupplierWithDetails)
                      setShowDeleteConfirm(true)
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-red-600 hover:bg-red-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-sm text-gray-500">
            Showing {filtered.length} of {suppliers.length} suppliers
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showFormModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && setShowFormModal(false)} />
            <motion.div
              variants={modal}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? 'Edit Supplier' : 'Add Supplier'}
                </h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <input
                      type="text"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. Net 30, Cash on Delivery"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingId ? 'Update Supplier' : 'Add Supplier'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && selectedSupplier && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowProfileModal(false)} />
            <motion.div
              variants={modal}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-semibold text-gray-900">Supplier Profile</h2>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedSupplier.name}</h3>
                    <p className="text-sm text-gray-500">{selectedSupplier.contact_person}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedSupplier.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedSupplier.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedSupplier.address || 'No address'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedSupplier.city || 'No city'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-lg p-3 text-center ${selectedSupplier.outstanding_balance > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {selectedSupplier.outstanding_balance > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-1" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    )}
                    <p className={`text-lg font-bold ${selectedSupplier.outstanding_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatKSh(selectedSupplier.outstanding_balance)}
                    </p>
                    <p className={`text-xs ${selectedSupplier.outstanding_balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      Outstanding Balance
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <FileText className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-gray-900">{selectedSupplier.payment_terms || 'Not set'}</p>
                    <p className="text-xs text-gray-500">Payment Terms</p>
                  </div>
                </div>

                {selectedSupplier.payment_history && selectedSupplier.payment_history.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment History</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-left text-gray-600">
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Method</th>
                            <th className="px-3 py-2 font-medium">Reference</th>
                            <th className="px-3 py-2 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedSupplier.payment_history.slice(0, 5).map((payment) => (
                            <tr key={payment.id}>
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(payment.created_at).toLocaleDateString('en-KE')}
                              </td>
                              <td className="px-3 py-2 text-gray-700">{payment.payment_method}</td>
                              <td className="px-3 py-2 text-gray-500">{payment.reference_number || '-'}</td>
                              <td className="px-3 py-2 text-right font-medium text-emerald-600">
                                -{formatKSh(payment.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedSupplier.recent_purchases && selectedSupplier.recent_purchases.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Recent Purchases</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-left text-gray-600">
                            <th className="px-3 py-2 font-medium">Sale #</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedSupplier.recent_purchases.slice(0, 5).map((purchase) => (
                            <tr key={purchase.id}>
                              <td className="px-3 py-2 font-medium text-gray-900">#{purchase.id}</td>
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(purchase.created_at).toLocaleDateString('en-KE')}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{formatKSh(purchase.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                  {selectedSupplier.outstanding_balance > 0 && (
                    <button
                      onClick={() => {
                        setShowProfileModal(false)
                        openPaymentModal(selectedSupplier)
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      <DollarSign className="w-4 h-4" /> Make Payment
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowProfileModal(false)
                      openEditModal(selectedSupplier)
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileModal(false)
                      setShowDeleteConfirm(true)
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedSupplier && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => !paying && setShowPaymentModal(false)} />
            <motion.div
              variants={modal}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative bg-white rounded-xl shadow-xl w-full max-w-md"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Make Payment</h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handlePayment} className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500">Outstanding Balance</p>
                  <p className="text-xl font-bold text-red-600">{formatKSh(selectedSupplier.outstanding_balance)}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedSupplier.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={selectedSupplier.outstanding_balance}
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={paymentData.reference_number}
                    onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Cheque number, transaction ID, etc."
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={paying}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paying}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                    Confirm Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && selectedSupplier && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setShowDeleteConfirm(false)} />
            <motion.div
              variants={modal}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Supplier</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete <strong>{selectedSupplier.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
