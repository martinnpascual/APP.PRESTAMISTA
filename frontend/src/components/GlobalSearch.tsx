import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../services/api'

interface SearchResult {
  type: 'cliente' | 'prestamo'
  id: string
  title: string
  subtitle: string
  badge?: string
  badgeColor?: string
  url: string
}

interface GlobalSearchProps {
  onClose: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const [clientesRes, prestamosRes] = await Promise.allSettled([
        apiGet<{ items: any[] }>(`/clientes?q=${encodeURIComponent(q)}&per_page=5`),
        apiGet<{ items: any[] }>(`/prestamos?per_page=5`),
      ])

      const items: SearchResult[] = []

      if (clientesRes.status === 'fulfilled' && clientesRes.value?.items) {
        for (const c of clientesRes.value.items) {
          items.push({
            type: 'cliente',
            id: c.id,
            title: c.nombre,
            subtitle: `DNI ${c.dni} · ${c.zona ?? ''}`,
            badge: c.prestamos_en_mora > 0 ? 'MORA' : c.prestamos_activos > 0 ? `${c.prestamos_activos} activo${c.prestamos_activos > 1 ? 's' : ''}` : undefined,
            badgeColor: c.prestamos_en_mora > 0 ? '#f87171' : '#4ade80',
            url: `/clientes/${c.id}`,
          })
        }
      }

      if (prestamosRes.status === 'fulfilled' && prestamosRes.value?.items) {
        for (const p of prestamosRes.value.items) {
          const nombre = p.cliente_nombre ?? p.clientes?.nombre ?? '—'
          if (!nombre.toLowerCase().includes(q.toLowerCase()) && !p.id.includes(q)) continue
          items.push({
            type: 'prestamo',
            id: p.id,
            title: `Préstamo — ${nombre}`,
            subtitle: `${fmt(p.monto)} · ${p.estado}`,
            badge: p.estado === 'en_mora' ? 'MORA' : p.estado === 'activo' ? 'ACTIVO' : p.estado.toUpperCase(),
            badgeColor: p.estado === 'en_mora' ? '#f87171' : p.estado === 'activo' ? '#4ade80' : '#9ca3af',
            url: `/prestamos/${p.id}`,
          })
        }
      }

      setResults(items.slice(0, 8))
      setSelected(0)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(q), 280)
  }

  const go = (url: string) => { navigate(url); onClose() }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) go(results[selected].url)
  }

  const typeIcon = (type: 'cliente' | 'prestamo') =>
    type === 'cliente'
      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 900 }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '12vh', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 580, zIndex: 901,
        background: '#181b2d', border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,.6)', overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder="Buscar clientes, préstamos, DNI..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#e8eaf0', fontSize: 15, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
            }}
          />
          {loading && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/>
              <path d="M21 12a9 9 0 00-9-9"/>
            </svg>
          )}
          <kbd style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 5, padding: '2px 6px', fontSize: 11, color: '#6b7280', flexShrink: 0 }}>ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 8px' }}>
            {results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => go(r.url)}
                onMouseEnter={() => setSelected(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: selected === i ? 'rgba(99,102,241,.15)' : 'transparent',
                  transition: 'background .1s', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                }}
              >
                <span style={{ color: selected === i ? '#a5b4fc' : '#6b7280', display: 'flex', flexShrink: 0 }}>
                  {typeIcon(r.type)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.subtitle}
                  </p>
                </div>
                {r.badge && (
                  <span style={{ background: `${r.badgeColor}22`, color: r.badgeColor, fontSize: 9.5, fontWeight: 700, borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>
                    {r.badge}
                  </span>
                )}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', padding: '20px 0' }}>
            Sin resultados para "{query}"
          </p>
        )}

        {!query.trim() && (
          <div style={{ padding: '12px 18px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '↑↓ Navegar', desc: '' },
              { label: '↵ Abrir', desc: '' },
              { label: 'ESC Cerrar', desc: '' },
            ].map(h => (
              <span key={h.label} style={{ fontSize: 11, color: '#4b5563', background: 'rgba(255,255,255,.04)', borderRadius: 6, padding: '3px 8px' }}>
                {h.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
