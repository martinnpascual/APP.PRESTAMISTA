import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet } from '../services/api'
import type { KPIs, Prestamo, PaginatedResponse } from '../types'
import Spinner from '../components/ui/Spinner'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function today() {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Inline SVGs ────────────────────────────────────────────────────────────
const IcoTrend = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IcoAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IcoPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IcoChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IcoCoin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
  </svg>
)
const IcoClipboard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>
)
const IcoUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const IcoChart = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

function estadoBadge(estado: string) {
  if (estado === 'activo')               return { bg: 'rgba(34,197,94,.14)',   color: '#4ade80',  label: 'AL DÍA' }
  if (estado === 'en_mora')              return { bg: 'rgba(239,68,68,.14)',   color: '#f87171',  label: 'EN MORA' }
  if (estado === 'pendiente_aprobacion') return { bg: 'rgba(234,179,8,.14)',   color: '#fbbf24',  label: 'PENDIENTE' }
  if (estado === 'cerrado')              return { bg: 'rgba(107,114,128,.14)', color: '#9ca3af',  label: 'CERRADO' }
  return                                        { bg: 'rgba(107,114,128,.14)', color: '#9ca3af',  label: estado.toUpperCase() }
}

// ── Action button component ────────────────────────────────────────────────
function ActionBtn({ to, label, sub, icon, color, primary }: {
  to: string; label: string; sub: string
  icon: React.ReactNode; color: string; primary?: boolean
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: primary ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,.04)',
          border: primary ? 'none' : '1px solid rgba(255,255,255,.07)',
          borderRadius: '11px', padding: '11px 14px',
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', transition: 'all .15s',
          boxShadow: primary ? '0 3px 14px rgba(99,102,241,.3)' : 'none',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          if (primary) el.style.opacity = '0.88'
          else el.style.background = 'rgba(255,255,255,.07)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          if (primary) el.style.opacity = '1'
          else el.style.background = 'rgba(255,255,255,.04)'
        }}
      >
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
          background: primary ? 'rgba(255,255,255,.2)' : color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: primary ? '#fff' : 'inherit',
        }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: primary ? '#fff' : '#d1d5db', margin: 0 }}>{label}</p>
          <p style={{ fontSize: '10px', color: primary ? 'rgba(255,255,255,.6)' : '#4b5563', margin: 0 }}>{sub}</p>
        </div>
      </div>
    </Link>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [kpis,      setKpis]      = useState<KPIs | null>(null)
  const [recientes, setRecientes] = useState<Prestamo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    Promise.all([
      apiGet<KPIs>('/reportes/kpis').then(setKpis).catch(e => setError(e.message)),
      apiGet<PaginatedResponse<Prestamo>>('/prestamos?per_page=5&estado=activo,en_mora')
        .then(d => setRecientes(d?.items ?? []))
        .catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) navigate(`/clientes?q=${encodeURIComponent(search.trim())}`)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spinner size="lg" />
    </div>
  )

  const riesgo = kpis
    ? kpis.prestamos_activos + kpis.clientes_en_mora > 0
      ? ((kpis.clientes_en_mora / (kpis.prestamos_activos + kpis.clientes_en_mora)) * 100).toFixed(1)
      : '0.0'
    : '0.0'

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '22px' }}>
        <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 6px' }}>
          VISIÓN GENERAL
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
            Dashboard Principal
          </h1>
          <span style={{ background: 'rgba(99,102,241,.15)', color: '#a5b4fc', fontSize: '11px', fontWeight: 700, borderRadius: '99px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IcoTrend /> +12.5% vs mes anterior
          </span>
        </div>
        <p style={{ fontSize: '12px', color: '#374151', marginTop: '4px', textTransform: 'capitalize', fontWeight: 400 }}>
          {today()}
        </p>
      </div>

      {/* ── Search ── */}
      <form onSubmit={handleSearch} style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', display: 'flex', pointerEvents: 'none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar préstamos o clientes..."
            style={{ width: '100%', background: '#161925', border: '1px solid rgba(255,255,255,.09)', borderRadius: '11px', padding: '10px 14px 10px 40px', color: '#e8eaf0', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
            onFocus={e => (e.target.style.borderColor = '#6366f1')}
            onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,.09)')}
          />
        </div>
        <button type="submit" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: '11px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 10px rgba(99,102,241,.35)' }}>
          Buscar
        </button>
      </form>

      {error && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {kpis && (
        <>
          {/* ── Main grid: content + sidebar ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 256px', gap: '20px', alignItems: 'start' }}>

            {/* ═══ LEFT: KPIs + Recientes ═══ */}
            <div>
              <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                MÉTRICAS DEL NEGOCIO
              </p>

              {/* Asymmetric KPI grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: '10px', marginBottom: '24px' }}>

                {/* Capital Prestado — spans 2 rows */}
                <Link to="/prestamos" style={{ textDecoration: 'none', gridRow: '1 / 3' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(160deg, #181b2d 0%, #111422 100%)', border: '1px solid rgba(99,102,241,.28)', borderRadius: '16px', padding: '22px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .2s, box-shadow .2s', boxSizing: 'border-box' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'rgba(99,102,241,.5)'; el.style.boxShadow = '0 4px 24px rgba(99,102,241,.12)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'rgba(99,102,241,.28)'; el.style.boxShadow = 'none' }}>
                    {/* Glows */}
                    <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: 'radial-gradient(circle, rgba(99,102,241,.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: '-30px', left: '-20px', width: '130px', height: '130px', background: 'radial-gradient(circle, rgba(139,92,246,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>CAPITAL PRESTADO</p>
                      <span style={{ background: 'rgba(99,102,241,.18)', color: '#818cf8', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>⬡</span>
                    </div>

                    <p style={{ fontSize: '36px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>
                      {fmt(kpis.capital_total_prestado)}
                    </p>

                    <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <p style={{ fontSize: '10px', color: '#374151', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Saldo pendiente</p>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', margin: 0 }}>{fmt(kpis.saldo_total_pendiente)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: '#374151', margin: '0 0 6px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Retorno est.</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,.08)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: '18.4%', height: '100%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>18.4%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Préstamos Activos */}
                <div style={{ background: '#161925', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>PRÉSTAMOS ACTIVOS</p>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,.6)', flexShrink: 0 }} />
                  </div>
                  <p style={{ fontSize: '38px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.02em', margin: '0 0 6px', lineHeight: 1 }}>
                    {kpis.prestamos_activos}
                  </p>
                  <p style={{ fontSize: '10px', color: '#4b5563', margin: 0 }}>Actualizado hace 5m</p>
                  <p style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>● Actualmente activos</p>
                </div>

                {/* Clientes en Mora */}
                <Link to="/cobros" style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#161925', border: `1px solid ${kpis.clientes_en_mora > 0 ? 'rgba(249,115,22,.35)' : 'rgba(255,255,255,.07)'}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'border-color .2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = kpis.clientes_en_mora > 0 ? 'rgba(249,115,22,.55)' : 'rgba(255,255,255,.14)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = kpis.clientes_en_mora > 0 ? 'rgba(249,115,22,.35)' : 'rgba(255,255,255,.07)'}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>CLIENTES EN MORA</p>
                      {kpis.clientes_en_mora > 0 && <span style={{ color: '#fb923c', display: 'flex' }}><IcoAlert /></span>}
                    </div>
                    <p style={{ fontSize: '38px', fontWeight: 800, color: kpis.clientes_en_mora > 0 ? '#fb923c' : '#e8eaf0', letterSpacing: '-0.02em', margin: '0 0 4px', lineHeight: 1 }}>
                      {kpis.clientes_en_mora}
                    </p>
                    <p style={{ fontSize: '10px', color: '#4b5563', margin: 0 }}>
                      {kpis.clientes_en_mora > 0 ? `/ ${kpis.prestamos_activos + kpis.clientes_en_mora} total` : 'todo al día ✓'}
                    </p>
                    {kpis.clientes_en_mora > 0 && (
                      <p style={{ fontSize: '10px', color: '#fb923c', marginTop: '4px', fontWeight: 600 }}>Acción requerida inmediata</p>
                    )}
                  </div>
                </Link>

                {/* Monto en Mora */}
                <Link to="/cobros" style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#161925', border: `1px solid ${kpis.monto_en_mora > 0 ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.15)'}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'border-color .2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = kpis.monto_en_mora > 0 ? 'rgba(239,68,68,.45)' : 'rgba(34,197,94,.3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = kpis.monto_en_mora > 0 ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.15)'}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>MONTO EN MORA</p>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: kpis.monto_en_mora > 0 ? '#ef4444' : '#22c55e', boxShadow: `0 0 6px ${kpis.monto_en_mora > 0 ? 'rgba(239,68,68,.6)' : 'rgba(34,197,94,.5)'}` }} />
                    </div>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: kpis.monto_en_mora > 0 ? '#f87171' : '#4ade80', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
                      {kpis.monto_en_mora > 0 ? fmt(kpis.monto_en_mora) : 'Sin mora'}
                    </p>
                    <p style={{ fontSize: '10px', color: '#4b5563', marginTop: '6px' }}>
                      {kpis.monto_en_mora > 0 ? 'monto total atrasado' : 'cartera sana ✓'}
                    </p>
                  </div>
                </Link>

                {/* Ratio de Riesgo */}
                <div style={{ background: '#161925', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '18px' }}>
                  <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 8px' }}>RATIO DE RIESGO</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
                    {riesgo}%
                  </p>
                  <div style={{ marginTop: '8px', height: '4px', background: 'rgba(255,255,255,.08)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(parseFloat(riesgo), 100)}%`, height: '100%', background: 'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius: '99px', transition: 'width .4s' }} />
                  </div>
                  <p style={{ fontSize: '10px', color: '#4b5563', marginTop: '5px' }}>mora / cartera total</p>
                </div>
              </div>

              {/* ── Préstamos Recientes ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: 0 }}>
                  PRÉSTAMOS RECIENTES
                </p>
                <Link to="/prestamos" style={{ fontSize: '11.5px', color: '#6366f1', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  VER TODOS <IcoChevron />
                </Link>
              </div>

              <div style={{ background: '#161925', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', overflow: 'hidden' }}>
                {recientes.length === 0 ? (
                  <p style={{ textAlign: 'center', fontSize: '13px', color: '#4b5563', padding: '24px' }}>Sin préstamos activos</p>
                ) : recientes.map((p, i) => {
                  const est = estadoBadge(p.estado)
                  const pct = p.monto > 0 ? Math.max(0, Math.min(100, ((p.monto - p.saldo_pendiente) / p.monto) * 100)) : 0
                  return (
                    <Link key={p.id} to={`/prestamos/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', borderBottom: i < recientes.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.03)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                      >
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.15))', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#a5b4fc', flexShrink: 0 }}>
                          {(p.clientes?.nombre ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8eaf0' }}>{p.clientes?.nombre ?? '—'}</span>
                            <span style={{ fontSize: '10.5px', color: '#374151' }}>· {p.clientes?.zona ?? 'Sin zona'}</span>
                          </div>
                          <div style={{ height: '3px', background: 'rgba(255,255,255,.07)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: p.estado === 'en_mora' ? '#ef4444' : 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '99px', transition: 'width .4s' }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#e8eaf0', margin: '0 0 4px' }}>{fmt(p.monto)}</p>
                          <span style={{ background: est.bg, color: est.color, fontSize: '9.5px', fontWeight: 700, borderRadius: '5px', padding: '2px 7px' }}>
                            {est.label}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}

                {/* + Nuevo Préstamo CTA */}
                <Link to="/prestamos/nuevo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderTop: '1px solid rgba(255,255,255,.05)', fontSize: '12.5px', fontWeight: 600, color: '#6366f1', transition: 'background .12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(99,102,241,.07)'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}>
                  <IcoPlus /> Nuevo Préstamo
                </Link>
              </div>
            </div>

            {/* ═══ RIGHT: Actions + Stats ═══ */}
            <div style={{ position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Acciones Rápidas */}
              <div style={{ background: '#161925', border: '1px solid rgba(255,255,255,.07)', borderRadius: '16px', padding: '18px' }}>
                <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 14px' }}>ACCIONES RÁPIDAS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <ActionBtn to="/prestamos/nuevo" label="Nuevo Préstamo"   sub="Registrar operación" icon={<IcoCoin />}      color="rgba(99,102,241,.15)"  primary />
                  <ActionBtn to="/cobros"          label="Registrar Cobro"  sub="Cobros del día"      icon={<IcoClipboard />} color="rgba(34,197,94,.12)" />
                  <ActionBtn to="/clientes/nuevo"  label="Agregar Cliente"  sub="Nuevo registro"      icon={<IcoUser />}      color="rgba(99,102,241,.12)" />
                  <ActionBtn to="/reportes"        label="Ver Reportes"     sub="Exportar datos"      icon={<IcoChart />}     color="rgba(251,191,36,.1)" />
                </div>
              </div>

              {/* Mini stats */}
              <div style={{ background: '#161925', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '16px' }}>
                <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 12px' }}>ESTADÍSTICAS</p>
                {[
                  { label: 'Préstamos activos', value: String(kpis.prestamos_activos), color: '#e8eaf0' },
                  { label: 'Clientes en mora',  value: String(kpis.clientes_en_mora),  color: kpis.clientes_en_mora > 0 ? '#fb923c' : '#4ade80' },
                  { label: 'Ratio de riesgo',   value: `${riesgo}%`,                   color: '#fbbf24' },
                ].map((s, i, arr) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                      <span style={{ fontSize: '11.5px', color: '#6b7280' }}>{s.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                    {i < arr.length - 1 && <div style={{ height: '1px', background: 'rgba(255,255,255,.04)' }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Bottom metrics strip ── */}
          <div style={{ marginTop: '20px', padding: '14px 20px', background: '#161925', border: '1px solid rgba(255,255,255,.06)', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0' }}>
            {[
              { label: 'Capital prestado',  value: fmt(kpis.capital_total_prestado),  color: '#a5b4fc' },
              { label: 'Saldo pendiente',   value: fmt(kpis.saldo_total_pendiente),   color: '#34d399' },
              { label: 'Monto en mora',     value: fmt(kpis.monto_en_mora),           color: kpis.monto_en_mora > 0 ? '#f87171' : '#4ade80' },
              { label: 'Préstamos activos', value: String(kpis.prestamos_activos),    color: '#e8eaf0' },
            ].map((m, i) => (
              <div key={i} style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,.05)' : 'none', paddingLeft: i > 0 ? '20px' : 0 }}>
                <p style={{ fontSize: '9.5px', color: '#374151', margin: '0 0 3px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{m.label}</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: m.color, margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {!kpis && !loading && (
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', padding: '40px 0' }}>Sin datos disponibles</p>
      )}
    </div>
  )
}
