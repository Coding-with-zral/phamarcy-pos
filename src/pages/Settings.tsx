import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  DollarSign,
  Package,
  Bell,
  Shield,
  Save,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { get, put } from '../utils/api'
import { useAuth } from '../context/AuthContext'

type Tab = 'general' | 'financial' | 'inventory' | 'notifications' | 'compliance'

interface SettingsData {
  pharmacy_name: string
  pharmacy_phone: string
  pharmacy_address: string
  pharmacy_email: string
  currency: string
  vat_rate: number
  payment_methods: string
  low_stock_threshold: number
  expiry_alert_days: number
  email_notifications: boolean
  sms_notifications: boolean
  whatsapp_notifications: boolean
  kra_etims_enabled: boolean
  kra_pin: string
  etims_server_url: string
}

const defaultSettings: SettingsData = {
  pharmacy_name: '',
  pharmacy_phone: '',
  pharmacy_address: '',
  pharmacy_email: '',
  currency: 'KES',
  vat_rate: 16,
  payment_methods: 'cash,mpesa,card,insurance,credit',
  low_stock_threshold: 10,
  expiry_alert_days: 90,
  email_notifications: true,
  sms_notifications: false,
  whatsapp_notifications: false,
  kra_etims_enabled: false,
  kra_pin: '',
  etims_server_url: '',
}

const tabs: { key: Tab; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'general', label: 'General', icon: SettingsIcon },
  { key: 'financial', label: 'Financial', icon: DollarSign },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'compliance', label: 'Compliance', icon: Shield },
]

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [settings, setSettings] = useState<SettingsData>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const res = await get<{ settings: Record<string, string> }>('/settings')
        if (res.settings) {
          setSettings((prev) => {
            const updated = { ...prev }
            Object.entries(res.settings).forEach(([key, value]) => {
              if (key in updated) {
                if (typeof updated[key as keyof SettingsData] === 'number') {
                  ;(updated as any)[key] = Number(value)
                } else if (typeof updated[key as keyof SettingsData] === 'boolean') {
                  ;(updated as any)[key] = value === 'true' || value === '1'
                } else {
                  ;(updated as any)[key] = value
                }
              }
            })
            return updated
          })
        }
      } catch {
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      Object.entries(settings).forEach(([key, value]) => {
        payload[key] = String(value)
      })
      await put('/settings', { settings: payload })
      toast.success('Settings saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Access Denied</p>
          <p className="text-sm text-gray-400">Only administrators can access settings.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your pharmacy settings.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'general' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
                <input
                  type="text"
                  value={settings.pharmacy_name}
                  onChange={(e) => updateSetting('pharmacy_name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="e.g. HealthPlus Pharmacy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={settings.pharmacy_phone}
                  onChange={(e) => updateSetting('pharmacy_phone', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="e.g. +254 712 345 678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={settings.pharmacy_email}
                  onChange={(e) => updateSetting('pharmacy_email', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="e.g. info@healthplus.co.ke"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={settings.pharmacy_address}
                  onChange={(e) => updateSetting('pharmacy_address', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="e.g. Kenyatta Avenue, Nairobi"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Financial Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => updateSetting('currency', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="UGX">UGX - Ugandan Shilling</option>
                  <option value="TZS">TZS - Tanzanian Shilling</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.vat_rate}
                  onChange={(e) => updateSetting('vat_rate', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Accepted Payment Methods</label>
              <div className="flex flex-wrap gap-3">
                {['cash', 'mpesa', 'card', 'insurance', 'credit'].map((method) => {
                  const methods = settings.payment_methods.split(',').map((m) => m.trim())
                  const checked = methods.includes(method)
                  return (
                    <label key={method} className="flex items-center gap-2 cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateSetting('payment_methods', [...methods, method].join(','))
                          } else {
                            updateSetting('payment_methods', methods.filter((m) => m !== method).join(','))
                          }
                        }}
                        className="text-emerald-600 focus:ring-emerald-500 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700 capitalize">{method}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Inventory Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                <p className="text-xs text-gray-500 mb-2">Alert when stock falls below this quantity</p>
                <input
                  type="number"
                  min="0"
                  value={settings.low_stock_threshold}
                  onChange={(e) => updateSetting('low_stock_threshold', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Alert Days</label>
                <p className="text-xs text-gray-500 mb-2">Alert this many days before medicines expire</p>
                <input
                  type="number"
                  min="0"
                  value={settings.expiry_alert_days}
                  onChange={(e) => updateSetting('expiry_alert_days', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
            <p className="text-sm text-gray-500">Configure how you receive notifications. (UI only)</p>
            <div className="space-y-4">
              {[
                { key: 'email_notifications' as const, label: 'Email Notifications', desc: 'Receive notifications via email', icon: Mail, color: 'text-blue-600' },
                { key: 'sms_notifications' as const, label: 'SMS Notifications', desc: 'Receive notifications via SMS', icon: MessageSquare, color: 'text-green-600' },
                { key: 'whatsapp_notifications' as const, label: 'WhatsApp Notifications', desc: 'Receive notifications via WhatsApp', icon: Phone, color: 'text-emerald-600' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting(item.key, !settings[item.key])}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings[item.key] ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings[item.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <h3 className="text-lg font-semibold text-gray-900">KRA eTIMS Integration</h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable eTIMS</p>
                  <p className="text-xs text-gray-500">Enable Kenya Revenue Authority electronic tax invoice system</p>
                </div>
                <button
                  onClick={() => updateSetting('kra_etims_enabled', !settings.kra_etims_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.kra_etims_enabled ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.kra_etims_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {settings.kra_etims_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">KRA PIN</label>
                    <input
                      type="text"
                      value={settings.kra_pin}
                      onChange={(e) => updateSetting('kra_pin', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="Enter KRA PIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">eTIMS Server URL</label>
                    <input
                      type="url"
                      value={settings.etims_server_url}
                      onChange={(e) => updateSetting('etims_server_url', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="https://etims.kra.go.ke/api"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Compliance Info</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">eTIMS Status</p>
                    <p className={`text-sm font-semibold mt-1 ${settings.kra_etims_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {settings.kra_etims_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Currency</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{settings.currency}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">VAT Rate</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{settings.vat_rate}%</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">KRA PIN</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{settings.kra_pin || 'Not set'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
