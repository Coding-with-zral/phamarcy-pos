import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  X,
  Eye,
  FileText,
  Loader2,
  Pill,
  User,
  Stethoscope,
  Trash2,
  CheckCircle,
  ExternalLink,
  Filter,
  Clock,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { get, post, put } from '../utils/api'
import type { Prescription, PrescriptionItem, Customer, Medicine } from '../types'

interface PrescriptionWithNotes extends Prescription {
  notes?: string
}

interface NewPrescriptionForm {
  customer_id: number | null
  patient_name: string
  patient_phone: string
  doctor_name: string
  doctor_license: string
  hospital: string
  prescription_date: string
  diagnosis: string
  notes: string
  items: PrescriptionItemForm[]
}

interface PrescriptionItemForm {
  medicine_id: number | null
  medicine_search: string
  dosage: string
  frequency: string
  duration: string
  quantity_prescribed: number
  notes: string
}

const emptyItem: PrescriptionItemForm = {
  medicine_id: null,
  medicine_search: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity_prescribed: 1,
  notes: '',
}

const emptyForm: NewPrescriptionForm = {
  customer_id: null,
  patient_name: '',
  patient_phone: '',
  doctor_name: '',
  doctor_license: '',
  hospital: '',
  prescription_date: new Date().toISOString().split('T')[0],
  diagnosis: '',
  notes: '',
  items: [{ ...emptyItem }],
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

type TabKey = 'all' | 'active' | 'dispensed' | 'expired'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All Prescriptions' },
  { key: 'active', label: 'Active' },
  { key: 'dispensed', label: 'Dispensed' },
  { key: 'expired', label: 'Expired' },
]

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionWithNotes | null>(null)
  const [formData, setFormData] = useState<NewPrescriptionForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [dispensing, setDispensing] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  const [medicineSearchResults, setMedicineSearchResults] = useState<Medicine[]>([])
  const [searchingMedicine, setSearchingMedicine] = useState<number | null>(null)

  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await get<Prescription[]>('/prescriptions')
      setPrescriptions(res)
    } catch {
      toast.error('Failed to load prescriptions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrescriptions()
  }, [fetchPrescriptions])

  const filtered = prescriptions.filter((p) => {
    const matchesSearch =
      (p.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      p.doctor_name.toLowerCase().includes(search.toLowerCase()) ||
      String(p.id).includes(search)
    const matchesTab =
      activeTab === 'all' ||
      p.status.toLowerCase() === activeTab
    return matchesSearch && matchesTab
  })

  const tabCounts = {
    all: prescriptions.length,
    active: prescriptions.filter((p) => p.status.toLowerCase() === 'active').length,
    dispensed: prescriptions.filter((p) => p.status.toLowerCase() === 'dispensed').length,
    expired: prescriptions.filter((p) => p.status.toLowerCase() === 'expired').length,
  }

  const searchCustomers = async (query: string) => {
    setCustomerSearch(query)
    if (query.length < 2) {
      setCustomerResults([])
      return
    }
    try {
      setSearchingCustomers(true)
      const res = await get<Customer[]>(`/customers?search=${encodeURIComponent(query)}`)
      setCustomerResults(res)
    } catch {
      setCustomerResults([])
    } finally {
      setSearchingCustomers(false)
    }
  }

  const selectCustomer = (customer: Customer) => {
    setFormData({ ...formData, customer_id: customer.id, patient_name: customer.name, patient_phone: customer.phone })
    setCustomerSearch('')
    setCustomerResults([])
  }

  const searchMedicine = async (query: string, index: number) => {
    const items = [...formData.items]
    items[index].medicine_search = query
    setFormData({ ...formData, items })
    if (query.length < 2) {
      setMedicineSearchResults([])
      return
    }
    try {
      setSearchingMedicine(index)
      const res = await get<Medicine[]>(`/medicines?search=${encodeURIComponent(query)}`)
      setMedicineSearchResults(res)
    } catch {
      setMedicineSearchResults([])
    } finally {
      setSearchingMedicine(null)
    }
  }

  const selectMedicine = (medicine: Medicine, index: number) => {
    const items = [...formData.items]
    items[index].medicine_id = medicine.id
    items[index].medicine_search = `${medicine.brand_name} (${medicine.generic_name}) - ${medicine.strength}`
    setFormData({ ...formData, items })
    setMedicineSearchResults([])
  }

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] })
  }

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return
    const items = formData.items.filter((_, i) => i !== index)
    setFormData({ ...formData, items })
  }

  const updateItem = (index: number, field: keyof PrescriptionItemForm, value: string | number | null) => {
    const items = [...formData.items]
    ;(items[index] as unknown as Record<string, unknown>)[field] = value
    setFormData({ ...formData, items })
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.doctor_name.trim()) {
      toast.error('Doctor name is required')
      return
    }
    if (!formData.prescription_date) {
      toast.error('Prescription date is required')
      return
    }
    const validItems = formData.items.filter((item) => item.medicine_id !== null)
    if (validItems.length === 0) {
      toast.error('Please add at least one medicine')
      return
    }

    try {
      setSubmitting(true)
      await post('/prescriptions', {
        customer_id: formData.customer_id,
        patient_name: formData.patient_name,
        patient_phone: formData.patient_phone,
        doctor_name: formData.doctor_name,
        doctor_license: formData.doctor_license,
        hospital: formData.hospital,
        prescription_date: formData.prescription_date,
        diagnosis: formData.diagnosis,
        notes: formData.notes,
        items: validItems.map((item) => ({
          medicine_id: item.medicine_id,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          quantity_prescribed: item.quantity_prescribed,
          notes: item.notes,
        })),
      })
      toast.success('Prescription created successfully')
      setShowFormModal(false)
      setFormData(emptyForm)
      fetchPrescriptions()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create prescription'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (prescription: Prescription) => {
    try {
      const res = await get<PrescriptionWithNotes>(`/prescriptions/${prescription.id}`)
      setSelectedPrescription(res)
    } catch {
      setSelectedPrescription(prescription as PrescriptionWithNotes)
    }
    setShowDetailModal(true)
  }

  const markDispensed = async (id: number) => {
    try {
      setDispensing(true)
      await put(`/prescriptions/${id}/dispense`)
      toast.success('Prescription marked as dispensed')
      setShowDetailModal(false)
      setSelectedPrescription(null)
      fetchPrescriptions()
    } catch {
      toast.error('Failed to mark as dispensed')
    } finally {
      setDispensing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const lower = status.toLowerCase()
    if (lower === 'active') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Active
        </span>
      )
    }
    if (lower === 'dispensed') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Dispensed
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prescriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage patient prescriptions</p>
        </div>
        <button
          onClick={() => {
            setFormData(emptyForm)
            setShowFormModal(true)
          }}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Prescription
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by patient, doctor, or prescription #..."
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
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No prescriptions found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Doctor</th>
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium text-center">Medicines</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((rx) => (
                    <tr key={rx.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">#{rx.id}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {new Date(rx.prescription_date).toLocaleDateString('en-KE')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{rx.doctor_name}</div>
                        {rx.hospital && <div className="text-xs text-gray-500">{rx.hospital}</div>}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{rx.customer_name || 'Walk-in'}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          <Pill className="w-3 h-3" />
                          {rx.items?.length || 0}
                        </span>
                      </td>
                      <td className="px-5 py-3">{getStatusBadge(rx.status)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetail(rx)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {rx.status.toLowerCase() === 'active' && (
                            <button
                              onClick={() => markDispensed(rx.id)}
                              disabled={dispensing}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                              title="Mark as Dispensed"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
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
            {filtered.map((rx) => (
              <motion.div
                key={rx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Prescription #{rx.id}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(rx.prescription_date).toLocaleDateString('en-KE')}
                    </p>
                  </div>
                  {getStatusBadge(rx.status)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Doctor:</span>
                    <span className="ml-1 text-gray-700 font-medium">{rx.doctor_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Patient:</span>
                    <span className="ml-1 text-gray-700">{rx.customer_name || 'Walk-in'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Medicines:</span>
                    <span className="ml-1 text-purple-600 font-medium">{rx.items?.length || 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => openDetail(rx)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-emerald-600 hover:bg-emerald-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                  {rx.status.toLowerCase() === 'active' && (
                    <button
                      onClick={() => markDispensed(rx.id)}
                      disabled={dispensing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" /> Dispense
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-sm text-gray-500">
            Showing {filtered.length} of {prescriptions.length} prescriptions
          </div>
        </>
      )}

      {/* New Prescription Modal */}
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
              className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-semibold text-gray-900">New Prescription</h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
                {/* Patient Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    Patient Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="relative sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Patient / Customer</label>
                      <input
                        type="text"
                        value={customerSearch || formData.patient_name}
                        onChange={(e) => {
                          if (formData.customer_id) {
                            setFormData({ ...formData, customer_id: null, patient_name: e.target.value, patient_phone: '' })
                          }
                          searchCustomers(e.target.value)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="Search existing customer or type new name..."
                      />
                      {searchingCustomers && (
                        <div className="absolute right-3 top-9">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      )}
                      {customerResults.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {customerResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-medium text-gray-900">{c.name}</span>
                                <span className="text-gray-500 ml-2">{c.phone}</span>
                              </div>
                              <span className="text-xs text-emerald-600">Select</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Patient Phone</label>
                      <input
                        type="tel"
                        value={formData.patient_phone}
                        onChange={(e) => setFormData({ ...formData, patient_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Doctor Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    Doctor Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name *</label>
                      <input
                        type="text"
                        value={formData.doctor_name}
                        onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                      <input
                        type="text"
                        value={formData.doctor_license}
                        onChange={(e) => setFormData({ ...formData, doctor_license: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hospital / Clinic</label>
                      <input
                        type="text"
                        value={formData.hospital}
                        onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Diagnosis & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prescription Date *</label>
                    <input
                      type="date"
                      value={formData.prescription_date}
                      onChange={(e) => setFormData({ ...formData, prescription_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                    <input
                      type="text"
                      value={formData.diagnosis}
                      onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Medicines */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-gray-400" />
                      Medicines
                    </h3>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Medicine
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Medicine {index + 1}</span>
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.medicine_search}
                            onChange={(e) => searchMedicine(e.target.value, index)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                            placeholder="Search medicine by name..."
                          />
                          {searchingMedicine === index && (
                            <div className="absolute right-3 top-2.5">
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            </div>
                          )}
                          {medicineSearchResults.length > 0 && searchingMedicine === null && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                              {medicineSearchResults.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => selectMedicine(m, index)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50"
                                >
                                  <span className="font-medium text-gray-900">{m.brand_name}</span>
                                  <span className="text-gray-500 ml-1">({m.generic_name})</span>
                                  <span className="text-gray-400 ml-1">{m.strength}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
                            <input
                              type="text"
                              value={item.dosage}
                              onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                              placeholder="e.g. 500mg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                            <input
                              type="text"
                              value={item.frequency}
                              onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                              placeholder="e.g. 3x daily"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                            <input
                              type="text"
                              value={item.duration}
                              onChange={(e) => updateItem(index, 'duration', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                              placeholder="e.g. 7 days"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity_prescribed}
                              onChange={(e) => updateItem(index, 'quantity_prescribed', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                            placeholder="Special instructions..."
                          />
                        </div>
                      </div>
                    ))}
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
                    Create Prescription
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedPrescription && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowDetailModal(false)} />
            <motion.div
              variants={modal}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-semibold text-gray-900">Prescription #{selectedPrescription.id}</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {new Date(selectedPrescription.prescription_date).toLocaleDateString('en-KE')}
                  </span>
                  {getStatusBadge(selectedPrescription.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Doctor</p>
                    <p className="font-medium text-gray-900">{selectedPrescription.doctor_name}</p>
                    {selectedPrescription.doctor_license && (
                      <p className="text-xs text-gray-500">License: {selectedPrescription.doctor_license}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Patient</p>
                    <p className="font-medium text-gray-900">{selectedPrescription.customer_name || 'Walk-in'}</p>
                  </div>
                  {selectedPrescription.hospital && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Hospital</p>
                      <p className="text-gray-700">{selectedPrescription.hospital}</p>
                    </div>
                  )}
                  {selectedPrescription.diagnosis && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Diagnosis</p>
                      <p className="text-gray-700">{selectedPrescription.diagnosis}</p>
                    </div>
                  )}
                </div>

                {(selectedPrescription as PrescriptionWithNotes).notes && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Notes</p>
                    <p className="text-sm text-blue-600">{(selectedPrescription as PrescriptionWithNotes).notes}</p>
                  </div>
                )}

                {selectedPrescription.items && selectedPrescription.items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-gray-400" />
                      Medicines ({selectedPrescription.items.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedPrescription.items.map((item, idx) => (
                        <div key={item.id || idx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {item.brand_name || `Medicine #${item.medicine_id}`}
                              </p>
                              {item.generic_name && (
                                <p className="text-xs text-gray-500">
                                  {item.generic_name} {item.strength}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              Qty: {item.quantity_prescribed}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                            {item.dosage && (
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                <strong>Dosage:</strong> {item.dosage}
                              </span>
                            )}
                            {item.frequency && (
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                <strong>Frequency:</strong> {item.frequency}
                              </span>
                            )}
                            {item.duration && (
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                <strong>Duration:</strong> {item.duration}
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="mt-1.5 text-xs text-gray-500 italic">{item.notes}</p>
                          )}
                          {item.quantity_dispensed > 0 && (
                            <p className="mt-1 text-xs text-blue-600">
                              Dispensed: {item.quantity_dispensed} / {item.quantity_prescribed}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                  {selectedPrescription.status.toLowerCase() === 'active' && (
                    <>
                      <button
                        onClick={() => markDispensed(selectedPrescription.id)}
                        disabled={dispensing}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {dispensing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Mark as Dispensed
                      </button>
                      <a
                        href="/pos"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" /> Go to POS
                      </a>
                    </>
                  )}
                  {selectedPrescription.status.toLowerCase() !== 'active' && (
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
