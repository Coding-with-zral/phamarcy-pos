import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  X,
  Eye,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  AlertTriangle,
  Shield,
  Star,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { get, post, put, del } from '../utils/api'
import type { Customer, Sale } from '../types'

interface CustomerWithSales extends Customer {
  recent_sales?: Sale[]
}

interface CustomerFormData {
  name: string
  phone: string
  email: string
  address: string
  date_of_birth: string
  medical_notes: string
  allergies: string
  insurance_provider: string
  insurance_number: string
}

const emptyForm: CustomerFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  date_of_birth: '',
  medical_notes: '',
  allergies: '',
  insurance_provider: '',
  insurance_number: '',
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

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithSales | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await get<Customer[] | { customers: Customer[] }>('/customers')
      setCustomers(Array.isArray(res) ? res : res.customers)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )

  const openAddModal = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setShowFormModal(true)
  }

  const openEditModal = (customer: Customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address || '',
      date_of_birth: customer.date_of_birth ? customer.date_of_birth.split('T')[0] : '',
      medical_notes: customer.medical_notes || '',
      allergies: customer.allergies || '',
      insurance_provider: customer.insurance_provider || '',
      insurance_number: customer.insurance_number || '',
    })
    setEditingId(customer.id)
    setShowFormModal(true)
  }

  const openProfile = async (customer: Customer) => {
    try {
      const res = await get<CustomerWithSales>(`/customers/${customer.id}`)
      setSelectedCustomer({ ...res, recent_sales: res.recent_sales || [] })
    } catch {
      setSelectedCustomer({ ...customer, recent_sales: [] })
    }
    setShowProfileModal(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (!formData.phone.trim()) {
      toast.error('Phone number is required')
      return
    }
    try {
      setSubmitting(true)
      if (editingId) {
        await put(`/customers/${editingId}`, formData)
        toast.success('Customer updated successfully')
      } else {
        await post('/customers', formData)
        toast.success('Customer added successfully')
      }
      setShowFormModal(false)
      fetchCustomers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedCustomer) return
    try {
      setDeleting(true)
      await del(`/customers/${selectedCustomer.id}`)
      toast.success('Customer deleted successfully')
      setShowDeleteConfirm(false)
      setShowProfileModal(false)
      setSelectedCustomer(null)
      fetchCustomers()
    } catch {
      toast.error('Failed to delete customer')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your customer database</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
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
          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No customers found</p>
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
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium text-center">Loyalty Points</th>
                    <th className="px-5 py-3 font-medium text-right">Total Purchases</th>
                    <th className="px-5 py-3 font-medium">Insurance</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{customer.name}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{customer.phone}</td>
                      <td className="px-5 py-3 text-gray-600">{customer.email || '-'}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <Star className="w-3.5 h-3.5" />
                          {customer.loyalty_points}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">
                        {formatKSh(customer.total_purchases)}
                      </td>
                      <td className="px-5 py-3">
                        {customer.insurance_provider ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <Shield className="w-3 h-3" />
                            {customer.insurance_provider}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openProfile(customer)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer)
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
            {filtered.map((customer) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  </div>
                  {customer.insurance_provider && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" />
                      {customer.insurance_provider}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-1 text-gray-700">{customer.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Loyalty:</span>
                    <span className="ml-1 text-amber-600 font-medium">{customer.loyalty_points} pts</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Total Purchases:</span>
                    <span className="ml-1 font-medium text-gray-900">{formatKSh(customer.total_purchases)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => openProfile(customer)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-emerald-600 hover:bg-emerald-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button
                    onClick={() => openEditModal(customer)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCustomer(customer)
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
            Showing {filtered.length} of {customers.length} customers
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
                  {editingId ? 'Edit Customer' : 'Add Customer'}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                    <input
                      type="text"
                      value={formData.insurance_provider}
                      onChange={(e) => setFormData({ ...formData, insurance_provider: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Number</label>
                    <input
                      type="text"
                      value={formData.insurance_number}
                      onChange={(e) => setFormData({ ...formData, insurance_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                    <input
                      type="text"
                      value={formData.allergies}
                      onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. Penicillin, Aspirin"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medical Notes</label>
                    <textarea
                      value={formData.medical_notes}
                      onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
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
                    {editingId ? 'Update Customer' : 'Add Customer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && selectedCustomer && (
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
                <h2 className="text-lg font-semibold text-gray-900">Customer Profile</h2>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h3>
                    <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedCustomer.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedCustomer.address || 'No address'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      {selectedCustomer.date_of_birth
                        ? new Date(selectedCustomer.date_of_birth).toLocaleDateString('en-KE')
                        : 'No DOB'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      {selectedCustomer.insurance_provider
                        ? `${selectedCustomer.insurance_provider} (${selectedCustomer.insurance_number || '-'})`
                        : 'No insurance'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <Star className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-amber-600">{selectedCustomer.loyalty_points}</p>
                    <p className="text-xs text-amber-700">Loyalty Points</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <ShoppingCart className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-emerald-600">{formatKSh(selectedCustomer.total_purchases)}</p>
                    <p className="text-xs text-emerald-700">Total Purchases</p>
                  </div>
                </div>

                {selectedCustomer.allergies && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-red-700">Allergies</span>
                    </div>
                    <p className="text-sm text-red-600">{selectedCustomer.allergies}</p>
                  </div>
                )}

                {selectedCustomer.medical_notes && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700">Medical Notes</span>
                    </div>
                    <p className="text-sm text-blue-600">{selectedCustomer.medical_notes}</p>
                  </div>
                )}

                {selectedCustomer.recent_sales && selectedCustomer.recent_sales.length > 0 && (
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
                          {selectedCustomer.recent_sales.slice(0, 5).map((sale) => (
                            <tr key={sale.id}>
                              <td className="px-3 py-2 font-medium text-gray-900">#{sale.id}</td>
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(sale.created_at).toLocaleDateString('en-KE')}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{formatKSh(sale.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowProfileModal(false)
                      openEditModal(selectedCustomer)
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileModal(false)
                      setShowDeleteConfirm(true)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && selectedCustomer && (
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Customer</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete <strong>{selectedCustomer.name}</strong>? This action cannot be undone.
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
