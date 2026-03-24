import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { usePrestamosStore } from '../stores/prestamosStore'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import { BadgePrestamo } from '../components/ui/Badge'
import type { EstadoPrestamo } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADOS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'en_mora', label: 'En mora' },
  { value: 'pendiente_aprobacion', label: 'Pendientes' },
  { value: 'cerrado', label: 'Cerrados' },
  { value: 'cancelado', label: 'Cancelados' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  try { return format(new Date(s), 'dd/MM/yyyy', { locale: es }) } catch { return s }
}

export default function PrestamosList() {
  const navigate = useNavigate()
  const { prestamos, total, loading, error, fetchPrestamos, limpiarError } = usePrestamosStore()
  const [estado, setEstado] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchPrestamos({ estado: estado || undefined, page, per_page: 20 })
  }, [estado, page, fetchPrestamos])

  useEffect(() => setPage(1), [estado])

  const pages = Math.ceil(total / 20)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Cabecera */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Préstamos</h1>
          <p className="text-xs text-gray-500">{total} registros</p>
        </div>
        <Link to="/prestamos/nuevo"
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <PlusIcon className="h-4 w-4" />
          Nuevo
        </Link>
      </div>

      {/* Filtro de estado */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <FunnelIcon className="h-4 w-4 shrink-0 text-gray-400" />
        {ESTADOS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setEstado(value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              estado === value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert message={error} onClose={limpiarError} className="mb-4" />}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : prestamos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
          <p className="text-sm">Sin préstamos{estado ? ` con estado "${estado}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prestamos.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/prestamos/${p.id}`)}
              className="flex w-full items-start gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md"
            >
              {/* Indicador de estado */}
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                p.estado === 'activo' ? 'bg-green-500' :
                p.estado === 'en_mora' ? 'bg-red-500' :
                p.estado === 'pendiente_aprobacion' ? 'bg-yellow-400' :
                'bg-gray-300'
              }`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{fmt(p.monto)}</p>
                    <p className="text-xs text-gray-500">
                      {p.clientes?.nombre ?? '—'} · {p.n_cuotas}×{p.periodicidad}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.tasa}% {p.tipo_tasa} · inicio {fmtDate(p.fecha_inicio)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <BadgePrestamo estado={p.estado as EstadoPrestamo} />
                    {p.saldo_pendiente > 0 && (
                      <p className="text-xs font-semibold text-gray-700">
                        Saldo: {fmt(p.saldo_pendiente)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Paginación */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">{page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
