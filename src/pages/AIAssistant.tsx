import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Bot,
  User,
  Pill,
  Stethoscope,
  BookOpen,
  ArrowRightLeft,
  Package,
  Snowflake,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { post } from '../utils/api'

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: Date
}

const quickActions = [
  { label: 'Drug Interactions', icon: ArrowRightLeft, prompt: 'What are common drug interactions I should be aware of?' },
  { label: 'Dosage Guide', icon: Pill, prompt: 'Provide a dosage guide for common medications.' },
  { label: 'Alternatives', icon: Stethoscope, prompt: 'What are common alternatives for frequently prescribed medications?' },
  { label: 'Stock Check', icon: Package, prompt: 'Help me check current stock levels and suggest reorder quantities.' },
  { label: 'Storage Info', icon: Snowflake, prompt: 'What are the storage requirements for common pharmaceutical products?' },
  { label: 'Insurance Tips', icon: Shield, prompt: 'Provide tips for handling insurance claims in a pharmacy setting.' },
]

function formatKSh(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>')
    .replace(/\n/g, '<br />')
}

const welcomeMessage: Message = {
  id: 'welcome',
  role: 'ai',
  content: "Welcome to the **AI Pharmacy Assistant**! I'm here to help you with:\n\n- Drug interactions and contraindications\n- Dosage recommendations\n- Alternative medications\n- Stock management advice\n- Storage guidelines\n- Insurance processing tips\n\nHow can I assist you today?",
  timestamp: new Date(),
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await post<{ response: string }>('/ai/chat', { message: text })
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: res.response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch {
      toast.error('Failed to get AI response')
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-emerald-100 rounded-lg p-2">
          <Bot className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-sm text-gray-500">Your intelligent pharmacy helper</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4"
          >
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left group"
              >
                <div className="bg-gray-100 group-hover:bg-emerald-100 rounded-lg p-2 transition-colors">
                  <action.icon className="w-4 h-4 text-gray-500 group-hover:text-emerald-600 transition-colors" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">{action.label}</span>
              </button>
            ))}
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'ai' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mt-1">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}
              >
                {message.role === 'ai' ? (
                  <div
                    className="text-sm leading-relaxed prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                  />
                ) : (
                  <p className="text-sm leading-relaxed">{message.content}</p>
                )}
                <p className={`text-xs mt-1.5 ${message.role === 'user' ? 'text-emerald-200' : 'text-gray-400'}`}>
                  {message.timestamp.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mt-1">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSend(action.prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-emerald-300 hover:text-emerald-600 whitespace-nowrap transition-all"
            >
              <action.icon className="w-3 h-3" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-center bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        <Bot className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about pharmacy..."
          className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          disabled={isLoading}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg p-2 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
