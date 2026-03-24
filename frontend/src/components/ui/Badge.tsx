import type { EstadoPrestamo, EstadoCuota } from '../../types'

type BadgeVariant = 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'gray' | 'purple'

const variants: Record<BadgeVariant, string> = {
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

// ── Badges semánticos ────────────────────────────────────────────────────

const estadoPrestamoVariant: Record<EstadoPrestamo, BadgeVariant> = {
  activo:               'green',
  en_mora:              'red',
  cancelado:            'gray',
  cerrado:              'blue',
  pendiente_aprobacion: 'yellow',
}

const estadoPrestamoLabel: Record<EstadoPrestamo, string> = {
  activo:               'Activo',
  en_mora:              'En mora',
  cancelado:            'Cancelado',
  cerrado:              'Cerrado',
  pendiente_aprobacion: 'Pendiente',
}

export function BadgePrestamo({ estado }: { estado: EstadoPrestamo }) {
  return (
    <Badge variant={estadoPrestamoVariant[estado]}>
      {estadoPrestamoLabel[estado]}
    </Badge>
  )
}

const estadoCuotaVariant: Record<EstadoCuota, BadgeVariant> = {
  pendiente:    'yellow',
  pagada:       'green',
  mora:         'red',
  pago_parcial: 'orange',
  condonada:    'purple',
}

const estadoCuotaLabel: Record<EstadoCuota, string> = {
  pendiente:    'Pendiente',
  pagada:       'Pagada',
  mora:         'Mora',
  pago_parcial: 'Parcial',
  condonada:    'Condonada',
}

export function BadgeCuota({ estado }: { estado: EstadoCuota }) {
  return (
    <Badge variant={estadoCuotaVariant[estado]}>
      {estadoCuotaLabel[estado]}
    </Badge>
  )
}

// Semáforo cobros
const semaforoVariant: Record<string, BadgeVariant> = {
  amarillo: 'yellow',
  naranja:  'orange',
  rojo:     'red',
}

export function BadgeSemaforo({ semaforo }: { semaforo: string }) {
  return (
    <Badge variant={semaforoVariant[semaforo] ?? 'gray'}>
      {semaforo === 'amarillo' ? '🟡 Hoy' : semaforo === 'naranja' ? '🟠 Atrasada' : '🔴 Mora'}
    </Badge>
  )
}
