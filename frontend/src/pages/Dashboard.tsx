import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet } from '../services/api'
import type { KPIs } from '../types'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  try {
    const d = new Date(s + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  } catch { return s }
}
function today() {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Mini icons ──────────────────────────────────────────────────────────────
const IcoTrendUp = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IcoAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IcoSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IcoArrowRight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)
const IcoCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

// ── Quick action button ─────────────────────────────────────────────────────
function QuickBtn({ to, label, icon, primary }: { to: string; label: string; icon: string; primary?: boolean }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '11px 16px', borderRadius: '10px', textDecoration: 'none',
      fontSize: '13px', fontWeight: 600, transition: 'all .15s',
      background: primary ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,.05)',
      color: primary ? 'white' : '#9ca3af',
      border: primary ? 'none' : '1px solid rgba(255,255,255,.08)',
      boxShadow: primary ? '0 2px 12px rgba(99,102,241,.3)' : 'none',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLAnchorElement
      el.style.transform = 'translateY(-1px)'
      el.style.background = primary ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(255,255,255,.09)'
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLAnchorElement
      el.style.transform = 'translateY(0)'
      el.style.background = primary ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,.05)'
    }}>
      <span style={{ fontSize: '15px' }}>{icon}</span>
      {label}
    </Link>
  )
}

// ── Interfaces ──────────────────────────────────────────────────────────────
interface CuotaVencer {
  id: string; numero: number; fecha_vencimiento: string
  monto: number; monto_pagado: number; prestamo_id: string
  prestamos: { cliente_id: string; clientes: { nombre: string; zona?: string } }
}

