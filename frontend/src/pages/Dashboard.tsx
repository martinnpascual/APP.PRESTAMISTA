import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BanknotesIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'
import { apiGet } from '../services/api'
import type { KPIs } from '../types'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

interface StatCardProps {
  label: string
  value: string
  icon: React.ElementType
  color: string
  to?: string
}

function StatCard({ label, value, icon: Icon, color, to }: StatCardProps) {
  const content = (
    <div className={`flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-gray-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      </div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : <div>{content}</div>
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<KPIs>('/reportes/kpis')
      .then(setKpis)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Panel principal</h1>
        <p className="text-sm text-gray-500">Resumen del negocio en tiempo real</p>
      </div>

      {error && <Alert message={error} className="mb-4" />}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Capital prestado"
            value={fmt(kpis.capital_total_prestado)}
            icon={BanknotesIcon}
            color="bg-blue-500"
            to="/prestamos"
          />
          <StatCard
            label="Saldo pendiente"
            value={fmt(kpis.saldo_total_pendiente)}
            icon={ArrowTrendingUpIcon}
            color="bg-emerald-500"
          />
          <StatCard
            label="Préstamos activos"
            value={String(kpis.prestamos_activos)}
            icon={UsersIcon}
            color="bg-violet-500"
            to="/prestamos"
          />
          <StatCard
            label="Clientes en mora"
            value={String(kpis.clientes_en_mora)}
            icon={ExclamationTriangleIcon}
            color="bg-red-500"
            to="/cobros"
          />
          {kpis.clientes_en_mora > 0 && (
            <div className="col-span-2">
              <StatCard
                label="Monto en mora"
                value={fmt(kpis.monto_en_mora)}
                icon={ExclamationTriangleIcon}
                color="bg-red-600"
                to="/cobros"
              />
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400">Sin datos</p>
      )}

      {/* Accesos rápidos */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/cobros"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <BanknotesIcon className="h-4 w-4" />
            Cobros del día
          </Link>
          <Link
            to="/prestamos/nuevo"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            <ArrowTrendingUpIcon className="h-4 w-4" />
            Nuevo préstamo
          </Link>
          <Link
            to="/clientes/nuevo"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            <UsersIcon className="h-4 w-4" />
            Nuevo cliente
          </Link>
          <Link
            to="/prestamos"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            <BanknotesIcon className="h-4 w-4" />
            Ver préstamos
          </Link>
        </div>
      </div>
    </div>
  )
}
