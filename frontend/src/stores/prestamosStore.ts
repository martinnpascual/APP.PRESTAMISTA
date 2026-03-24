import { create } from 'zustand'
import { apiGet, apiPost, apiPatch } from '../services/api'
import type { Prestamo, Cuota, PaginatedResponse } from '../types'

interface PrestamosState {
  prestamos: Prestamo[]
  total: number
  loading: boolean
  error: string | null
  prestamoActual: Prestamo | null
  cuotas: Cuota[]

  fetchPrestamos: (params?: {
    page?: number
    per_page?: number
    estado?: string
    cliente_id?: string
  }) => Promise<void>

  fetchPrestamo: (id: string) => Promise<void>
  fetchCuotas: (prestamoId: string) => Promise<void>
  crearPrestamo: (data: unknown) => Promise<Prestamo>
  cambiarEstado: (id: string, estado: string, motivo?: string) => Promise<Prestamo>
  limpiarError: () => void
}

export const usePrestamosStore = create<PrestamosState>((set) => ({
  prestamos: [],
  total: 0,
  loading: false,
  error: null,
  prestamoActual: null,
  cuotas: [],

  fetchPrestamos: async (params = {}) => {
    set({ loading: true, error: null })
    try {
      const data = await apiGet<PaginatedResponse<Prestamo>>('/prestamos', params as Record<string, unknown>)
      set({ prestamos: data.items, total: data.total })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  fetchPrestamo: async (id) => {
    set({ loading: true, error: null })
    try {
      const data = await apiGet<Prestamo>(`/prestamos/${id}`)
      set({ prestamoActual: data })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  fetchCuotas: async (prestamoId) => {
    const cuotas = await apiGet<Cuota[]>(`/pagos/${prestamoId}/cuotas`)
    set({ cuotas })
  },

  crearPrestamo: async (data) => {
    const prestamo = await apiPost<Prestamo>('/prestamos', data)
    set((s) => ({ prestamos: [prestamo, ...s.prestamos], total: s.total + 1 }))
    return prestamo
  },

  cambiarEstado: async (id, estado, motivo) => {
    const prestamo = await apiPatch<Prestamo>(`/prestamos/${id}/estado`, { estado, motivo })
    set((s) => ({
      prestamos: s.prestamos.map((p) => (p.id === id ? prestamo : p)),
      prestamoActual: s.prestamoActual?.id === id ? prestamo : s.prestamoActual,
    }))
    return prestamo
  },

  limpiarError: () => set({ error: null }),
}))
