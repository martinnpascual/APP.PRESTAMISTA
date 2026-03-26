import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  BanknotesIcon,
  DocumentArrowDownIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { usePrestamosStore } from '../stores/prestamosStore'
import { apiPost, apiGet, apiPatch } from '../services/api'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Modal from '../components/ui/Modal'
import { BadgePrestamo, BadgeCuota } from '../components/ui/Badge'
import type { Cuota, EstadoPrestamo, EstadoCuota, MetodoPago, Documento, GenerarDocumentoOut } from '../types'
import { useAuthStore } from '../stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  try { return format(new Date(s + 'T12:00:00'), 'dd/MM/yyyy', { locale: es }) } catch { return s }
}
function fmtTs(s: string) {
  try { return format(new Date(s), 'dd/MM/yyyy HH:mm', { locale: es }) } catch { return s }
}

const TIPO_LABEL: Record<string, string> = {
  contrato: 'Contrato',
  recibo: 'Recibo de pago',
  tabla_amortizacion: 'Tabla amortización',
  reporte_cartera: 'Reporte',
}

export default function PrestamoDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const isAdmin = session?.user?.app_metadata?.rol === 'admin' || session?.user?.user_metadata?.rol === 'admin'
  const { prestamoActual, cuotas, fetchPrestamo, fetchCuotas, cambiarEstado, loading, error, limpiarError } = usePrestamosStore()

  const [pagoModal, setPagoModal] = useState<Cuota | null>(null)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [notas, setNotas] = useState('')
  const [pagando, setPagando] = useState(false)
  const [pagoError, setPagoError] = useState<string | null>(null)
  const [pagoOkId, setPagoOkId] = useState<string | null>(null)

  // Condonar
  const [condonandoId, setCondonandoId] = useState<string | null>(null)

  // PDF generation states
  const [genPdf, setGenPdf] = useState(false)
  const [genContrato, setGenContrato] = useState(false)
  const [genRecibo, setGenRecibo] = useState<string | null>(null)

  // Documentos existentes
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [renovandoUrl, setRenovandoUrl] = useState<string | null>(null)

  // Refinanciación
  const [refModal, setRefModal] = useState(false)
  const [refNuevoCuotas, setRefNuevoCuotas] = useState('')
  const [refNuevaTasa, setRefNuevaTasa] = useState('')
  const [refSaving, setRefSaving] = useState(false)
  const [refError, setRefError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchPrestamo(id)
      fetchCuotas(id)
      cargarDocumentos(id)
    }
  }, [id, fetchPrestamo, fetchCuotas])

  const cargarDocumentos = async (prestamo_id: string) => {
    setLoadingDocs(true)
    try {
      const data = await apiGet<Documento[]>(`/documentos/prestamo/${prestamo_id}`)
      setDocumentos(data)
    } catch {
      // silencioso
    } finally {
      setLoadingDocs(false)
    }
  }

  const abrirPago = (c: Cuota) => {
    const saldo = c.monto - c.monto_pagado + (c.recargo_mora ?? 0)
    setMonto(String(saldo.toFixed(2)))
    setMetodo('efectivo')
    setNotas('')
    setPagoError(null)
    setPagoOkId(null)
    setPagoModal(c)
  }

  const registrarPago = async () => {
    if (!pagoModal || !id) return
    setPagando(true)
    setPagoError(null)
    try {
      const pago = await apiPost<{ id: string }>('/pagos', {
        cuota_id: pagoModal.id,
        prestamo_id: id,
        monto: Number(monto),
        metodo,
        notas: notas || undefined,
      })
      setPagoOkId(pago.id)
      setPagoModal(null)
      fetchPrestamo(id)
      fetchCuotas(id)
      cargarDocumentos(id)
    } catch (e) {
      setPagoError((e as Error).message)
    } finally {
      setPagando(false)
    }
  }

  const condonarCuota = async (cuota_id: string) => {
    if (!confirm('¿Condonar esta cuota? Esta acción perdona el saldo pendiente.')) return
    setCondonandoId(cuota_id)
    try {
      await apiPost(`/pagos/condonar/${cuota_id}`, {})
      fetchPrestamo(id!)
      fetchCuotas(id!)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setCondonandoId(null)
    }
  }

  const [aprobando, setAprobando] = useState(false)

  const aprobar = async () => {
    if (!id) return
    setAprobando(true)
    try { await cambiarEstado(id, 'activo') } catch (e) { alert((e as Error).message) }
    finally { setAprobando(false) }
  }

  const generarTabla = async () => {
    if (!id) return
    setGenPdf(true)
    try {
      const r = await apiPost<GenerarDocumentoOut>(`/documentos/tabla/${id}`)
      window.open(r.url_firmada, '_blank')
      cargarDocumentos(id)
    } catch (e) { alert((e as Error).message) }
    finally { setGenPdf(false) }
  }

  const generarContrato = async () => {
    if (!id) return
    setGenContrato(true)
    try {
      const r = await apiPost<GenerarDocumentoOut>(`/documentos/contrato/${id}`)
      window.open(r.url_firmada, '_blank')
      cargarDocumentos(id)
    } catch (e) { alert((e as Error).message) }
    finally { setGenContrato(false) }
  }

  const generarRecibo = async (pago_id: string) => {
    setGenRecibo(pago_id)
    try {
      const r = await apiPost<GenerarDocumentoOut>(`/documentos/recibo/${pago_id}`)
      window.open(r.url_firmada, '_blank')
      cargarDocumentos(id!)
    } catch (e) { alert((e as Error).message) }
    finally { setGenRecibo(null) }
  }

  const renovarUrl = async (doc_id: string) => {
    setRenovandoUrl(doc_id)
    try {
      const r = await apiGet<GenerarDocumentoOut>(`/documentos/${doc_id}/url`)
      window.open(r.url_firmada, '_blank')
    } catch (e) { alert((e as Error).message) }
    finally { setRenovandoUrl(null) }
  }

  const renovarPrestamo = () => {
    if (!prestamoActual) return
    // Navegar a nuevo préstamo pre-llenando cliente
    navigate(`/prestamos/nuevo?cliente_id=${prestamoActual.cliente_id}`)
  }

  const refinanciar = async () => {
    if (!id || !refNuevoCuotas) return
    setRefSaving(true)
    setRefError(null)
    try {
      // Condonar cuotas pendientes y crear nuevo préstamo por el saldo
      await apiPost(`/prestamos/${id}/refinanciar`, {
        n_cuotas: parseInt(refNuevoCuotas),
        tasa: refNuevaTasa ? parseFloat(refNuevaTasa) : undefined,
      })
      setRefModal(false)
      fetchPrestamo(id)
      fetchCuotas(id)
    } catch (e) {
      setRefError((e as Error).message)
    } finally {
      setRefSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>
  if (!prestamoActual) return <div className="p-6 text-center text-gray-400">Préstamo no encontrado</div>

  const p = prestamoActual
  const progreso = p.monto > 0 ? Math.min(100, ((p.monto - p.saldo_pendiente) / p.monto) * 100) : 0
  const cuotasPendientes = cuotas.filter(c => ['pendiente', 'pago_parcial', 'mora'].includes(c.estado))

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{fmt(p.monto)}</h1>
            <p className="text-xs text-gray-500">{p.clientes?.nombre ?? '—'}</p>
          </div>
        </div>
        <BadgePrestamo estado={p.estado as EstadoPrestamo} />
      </div>

      {error && <Alert message={error} onClose={limpiarError} className="mb-4" />}

      {/* Aviso de recibo disponible */}
      {pagoOkId && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 ring-1 ring-green-200">
          <p className="text-sm font-medium text-green-800">✅ Pago registrado</p>
          <button
            onClick={() => generarRecibo(pagoOkId)}
            disabled={genRecibo === pagoOkId}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {genRecibo === pagoOkId ? <Spinner size="sm" className="border-white border-t-green-200" /> : <DocumentArrowDownIcon className="h-3.5 w-3.5" />}
            Recibo PDF
          </button>
        </div>
      )}

      {/* Info préstamo */}
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">Tasa</p>
            <p className="font-bold text-gray-800">{p.tasa}% {p.tipo_tasa}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cuotas</p>
            <p className="font-bold text-gray-800">{p.n_cuotas} {p.periodicidad}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Inicio</p>
            <p className="font-bold text-gray-800">{fmtDate(p.fecha_inicio)}</p>
          </div>
        </div>

        {/* Progreso */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Pagado: {fmt(p.monto - p.saldo_pendiente)}</span>
            <span>Saldo: {fmt(p.saldo_pendiente)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${progreso}%` }} />
          </div>
          <p className="mt-1 text-right text-xs text-gray-400">{progreso.toFixed(1)}% completado</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="mb-4 flex flex-wrap gap-2">
        {p.estado === 'pendiente_aprobacion' && (
          <button onClick={aprobar} disabled={aprobando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
            {aprobando ? <Spinner size="sm" className="border-white border-t-green-200" /> : null}
            {aprobando ? 'Aprobando...' : '✓ Aprobar préstamo'}
          </button>
        )}
        <button onClick={generarContrato} disabled={genContrato}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {genContrato ? <Spinner size="sm" /> : <DocumentTextIcon className="h-4 w-4" />}
          Contrato
        </button>
        <button onClick={generarTabla} disabled={genPdf}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {genPdf ? <Spinner size="sm" /> : <ClipboardDocumentListIcon className="h-4 w-4" />}
          Tabla PDF
        </button>
        {isAdmin && (p.estado === 'activo' || p.estado === 'en_mora') && (
          <button onClick={() => setRefModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100">
            🔄 Refinanciar
          </button>
        )}
        {(p.estado === 'cerrado' || p.estado === 'cancelado') && (
          <button onClick={renovarPrestamo}
            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
            ➕ Nuevo préstamo
          </button>
        )}
      </div>

      {/* Cuotas */}
      <h2 className="mb-2 text-sm font-semibold text-gray-800">
        Cuotas ({cuotas.length})
        {cuotasPendientes.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-400">{cuotasPendientes.length} pendientes</span>
        )}
      </h2>

      <div className="space-y-1.5">
        {cuotas.map((c) => {
          const saldo = c.monto - c.monto_pagado + (c.recargo_mora ?? 0)
          const cobrable = ['pendiente', 'pago_parcial', 'mora'].includes(c.estado)
          return (
            <div key={c.id}
              className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100 ${
                c.estado === 'mora' ? 'ring-red-200 bg-red-50/50' : ''
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                {c.numero}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-800">{fmt(c.monto)}</p>
                  <BadgeCuota estado={c.estado as EstadoCuota} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">{fmtDate(c.fecha_vencimiento)}</p>
                  {(c.recargo_mora ?? 0) > 0 && (
                    <p className="text-[11px] font-medium text-red-600">+{fmt(c.recargo_mora)} mora</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {cobrable && (
                  <button
                    onClick={() => abrirPago(c)}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    <BanknotesIcon className="h-3.5 w-3.5" />
                    {fmt(saldo)}
                  </button>
                )}
                {cobrable && isAdmin && (
                  <button
                    onClick={() => condonarCuota(c.id)}
                    disabled={condonandoId === c.id}
                    title="Condonar cuota"
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-500 hover:border-yellow-300 hover:text-yellow-700 disabled:opacity-60"
                  >
                    {condonandoId === c.id ? '...' : '✗'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Documentos generados */}
      {(documentos.length > 0 || loadingDocs) && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-800">Documentos</h2>
          {loadingDocs ? (
            <div className="flex justify-center py-3"><Spinner size="sm" /></div>
          ) : (
            <div className="space-y-1.5">
              {documentos.map((doc) => (
                <div key={doc.id}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800">
                      {TIPO_LABEL[doc.tipo] ?? doc.tipo}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {fmtTs(doc.created_at)}
                      {doc.profiles?.nombre ? ` · ${doc.profiles.nombre}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => renovarUrl(doc.id)}
                    disabled={renovandoUrl === doc.id}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {renovandoUrl === doc.id ? <Spinner size="sm" /> : <DocumentArrowDownIcon className="h-3 w-3" />}
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de pago */}
      <Modal open={!!pagoModal} onClose={() => setPagoModal(null)} title={`Pago — Cuota #${pagoModal?.numero}`}>
        {pagoModal && (
          <div className="space-y-3">
            {pagoError && <Alert message={pagoError} onClose={() => setPagoError(null)} />}

            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Cuota N°</span>
                <span className="font-medium">{pagoModal.numero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Vencimiento</span>
                <span className="font-medium">{fmtDate(pagoModal.fecha_vencimiento)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Saldo total</span>
                <span className="font-bold text-gray-900">
                  {fmt(pagoModal.monto - pagoModal.monto_pagado + (pagoModal.recargo_mora ?? 0))}
                </span>
              </div>
            </div>

            <div>
              <label className="field-label">Monto a cobrar *</label>
              <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
                min="0.01" step="0.01" className="field-input" autoFocus />
            </div>

            <div>
              <label className="field-label">Método de pago</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className="field-input">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="field-label">Notas</label>
              <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones opcionales" className="field-input" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setPagoModal(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={registrarPago} disabled={pagando || !monto}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {pagando && <Spinner size="sm" className="border-white border-t-blue-200" />}
                {pagando ? 'Registrando...' : 'Registrar pago'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal refinanciación */}
      <Modal open={refModal} onClose={() => { setRefModal(false); setRefError(null) }} title="Refinanciar préstamo">
        <div className="space-y-4">
          <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800 ring-1 ring-orange-200">
            <p className="font-semibold mb-1">Saldo actual: {fmt(p.saldo_pendiente)}</p>
            <p className="text-xs">Se creará un nuevo plan de cuotas por el saldo pendiente. Las cuotas anteriores no pagadas quedarán condonadas.</p>
          </div>
          {refError && <Alert message={refError} onClose={() => setRefError(null)} />}
          <div>
            <label className="field-label">Nuevo número de cuotas *</label>
            <input type="number" min="1" max="120" value={refNuevoCuotas}
              onChange={e => setRefNuevoCuotas(e.target.value)}
              placeholder={String(p.n_cuotas)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Nueva tasa % (opcional, deja vacío para mantener {p.tasa}%)</label>
            <input type="number" min="0" step="0.1" value={refNuevaTasa}
              onChange={e => setRefNuevaTasa(e.target.value)}
              placeholder={String(p.tasa)} className="field-input" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setRefModal(false); setRefError(null) }}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={refinanciar} disabled={refSaving || !refNuevoCuotas}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
              {refSaving ? 'Procesando...' : 'Confirmar refinanciación'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