// ── Component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [kpis,      setKpis]      = useState<KPIs | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [porVencer, setPorVencer] = useState<CuotaVencer[]>([])
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    Promise.all([
      apiGet<KPIs>('/reportes/kpis').then(setKpis).catch(e => setError(e.message)),
      apiGet<CuotaVencer[]>('/prestamos/por-vencer?dias=7').then(setPorVencer).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) navigate(`/clientes?q=${encodeURIComponent(search.trim())}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page:        { maxWidth: 860, margin: '0 auto', padding: '28px 24px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" },
    sectionLabel:{ fontSize: '10.5px', fontWeight: 700, color: '#4b5563', letterSpacing: '0.09em', textTransform: 'uppercase' as const, marginBottom: '16px' },
    divider:     { height: '1px', background: 'rgba(255,255,255,.06)', margin: '28px 0' },
    card:        { background: '#1c1f2e', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '20px 22px', transition: 'border-color .2s' },
    cardHover:   { borderColor: 'rgba(255,255,255,.13)' },
  }

  return (
    <div style={S.page}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              VISIÓN GENERAL
            </p>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
              Dashboard Principal
            </h1>
            <p style={{ fontSize: '12.5px', color: '#4b5563', marginTop: '5px', fontWeight: 400, textTransform: 'capitalize' }}>
              {today()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Búsqueda global ── */}
      <form onSubmit={handleSearch} style={{ marginBottom: '28px', display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', display: 'flex' }}>
            <IcoSearch />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente por nombre o DNI..."
            style={{ width: '100%', background: '#1c1f2e', border: '1px solid rgba(255,255,255,.09)', borderRadius: '10px', padding: '10px 14px 10px 38px', color: '#e8eaf0', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <button type="submit" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(99,102,241,.3)' }}>
          Buscar
        </button>
      </form>

      {error && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.18)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
          <div style={{ width: '30px', height: '30px', border: '3px solid rgba(255,255,255,.07)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        </div>
      ) : kpis ? (
        <>
          {/* ── KPIs ── */}
          <p style={S.sectionLabel}>Métricas del negocio</p>

          {/* Hero card: Capital prestado */}
          <Link to="/prestamos" style={{ textDecoration: 'none', display: 'block', marginBottom: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e2035 0%, #1a1d30 100%)', border: '1px solid rgba(99,102,241,.25)', borderRadius: '16px', padding: '22px 24px', position: 'relative', overflow: 'hidden', transition: 'border-color .2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,.45)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,.25)'}>
              {/* Glow fondo */}
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: 'radial-gradient(circle, rgba(99,102,241,.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                    Capital prestado
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>
                    {fmt(kpis.capital_total_prestado)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(99,102,241,.15)', color: '#a5b4fc', borderRadius: '99px', padding: '5px 10px', fontSize: '11.5px', fontWeight: 600, flexShrink: 0 }}>
                  <IcoTrendUp /> Cartera activa
                </div>
              </div>
              {/* Sub-métricas */}
              <div style={{ display: 'flex', gap: '24px', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#4b5563', margin: '0 0 3px', fontWeight: 500 }}>Saldo pendiente</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#34d399', margin: 0 }}>{fmt(kpis.saldo_total_pendiente)}</p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,.06)' }} />
                <div>
                  <p style={{ fontSize: '11px', color: '#4b5563', margin: '0 0 3px', fontWeight: 500 }}>Préstamos activos</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#e8eaf0', margin: 0 }}>{kpis.prestamos_activos}</p>
                </div>
              </div>
            </div>
          </Link>

          {/* Grid 2 cols: mora + mora monto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            {/* Clientes en mora */}
            <Link to="/cobros" style={{ textDecoration: 'none' }}>
              <div style={{ ...S.card, cursor: 'pointer', borderColor: kpis.clientes_en_mora > 0 ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.07)' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = kpis.clientes_en_mora > 0 ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.14)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = kpis.clientes_en_mora > 0 ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.07)'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>Clientes en mora</p>
                  {kpis.clientes_en_mora > 0 && (
                    <span style={{ color: '#f87171', display: 'flex' }}><IcoAlert /></span>
                  )}
                </div>
                <p style={{ fontSize: '30px', fontWeight: 800, color: kpis.clientes_en_mora > 0 ? '#f87171' : '#e8eaf0', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
                  {kpis.clientes_en_mora}
                </p>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                  {kpis.clientes_en_mora > 0 ? 'requieren atención' : 'todo al día ✓'}
                </p>
              </div>
            </Link>

            {/* Monto en mora */}
            {kpis.monto_en_mora > 0 ? (
              <Link to="/cobros" style={{ textDecoration: 'none' }}>
                <div style={{ ...S.card, cursor: 'pointer', borderColor: 'rgba(239,68,68,.2)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(239,68,68,.4)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(239,68,68,.2)'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>Monto en mora</p>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,.6)' }} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f87171', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
                    {fmt(kpis.monto_en_mora)}
                  </p>
                  <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>monto total atrasado</p>
                </div>
              </Link>
            ) : (
              <div style={{ ...S.card, borderColor: 'rgba(34,197,94,.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>Estado mora</p>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,.5)' }} />
                </div>
                <p style={{ fontSize: '24px', fontWeight: 800, color: '#4ade80', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>Sin mora</p>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>cartera sana ✓</p>
              </div>
            )}
          </div>

          <div style={S.divider} />

          {/* ── Cuotas por vencer ── */}
          {porVencer.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <IcoCalendar />
                  <p style={{ ...S.sectionLabel, margin: 0 }}>Vencen esta semana</p>
                  <span style={{ background: 'rgba(99,102,241,.15)', color: '#a5b4fc', fontSize: '11px', fontWeight: 700, borderRadius: '99px', padding: '2px 8px' }}>
                    {porVencer.length}
                  </span>
                </div>
                <Link to="/prestamos" style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Ver todos <IcoArrowRight />
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '28px' }}>
                {porVencer.slice(0, 5).map(c => (
                  <Link key={c.id} to={`/prestamos/${c.prestamo_id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1c1f2e', border: '1px solid rgba(255,255,255,.06)', borderRadius: '11px', padding: '11px 15px', transition: 'border-color .15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.12)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.06)'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.15))', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>
                          {(c.prestamos?.clientes?.nombre ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#e8eaf0', margin: 0 }}>
                            {c.prestamos?.clientes?.nombre ?? '—'}
                          </p>
                          <p style={{ fontSize: '11px', color: '#4b5563', margin: '2px 0 0' }}>
                            {c.prestamos?.clientes?.zona ?? ''} · Cuota #{c.numero}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#a5b4fc', margin: 0 }}>
                          {fmt(c.monto - c.monto_pagado)}
                        </p>
                        <p style={{ fontSize: '11px', color: '#4b5563', margin: '2px 0 0' }}>
                          {fmtDate(c.fecha_vencimiento)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {porVencer.length > 5 && (
                  <Link to="/prestamos" style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', padding: '8px', display: 'block' }}>
                    +{porVencer.length - 5} más →
                  </Link>
                )}
              </div>

              <div style={S.divider} />
            </>
          )}

          {/* ── Accesos rápidos ── */}
          <p style={S.sectionLabel}>Acciones rápidas</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <QuickBtn to="/cobros"          label="Cobros del día"   icon="📋" primary />
            <QuickBtn to="/prestamos/nuevo" label="Nuevo préstamo"   icon="💰" />
            <QuickBtn to="/clientes/nuevo"  label="Nuevo cliente"    icon="👤" />
            <QuickBtn to="/reportes"        label="Ver reportes"     icon="📊" />
          </div>
        </>
      ) : (
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', padding: '40px 0' }}>Sin datos disponibles</p>
      )}
    </div>
  )
}
