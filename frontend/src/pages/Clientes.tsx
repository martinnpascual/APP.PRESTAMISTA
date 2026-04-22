import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useClientesStore } from '../stores/clientesStore'
import Spinner from '../components/ui/Spinner'
import { useDebounce } from '../hooks/useDebounce'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const AVATAR_PALETTE = [
  { bg: 'rgba(99,102,241,.22)',  color: '#a5b4fc' },
  { bg: 'rgba(34,197,94,.18)',   color: '#4ade80' },
  { bg: 'rgba(251,191,36,.18)',  color: '#fbbf24' },
  { bg: 'rgba(239,68,68,.18)',   color: '#f87171' },
  { bg: 'rgba(168,85,247,.18)',  color: '#c084fc' },
]

// ── Inline SVGs ──────────────────────────────────────────────────────────────
const IcoSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IcoPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IcoChevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IcoWarn = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IcoUsers = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.15 }}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

export default function Clientes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { clientes, total, loading, error, fetchClientes, limpiarError } = useClientesStore()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [page, setPage] = useState(1)
  const debouncedQuery = useDebounce(query, 350)

  const load = useCallback(() => {
    fetchClientes({ q: debouncedQuery || undefined, page, per_page: 20 })
  }, [debouncedQuery, page, fetchClientes])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedQuery])

  const pages = Math.ceil(total / 20)

  const S = {
    wrap: {
      maxWidth: 900,
      margin: '0 auto',
    } as React.CSSProperties,
    header: {
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      marginBottom: '22px', gap: '12px', flexWrap: 'wrap' as const,
    },
    h1: {
      fontSize: '26px', fontWeight: 800, color: '#e8eaf0',
      letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1,
    },
    sub: {
      fontSize: '11.5px', color: '#4b5563', marginTop: '4px',
      fontWeight: 500,
    },
    newBtn: {
      display: 'flex', alignItems: 'center', gap: '6px',
      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      color: '#fff', border: 'none', borderRadius: '10px',
      padding: '9px 16px', fontSize: '13px', fontWeight: 700,
      cursor: 'pointer', textDecoration: 'none', flexShrink: 0,
      boxShadow: '0 2px 12px rgba(99,102,241,.35)',
    },
    searchWrap: {
      position: 'relative' as const, marginBottom: '20px',
    },
    searchIcon: {
      position: 'absolute' as const, left: '13px', top: '50%',
      transform: 'translateY(-50%)', color: '#4b5563',
      display: 'flex', pointerEvents: 'none' as const,
    },
    searchInput: {
      width: '100%', background: '#161925',
      border: '1px solid rgba(255,255,255,.09)', borderRadius: '11px',
      padding: '10px 14px 10px 42px', color: '#e8eaf0',
      fontSize: '13.5px', outline: 'none', boxSizing: 'border-box' as const,
      transition: 'border-color .15s', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    },
  }

  return (
    <div className="page-container" style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 5px' }}>CARTERA DE CLIENTES</p>
          <h1 style={S.h1}>Clientes</h1>
          <p style={S.sub}>{total} registros en total</p>
        </div>
        <Link to="/clientes/nuevo" style={S.newBtn}>
          <IcoPlus /> Nuevo cliente
        </Link>
      </div>

      {/* Search */}
      <div style={S.searchWrap}>
        <span style={S.searchIcon}><IcoSearch /></span>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre, DNI o teléfono..."
          style={S.searchInput}
          onFocus={e => (e.target.style.borderColor = '#6366f1')}
          onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,.09)')}
        />
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
      ) : clientes.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: '#4b5563' }}>
          <IcoUsers />
          <p style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280', margin: 0 }}>
            {query ? 'Sin resultados para esta búsqueda' : 'Sin clientes registrados'}
          </p>
          {!query && (
            <Link to="/clientes/nuevo" style={{ fontSize: '13px', fontWeight: 600, color: '#6366f1', textDecoration: 'none' }}>
              + Agregar el primero
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {clientes.map((c) => {
            const pal = AVATAR_PALETTE[c.nombre.charCodeAt(0) % AVATAR_PALETTE.length]
            const hasMora = (c.prestamos_en_mora ?? 0) > 0
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/clientes/${c.id}`)}
                style={{
                  width: '100%', background: '#161925',
                  border: `1px solid ${hasMora ? 'rgba(239,68,68,.22)' : 'rgba(255,255,255,.07)'}`,
                  borderRadius: '13px', padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  cursor: 'pointer', textAlign: 'left', transition: 'background .12s, border-color .15s',
                  fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#1c1f2e'; el.style.borderColor = hasMora ? 'rgba(239,68,68,.38)' : 'rgba(255,255,255,.12)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#161925'; el.style.borderColor = hasMora ? 'rgba(239,68,68,.22)' : 'rgba(255,255,255,.07)' }}
              >
                {/* Avatar */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: pal.bg, border: `1px solid ${pal.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 800, color: pal.color, flexShrink: 0,
                }}>
                  {c.nombre.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e8eaf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.nombre}
                    </span>
                    {hasMora && (
                      <span style={{ color: '#f87171', display: 'flex', flexShrink: 0 }}><IcoWarn /></span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: '#4b5563' }}>DNI {c.dni}</span>
                    {c.zona && <span style={{ fontSize: '11.5px', color: '#4b5563' }}>· {c.zona}</span>}
                    {(c.total_adeudado ?? 0) > 0 && (
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#9ca3af' }}>· {fmt(c.total_adeudado ?? 0)}</span>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                  {(c.prestamos_activos ?? 0) > 0 && (
                    <span style={{ background: 'rgba(34,197,94,.14)', color: '#4ade80', fontSize: '10px', fontWeight: 700, borderRadius: '6px', padding: '2px 8px' }}>
                      {c.prestamos_activos} activo{(c.prestamos_activos ?? 0) > 1 ? 's' : ''}
                    </span>
                  )}
                  {hasMora && (
                    <span style={{ background: 'rgba(239,68,68,.14)', color: '#f87171', fontSize: '10px', fontWeight: 700, borderRadius: '6px', padding: '2px 8px' }}>
                      {c.prestamos_en_mora} mora
                    </span>
                  )}
                  <span style={{ color: '#374151', display: 'flex' }}><IcoChevron /></span>
                </div>
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
