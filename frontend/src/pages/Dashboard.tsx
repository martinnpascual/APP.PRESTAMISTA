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

function KpiCard({ label, value, sub, accent, to }: { label: string; value: string; sub?: string; accent: string; to?: string }) {
  const inner = (
    <div style={{background:'#1c1e27',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'18px 20px',transition:'border-color .2s',cursor:to?'pointer':'default'}}
      onMouseEnter={e=>{if(to)(e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.14)'}}
      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.07)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <span style={{fontSize:'12px',fontWeight:500,color:'#6b7280',letterSpacing:'0.02em'}}>{label}</span>
        <div style={{width:'7px',height:'7px',borderRadius:'50%',background:accent}}/>
      </div>
      <div style={{fontSize:'22px',fontWeight:800,color:'#e4e6eb',letterSpacing:'-0.02em',lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:'11px',color:'#6b7280',marginTop:'6px'}}>{sub}</div>}
    </div>
  )
  return to ? <Link to={to} style={{textDecoration:'none'}}>{inner}</Link> : <>{inner}</>
}

function QuickBtn({ to, label, primary }: { to: string; label: string; primary?: boolean }) {
  return (
    <Link to={to} style={{
      display:'flex',alignItems:'center',justifyContent:'center',
      padding:'11px 16px',borderRadius:'10px',textDecoration:'none',
      fontSize:'13px',fontWeight:600,transition:'background .15s',
      background: primary ? '#6366f1' : 'rgba(255,255,255,0.05)',
      color: primary ? 'white' : '#9ca3af',
      border: primary ? 'none' : '1px solid rgba(255,255,255,0.08)',
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background=primary?'#4f46e5':'rgba(255,255,255,0.09)'}}
    onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background=primary?'#6366f1':'rgba(255,255,255,0.05)'}}>
      {label}
    </Link>
  )
}

interface CuotaVencer {
  id: string
  numero: number
  fecha_vencimiento: string
  monto: number
  monto_pagado: number
  prestamo_id: string
  prestamos: {
    cliente_id: string
    clientes: { nombre: string; zona?: string; telefono?: string }
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [kpis,    setKpis]    = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [porVencer, setPorVencer] = useState<CuotaVencer[]>([])
  const [search, setSearch] = useState('')

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

  return (
    <div style={{maxWidth:'720px',margin:'0 auto',padding:'28px 20px',fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>

      {/* Header */}
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:800,color:'#e4e6eb',letterSpacing:'-0.02em',margin:0}}>Panel principal</h1>
        <p style={{fontSize:'13px',color:'#6b7280',marginTop:'4px',fontWeight:400}}>Resumen del negocio en tiempo real</p>
      </div>

      {/* Búsqueda global */}
      <form onSubmit={handleSearch} style={{marginBottom:'20px',display:'flex',gap:'8px'}}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente por nombre o DNI..."
          style={{flex:1,background:'#1c1e27',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'9px',padding:'9px 14px',color:'#e4e6eb',fontSize:'13px',outline:'none'}}
        />
        <button type="submit" style={{background:'#6366f1',color:'white',border:'none',borderRadius:'9px',padding:'9px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
          Buscar
        </button>
      </form>

      {error && (
        <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:'10px',padding:'12px 14px',marginBottom:'20px',fontSize:'13px',color:'#fca5a5'}}>{error}</div>
      )}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'48px 0'}}>
          <div style={{width:'28px',height:'28px',border:'3px solid rgba(255,255,255,0.08)',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : kpis ? (
        <>
          {/* KPI grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <KpiCard label="Capital prestado"   value={fmt(kpis.capital_total_prestado)}    accent="#6366f1" to="/prestamos"/>
            <KpiCard label="Saldo pendiente"    value={fmt(kpis.saldo_total_pendiente)}     accent="#34d399"/>
            <KpiCard label="Préstamos activos"  value={String(kpis.prestamos_activos)}      accent="#3b82f6" to="/prestamos" sub="préstamos vigentes"/>
            <KpiCard label="Clientes en mora"   value={String(kpis.clientes_en_mora)}       accent="#f87171" to="/cobros"   sub={kpis.clientes_en_mora>0?'requieren atención':'todo al día'}/>
          </div>
          {kpis.monto_en_mora > 0 && (
            <KpiCard label="Monto total en mora" value={fmt(kpis.monto_en_mora)} accent="#ef4444" to="/cobros"/>
          )}

          <div style={{height:'1px',background:'rgba(255,255,255,0.06)',margin:'24px 0'}}/>

          {/* Cuotas por vencer esta semana */}
          {porVencer.length > 0 && (
            <>
              <div style={{marginBottom:'16px'}}>
                <p style={{fontSize:'12px',fontWeight:600,color:'#6b7280',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'12px'}}>
                  📅 Vencen esta semana ({porVencer.length})
                </p>
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  {porVencer.slice(0, 5).map(c => (
                    <Link key={c.id} to={`/prestamos/${c.prestamo_id}`}
                      style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#1c1e27',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'10px',padding:'10px 14px',textDecoration:'none'}}>
                      <div>
                        <div style={{fontSize:'13px',fontWeight:600,color:'#e4e6eb'}}>{c.prestamos?.clientes?.nombre ?? '—'}</div>
                        <div style={{fontSize:'11px',color:'#6b7280'}}>{c.prestamos?.clientes?.zona ?? ''} · Cuota #{c.numero}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'13px',fontWeight:700,color:'#a5b4fc'}}>{fmt(c.monto - c.monto_pagado)}</div>
                        <div style={{fontSize:'11px',color:'#6b7280'}}>{fmtDate(c.fecha_vencimiento)}</div>
                      </div>
                    </Link>
                  ))}
                  {porVencer.length > 5 && (
                    <Link to="/prestamos" style={{fontSize:'12px',color:'#6b7280',textAlign:'center',padding:'8px',textDecoration:'none'}}>
                      +{porVencer.length - 5} más →
                    </Link>
                  )}
                </div>
              </div>
              <div style={{height:'1px',background:'rgba(255,255,255,0.06)',marginBottom:'24px'}}/>
            </>
          )}

          {/* Quick access */}
          <div style={{marginBottom:'16px'}}>
            <p style={{fontSize:'12px',fontWeight:600,color:'#6b7280',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'12px'}}>Accesos rápidos</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <QuickBtn to="/cobros"          label="Cobros del día"  primary/>
              <QuickBtn to="/prestamos/nuevo" label="Nuevo préstamo"/>
              <QuickBtn to="/clientes/nuevo"  label="Nuevo cliente"/>
              <QuickBtn to="/reportes"        label="Reportes"/>
            </div>
          </div>
        </>
      ) : (
        <p style={{textAlign:'center',fontSize:'13px',color:'#6b7280',padding:'40px 0'}}>Sin datos disponibles</p>
      )}
    </div>
  )
}
