import { create } from 'zustand'
import { apiGet, apiPost, apiPatch, apiDelete } from '../services/api'
import type { Cliente, PaginatedResponse } from '../types'

interface ClientesState {
  clientes: Cliente[]
  total: number
  loading: boolean
  error: string | null
  clienteActual: Cliente | null

  fetchClientes: (params?: {
    page?: number
    per_page?: number
    q?: string
    zona?: string
  }) => Promise<void>

  fetchCliente: (id: string) => Promise<void>
  crearCliente: (data: Partial<Cliente>) => Promise<Cliente>
  actualizarCliente: (id: string, data: Partial<Cliente>) => Promise<Cliente>
  eliminarCliente: (id: string) => Promise<void>
  limpiarError: () => void
}

export const useClientesStore = create<ClientesState>((set) => ({
  clientes: [],
  total: 0,
  loading: false,
  error: null,
  clienteActual: null,

  fetchClientes: async (params = {}) => {
    set({ loading: true, error: null })
    try {
      const data = await apiGet<PaginatedResponse<Cliente>>('/clientes', params as Record<string, unknown>)
      set({ clientes: data.items, total: data.total })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  fetchCliente: async (id) => {
    set({ loading: true, error: null })
    try {
      const data = await apiGet<Cliente>(`/clientes/${id}`)
      set({ clienteActual: data })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  crearCliente: async (data) => {
    const cliente = await apiPost<Cliente>('/clientes', data)
    set((s) => ({ clientes: [cliente, ...s.clientes], total: s.total + 1 }))
    return cliente
  },

  actualizarCliente: async (id, data) => {
    const cliente = await apiPatch<Cliente>(`/clientes/${id}`, data)
    set((s) => ({
      clientes: s.clientes.map((c) => (c.id === id ? cliente : c)),
      clienteActual: s.clienteActual?.id === id ? cliente : s.clienteActual,
    }))
    return cliente
  },

  eliminarCliente: async (id) => {
    await apiDelete(`/clientes/${id}`)
    set((s) => ({
      clientes: s.clientes.filter((c) => c.id !== id),
      total: s.total - 1,
    }))
  },

  limpiarError: () => set({ error: null }),
}))
