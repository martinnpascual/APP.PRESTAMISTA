import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../services/api'
import type { CuotaCobro, GenerarDocumentoOut } from '../types'
import Spinner from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'
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

function semaforoBadge(s: string) {
  if (s === 'verde')   return { bg: 'rgba(34,197,94,.14)',  color: '#4ade80', label: 'AL DÍA'    }
  if (s === 'naranja') return { bg: 'rgba(249,115,22,.14)', color: '#fb923c', label: 'ATRASADO'  }
  if (s === 'rojo')    return { bg: 'rgba(239,68,68,.14)',  color: '#f87171', label: 'EN MORA'   }
  return                      { bg: 'rgba(107,114,128,.14)',color: '#9ca3af', label: s           }
}

// ── Inline SVGs ───────────────────────────────────────────────────────────────
const IcoPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
)
const IcoWhatsApp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)
const IcoEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const IcoMoney = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/>
    <path d="M6 12h.01M18 12h.01"/>
  </svg>
)
const IcoPin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)
const IcoPrint = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
)
const IcoDoc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
)
const IcoCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IcoX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IcoClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IcoMsg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)

export default function CobrosHoy() {
  const [tab,           setTab]           = useState<Tab>('pendientes')
  const [cobros,        setCobros]        = useState<CuotaCobro[]>([])
  const [zonas,         setZonas]         = useState<string[]>([])
  const [zonaActiva,    setZonaActiva]    = useState<string | null>(null)
  const [resumen,       setResumen]       = useState<ResumenCobrador | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [selected,      setSelected]      = useState<CuotaCobro | null>(null)
  const [pagando,       setPagando]       = useState(false)
  const [pagoOk,        setPagoOk]        = useState<string | null>(null)
  const [ultimoPagoId,  setUltimoPagoId]  = useState<string | null>(null)
  const [genRecibo,     setGenRecibo]     = useState(false)
  const [visitaTarget,  setVisitaTarget]  = useState<CuotaCobro | null>(null)
  const [resultadoVisita, setResultadoVisita] = useState<ResultadoVisita>('sin_pago')
  const [notasVisita,   setNotasVisita]   = useState('')
  const [guardandoVisita, setGuardandoVisita] = useState(false)

  const cargar = async (t: Tab) => {
    setLoading(true); setError(null)
    try {
      const endpoint = t === 'pendientes' ? '/cobros/pendientes' : '/cobros/hoy'
      const [data, resumenData, zonasData] = await Promise.all([
        apiGet<CuotaCobro[]>(endpoint),
        apiGet<ResumenCobrador>('/cobros/resumen'),
        apiGet<string[]>('/cobros/zonas'),
      ])
      setCobros(data); setResumen(resumenData); setZonas(zonasData)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar(tab) }, [tab])

  const cobrarRapido = async () => {
    if (!selected) return
    setPagando(true)
    try {
      const pago = await apiPost<{ id: string }>(`/cobros/${selected.cuota_id}/pagar`, { metodo: 'efectivo' })
      setUltimoPagoId(pago.id)
      setPagoOk(`Cobro registrado: ${fmt(calcTotal(selected))}`)
      setSelected(null)
      cargar(tab)
    } catch (e) { setError((e as Error).message) }
    finally { setPagando(false) }
  }

  const generarReciboUltimoPago = async () => {
    if (!ultimoPagoId) return
    setGenRecibo(true)
    try {
      const r = await apiPost<GenerarDocumentoOut>(`/documentos/recibo/${ultimoPagoId}`)
      window.open(r.url_firmada, '_blank')
    } catch (e) { setError((e as Error).message) }
    finally { setGenRecibo(false) }
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
      setVisitaTarget(null); setNotasVisita('')
    } catch (e) { setError((e as Error).message) }
    finally { setGuardandoVisita(false) }
  }

  const imprimirLista = () => {
    const fecha = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })
    const html = `<html><head><title>Cobros del día - ${fecha}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px}h1{font-size:16px;margin-bottom:4px}p{margin:2px 0 12px;color:#666}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:6px 8px;text-align:left;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #e5e7eb}@media print{body{margin:0}}</style></head>
    <body><h1>Lista de Cobros</h1><p>${fecha} — ${cobros.length} cuotas</p>
    <table><thead><tr><th>Cliente</th><th>Zona</th><th>Cuota</th><th>Monto</th><th>Mora</th><th>✓</th></tr></thead><tbody>
    ${cobrosFiltrados.map(c => `<tr><td>${c.cliente_nombre}</td><td>${c.zona ?? '—'}</td><td>#${c.numero} · ${new Date(c.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}</td><td>$ ${(calcTotal(c)).toLocaleString('es-AR')}</td><td>${(c.recargo_mora ?? 0) > 0 ? '$ ' + Number(c.recargo_mora).toLocaleString('es-AR') : '—'}</td><td></td></tr>`).join('')}
    </tbody></table></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const cobrosFiltrados = zonaActiva ? cobros.filter(c => c.zona === zonaActiva) : cobros
  const resumenPorZona  = cobrosFiltrados.reduce<Record<string, CuotaCobro[]>>((acc, c) => {
    const z = c.zona ?? 'Sin zona'
    return { ...acc, [z]: [...(acc[z] ?? []), c] }
  }, {})

  // ── Render ──────────────────────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'background .15s',
    fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
  }

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '22px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 5px' }}>
            GESTIÓN DE COBROS
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
            Cobros
          </h1>
          <p style={{ fontSize: '11.5px', color: '#4b5563', marginTop: '4px', fontWeight: 500 }}>
            {(() => { const s = format(new Date(), "EEEE d 'de' MMMM", { locale: es }); return s.charAt(0).toUpperCase() + s.slice(1) })()} · {cobros.length} cuotas
          </p>
        </div>
        <button
          onClick={imprimirLista}
          style={{ ...btnBase, gap: '6px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', padding: '9px 14px', fontSize: '12.5px', fontWeight: 600, color: '#9ca3af' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.1)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.06)'}
        >
          <IcoPrint /> Imprimir
        </button>
      </div>

      {/* Resumen cobrador */}
      {resumen && resumen.total_cuotas > 0 && (
        <div style={{ marginBottom: '18px', background: '#161925', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>MI PROGRESO HOY</p>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#6366f1' }}>{resumen.porcentaje_cobro}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,.07)', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ width: `${resumen.porcentaje_cobro}%`, height: '100%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '99px', transition: 'width .5s' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', textAlign: 'center' }}>
            {[
              { val: resumen.cuotas_cobradas,  label: 'Cobradas',   color: '#4ade80' },
              { val: resumen.cuotas_pendientes, label: 'Pendientes', color: '#e8eaf0' },
              { val: fmt(resumen.monto_cobrado), label: 'Cobrado',   color: '#a5b4fc' },
            ].map((s, i) => (
              <div key={i}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: s.color, margin: '0 0 2px' }}>{s.val}</p>
                <p style={{ fontSize: '10px', color: '#4b5563', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pago OK banner */}
      {pagoOk && (
        <div style={{ marginBottom: '14px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.22)', borderRadius: '11px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#4ade80', margin: 0 }}>✅ {pagoOk}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {ultimoPagoId && (
              <button
                onClick={generarReciboUltimoPago}
                disabled={genRecibo}
                style={{ ...btnBase, gap: '5px', background: 'rgba(34,197,94,.18)', color: '#4ade80', padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, opacity: genRecibo ? 0.6 : 1 }}
              >
                {genRecibo ? <Spinner size="sm" /> : <IcoDoc />}
                Recibo
              </button>
            )}
            <button onClick={() => { setPagoOk(null); setUltimoPagoId(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(74,222,128,.5)', padding: 0, display: 'flex' }}>
              <IcoX />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(252,165,165,.6)', display: 'flex', padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,.05)', borderRadius: '11px', padding: '4px', marginBottom: '14px' }}>
        {(['pendientes', 'hoy'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all .15s',
              background: tab === t ? '#1c1f2e' : 'transparent',
              color: tab === t ? '#e8eaf0' : '#6b7280',
              boxShadow: tab === t ? '0 1px 6px rgba(0,0,0,.3)' : 'none',
              fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
            }}
          >
            {t === 'pendientes' ? '📋 Todas pendientes' : '📅 Solo hoy'}
          </button>
        ))}
      </div>

      {/* Zone filter */}
      {zonas.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[null, ...zonas].map(z => {
            const active = z === null ? !zonaActiva : zonaActiva === z
            return (
              <button
                key={z ?? '__all__'}
                onClick={() => setZonaActiva(z === zonaActiva ? null : z)}
                style={{
                  flexShrink: 0, borderRadius: '99px', padding: '5px 13px',
                  fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                  border: active ? 'none' : '1px solid rgba(255,255,255,.1)',
                  background: active ? '#6366f1' : 'transparent',
                  color: active ? '#fff' : '#6b7280',
                  fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                }}
              >
                {z ?? 'Todas'}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner size="lg" /></div>
      ) : cobrosFiltrados.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0' }}>
          <p style={{ fontSize: '36px', margin: 0 }}>🎉</p>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80', margin: 0 }}>Sin cobros pendientes</p>
          <p style={{ fontSize: '12px', color: '#4b5563', margin: 0 }}>Cartera al día</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(resumenPorZona).map(([zona, items]) => (
            <div key={zona}>
              {/* Zone header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ color: '#374151', display: 'flex' }}><IcoPin /></span>
                <h2 style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{zona}</h2>
                <span style={{ fontSize: '11px', color: '#4b5563' }}>
                  ({items.length}) · {fmt(items.reduce((s, c) => s + calcTotal(c), 0))}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(c => {
                  const sem = c.semaforo ? semaforoBadge(c.semaforo) : null
                  const hasMora = (c.recargo_mora ?? 0) > 0
                  return (
                    <div
                      key={c.cuota_id}
                      style={{
                        background: '#161925',
                        border: `1px solid ${c.semaforo === 'rojo' ? 'rgba(239,68,68,.25)' : c.semaforo === 'naranja' ? 'rgba(249,115,22,.22)' : 'rgba(255,255,255,.07)'}`,
                        borderLeft: `3px solid ${c.semaforo === 'rojo' ? '#ef4444' : c.semaforo === 'naranja' ? '#f97316' : '#22c55e'}`,
                        borderRadius: '13px',
                        padding: '14px 16px',
                      }}
                    >
                      <div className="cobro-card-inner" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        {/* Left: client info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#e8eaf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.cliente_nombre}
                            </span>
                            {sem && (
                              <span style={{ background: sem.bg, color: sem.color, fontSize: '9.5px', fontWeight: 700, borderRadius: '5px', padding: '2px 7px', flexShrink: 0 }}>
                                {sem.label}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 3px' }}>
                            Cuota {c.numero} · vence {new Date(c.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}
                            {(c.dias_atraso ?? 0) > 0 && (
                              <span style={{ color: '#f87171', fontWeight: 600 }}> (+{c.dias_atraso}d)</span>
                            )}
                          </p>
                          {c.direccion && (
                            <p style={{ fontSize: '11px', color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <IcoPin />{c.direccion}
                            </p>
                          )}
                        </div>

                        {/* Right: amount + actions */}
                        <div className="cobro-card-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                          <p style={{ fontSize: '18px', fontWeight: 800, color: '#e8eaf0', margin: 0, letterSpacing: '-0.02em' }}>
                            {fmt(calcTotal(c))}
                          </p>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {c.telefono && (
                              <>
                                <a
                                  href={`tel:${c.telefono}`}
                                  onClick={e => e.stopPropagation()}
                                  style={{ ...btnBase, width: '32px', height: '32px', background: 'rgba(255,255,255,.06)', color: '#9ca3af', textDecoration: 'none' }}
                                  title="Llamar"
                                >
                                  <IcoPhone />
                                </a>
                                <a
                                  href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ ...btnBase, width: '32px', height: '32px', background: 'rgba(37,211,102,.12)', color: '#25d366', textDecoration: 'none' }}
                                  title="WhatsApp"
                                >
                                  <IcoWhatsApp />
                                </a>
                              </>
                            )}
                            <button
                              onClick={() => setVisitaTarget(c)}
                              style={{ ...btnBase, width: '32px', height: '32px', background: 'rgba(255,255,255,.06)', color: '#9ca3af' }}
                              title="Registrar visita"
                            >
                              <IcoEye />
                            </button>
                            <button
                              onClick={() => setSelected(c)}
                              style={{ ...btnBase, gap: '5px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', padding: '0 14px', height: '32px', fontSize: '12.5px', fontWeight: 700, boxShadow: '0 2px 8px rgba(99,102,241,.3)' }}
                            >
                              <IcoMoney /> Cobrar
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Mora recargo */}
                      {hasMora && (
                        <div style={{ marginTop: '10px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: '8px', padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11.5px', color: '#f87171', fontWeight: 600 }}>
                            ⚠ Recargo mora: {fmt(c.recargo_mora ?? 0)}
                          </span>
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>{c.dias_mora} días</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Cobro rápido ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Confirmar cobro">
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.18)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 8px' }}>{selected.cliente_nombre}</p>
              <p style={{ fontSize: '34px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.03em', margin: '0 0 6px' }}>{fmt(calcTotal(selected))}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                Cuota {selected.numero} · {new Date(selected.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}
              </p>
              {(selected.recargo_mora ?? 0) > 0 && (
                <p style={{ fontSize: '11.5px', color: '#f87171', marginTop: '6px', fontWeight: 600 }}>
                  Incluye mora: {fmt(selected.recargo_mora ?? 0)}
                </p>
              )}
            </div>
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', margin: 0 }}>¿Confirmar cobro en efectivo?</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSelected(null)}
                style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '11px', padding: '12px', fontSize: '13.5px', fontWeight: 600, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancelar
              </button>
              <button
                onClick={cobrarRapido}
                disabled={pagando}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '11px', padding: '12px', fontSize: '13.5px', fontWeight: 700, color: '#fff', cursor: pagando ? 'not-allowed' : 'pointer', opacity: pagando ? 0.7 : 1, fontFamily: 'inherit' }}
              >
                {pagando ? <Spinner size="sm" /> : null}
                {pagando ? 'Registrando...' : '✓ Confirmar cobro'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Visita ── */}
      <Modal open={!!visitaTarget} onClose={() => { setVisitaTarget(null); setNotasVisita('') }} title="Registrar visita">
        {visitaTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#e8eaf0', margin: '0 0 4px' }}>{visitaTarget.cliente_nombre}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Cuota {visitaTarget.numero} · {fmt(calcTotal(visitaTarget))}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
              {([
                { value: 'cobrado',       label: 'Cobrado',      Icon: IcoCheck, color: '#22c55e', bg: 'rgba(34,197,94,.12)',   active: 'rgba(34,197,94,.18)'  },
                { value: 'sin_pago',      label: 'Sin pago',     Icon: IcoX,     color: '#ef4444', bg: 'rgba(239,68,68,.12)',   active: 'rgba(239,68,68,.2)'   },
                { value: 'ausente',       label: 'Ausente',      Icon: IcoClock, color: '#eab308', bg: 'rgba(234,179,8,.12)',   active: 'rgba(234,179,8,.2)'   },
                { value: 'promesa_pago',  label: 'Promesa',      Icon: IcoMsg,   color: '#6366f1', bg: 'rgba(99,102,241,.12)',  active: 'rgba(99,102,241,.2)'  },
              ] as const).map(({ value, label, Icon, color, bg, active }) => {
                const sel = resultadoVisita === value
                return (
                  <button
                    key={value}
                    onClick={() => setResultadoVisita(value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      padding: '14px', borderRadius: '11px', cursor: 'pointer', transition: 'all .15s',
                      border: `2px solid ${sel ? color : 'rgba(255,255,255,.08)'}`,
                      background: sel ? active : bg,
                      color: sel ? color : '#6b7280',
                      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                    }}
                  >
                    <Icon />
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{label}</span>
                  </button>
                )
              })}
            </div>

            <textarea
              value={notasVisita}
              onChange={e => setNotasVisita(e.target.value)}
              placeholder="Notas opcionales..."
              rows={2}
              style={{ background: '#161925', border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', padding: '10px 14px', color: '#e8eaf0', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#6366f1')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setVisitaTarget(null); setNotasVisita('') }}
                style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '11px', padding: '12px', fontSize: '13.5px', fontWeight: 600, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancelar
              </button>
              <button
                onClick={registrarVisita}
                disabled={guardandoVisita}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '11px', padding: '12px', fontSize: '13.5px', fontWeight: 700, color: '#fff', cursor: guardandoVisita ? 'not-allowed' : 'pointer', opacity: guardandoVisita ? 0.7 : 1, fontFamily: 'inherit' }}
              >
                {guardandoVisita ? <Spinner size="sm" /> : null}
                {guardandoVisita ? 'Guardando...' : 'Guardar visita'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
