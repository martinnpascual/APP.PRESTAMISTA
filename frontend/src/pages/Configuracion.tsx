import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { apiGet, apiPatch } from '../services/api'

interface Config {
  id: string
  nombre_negocio: string
  moneda: string
  tasa_mora_diaria: number
  dias_gracia: number
  telegram_chat_id: string | null
  updated_at: string
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 600, margin: '0 auto' },
  h1: { fontSize: 22, fontWeight: 700, color: '#e4e6eb', margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 28px' },
  card: { background: '#1c1e27', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#9ca3af', marginBottom: 6 },
  input: { width: '100%', background: '#111318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#e4e6eb', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' },
  hint: { fontSize: 12, color: '#4b5563', marginTop: 4 },
  row: { display: 'flex', gap: 16 },
  btnPrimary: { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  alert: { borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  alertOk: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' },
  alertErr: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' },
  updatedAt: { fontSize: 12, color: '#4b5563', marginTop: 8 },
}

export default function Configuracion() {
  const { session } = useAuthStore()
  const isAdmin = session?.user?.app_metadata?.rol === 'admin' || session?.user?.user_metadata?.rol === 'admin'

  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [form, setForm] = useState({
    nombre_negocio: '',
    moneda: 'ARS',
    tasa_mora_diaria: '',
    dias_gracia: '',
    telegram_chat_id: '',
  })

  useEffect(() => {
    apiGet<Config>('/config').then(d => {
      if (d) {
        setConfig(d)
        setForm({
          nombre_negocio: d.nombre_negocio,
          moneda: d.moneda,
          tasa_mora_diaria: String(d.tasa_mora_diaria),
          dias_gracia: String(d.dias_gracia),
          telegram_chat_id: d.telegram_chat_id ?? '',
        })
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!isAdmin) return
    setSaving(true)
    setMsg(null)
    try {
      const payload: Record<string, unknown> = {
        nombre_negocio: form.nombre_negocio.trim() || undefined,
        moneda: form.moneda.trim() || undefined,
        tasa_mora_diaria: form.tasa_mora_diaria ? parseFloat(form.tasa_mora_diaria) : undefined,
        dias_gracia: form.dias_gracia ? parseInt(form.dias_gracia) : undefined,
        telegram_chat_id: form.telegram_chat_id.trim() || null,
      }
      // remove undefined
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      const updated = await apiPatch<Config>('/config', payload)
      if (updated) {
        setConfig(updated)
        setMsg({ type: 'ok', text: 'Configuración guardada correctamente' })
      } else {
        setMsg({ type: 'err', text: 'Error al guardar' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Error de red' })
    }
    setSaving(false)
  }

  if (loading) return <div className="page-container" style={S.page}><p style={{ color: '#6b7280' }}>Cargando...</p></div>

  return (
    <div className="page-container" style={S.page}>
      <h1 style={S.h1}>Configuración</h1>
      <p style={S.sub}>Parámetros globales del negocio</p>

      {msg && (
        <div style={{ ...S.alert, ...(msg.type === 'ok' ? S.alertOk : S.alertErr) }}>
          {msg.text}
        </div>
      )}

      {/* Negocio */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Negocio</div>
        <div style={S.field}>
          <label style={S.label}>Nombre del negocio</label>
          <input
            style={S.input}
            value={form.nombre_negocio}
            onChange={e => setForm(f => ({ ...f, nombre_negocio: e.target.value }))}
            disabled={!isAdmin}
            placeholder="prestamos.app"
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>Moneda</label>
          <input
            style={S.input}
            value={form.moneda}
            onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
            disabled={!isAdmin}
            placeholder="ARS"
          />
          <span style={S.hint}>Código ISO: ARS, USD, etc.</span>
        </div>
      </div>

      {/* Mora */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Mora</div>
        <div style={{ ...S.row }}>
          <div style={{ ...S.field, flex: 1 }}>
            <label style={S.label}>Tasa mora diaria (%)</label>
            <input
              style={S.input}
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.tasa_mora_diaria}
              onChange={e => setForm(f => ({ ...f, tasa_mora_diaria: e.target.value }))}
              disabled={!isAdmin}
            />
            <span style={S.hint}>Ej: 0.10 = 0.10% por día</span>
          </div>
          <div style={{ ...S.field, flex: 1 }}>
            <label style={S.label}>Días de gracia</label>
            <input
              style={S.input}
              type="number"
              min="0"
              max="30"
              value={form.dias_gracia}
              onChange={e => setForm(f => ({ ...f, dias_gracia: e.target.value }))}
              disabled={!isAdmin}
            />
            <span style={S.hint}>Días antes de aplicar mora</span>
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Telegram</div>
        <div style={S.field}>
          <label style={S.label}>Chat ID del prestamista</label>
          <input
            style={S.input}
            value={form.telegram_chat_id}
            onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
            disabled={!isAdmin}
            placeholder="123456789"
          />
          <span style={S.hint}>Obtener con @userinfobot en Telegram. Usado para notificaciones automáticas.</span>
        </div>
      </div>

      {/* Config actual */}
      {config && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Estado actual</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {[
              ['Nombre', config.nombre_negocio],
              ['Moneda', config.moneda],
              ['Tasa mora', `${config.tasa_mora_diaria}% / día`],
              ['Días de gracia', `${config.dias_gracia} días`],
              ['Chat ID Telegram', config.telegram_chat_id ?? '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 14, color: '#e4e6eb', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          <p style={S.updatedAt}>Última actualización: {new Date(config.updated_at).toLocaleString('es-AR')}</p>
        </div>
      )}

      {isAdmin && (
        <button
          style={{ ...S.btnPrimary, ...(saving ? S.btnDisabled : {}) }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      )}
      {!isAdmin && (
        <p style={{ fontSize: 13, color: '#4b5563' }}>Solo los administradores pueden modificar la configuración.</p>
      )}
    </div>
  )
}
