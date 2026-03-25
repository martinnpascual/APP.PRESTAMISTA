import { useEffect, useState } from 'react'
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  UsersIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { apiGet } from '../services/api'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import { BadgePrestamo, BadgeCuota } from '../components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

type Tab = 'kpis' | 'cartera' | 'recaudacion' | 'mora' | 'historial'

interface KPIsExtended {
  capital_total_prestado: number
  saldo_total_pendiente: number
  clientes_en_mora: number
  monto_en_mora: number
  prestamos_activos: number
  clientes_activos: number
  cuotas_hoy_total: number
  cuotas_hoy_monto: number
  cobrado_hoy: number
}

interface PeriodoRecaudacion {
  periodo: string
  total: number
  cantidad: number
  metodos: Record<string, number>
}

interface RecaudacionData {
  desde: string
  hasta: string
  total_cobrado: number
  cantidad_pagos: number
  periodos: PeriodoRecaudacion[]
}

interface MoraItem {
  id: string
  numero: number
  fecha_vencimiento: string
  monto: number
  monto_pagado: number
  saldo_cuota: number
  dias_mora: number
  recargo_mora: number
  cliente_nombre: string
  cliente_dni: string
  zona?: string
  cobrador_nombre?: string
}

interface MoraData {
  fecha: string
  cuotas_en_mora: number
  total_saldo_mora: number
  total_recargo_mora: number
  items: MoraItem[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CarteraItem = any

interface HistorialPago {
  id: string
  monto: number
  fecha_pago: string
  metodo: string
  cuotas?: { numero: number; fecha_vencimiento: string }
  clientes?: { nombre: string; zona?: string }
  profiles?: { nombre: string }
}

export default function Reportes() {
  const [tab, setTab] = useState<Tab>('kpis')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kpis, setKpis] = useState<KPIsExtended | null>(null)
  const [cartera, setCartera] = useState<CarteraItem[]>([])
  const [recaudacion, setRecaudacion] = useState<RecaudacionData | null>(null)
  const [mora, setMora] = useState<MoraData | null>(null)
  const [agrupacion, setAgrupacion] = useState<'dia' | 'semana' | 'mes'>('semana')
  const [historial, setHistorial] = useState<HistorialPago[]>([])
  const [historialFecha, setHistorialFecha] = useState(new Date().toISOString().split('T')[0])

  const cargarTab = async (t: Tab) => {
    setLoading(true)
    setError(null)
    try {
      if (t === 'kpis') {
        const data = await apiGet<KPIsExtended>('/reportes/kpis')
        setKpis(data)
      } else if (t === 'cartera') {
        const data = await apiGet<CarteraItem[]>('/reportes/cartera')
        setCartera(data)
      } else if (t === 'recaudacion') {
        const data = await apiGet<RecaudacionData>(`/reportes/recaudacion?agrupar_por=${agrupacion}`)
        setRecaudacion(data)
      } else if (t === 'mora') {
        const data = await apiGet<MoraData>('/reportes/mora')
        setMora(data)
      } else if (t === 'historial') {
        const data = await apiGet<HistorialPago[]>(`/pagos/historial/dia?fecha=${historialFecha}`)
        setHistorial(data)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarTab(tab) }, [tab])
  useEffect(() => {
    if (tab === 'recaudacion') cargarTab('recaudacion')
  }, [agrupacion])
  useEffect(() => {
    if (tab === 'historial') cargarTab('historial')
  }, [historialFecha])

  const descargarCSV = async (tipo: 'cartera' | 'recaudacion' | 'mora') => {
    try {
      const { default: axios } = await import('axios')
      const { supabase } = await import('../lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/reportes/exportar/csv?tipo=${tipo}`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          responseType: 'blob',
        }
      )
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tipo}_${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof ChartBarIcon }[] = [
    { id: 'kpis', label: 'KPIs', icon: ChartBarIcon },
    { id: 'cartera', label: 'Cartera', icon: UsersIcon },
    { id: 'recaudacion', label: 'Recaudación', icon: BanknotesIcon },
    { id: 'mora', label: 'Mora', icon: ExclamationTriangleIcon },
    { id: 'historial', label: 'Historial', icon: DocumentTextIcon },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
          <p className="text-xs text-gray-500">
            {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        {(tab === 'cartera' || tab === 'mora' || tab === 'recaudacion') && (
          <button
            onClick={() => descargarCSV(tab as 'cartera' | 'mora' | 'recaudacion')}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            CSV
          </button>
        )}
      </div>

      {error && <Alert message={error} onClose={() => setError(null)} className="mb-4" />}

      {/* Tabs */}
      <div className="mb-4 grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* KPIs */}
          {tab === 'kpis' && kpis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard label="Capital prestado" value={fmt(kpis.capital_total_prestado)} color="blue" />
                <KpiCard label="Saldo pendiente" value={fmt(kpis.saldo_total_pendiente)} color="indigo" />
                <KpiCard label="Cobrado hoy" value={fmt(kpis.cobrado_hoy)} color="green" />
                <KpiCard label="Préstamos activos" value={String(kpis.prestamos_activos)} color="gray" />
                <KpiCard label="Clientes activos" value={String(kpis.clientes_activos)} color="gray" />
                <KpiCard label="En mora" value={String(kpis.clientes_en_mora)} color="red" />
              </div>
              {kpis.monto_en_mora > 0 && (
                <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Monto total en mora</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">{fmt(kpis.monto_en_mora)}</p>
                </div>
              )}
              <div className="rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Cuotas para hoy</p>
                <div className="flex justify-between">
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{kpis.cuotas_hoy_total}</p>
                    <p className="text-xs text-blue-500">cuotas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-700">{fmt(kpis.cuotas_hoy_monto)}</p>
                    <p className="text-xs text-blue-500">a cobrar</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cartera */}
          {tab === 'cartera' && (
            <div>
              <p className="mb-3 text-xs text-gray-500">{cartera.length} préstamos activos/en mora</p>
              <div className="space-y-2">
                {cartera.map((item: CarteraItem) => {
                  const cliente = item.clientes || {}
                  const cobrador = item['profiles!prestamos_cobrador_id_fkey'] || {}
                  return (
                    <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900">{cliente.nombre || '—'}</p>
                          <p className="text-xs text-gray-500">DNI {cliente.dni || '—'} · {cliente.zona || 'Sin zona'}</p>
                          {cobrador.nombre && (
                            <p className="text-xs text-gray-400">Cobrador: {cobrador.nombre}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <BadgePrestamo estado={item.estado} />
                          <p className="text-sm font-bold text-gray-900">{fmt(item.saldo_pendiente)}</p>
                          <p className="text-xs text-gray-400">de {fmt(item.monto)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-3 text-xs text-gray-500">
                        <span>Tasa {item.tasa}% {item.tipo_tasa}</span>
                        <span>{item.periodicidad}</span>
                        <span>{item.n_cuotas} cuotas</span>
                      </div>
                    </div>
                  )
                })}
                {cartera.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-400">Sin préstamos activos</p>
                )}
              </div>
            </div>
          )}

          {/* Recaudación */}
          {tab === 'recaudacion' && recaudacion && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total período</p>
                  <p className="text-2xl font-bold text-gray-900">{fmt(recaudacion.total_cobrado)}</p>
                  <p className="text-xs text-gray-400">{recaudacion.cantidad_pagos} pagos</p>
                </div>
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                  {(['dia', 'semana', 'mes'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setAgrupacion(g)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        agrupacion === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {g === 'dia' ? 'Día' : g === 'semana' ? 'Semana' : 'Mes'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {recaudacion.periodos.map((p) => (
                  <div key={p.periodo} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">{p.periodo}</p>
                      <p className="text-base font-bold text-gray-900">{fmt(p.total)}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>{p.cantidad} pagos</span>
                      {Object.entries(p.metodos).map(([m, v]) => (
                        <span key={m}>{m}: {fmt(v)}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {recaudacion.periodos.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-400">Sin pagos en el período</p>
                )}
              </div>
            </div>
          )}

          {/* Historial del día */}
          {tab === 'historial' && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <input
                  type="date"
                  value={historialFecha}
                  onChange={e => { setHistorialFecha(e.target.value); }}
                  className="field-input max-w-[160px]"
                />
                <button onClick={() => cargarTab('historial')}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Ver
                </button>
                <span className="text-sm text-gray-500">{historial.length} pagos</span>
                <span className="text-sm font-bold text-green-700">
                  Total: {fmt(historial.reduce((s, p) => s + p.monto, 0))}
                </span>
              </div>
              <div className="space-y-2">
                {historial.map(p => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{p.clientes?.nombre ?? '—'}</p>
                      <p className="text-xs text-gray-400">
                        {p.clientes?.zona ?? ''} · Cuota #{p.cuotas?.numero}
                        {p.profiles?.nombre ? ` · ${p.profiles.nombre}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">{fmt(p.monto)}</p>
                      <p className="text-xs text-gray-400">
                        {p.metodo} · {new Date(p.fecha_pago).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {historial.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
                    <BanknotesIcon className="h-10 w-10" />
                    <p className="text-sm font-medium">Sin pagos registrados para esta fecha</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mora */}
          {tab === 'mora' && mora && (
            <div>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <KpiCard label="Cuotas en mora" value={String(mora.cuotas_en_mora)} color="red" />
                <KpiCard label="Saldo mora" value={fmt(mora.total_saldo_mora)} color="red" />
                <KpiCard label="Recargos" value={fmt(mora.total_recargo_mora)} color="orange" />
              </div>
              <div className="space-y-2">
                {mora.items.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-red-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">{item.cliente_nombre}</p>
                        <p className="text-xs text-gray-500">DNI {item.cliente_dni} · {item.zona || 'Sin zona'}</p>
                        <p className="text-xs text-gray-400">Cuota {item.numero} · vence {item.fecha_vencimiento}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <BadgeCuota estado="mora" />
                        <p className="text-sm font-bold text-red-700">{fmt(item.saldo_cuota)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-3 text-xs">
                      <span className="font-medium text-red-600">{item.dias_mora} días</span>
                      {item.recargo_mora > 0 && (
                        <span className="text-red-500">Recargo: {fmt(item.recargo_mora)}</span>
                      )}
                      {item.cobrador_nombre && (
                        <span className="text-gray-400">Cob: {item.cobrador_nombre}</span>
                      )}
                    </div>
                  </div>
                ))}
                {mora.items.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
                    <DocumentTextIcon className="h-10 w-10" />
                    <p className="text-sm font-medium">Sin cuotas en mora</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({
  label, value, color
}: {
  label: string
  value: string
  color: 'blue' | 'indigo' | 'green' | 'red' | 'orange' | 'gray'
}) {
  const colorMap = {
    blue:   'bg-blue-50 ring-blue-100 text-blue-700 text-blue-900',
    indigo: 'bg-indigo-50 ring-indigo-100 text-indigo-700 text-indigo-900',
    green:  'bg-green-50 ring-green-100 text-green-700 text-green-900',
    red:    'bg-red-50 ring-red-100 text-red-700 text-red-900',
    orange: 'bg-orange-50 ring-orange-100 text-orange-700 text-orange-900',
    gray:   'bg-gray-50 ring-gray-100 text-gray-600 text-gray-900',
  }
  const [bg, ring, labelColor, valueColor] = colorMap[color].split(' ')
  return (
    <div className={`rounded-2xl p-4 ring-1 ${bg} ${ring}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${labelColor}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
