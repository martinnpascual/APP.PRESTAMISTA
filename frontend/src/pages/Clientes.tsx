import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { useClientesStore } from '../stores/clientesStore'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import { useDebounce } from '../hooks/useDebounce'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function Clientes() {
  const navigate = useNavigate()
  const { clientes, total, loading, error, fetchClientes, limpiarError } = useClientesStore()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQuery = useDebounce(query, 350)

  const load = useCallback(() => {
    fetchClientes({ q: debouncedQuery || undefined, page, per_page: 20 })
  }, [debouncedQuery, page, fetchClientes])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedQuery])

  const pages = Math.ceil(total / 20)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Cabecera */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-xs text-gray-500">{total} registros</p>
        </div>
        <Link
          to="/clientes/nuevo"
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, DNI o teléfono..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {error && (
        <Alert message={error} className="mb-4" onClose={limpiarError} />
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : clientes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
          <p className="text-sm">{query ? 'Sin resultados para esta búsqueda' : 'Sin clientes registrados'}</p>
          {!query && (
            <Link to="/clientes/nuevo" className="text-sm font-medium text-blue-600 hover:underline">
              Agregar el primero
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {clientes.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/clientes/${c.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md"
            >
              {/* Avatar inicial */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {c.nombre.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{c.nombre}</p>
                  {(c.prestamos_en_mora ?? 0) > 0 && (
                    <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                  <span>DNI {c.dni}</span>
                  {c.zona && <span>· {c.zona}</span>}
                  {(c.total_adeudado ?? 0) > 0 && (
                    <span className="font-medium text-gray-700">· {fmt(c.total_adeudado ?? 0)}</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {(c.prestamos_activos ?? 0) > 0 && (
                  <Badge variant="green">{c.prestamos_activos} activo{(c.prestamos_activos ?? 0) > 1 ? 's' : ''}</Badge>
                )}
                {(c.prestamos_en_mora ?? 0) > 0 && (
                  <Badge variant="red">{c.prestamos_en_mora} mora</Badge>
                )}
                <ChevronRightIcon className="h-4 w-4 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Paginación */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">{page} / {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
