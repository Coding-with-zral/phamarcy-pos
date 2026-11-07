import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, Eye, ChevronLeft, ChevronRight, X, Package, AlertTriangle, Clock, Filter, ArrowUpDown, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { get, post, put, del } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Medicine, Batch, Supplier } from '../types';
import toast from 'react-hot-toast';

interface Category {
  id: number;
  name: string;
}

interface PaginatedResponse<T> {
  medicines: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CartItem {
  medicine_id: number;
  batch_id: number;
  batch_number: string;
  medicine_name: string;
  strength: string;
  quantity: number;
  unit_price: number;
}

type Tab = 'all' | 'low_stock' | 'expiring' | 'stock_management';

const Inventory: React.FC = () => {
  const { user } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // All Medicines state
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Low Stock state
  const [lowStockMedicines, setLowStockMedicines] = useState<Medicine[]>([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  // Expiring Soon state
  const [expiringBatches, setExpiringBatches] = useState<Batch[]>([]);
  const [expiringLoading, setExpiringLoading] = useState(false);

  // Stock Management state
  const [stockMedicines, setStockMedicines] = useState<Medicine[]>([]);
  const [stockManagementLoading, setStockManagementLoading] = useState(false);
  const [stockSubTab, setStockSubTab] = useState<'stock_in' | 'adjustment' | 'stock_take'>('stock_in');

  // Stock In form
  const [stockInSearch, setStockInSearch] = useState('');
  const [stockInResults, setStockInResults] = useState<Medicine[]>([]);
  const [stockInMedicine, setStockInMedicine] = useState<Medicine | null>(null);
  const [stockInForm, setStockInForm] = useState({
    batch_number: '',
    quantity: '',
    purchase_price: '',
    selling_price: '',
    expiry_date: '',
    supplier_id: '',
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockInSubmitting, setStockInSubmitting] = useState(false);

  // Stock Adjustment form
  const [adjSearch, setAdjSearch] = useState('');
  const [adjResults, setAdjResults] = useState<Medicine[]>([]);
  const [adjMedicine, setAdjMedicine] = useState<Medicine | null>(null);
  const [adjBatches, setAdjBatches] = useState<Batch[]>([]);
  const [adjSelectedBatch, setAdjSelectedBatch] = useState('');
  const [adjForm, setAdjForm] = useState({
    adjustment_type: 'add' as 'add' | 'remove',
    quantity: '',
    reason: '',
  });
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  // Add/Edit Medicine modal
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [medicineForm, setMedicineForm] = useState({
    name: '',
    generic_name: '',
    brand_name: '',
    strength: '',
    dosage_form: '',
    category: '',
    unit_price: '',
    reorder_level: '',
    description: '',
    requires_prescription: false,
  });
  const [medicineFormSubmitting, setMedicineFormSubmitting] = useState(false);

  // Medicine detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailMedicine, setDetailMedicine] = useState<Medicine | null>(null);
  const [detailBatches, setDetailBatches] = useState<Batch[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const perPage = 15;

  // Fetch all medicines
  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(perPage));
      if (searchQuery) params.set('search', searchQuery);
      if (categoryFilter) params.set('category_id', categoryFilter);
      const res = await get<PaginatedResponse<Medicine>>(`/medicines?${params.toString()}`);
      setMedicines(res.medicines || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      toast.error('Failed to load medicines');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, categoryFilter]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await get<Category[]>('/medicines/categories');
      setCategories(Array.isArray(res) ? res : (res as any).data || []);
    } catch (err) {
      // silent
    }
  }, []);

  // Fetch low stock
  const fetchLowStock = useCallback(async () => {
    setLowStockLoading(true);
    try {
      const res = await get<Medicine[]>('/medicines/low-stock');
      setLowStockMedicines(Array.isArray(res) ? res : (res as any).data || []);
    } catch (err) {
      toast.error('Failed to load low stock medicines');
    } finally {
      setLowStockLoading(false);
    }
  }, []);

  // Fetch expiring soon
  const fetchExpiringSoon = useCallback(async () => {
    setExpiringLoading(true);
    try {
      const res = await get<Batch[]>('/medicines/expiry?days=90');
      setExpiringBatches(Array.isArray(res) ? res : (res as any).data || []);
    } catch (err) {
      toast.error('Failed to load expiring batches');
    } finally {
      setExpiringLoading(false);
    }
  }, []);

  // Fetch suppliers
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await get<Supplier[]>('/suppliers');
      setSuppliers(Array.isArray(res) ? res : (res as any).data || []);
    } catch (err) {
      // silent
    }
  }, []);

  // Fetch stock management list
  const fetchStockMedicines = useCallback(async () => {
    setStockManagementLoading(true);
    try {
      const res = await get<any>('/medicines?limit=100');
      const data = Array.isArray(res) ? res : res?.medicines || [];
      setStockMedicines(data);
    } catch (err) {
      toast.error('Failed to load medicines');
    } finally {
      setStockManagementLoading(false);
    }
  }, []);

  // Tab change handler
  useEffect(() => {
    if (activeTab === 'all') {
      fetchMedicines();
    } else if (activeTab === 'low_stock') {
      fetchLowStock();
    } else if (activeTab === 'expiring') {
      fetchExpiringSoon();
    } else if (activeTab === 'stock_management') {
      fetchStockMedicines();
      fetchSuppliers();
    }
  }, [activeTab, fetchMedicines, fetchLowStock, fetchExpiringSoon, fetchStockMedicines, fetchSuppliers]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Search debounce for all medicines
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchMedicines();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, fetchMedicines]);

  // Stock In medicine search
  const handleStockInSearch = async (query: string) => {
    setStockInSearch(query);
    if (query.length < 2) {
      setStockInResults([]);
      return;
    }
    try {
      const res = await get<any>(`/medicines?search=${encodeURIComponent(query)}`);
      const list = Array.isArray(res) ? res : res?.medicines || [];
      setStockInResults(list);
    } catch (err) {
      // silent
    }
  };

  // Stock In submit
  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInMedicine) {
      toast.error('Please select a medicine');
      return;
    }
    if (!stockInForm.batch_number || !stockInForm.quantity || !stockInForm.expiry_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    setStockInSubmitting(true);
    try {
      await post('/inventory/stock-in', {
        medicine_id: stockInMedicine.id,
        batch_number: stockInForm.batch_number,
        quantity: Number(stockInForm.quantity),
        purchase_price: stockInForm.purchase_price ? Number(stockInForm.purchase_price) : undefined,
        selling_price: stockInForm.selling_price ? Number(stockInForm.selling_price) : undefined,
        expiry_date: stockInForm.expiry_date,
        supplier_id: stockInForm.supplier_id ? Number(stockInForm.supplier_id) : undefined,
      });
      toast.success('Stock added successfully');
      setStockInMedicine(null);
      setStockInSearch('');
      setStockInResults([]);
      setStockInForm({ batch_number: '', quantity: '', purchase_price: '', selling_price: '', expiry_date: '', supplier_id: '' });
    } catch (err: any) {
      toast.error('Failed to add stock');
    } finally {
      setStockInSubmitting(false);
    }
  };

  // Stock Adjustment medicine search
  const handleAdjSearch = async (query: string) => {
    setAdjSearch(query);
    if (query.length < 2) {
      setAdjResults([]);
      return;
    }
    try {
      const res = await get<any>(`/medicines?search=${encodeURIComponent(query)}`);
      setAdjResults(Array.isArray(res) ? res : res?.medicines || []);
    } catch (err) {
      // silent
    }
  };

  // Select medicine for adjustment - fetch batches
  const selectAdjMedicine = async (med: Medicine) => {
    setAdjMedicine(med);
    setAdjSearch(med.name);
    setAdjResults([]);
    try {
      const res = await get<any>(`/medicines/${med.id}/batches`);
      setAdjBatches(Array.isArray(res) ? res : res?.batches || []);
    } catch (err) {
      toast.error('Failed to load batches');
    }
  };

  // Stock Adjustment submit
  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjMedicine || !adjSelectedBatch) {
      toast.error('Please select a medicine and batch');
      return;
    }
    if (!adjForm.quantity || Number(adjForm.quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (!adjForm.reason.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    setAdjSubmitting(true);
    try {
      await post('/inventory/adjust', {
        medicine_id: adjMedicine.id,
        batch_id: Number(adjSelectedBatch),
        adjustment_type: adjForm.adjustment_type,
        quantity: Number(adjForm.quantity),
        reason: adjForm.reason,
      });
      toast.success('Stock adjusted successfully');
      setAdjMedicine(null);
      setAdjSearch('');
      setAdjResults([]);
      setAdjBatches([]);
      setAdjSelectedBatch('');
      setAdjForm({ adjustment_type: 'add', quantity: '', reason: '' });
    } catch (err: any) {
      toast.error('Failed to adjust stock');
    } finally {
      setAdjSubmitting(false);
    }
  };

  // View medicine detail
  const viewMedicineDetail = async (med: Medicine) => {
    setDetailMedicine(med);
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const res = await get<any>(`/medicines/${med.id}/batches`);
      setDetailBatches(Array.isArray(res) ? res : res?.batches || []);
    } catch (err) {
      toast.error('Failed to load batch details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Open add medicine modal
  const openAddMedicine = () => {
    setEditingMedicine(null);
    setMedicineForm({
      name: '', generic_name: '', brand_name: '', strength: '', dosage_form: '',
      category: '', unit_price: '', reorder_level: '', description: '', requires_prescription: false,
    });
    setShowMedicineModal(true);
  };

  // Open edit medicine modal
  const openEditMedicine = (med: Medicine) => {
    setEditingMedicine(med);
    setMedicineForm({
      name: med.name || '',
      generic_name: med.generic_name || '',
      brand_name: med.brand_name || '',
      strength: med.strength || '',
      dosage_form: med.dosage_form || '',
      category: med.category || '',
      unit_price: String(med.unit_price || ''),
      reorder_level: String(med.reorder_level || ''),
      description: med.description || '',
      requires_prescription: med.requires_prescription || false,
    });
    setShowMedicineModal(true);
  };

  // Submit medicine form
  const handleMedicineFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineForm.name || !medicineForm.unit_price) {
      toast.error('Name and price are required');
      return;
    }
    setMedicineFormSubmitting(true);
    const brandName = medicineForm.brand_name || medicineForm.name;
    const unitPrice = Number(medicineForm.unit_price);
    const payload = {
      name: brandName,
      brand_name: brandName,
      generic_name: medicineForm.generic_name || brandName,
      strength: medicineForm.strength,
      dosage_form: medicineForm.dosage_form,
      category: medicineForm.category,
      unit_price: unitPrice,
      default_selling_price: unitPrice,
      purchase_price: Math.round(unitPrice * 0.65),
      reorder_level: medicineForm.reorder_level ? Number(medicineForm.reorder_level) : undefined,
      description: medicineForm.description,
      requires_prescription: medicineForm.requires_prescription,
      prescription_required: medicineForm.requires_prescription ? 1 : 0,
      initial_stock: 50,
    };
    try {
      if (editingMedicine) {
        await put(`/medicines/${editingMedicine.id}`, payload);
        toast.success('Medicine updated successfully');
      } else {
        await post('/medicines', payload);
        toast.success('Medicine added successfully');
      }
      setShowMedicineModal(false);
      fetchMedicines();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save medicine');
    } finally {
      setMedicineFormSubmitting(false);
    }
  };

  // Delete medicine
  const deleteMedicine = async (id: number) => {
    try {
      await del(`/medicines/${id}`);
      toast.success('Medicine deactivated from catalog');
      fetchMedicines();
    } catch (err: any) {
      toast.error('Failed to delete medicine');
    }
  };

  // Format KSh
  const formatKSh = (amount: number) => {
    return `KSh ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Status badge component
  const StatusBadge: React.FC<{ medicine: Medicine }> = ({ medicine }) => {
    const stock = medicine.total_stock ?? 0;
    const reorder = medicine.reorder_level ?? 10;
    const hasExpiringSoon = medicine.batches?.some((b: any) => {
      const exp = new Date(b.expiry_date);
      const now = new Date();
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 90 && diffDays > 0;
    });

    if (stock === 0) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Out of Stock</span>;
    }
    if (hasExpiringSoon) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Expiring Soon</span>;
    }
    if (stock <= reorder) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Low Stock</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">In Stock</span>;
  };

  // Tab configuration
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All Medicines', icon: <Package size={16} /> },
    { key: 'low_stock', label: 'Low Stock', icon: <TrendingDown size={16} /> },
    { key: 'expiring', label: 'Expiring Soon', icon: <Clock size={16} /> },
    { key: 'stock_management', label: 'Stock Management', icon: <RefreshCw size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your pharmacy inventory, stock levels, and medicine catalog</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-1 -mb-px overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ============ ALL MEDICINES TAB ============ */}
      {activeTab === 'all' && (
        <div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search medicines by name, generic name, brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <button
              onClick={openAddMedicine}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
            >
              <Plus size={18} />
              Add Medicine
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strength/Form</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <span className="ml-3 text-gray-500">Loading medicines...</span>
                        </div>
                      </td>
                    </tr>
                  ) : medicines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        No medicines found
                      </td>
                    </tr>
                  ) : (
                    medicines.map((med) => (
                      <tr
                        key={med.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => viewMedicineDetail(med)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{med.name}</div>
                            {med.generic_name && <div className="text-xs text-gray-500">{med.generic_name}</div>}
                            {med.brand_name && <div className="text-xs text-gray-400">{med.brand_name}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {med.strength} {med.dosage_form}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{med.category || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{med.total_stock ?? 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatKSh(med.unit_price)}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <StatusBadge medicine={med} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => viewMedicineDetail(med)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => openEditMedicine(med)}
                              className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteMedicine(med.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ LOW STOCK TAB ============ */}
      {activeTab === 'low_stock' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Medicines below reorder level
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strength/Form</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shortage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lowStockLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : lowStockMedicines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      All medicines are adequately stocked
                    </td>
                  </tr>
                ) : (
                  lowStockMedicines.map((med) => {
                    const stock = med.total_stock ?? 0;
                    const reorder = med.reorder_level ?? 10;
                    const shortage = reorder - stock;
                    return (
                      <tr key={med.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{med.name}</div>
                          {med.generic_name && <div className="text-xs text-gray-500">{med.generic_name}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{med.strength} {med.dosage_form}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${stock === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                            {stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{reorder}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{shortage > 0 ? shortage : 0}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setStockSubTab('stock_in');
                              setActiveTab('stock_management');
                              setStockInMedicine(med);
                              setStockInSearch(med.name);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ EXPIRING SOON TAB ============ */}
      {activeTab === 'expiring' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Batches expiring within 90 days
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Left</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expiringLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : expiringBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      No batches expiring within 90 days
                    </td>
                  </tr>
                ) : (
                  expiringBatches.map((batch) => {
                    const now = new Date();
                    const exp = new Date(batch.expiry_date);
                    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {batch.medicine_name || (batch as any).medicine?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{batch.batch_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{batch.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(batch.expiry_date).toLocaleDateString('en-KE')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${daysLeft <= 30 ? 'text-red-600' : daysLeft <= 60 ? 'text-yellow-600' : 'text-blue-600'}`}>
                            {daysLeft} days
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {daysLeft <= 30 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Urgent
                            </span>
                          ) : daysLeft <= 60 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Notice
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ STOCK MANAGEMENT TAB ============ */}
      {activeTab === 'stock_management' && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setStockSubTab('stock_in')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                stockSubTab === 'stock_in' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Stock In
            </button>
            <button
              onClick={() => setStockSubTab('adjustment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                stockSubTab === 'adjustment' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Stock Adjustment
            </button>
            <button
              onClick={() => setStockSubTab('stock_take')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                stockSubTab === 'stock_take' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Stock Take
            </button>
          </div>

          {/* Stock In Form */}
          {stockSubTab === 'stock_in' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Stock</h3>
              <form onSubmit={handleStockInSubmit} className="space-y-4">
                {/* Medicine Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Medicine *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={stockInSearch}
                      onChange={(e) => handleStockInSearch(e.target.value)}
                      placeholder="Type to search medicine..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    {stockInResults.length > 0 && !stockInMedicine && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {stockInResults.map((med) => (
                          <button
                            key={med.id}
                            type="button"
                            onClick={() => {
                              setStockInMedicine(med);
                              setStockInSearch(med.name);
                              setStockInResults([]);
                              setStockInForm((f) => ({ ...f, selling_price: String(med.unit_price || '') }));
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium text-gray-900">{med.name}</div>
                            <div className="text-xs text-gray-500">{med.strength} {med.dosage_form} | Stock: {med.total_stock ?? 0}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {stockInMedicine && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-blue-900">{stockInMedicine.name}</span>
                        <span className="text-sm text-blue-700 ml-2">{stockInMedicine.strength} {stockInMedicine.dosage_form}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setStockInMedicine(null); setStockInSearch(''); }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number *</label>
                    <input
                      type="text"
                      value={stockInForm.batch_number}
                      onChange={(e) => setStockInForm((f) => ({ ...f, batch_number: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={stockInForm.quantity}
                      onChange={(e) => setStockInForm((f) => ({ ...f, quantity: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stockInForm.purchase_price}
                      onChange={(e) => setStockInForm((f) => ({ ...f, purchase_price: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (KSh) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stockInForm.selling_price}
                      onChange={(e) => setStockInForm((f) => ({ ...f, selling_price: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      value={stockInForm.expiry_date}
                      onChange={(e) => setStockInForm((f) => ({ ...f, expiry_date: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <select
                      value={stockInForm.supplier_id}
                      onChange={(e) => setStockInForm((f) => ({ ...f, supplier_id: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={stockInSubmitting || !stockInMedicine}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {stockInSubmitting ? 'Adding...' : 'Add Stock'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Stock Adjustment Form */}
          {stockSubTab === 'adjustment' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Adjustment</h3>
              <form onSubmit={handleAdjSubmit} className="space-y-4">
                {/* Medicine Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Medicine *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={adjSearch}
                      onChange={(e) => handleAdjSearch(e.target.value)}
                      placeholder="Type to search medicine..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    {adjResults.length > 0 && !adjMedicine && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {adjResults.map((med) => (
                          <button
                            key={med.id}
                            type="button"
                            onClick={() => selectAdjMedicine(med)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium text-gray-900">{med.name}</div>
                            <div className="text-xs text-gray-500">{med.strength} {med.dosage_form} | Stock: {med.total_stock ?? 0}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {adjMedicine && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-blue-900">{adjMedicine.name}</span>
                        <span className="text-sm text-blue-700 ml-2">Current Stock: {adjMedicine.total_stock ?? 0}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjMedicine(null);
                          setAdjSearch('');
                          setAdjBatches([]);
                          setAdjSelectedBatch('');
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch *</label>
                    <select
                      value={adjSelectedBatch}
                      onChange={(e) => setAdjSelectedBatch(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      disabled={!adjMedicine}
                    >
                      <option value="">Select Batch</option>
                      {adjBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batch_number} - Qty: {b.quantity} - Exp: {new Date(b.expiry_date).toLocaleDateString('en-KE')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type *</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjForm((f) => ({ ...f, adjustment_type: 'add' }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                          adjForm.adjustment_type === 'add'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <TrendingUp size={16} className="inline mr-1" />
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjForm((f) => ({ ...f, adjustment_type: 'remove' }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                          adjForm.adjustment_type === 'remove'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <TrendingDown size={16} className="inline mr-1" />
                        Remove
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={adjForm.quantity}
                      onChange={(e) => setAdjForm((f) => ({ ...f, quantity: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <input
                    type="text"
                    value={adjForm.reason}
                    onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g., Damaged goods, Expired, Count correction..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={adjSubmitting || !adjMedicine || !adjSelectedBatch}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adjSubmitting ? 'Adjusting...' : 'Apply Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Stock Take */}
          {stockSubTab === 'stock_take' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Current Stock Levels</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strength/Form</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Level</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockManagementLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-500">Loading...</span>
                          </div>
                        </td>
                      </tr>
                    ) : stockMedicines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">No medicines found</td>
                      </tr>
                    ) : (
                      <>
                        {stockMedicines.map((med) => (
                          <tr key={med.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{med.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{med.strength} {med.dosage_form}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{med.category || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-bold">{med.total_stock ?? 0}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{med.reorder_level ?? '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{formatKSh(med.unit_price)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {formatKSh((med.total_stock ?? 0) * (med.unit_price ?? 0))}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                          <td colSpan={3} className="px-4 py-3 text-sm text-right text-gray-700">Total Stock Value:</td>
                          <td colSpan={2} className="px-4 py-3 text-sm text-gray-900">
                            {stockMedicines.reduce((sum, m) => sum + (m.total_stock ?? 0), 0).toLocaleString()} units
                          </td>
                          <td colSpan={2} className="px-4 py-3 text-sm text-blue-700">
                            {formatKSh(stockMedicines.reduce((sum, m) => sum + (m.total_stock ?? 0) * (m.unit_price ?? 0), 0))}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ ADD/EDIT MEDICINE MODAL ============ */}
      {showMedicineModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowMedicineModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}
                </h3>
                <button onClick={() => setShowMedicineModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleMedicineFormSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={medicineForm.name}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                    <input
                      type="text"
                      value={medicineForm.generic_name}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, generic_name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                    <input
                      type="text"
                      value={medicineForm.brand_name}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, brand_name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                    <input
                      type="text"
                      value={medicineForm.strength}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, strength: e.target.value }))}
                      placeholder="e.g., 500mg"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage Form</label>
                    <input
                      type="text"
                      value={medicineForm.dosage_form}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, dosage_form: e.target.value }))}
                      placeholder="e.g., Tablet, Capsule, Syrup"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={medicineForm.category}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, category: e.target.value }))}
                      list="category-suggestions"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <datalist id="category-suggestions">
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (KSh) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={medicineForm.unit_price}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, unit_price: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      value={medicineForm.reorder_level}
                      onChange={(e) => setMedicineForm((f) => ({ ...f, reorder_level: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={medicineForm.description}
                    onChange={(e) => setMedicineForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requires_prescription"
                    checked={medicineForm.requires_prescription}
                    onChange={(e) => setMedicineForm((f) => ({ ...f, requires_prescription: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="requires_prescription" className="text-sm text-gray-700">Requires Prescription</label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowMedicineModal(false)}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={medicineFormSubmitting}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                  >
                    {medicineFormSubmitting ? 'Saving...' : editingMedicine ? 'Update Medicine' : 'Add Medicine'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============ MEDICINE DETAIL MODAL ============ */}
      {showDetailModal && detailMedicine && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDetailModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{detailMedicine.name}</h3>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Generic Name</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.generic_name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Brand Name</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.brand_name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Strength</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.strength || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Dosage Form</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.dosage_form || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Category</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.category || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Unit Price</span>
                    <p className="text-sm text-gray-900 mt-1">{formatKSh(detailMedicine.unit_price)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Total Stock</span>
                    <p className="text-sm font-bold text-gray-900 mt-1">{detailMedicine.total_stock ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Reorder Level</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.reorder_level ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Prescription Required</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.requires_prescription ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {detailMedicine.description && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Description</span>
                    <p className="text-sm text-gray-900 mt-1">{detailMedicine.description}</p>
                  </div>
                )}

                {/* Batches */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Batch Information</h4>
                  {detailLoading ? (
                    <div className="flex items-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-500">Loading batches...</span>
                    </div>
                  ) : detailBatches.length === 0 ? (
                    <p className="text-sm text-gray-500">No batches found</p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch #</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Purchase Price</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Selling Price</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expiry Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {detailBatches.map((batch) => (
                            <tr key={batch.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-sm text-gray-900">{batch.batch_number}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 font-medium">{batch.quantity}</td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {batch.purchase_price ? formatKSh(batch.purchase_price) : '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {batch.selling_price ? formatKSh(batch.selling_price) : '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {new Date(batch.expiry_date).toLocaleDateString('en-KE')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openEditMedicine(detailMedicine);
                    }}
                    className="px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium"
                  >
                    <Edit2 size={16} className="inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setStockInMedicine(detailMedicine);
                      setStockInSearch(detailMedicine.name);
                      setStockSubTab('stock_in');
                      setActiveTab('stock_management');
                    }}
                    className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    <Package size={16} className="inline mr-1" />
                    Add Stock
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
