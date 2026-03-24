// ============================================================
// Types — prestamos.app
// ============================================================

export type RolUsuario = 'admin' | 'cobrador' | 'solo_lectura'

export type EstadoPrestamo =
  | 'activo'
  | 'en_mora'
  | 'cancelado'
  | 'cerrado'
  | 'pendiente_aprobacion'

export type EstadoCuota =
  | 'pendiente'
  | 'pagada'
  | 'mora'
  | 'pago_parcial'
  | 'condonada'

export type Periodicidad = 'diaria' | 'semanal' | 'quincenal' | 'mensual'

export type TipoTasa = 'flat' | 'sobre_saldo' | 'personalizada'

export type TipoDocumento =
  | 'contrato'
  | 'recibo'
  | 'tabla_amortizacion'
  | 'reporte_cartera'

export type CanalNotif = 'telegram' | 'email'

export type MetodoPago = 'efectivo' | 'transferencia' | 'otro'

// ── Entidades ────────────────────────────────────────────────

export interface Cliente {
  id: string
  nombre: string
  dni: string
  telefono?: string
  direccion?: string
  zona?: string
  notas?: string
  activo: boolean
  created_at: string
  // campos extra de v_clientes_deuda
  prestamos_activos?: number
  prestamos_en_mora?: number
  total_adeudado?: number
}

export interface Prestamo {
  id: string
  cliente_id: string
  cobrador_id?: string
  monto: number
  tasa: number
  tipo_tasa: TipoTasa
  periodicidad: Periodicidad
  n_cuotas: number
  estado: EstadoPrestamo
  saldo_pendiente: number
  fecha_inicio: string
  activo: boolean
  created_at: string
  // relaciones embebidas opcionales
  clientes?: Cliente
}

export interface Cuota {
  id: string
  prestamo_id: string
  numero: number
  fecha_vencimiento: string
  monto: number
  monto_pagado: number
  recargo_mora: number
  dias_mora: number
  estado: EstadoCuota
  updated_at: string
}

export interface Pago {
  id: string
  cuota_id: string
  prestamo_id: string
  cliente_id: string
  monto: number
  fecha_pago: string
  metodo: MetodoPago
  registrado_por: string
  notas?: string
  created_at: string
}

export interface Profile {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  zona?: string
  activo: boolean
  created_at: string
}

export interface CuotaCobro {
  cuota_id: string
  prestamo_id: string
  numero: number
  fecha_vencimiento: string
  monto: number
  monto_pagado: number
  recargo_mora: number
  dias_mora: number
  estado: EstadoCuota
  semaforo?: 'amarillo' | 'naranja' | 'rojo'
  total_a_cobrar?: number
  dias_atraso?: number
  cliente_id: string
  cliente_nombre: string
  telefono?: string
  direccion?: string
  zona?: string
  cobrador_id?: string
  periodicidad: Periodicidad
  prestamo_monto?: number
}

export interface KPIs {
  capital_total_prestado: number
  saldo_total_pendiente: number
  clientes_en_mora: number
  monto_en_mora: number
  prestamos_activos: number
}

// ── Genéricos de API ─────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

// ── Formularios ──────────────────────────────────────────────

export interface ClienteForm {
  nombre: string
  dni: string
  telefono?: string
  direccion?: string
  zona?: string
  notas?: string
}

export interface PrestamoCalcularForm {
  cliente_id: string
  monto: number
  tasa: number
  tipo_tasa: TipoTasa
  periodicidad: Periodicidad
  n_cuotas: number
  fecha_inicio: string
  cobrador_id?: string
}

export interface PagoForm {
  cuota_id: string
  prestamo_id: string
  monto: number
  metodo: MetodoPago
  notas?: string
}
