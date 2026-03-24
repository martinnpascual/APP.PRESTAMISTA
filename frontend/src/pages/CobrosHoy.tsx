import { useEffect, useState } from 'react'
import {
  PhoneIcon,
  MapPinIcon,
  BanknotesIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline'
import { apiGet, apiPost } from '../services/api'
import type { CuotaCobro } from '../types'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Modal from '../components/ui/Modal'
import { BadgeSemaforo } from '../components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function calcTotal(c: CuotaCobro) {
  return c.total_a_cobrar ?? (c.monto - c.monto_pagado + (c.recargo_mora ?? 0))
}

type Tab = 'pendientes' | 'hoy'
type ResultadoVisita = 'cobrado' | 'sin_pago' | 'ausente' | 'promesa_pago'

interface ResumenCobrador {
  total_cuotas: number
  cuotas_cobradas: number
  cuotas_pendientes: number
  monto_cobrado: number
  monto_pendiente: number
  porcentaje_cobro: number
}

export default function CobrosHoy() {
  const [tab, setTab] = useState<Tab>('pendientes')
  const [cobros, setCobros] = useState<CuotaCobro[]>([])
  const [zonas, setZonas] = useState<string[]>([])
  const [zonaActiva, setZonaActiva] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenCobrador | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CuotaCobro | null>(null)
  const [pagando, setPagando] = useState(false)
  const [pagoOk, setPagoOk] = useState<string | null>(null)

  // Visita modal
  const [visitaTarget, setVisitaTarget] = useState<CuotaCobro | null>(null)
  const [resultadoVisita, setResultadoVisita] = useState<ResultadoVisita>('sin_pago')
  const [notasVisita, setNotasVisita] = useState('')
  const [guardandoVisita, setGuardandoVisita] = useState(false)

  const cargar = async (t: Tab) => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = t === 'pendientes' ? '/cobros/pendientes' : '/cobros/hoy'
      const [data, resumenData, zonasData] = await Promise.all([
        apiGet<CuotaCobro[]>(endpoint),
        apiGet<ResumenCobrador>('/cobros/resumen'),
        apiGet<string[]>('/cobros/zonas'),
      ])
      setCobros(data)
      setResumen(resumenData)
      setZonas(zonasData)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar(tab) }, [tab])

  const cobrarRapido = async () => {
    if (!selected) return
    setPagando(true)
    try {
      await apiPost(`/cobros/${selected.cuota_id}/pagar`, { metodo: 'efectivo' })
      setPagoOk(`Cobro registrado: ${fmt(calcTotal(selected))}`)
      setSelected(null)
      cargar(tab)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPagando(false)
    }
  }

  const registrarVisita = async () => {
    if (!visitaTarget) return
    setGuardandoVisita(true)
    try {
      await apiPost(`/cobros/${visitaTarget.cuota_id}/visita`, {
        resultado: resultadoVisita,
        notas: notasVisita || undefined,
      })
      setPagoOk(`Visita registrada: ${resultadoVisita.replace('_', ' ')}`)
      setVisitaTarget(null)
      setNotasVisita('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardandoVisita(false)
    }
  }

  const cobrosFiltrados = zonaActiva
    ? cobros.filter((c) => c.zona === zonaActiva)
    : cobros

  const resumenPorZona = cobrosFiltrados.reduce<Record<string, CuotaCobro[]>>((acc, c) => {
    const z = c.zona ?? 'Sin zona'
    return { ...acc, [z]: [...(acc[z] ?? []), c] }
  }, {})

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Cobros</h1>
        <p className="text-xs text-gray-500">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })} · {cobros.length} cuotas
        </p>
      </div>

      {/* Resumen cobrador */}
      {resumen && resumen.total_cuotas > 0 && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mi progreso hoy</p>
            <span className="text-sm font-bold text-blue-600">{resumen.porcentaje_cobro}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${resumen.porcentaje_cobro}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-bold text-green-600">{resumen.cuotas_cobradas}</p>
              <p className="text-gray-400">Cobradas</p>
            </div>
            <div>
              <p className="font-bold text-gray-700">{resumen.cuotas_pendientes}</p>
              <p className="text-gray-400">Pendientes</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">{fmt(resumen.monto_cobrado)}</p>
              <p className="text-gray-400">Cobrado</p>
            </div>
          </div>
        </div>
      )}

      {pagoOk && (
        <Alert type="success" message={pagoOk} onClose={() => setPagoOk(null)} className="mb-4" />
      )}
      {error && <Alert message={error} onClose={() => setError(null)} className="mb-4" />}

      {/* Tabs */}
      <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
        {(['pendientes', 'hoy'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'pendientes' ? '📋 Todas pendientes' : '📅 Solo hoy'}
          </button>
        ))}
      </div>

      {/* Filtro por zona */}
      {zonas.length > 1 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setZonaActiva(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !zonaActiva
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          {zonas.map((z) => (
            <button
              key={z}
              onClick={() => setZonaActiva(zonaActiva === z ? null : z)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                zonaActiva === z
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : cobrosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
          <p className="text-4xl">🎉</p>
          <p className="text-sm font-medium">Sin cobros pendientes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(resumenPorZona).map(([zona, items]) => (
            <div key={zona}>
              <div className="mb-2 flex items-center gap-2">
                <MapPinIcon className="h-3.5 w-3.5 text-gray-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{zona}</h2>
                <span className="text-xs text-gray-400">
                  ({items.length}) · {fmt(items.reduce((s, c) => s + calcTotal(c), 0))}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((c) => (
                  <div key={c.cuota_id}
                    className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-shadow hover:shadow-md ${
                      c.semaforo === 'rojo' ? 'ring-red-200' :
                      c.semaforo === 'naranja' ? 'ring-orange-200' : 'ring-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-gray-900">{c.cliente_nombre}</p>
                          {c.semaforo && <BadgeSemaforo semaforo={c.semaforo} />}
                        </div>
                        <p className="text-xs text-gray-500">
                          Cuota {c.numero} · vence {c.fecha_vencimiento}
                          {(c.dias_atraso ?? 0) > 0 && (
                            <span className="font-medium text-red-600"> (+{c.dias_atraso} días)</span>
                          )}
                        </p>
                        {c.direccion && (
                          <p className="mt-0.5 text-xs text-gray-400 flex items-center gap-1">
                            <MapPinIcon className="h-3 w-3" />{c.direccion}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="text-base font-bold text-gray-900">{fmt(calcTotal(c))}</p>
                        <div className="flex gap-1.5">
                          {c.telefono && (
                            <>
                              <a
                                href={`tel:${c.telefono}`}
                                className="flex items-center justify-center rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
                                onClick={(e) => e.stopPropagation()}
                                title="Llamar"
                              >
                                <PhoneIcon className="h-3.5 w-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center rounded-lg bg-green-100 p-1.5 text-green-700 hover:bg-green-200"
                                onClick={(e) => e.stopPropagation()}
                                title="WhatsApp"
                              >
                                <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => setVisitaTarget(c)}
                            className="flex items-center justify-center rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
                            title="Registrar visita"
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setSelected(c)}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            <BanknotesIcon className="h-3.5 w-3.5" />
                            Cobrar
                          </button>
                        </div>
                      </div>
                    </div>

                    {(c.recargo_mora ?? 0) > 0 && (
                      <div className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                        Recargo mora: {fmt(c.recargo_mora ?? 0)} · {c.dias_mora} días
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal cobro rápido */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Confirmar cobro">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="text-xs text-blue-600 uppercase font-medium">{selected.cliente_nombre}</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{fmt(calcTotal(selected))}</p>
              <p className="text-xs text-blue-500 mt-1">
                Cuota {selected.numero} · {selected.fecha_vencimiento}
              </p>
              {(selected.recargo_mora ?? 0) > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Incluye mora: {fmt(selected.recargo_mora ?? 0)}
                </p>
              )}
            </div>

            <p className="text-center text-sm text-gray-500">¿Confirmar cobro en efectivo?</p>

            <div className="flex gap-2">
              <button onClick={() => setSelected(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700">
                Cancelar
              </button>
              <button onClick={cobrarRapido} disabled={pagando}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {pagando && <Spinner size="sm" className="border-white border-t-blue-200" />}
                {pagando ? 'Registrando...' : '✓ Confirmar cobro'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal visita */}
      <Modal open={!!visitaTarget} onClose={() => { setVisitaTarget(null); setNotasVisita('') }} title="Registrar visita">
        {visitaTarget && (
          <div className="space-y-4">
            <p className="text-center text-sm font-semibold text-gray-700">{visitaTarget.cliente_nombre}</p>
            <p className="text-center text-xs text-gray-500">
              Cuota {visitaTarget.numero} · {fmt(calcTotal(visitaTarget))}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'cobrado',      label: 'Cobrado',       Icon: CheckCircleIcon, color: 'green' },
                { value: 'sin_pago',     label: 'Sin pago',      Icon: XCircleIcon,     color: 'red'   },
                { value: 'ausente',      label: 'Ausente',       Icon: ClockIcon,       color: 'yellow'},
                { value: 'promesa_pago', label: 'Promesa pago',  Icon: ChatBubbleLeftIcon, color: 'blue'},
              ] as const).map(({ value, label, Icon, color }) => (
                <button
                  key={value}
                  onClick={() => setResultadoVisita(value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-semibold transition-colors ${
                    resultadoVisita === value
                      ? color === 'green'  ? 'border-green-500 bg-green-50 text-green-700'
                      : color === 'red'    ? 'border-red-500 bg-red-50 text-red-700'
                      : color === 'yellow' ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                                           : 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={notasVisita}
              onChange={(e) => setNotasVisita(e.target.value)}
              placeholder="Notas opcionales..."
              rows={2}
              className="field-input resize-none text-sm"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setVisitaTarget(null); setNotasVisita('') }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={registrarVisita}
                disabled={guardandoVisita}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {guardandoVisita && <Spinner size="sm" className="border-white border-t-blue-200" />}
                {guardandoVisita ? 'Guardando...' : 'Guardar visita'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
