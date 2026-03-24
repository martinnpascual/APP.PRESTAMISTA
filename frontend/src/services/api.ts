import axios, { AxiosError } from 'axios'
import { supabase } from '../lib/supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Adjuntar JWT de Supabase a cada request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Normalizar errores
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string }>) => {
    const msg =
      error.response?.data?.error ||
      error.message ||
      'Error de conexión'
    return Promise.reject(new Error(msg))
  }
)

export default api

// ── Helpers tipados ────────────────────────────────────────────────────

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const r = await api.get<{ data: T }>(url, { params })
  return r.data.data
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const r = await api.post<{ data: T }>(url, body)
  return r.data.data
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const r = await api.patch<{ data: T }>(url, body)
  return r.data.data
}

export async function apiDelete<T>(url: string): Promise<T> {
  const r = await api.delete<{ data: T }>(url)
  return r.data.data
}
