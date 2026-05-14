import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeftIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { apiGet } from '../services/api'
import api from '../services/api'
import { useClientesStore } from '../stores/clientesStore'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import { BadgePrestamo } from '../components/ui/Badge'
import type { Prestamo, PaginatedResponse } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  try { return format(new Date(s), 'dd/MM/yyyy', { locale: es }) } catch { return s }
}

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { clienteActual, fetchCliente, loading, error, limpiarError } = useClientesStore()
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) {
      fetchCliente(id)
      apiGet<PaginatedResponse<Prestamo>>('/prestamos', { cliente_id: id, per_page: 50 })
        .then((r) => setPrestamos(r.items))
        .catch(() => {})
    }
  }, [id, fetchCliente])

  useEffect(() => {
    if (clienteActual) {
      setFotoUrl((clienteActual as any).foto_url ?? null)
    }
  }, [clienteActual])

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingFoto(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<{ data: { foto_url: string } }>(`/clientes/${id}/foto`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setFotoUrl(res.data.data.foto_url)
    } catch {
      // silencioso — el error aparece en la consola
    } finally {
      setUploadingFoto(false)
      e.target.value = ''
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>
  if (!clienteActual) return <div className="p-6 text-center text-gray-400">Cliente no encontrado</div>

  const c = clienteActual

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>

          {/* Avatar con foto */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                background: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.15))',
                border: '2px solid rgba(99,102,241,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, color: '#a5b4fc',
              }}
              title="Clic para cambiar foto"
            >
              {fotoUrl
                ? <img src={fotoUrl} alt={c.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : c.nombre.charAt(0).toUpperCase()
              }
              {uploadingFoto && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: 'spin .8s linear infinite' }}>
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
                  </svg>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFotoChange} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-900">{c.nombre}</h1>
            <p className="text-xs text-gray-500">DNI {c.dni}</p>
          </div>
        </div>
        <Link to={`/clientes/${id}/editar`}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <PencilSquareIcon className="h-4 w-4" />
          Editar
        </Link>
      </div>

      {error && <Alert message={error} onClose={limpiarError} className="mb-4" />}

      {/* Info básica */}
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {c.telefono && <InfoRow label="Teléfono" value={c.telefono} />}
          {c.zona && <InfoRow label="Zona" value={c.zona} />}
          {c.direccion && <InfoRow label="Dirección" value={c.direccion} className="col-span-2" />}
          {c.notas && <InfoRow label="Notas" value={c.notas} className="col-span-2" />}
          <InfoRow label="Alta" value={fmtDate(c.created_at)} />
          <InfoRow label="Estado" value={c.activo ? 'Activo' : 'Inactivo'} />
        </div>
      </div>

      {/* Deuda resumen */}
      {((c.total_adeudado ?? 0) > 0) && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-xs text-blue-600">Activos</p>
            <p className="text-lg font-bold text-blue-700">{c.prestamos_activos ?? 0}</p>
          </div>
          <div className="rounded-xl bg-red-50 p-3 text-center">
            <p className="text-xs text-red-600">En mora</p>
            <p className="text-lg font-bold text-red-700">{c.prestamos_en_mora ?? 0}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">Adeudado</p>
            <p className="text-sm font-bold text-gray-900">{fmt(c.total_adeudado ?? 0)}</p>
          </div>
        </div>
      )}

      {/* Préstamos */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Préstamos</h2>
        <Link to={`/prestamos/nuevo?cliente_id=${id}`}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
          <PlusIcon className="h-3.5 w-3.5" /> Nuevo
        </Link>
      </div>

      {prestamos.length === 0 ? (
        <p className="text-center text-sm text-gray-400">Sin préstamos</p>
      ) : (
        <div className="space-y-2">
          {prestamos.map((p) => (
            <Link key={p.id} to={`/prestamos/${p.id}`}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100 hover:shadow-md">
              <div>
                <p className="text-sm font-semibold text-gray-900">{fmt(p.monto)}</p>
                <p className="text-xs text-gray-500">
                  {p.n_cuotas} cuotas {p.periodicidad} · {p.tasa}% {p.tipo_tasa}
                </p>
                <p className="text-xs text-gray-400">Inicio: {fmtDate(p.fecha_inicio)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <BadgePrestamo estado={p.estado} />
                <p className="text-xs font-medium text-gray-700">{fmt(p.saldo_pendiente)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  )
}
