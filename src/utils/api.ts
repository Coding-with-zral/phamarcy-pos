const BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (token && url.split('?')[0] !== '/auth/login') window.location.href = '/login'
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || errorData.error || 'Invalid username or password')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || errorData.error || `Request failed (${response.status})`)
  }

  return response.json()
}

export async function get<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'GET' })
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function del<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'DELETE' })
}
