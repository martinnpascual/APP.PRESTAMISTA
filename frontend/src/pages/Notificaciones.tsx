import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '../services/api'
import { useAuthStore } from '../stores/authStore'

interface Notif {
  id: string
  tipo: string
  canal: string
  mensaje: string
  cuerpo?: string
  enviado: boolean
  created_at: string
}

const TIPO_ICON: Record<string, string> = {
  mora: '🔴',
  pago: '✅',
  cierre_dia: '📊',
  alerta_vencimiento: '📅',
  pago_cliente: '💳',
  vencimiento_cliente: '⚠️',
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 700, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  h1: { fontSize: 22, fontWeight: 700, color: '#e4e6eb', margin: 0 },
  btnSm: { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 8, marginBottom: 20 },
  tab: { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#6b7280', cursor: 'pointer' },
  tabActive: { background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.3)', color: '#a5b4fc' },
  empty: { textAlign: 'center' as const, color: '#4b5563', padding: '48px 0', fontSize: 14 },
  item: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', background: '#1c1e27', borderRadius: 10, marginBottom: 8, border: '1px solid rgba(255,255,255,0.05)' },
  itemUnread: { borderColor: 'rgba(99,102,241,0.2)', background: '#1e2030' },
  icon: { fontSize: 20, flexShrink: 0, marginTop: 2 },
  content: { flex: 1, minWidth: 0 },
  tipo: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 },
  msg: { fontSize: 14, color: '#d1d5db', marginBottom: 4, wordBreak: 'break-word' as const },
  meta: { fontSize: 12, color: '#4b5563', display: 'flex', gap: 10 },
  badge: { display: 'inline-block', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 },
  badgePending: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  badgeSent: { background: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  actions: { display: 'flex', gap: 6, flexShrink: 0 },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '4px 6px', borderRadius: 5, fontSize: 13, transition: 'color .15s' },
}

export default function Notificaciones() {
  const { session } = useAuthStore()
  const isAdmin = session?.user?.app_metadata?.rol === 'admin' || session?.user?.user_metadata?.rol === 'admin'

  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'todas' | 'pendientes'>('todas')

  const load = () => {
    setLoading(true)
    const url = tab === 'pendientes'
      ? '/notificaciones?solo_pendientes=true&per_page=50'
      : '/notificaciones?per_page=50'
    apiGet<Notif[]>(url).then(d => {
      setItems(d || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [tab])

  const markRead = async (id: string) => {
    await apiPost(`/notificaciones/${id}/leer`, {})
    setItems(prev => prev.map(n => n.id === id ? { ...n, enviado: true } : n))
  }

  const markAllRead = async () => {
    await apiPost('/notificaciones/leer-todas', {})
    setItems(prev => prev.map(n => ({ ...n, enviado: true })))
  }

  const remove = async (id: string) => {
    await apiDelete(`/notificaciones/${id}`)
    setItems(prev => prev.filter(n => n.id !== id))
  }

  const unread = items.filter(n => !n.enviado).length

  return (
    <div className="page-container" style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>🔔 Notificaciones {unread > 0 && <span style={{ fontSize: 14, color: '#6b7280' }}>({unread} sin leer)</span>}</h1>
        </div>
        {unread > 0 && (
          <button style={S.btnSm} onClick={markAllRead}>Marcar todas leídas</button>
        )}
      </div>

      <div style={S.tabs}>
        {(['todas', 'pendientes'] as const).map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'todas' ? 'Todas' : 'Sin leer'}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>}

      {!loading && items.length === 0 && (
        <div style={S.empty}>
          {tab === 'pendientes' ? '✅ No hay notificaciones pendientes' : '📭 No hay notificaciones'}
        </div>
      )}

      {!loading && items.map(n => (
        <div key={n.id} style={{ ...S.item, ...(!n.enviado ? S.itemUnread : {}) }}>
          <span style={S.icon}>{TIPO_ICON[n.tipo] ?? '🔔'}</span>
          <div style={S.content}>
            <div style={S.tipo}>{n.tipo.replace(/_/g, ' ')} · {n.canal}</div>
            <div style={S.msg}>{n.mensaje}</div>
            {n.cuerpo && n.cuerpo !== n.mensaje && (
              <div style={{ ...S.msg, fontSize: 13, color: '#6b7280' }}>{n.cuerpo}</div>
            )}
            <div style={S.meta}>
              <span style={{ ...S.badge, ...(n.enviado ? S.badgeSent : S.badgePending) }}>
                {n.enviado ? 'Enviado' : 'Pendiente'}
              </span>
              <span>{new Date(n.created_at).toLocaleString('es-AR')}</span>
            </div>
          </div>
          <div style={S.actions}>
            {!n.enviado && (
              <button style={S.btnIcon} title="Marcar como leída" onClick={() => markRead(n.id)}>✓</button>
            )}
            {isAdmin && (
              <button style={{ ...S.btnIcon, color: '#ef4444' }} title="Eliminar" onClick={() => remove(n.id)}>✕</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
