import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePrestamosStore } from '../stores/prestamosStore'
import Spinner from '../components/ui/Spinner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADOS = [
  { value: '',                    label: 'Todos'      },
  { value: 'activo',              label: 'Activos'    },
  { value: 'en_mora',             label: 'En mora'    },
  { value: 'pendiente_aprobacion',label: 'Pendientes' },
  { value: 'cerrado',             label: 'Cerrados'   },
  { value: 'cancelado',           label: 'Cancelados' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  try { return format(new Date(s), 'dd/MM/yyyy', { locale: es }) } catch { return s }
}

function estadoBadge(e: string) {
  if (e === 'activo')               return { bg: 'rgba(34,197,94,.14)',   color: '#4ade80', dot: '#22c55e', label: 'ACTIVO'     }
  if (e === 'en_mora')              return { bg: 'rgba(239,68,68,.14)',   color: '#f87171', dot: '#ef4444', label: 'EN MORA'    }
  if (e === 'pendiente_aprobacion') return { bg: 'rgba(234,179,8,.14)',   color: '#fbbf24', dot: '#eab308', label: 'PENDIENTE'  }
  if (e === 'cerrado')              return { bg: 'rgba(107,114,128,.14)', color: '#9ca3af', dot: '#6b7280', label: 'CERRADO'    }
  if (e === 'cancelado')            return { bg: 'rgba(107,114,128,.14)', color: '#9ca3af', dot: '#6b7280', label: 'CANCELADO'  }
  return                                   { bg: 'rgba(107,114,128,.14)', color: '#9ca3af', dot: '#6b7280', label: e.toUpperCase() }
}

// ── SVGs ──────────────────────────────────────────────────────────────────────
const IcoPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IcoFilter = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
)
const IcoChevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IcoCash = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.15 }}>
    <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/>
    <path d="M6 12h.01M18 12h.01"/>
  </svg>
)

export default function PrestamosList() {
  const navigate  = useNavigate()
  const { prestamos, total, loading, error, fetchPrestamos, limpiarError } = usePrestamosStore()
  const [estado, setEstado] = useState('')
  const [page,   setPage]   = useState(1)

  useEffect(() => {
    fetchPrestamos({ estado: estado || undefined, page, per_page: 20 })
  }, [estado, page, fetchPrestamos])

  useEffect(() => setPage(1), [estado])

  const pages = Math.ceil(total / 20)

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '22px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 5px' }}>
            CARTERA DE PRÉSTAMOS
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
            Préstamos
          </h1>
          <p style={{ fontSize: '11.5px', color: '#4b5563', marginTop: '4px', fontWeight: 500 }}>
            {total} registros en total
          </p>
        </div>
        <Link
          to="/prestamos/nuevo"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: '#fff', borderRadius: '10px', padding: '9px 16px',
            fontSize: '13px', fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(99,102,241,.35)', flexShrink: 0,
          }}
        >
          <IcoPlus /> Nuevo
        </Link>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px' }}>
        <span style={{ color: '#374151', display: 'flex', flexShrink: 0 }}><IcoFilter /></span>
        {ESTADOS.map(({ value, label }) => {
          const active = estado === value
          return (
            <button
              key={value}
              onClick={() => setEstado(value)}
              style={{
                flexShrink: 0, borderRadius: '99px', padding: '5px 13px',
                fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                border: active ? 'none' : '1px solid rgba(255,255,255,.1)',
                background: active ? '#6366f1' : 'transparent',
                color: active ? '#fff' : '#6b7280',
                fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</span>
          <button onClick={limpiarError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(252,165,165,.6)', display: 'flex', padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : prestamos.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: '#4b5563' }}>
          <IcoCash />
          <p style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280', margin: 0 }}>
            Sin préstamos{estado ? ` con estado "${ESTADOS.find(e => e.value === estado)?.label ?? estado}"` : ''}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {prestamos.map((p) => {
            const badge = estadoBadge(p.estado)
            const pct   = p.monto > 0 ? Math.max(0, Math.min(100, ((p.monto - p.saldo_pendiente) / p.monto) * 100)) : 0
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/prestamos/${p.id}`)}
                style={{
                  width: '100%', background: '#161925',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderLeft: `3px solid ${badge.dot}`,
                  borderRadius: '13px', padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background .12s, box-shadow .15s',
                  fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#1c1f2e'; el.style.boxShadow = '0 2px 14px rgba(0,0,0,.35)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#161925'; el.style.boxShadow = 'none' }}
              >
                {/* Dot indicator */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: badge.dot, flexShrink: 0,
                  boxShadow: `0 0 6px ${badge.dot}88`,
                }} />

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                    <div>
                      <p style={{ fontSize: '17px', fontWeight: 800, color: '#e8eaf0', margin: '0 0 3px', letterSpacing: '-0.02em' }}>
                        {fmt(p.monto)}
                      </p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.clientes?.nombre ?? '—'}
                        <span style={{ color: '#374151' }}> · {p.n_cuotas}×{p.periodicidad}</span>
                      </p>
                      <p style={{ fontSize: '11px', color: '#374151', margin: '2px 0 0' }}>
                        {p.tasa}% {p.tipo_tasa} · inicio {fmtDate(p.fecha_inicio)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                      <span style={{ background: badge.bg, color: badge.color, fontSize: '10px', fontWeight: 700, borderRadius: '6px', padding: '2px 8px' }}>
                        {badge.label}
                      </span>
                      {p.saldo_pendiente > 0 && (
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#9ca3af' }}>
                          Saldo: {fmt(p.saldo_pendiente)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: '3px', background: 'rgba(255,255,255,.07)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: '99px',
                      background: p.estado === 'en_mora' ? '#ef4444' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                      transition: 'width .4s',
                    }} />
                  </div>
                </div>

                <span style={{ color: '#374151', display: 'flex', flexShrink: 0 }}><IcoChevron /></span>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '8px', padding: '6px 14px', fontSize: '12.5px', fontWeight: 600, color: '#9ca3af', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontFamily: 'inherit' }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '12.5px', color: '#6b7280', padding: '0 4px' }}>{page} / {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '8px', padding: '6px 14px', fontSize: '12.5px', fontWeight: 600, color: '#9ca3af', cursor: page === pages ? 'not-allowed' : 'pointer', opacity: page === pages ? 0.4 : 1, fontFamily: 'inherit' }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
