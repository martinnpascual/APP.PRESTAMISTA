import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import Spinner from '../components/ui/Spinner'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  try {
    return new Date(s + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return s }
}

interface PortalData {
  cliente: { nombre: string; zona: string }
  prestamo: {
    id: string; monto: number; tasa: number; tipo_tasa: string
    periodicidad: string; n_cuotas: number; monto_cuota: number
    monto_total: number; saldo_pendiente: number; estado: string
    fecha_inicio: string; fecha_fin_estimada: string
  }
  cuotas: Array<{
    numero: number; fecha_vencimiento: string; monto: number
    monto_pagado: number; estado: string; dias_mora: number
    recargo_mora: number; pendiente: number
  }>
  pagos_recientes: Array<{ monto: number; fecha: string; metodo: string; notas?: string }>
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: '#fbbf24', pagada: '#4ade80', mora: '#f87171',
  pago_parcial: '#fb923c', condonada: '#9ca3af',
}

export default function PortalDeudor() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    axios.get<{ data: PortalData }>(`${API}/portal/${token}`)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.detail || 'Enlace no válido o expirado'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size="lg" />
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 40 }}>⚠️</span>
      <h2 style={{ color: '#f87171', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", margin: 0 }}>Enlace inválido</h2>
      <p style={{ color: '#6b7280', fontSize: 14 }}>{error}</p>
    </div>
  )

  if (!data) return null

  const { cliente, prestamo: p, cuotas, pagos_recientes } = data
  const pagadas = cuotas.filter(c => c.estado === 'pagada').length
  const enMora = cuotas.filter(c => c.estado === 'mora').length
  const progreso = p.monto > 0 ? Math.min(100, ((p.monto - p.saldo_pendiente) / p.monto) * 100) : 0

  const S = {
    page: { minHeight: '100vh', background: '#0f1117', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#e8eaf0', padding: '0 0 40px' } as React.CSSProperties,
    header: { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', padding: '28px 20px 24px', textAlign: 'center' as const },
    card: { background: '#161925', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 18, margin: '0 16px 14px' },
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>💰</div>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>Estado de Cuenta</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', margin: 0 }}>{cliente.nombre}</p>
        {cliente.zona && <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.5)', margin: '2px 0 0' }}>{cliente.zona}</p>}
      </div>

      <div style={{ height: 14 }} />

      {/* Resumen */}
      <div style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saldo pendiente</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: p.saldo_pendiente > 0 ? '#f87171' : '#4ade80', margin: 0 }}>
            {fmt(p.saldo_pendiente)}
          </p>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.07)', paddingLeft: 12 }}>
          <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cuota</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#e8eaf0', margin: 0 }}>{fmt(p.monto_cuota)}</p>
          <p style={{ fontSize: 10.5, color: '#6b7280', margin: '2px 0 0' }}>{p.periodicidad}</p>
        </div>
      </div>

      {/* Progreso */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
          <span>Pagado: {fmt(p.monto - p.saldo_pendiente)}</span>
          <span>Total: {fmt(p.monto_total)}</span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progreso}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 99, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
          <span style={{ color: '#4ade80' }}>{pagadas} cuotas pagadas</span>
          {enMora > 0 && <span style={{ color: '#f87171' }}>{enMora} en mora</span>}
          <span style={{ color: '#6b7280' }}>{progreso.toFixed(0)}% completado</span>
        </div>
      </div>

      {/* Info del préstamo */}
      <div style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        <InfoItem label="Préstamo" value={fmt(p.monto)} />
        <InfoItem label="Tasa" value={`${p.tasa}% ${p.tipo_tasa}`} />
        <InfoItem label="Cuotas" value={`${p.n_cuotas} ${p.periodicidad}`} />
        <InfoItem label="Inicio" value={fmtDate(p.fecha_inicio)} />
        <InfoItem label="Fin estimado" value={fmtDate(p.fecha_fin_estimada)} />
        <InfoItem label="Estado" value={p.estado.replace('_', ' ')} color={p.estado === 'activo' ? '#4ade80' : p.estado === 'en_mora' ? '#f87171' : '#9ca3af'} />
      </div>

      {/* Cuotas */}
      <div style={{ margin: '0 16px 14px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          CUOTAS ({cuotas.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cuotas.map(c => (
            <div key={c.numero} style={{
              background: '#161925',
              border: `1px solid ${c.estado === 'mora' ? 'rgba(239,68,68,.3)' : c.estado === 'pagada' ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.07)'}`,
              borderRadius: 11, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: c.estado === 'pagada' ? 'rgba(34,197,94,.15)' : c.estado === 'mora' ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: c.estado === 'pagada' ? 14 : 11.5,
                fontWeight: 700,
                color: ESTADO_COLOR[c.estado] ?? '#9ca3af',
              }}>
                {c.estado === 'pagada' ? '✓' : c.numero}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e8eaf0' }}>{fmt(c.monto)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, background: `${ESTADO_COLOR[c.estado] ?? '#9ca3af'}20`, color: ESTADO_COLOR[c.estado] ?? '#9ca3af', borderRadius: 5, padding: '2px 7px' }}>
                    {c.estado.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Vence: {fmtDate(c.fecha_vencimiento)}</span>
                  {c.recargo_mora > 0 && (
                    <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>+{fmt(c.recargo_mora)} mora</span>
                  )}
                </div>
                {c.monto_pagado > 0 && c.estado !== 'pagada' && (
                  <p style={{ fontSize: 10.5, color: '#4ade80', margin: '2px 0 0' }}>Abonado: {fmt(c.monto_pagado)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagos recientes */}
      {pagos_recientes.length > 0 && (
        <div style={{ margin: '0 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            ÚLTIMOS PAGOS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pagos_recientes.slice(0, 5).map((pago, i) => (
              <div key={i} style={{ background: '#161925', border: '1px solid rgba(34,197,94,.12)', borderRadius: 11, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', margin: 0 }}>{fmt(pago.monto)}</p>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{pago.metodo} · {fmtDate(pago.fecha)}</p>
                </div>
                <span style={{ fontSize: 18 }}>✅</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: '#374151' }}>
        prestamos.app · Este enlace es personal y confidencial
      </div>
    </div>
  )
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: color ?? '#e8eaf0', margin: 0 }}>{value}</p>
    </div>
  )
}
