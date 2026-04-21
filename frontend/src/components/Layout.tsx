import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { apiGet } from '../services/api'

// ── SVG icons inline (no deps) ─────────────────────────────────────────────
const IcoHome = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IcoUsers = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
)
const IcoBanknotes = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
  </svg>
)
const IcoClipboard = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
  </svg>
)
const IcoChart = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const IcoCog = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14M12 2v2M12 20v2M2 12h2M20 12h2"/>
  </svg>
)
const IcoBell = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
)
const IcoLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
)

const NAV = [
  { to: '/',          label: 'Inicio',        Icon: IcoHome      },
  { to: '/clientes',  label: 'Clientes',      Icon: IcoUsers     },
  { to: '/prestamos', label: 'Préstamos',     Icon: IcoBanknotes },
  { to: '/cobros',    label: 'Cobros',        Icon: IcoClipboard },
  { to: '/reportes',  label: 'Reportes',      Icon: IcoChart     },
  { to: '/usuarios',  label: 'Usuarios',      Icon: IcoCog, adminOnly: true },
]

export default function Layout() {
  const { user, signOut, session } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = session?.user?.app_metadata?.rol === 'admin' || session?.user?.user_metadata?.rol === 'admin'
  const name = user?.email?.split('@')[0] ?? 'Usuario'
  const initial = name[0]?.toUpperCase() ?? 'U'
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    apiGet<{ total: number }>('/notificaciones/conteo').then(d => {
      if (d && typeof d.total === 'number') setUnread(d.total)
    }).catch(() => {})
    const interval = setInterval(() => {
      apiGet<{ total: number }>('/notificaciones/conteo').then(d => {
        if (d && typeof d.total === 'number') setUnread(d.total)
      }).catch(() => {})
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const items = NAV.filter(n => !n.adminOnly || isAdmin)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin:0; background:#0f1117; font-family:'Plus Jakarta Sans',system-ui,sans-serif; }

        /* ════════════════════════════════════════════
           DARK THEME OVERRIDES — convierte las clases
           Tailwind light-mode al dark theme unificado
           ════════════════════════════════════════════ */
        /* Backgrounds */
        .bg-white               { background:#1c1f2e !important }
        .bg-gray-50             { background:#161925 !important }
        .bg-gray-100            { background:rgba(255,255,255,.07) !important }
        .bg-gray-200            { background:rgba(255,255,255,.12) !important }
        /* Ring / border */
        .ring-gray-100          { --tw-ring-color:rgba(255,255,255,.07) !important }
        .ring-gray-200          { --tw-ring-color:rgba(255,255,255,.10) !important }
        .border-gray-100        { border-color:rgba(255,255,255,.07) !important }
        .border-gray-200        { border-color:rgba(255,255,255,.10) !important }
        /* Text */
        .text-gray-900          { color:#e8eaf0 !important }
        .text-gray-800          { color:#d1d5db !important }
        .text-gray-700          { color:#9ca3af !important }
        .text-gray-600          { color:#6b7280 !important }
        .text-gray-400          { color:#6b7280 !important }
        /* Badge variants — dark soft */
        .bg-green-100           { background:rgba(34,197,94,.14) !important }
        .text-green-800         { color:#4ade80 !important }
        .bg-red-100             { background:rgba(239,68,68,.14) !important }
        .text-red-800           { color:#f87171 !important }
        .bg-yellow-100          { background:rgba(234,179,8,.14) !important }
        .text-yellow-800        { color:#fbbf24 !important }
        .bg-orange-100          { background:rgba(249,115,22,.14) !important }
        .text-orange-800        { color:#fb923c !important }
        .bg-blue-100            { background:rgba(99,102,241,.14) !important }
        .text-blue-700          { color:#a5b4fc !important }
        .bg-purple-100          { background:rgba(168,85,247,.14) !important }
        .text-purple-800        { color:#c084fc !important }
        /* Alert / status backgrounds */
        .bg-green-50            { background:rgba(34,197,94,.08) !important }
        .ring-green-200         { --tw-ring-color:rgba(34,197,94,.22) !important }
        .bg-red-50              { background:rgba(239,68,68,.08) !important }
        .ring-red-200           { --tw-ring-color:rgba(239,68,68,.22) !important }
        .ring-orange-200        { --tw-ring-color:rgba(249,115,22,.22) !important }
        .bg-blue-50             { background:rgba(99,102,241,.08) !important }
        /* Semantic text */
        .text-green-600,.text-green-800 { color:#4ade80 !important }
        .text-red-600,.text-red-700,.text-red-800 { color:#f87171 !important }
        .text-blue-600          { color:#818cf8 !important }
        .text-blue-500          { color:#a5b4fc !important }
        /* Buttons — map blue→indigo */
        .bg-blue-600            { background:#6366f1 !important }
        .bg-blue-500            { background:#6366f1 !important }
        .hover\\:bg-blue-700:hover { background:#4f46e5 !important }
        .bg-green-600           { background:#16a34a !important }
        .hover\\:bg-green-700:hover { background:#15803d !important }
        /* Hover states */
        .hover\\:bg-gray-50:hover,.hover\\:bg-gray-100:hover { background:rgba(255,255,255,.06) !important }
        .hover\\:bg-gray-200:hover { background:rgba(255,255,255,.10) !important }
        .hover\\:bg-green-200:hover { background:rgba(34,197,94,.18) !important }
        .hover\\:shadow-md:hover { box-shadow:0 4px 16px rgba(0,0,0,.4) !important }
        /* Form inputs — global dark */
        input,select,textarea   { background:#161925 !important; border-color:rgba(255,255,255,.1) !important; color:#e8eaf0 !important }
        input::placeholder,textarea::placeholder { color:#6b7280 !important }
        input:focus,select:focus,textarea:focus { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,.18) !important; outline:none !important }
        /* Pagination / misc */
        .hover\\:bg-gray-100:hover { background:rgba(255,255,255,.06) !important }
        /* Progress bar container */
        .bg-gray-100.h-2,.bg-gray-100.overflow-hidden { background:rgba(255,255,255,.08) !important }
        /* Tabs container */
        .bg-gray-100.rounded-xl { background:rgba(255,255,255,.06) !important }
        /* Alert border colors */
        .border-red-200    { border-color:rgba(239,68,68,.25) !important }
        .border-green-200  { border-color:rgba(34,197,94,.25) !important }
        .border-yellow-200 { border-color:rgba(234,179,8,.25) !important }
        .border-blue-200   { border-color:rgba(99,102,241,.25) !important }
        .border-orange-200 { border-color:rgba(249,115,22,.25) !important }
        /* text-blue-800 in alerts */
        .text-blue-800     { color:#a5b4fc !important }
        .text-yellow-700,.text-yellow-800 { color:#fbbf24 !important }
        /* Focus ring */
        .focus\\:border-blue-500:focus { border-color:#6366f1 !important }
        /* SVG display + size fix — prevents Heroicons from expanding to full width */
        svg { display:inline-block; flex-shrink:0; overflow:hidden; vertical-align:middle; }
        svg.h-3,     .h-3>svg     { height:0.75rem!important;  width:0.75rem!important;  }
        svg.h-3\\.5, .h-3\\.5>svg { height:0.875rem!important; width:0.875rem!important; }
        svg.h-4,     .h-4>svg     { height:1rem!important;     width:1rem!important;     }
        svg.h-5,  .h-5>svg  { height:1.25rem!important;  width:1.25rem!important;  }
        svg.h-6,  .h-6>svg  { height:1.5rem!important;   width:1.5rem!important;   }
        svg.h-7,  .h-7>svg  { height:1.75rem!important;  width:1.75rem!important;  }
        svg.h-8,  .h-8>svg  { height:2rem!important;     width:2rem!important;     }
        svg.h-10, .h-10>svg { height:2.5rem!important;   width:2.5rem!important;   }
        svg.h-12, .h-12>svg { height:3rem!important;     width:3rem!important;     }
        svg.w-3  { width:0.75rem!important; }
        svg.w-4  { width:1rem!important;    }
        svg.w-5  { width:1.25rem!important; }
        svg.w-6  { width:1.5rem!important;  }
        svg.w-8  { width:2rem!important;    }
        svg.w-10 { width:2.5rem!important;  }

        /* ═══════════════════════════
           LAYOUT BASE
           ═══════════════════════════ */
        .app-wrap  { display:flex; height:100vh; overflow:hidden; background:#0f1117; }

        /* ── sidebar ── */
        .sidebar { width:232px; flex-shrink:0; display:flex; flex-direction:column; background:#13151f; border-right:1px solid rgba(255,255,255,.06); }
        @media(max-width:768px){ .sidebar{display:none!important} }

        .sb-logo  { display:flex; align-items:center; gap:10px; padding:22px 18px 20px; border-bottom:1px solid rgba(255,255,255,.05); }
        .sb-logo-dot { width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:15px; box-shadow:0 2px 8px rgba(99,102,241,.35); }
        .sb-logo-text { font-size:14px; font-weight:800; color:#e8eaf0; letter-spacing:-0.02em; }
        .sb-logo-sub  { font-size:10px; font-weight:500; color:#4b5563; margin-top:1px; letter-spacing:0.02em; }

        .sb-section-label { font-size:10px; font-weight:700; color:#374151; letter-spacing:0.08em; text-transform:uppercase; padding:14px 16px 6px; }
        .sb-nav { flex:1; padding:10px 8px; display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
        .sb-link { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:9px; text-decoration:none; font-size:13px; font-weight:500; color:#6b7280; transition:background .15s,color .15s; position:relative; }
        .sb-link:hover { background:rgba(255,255,255,.05); color:#d1d5db; }
        .sb-link.active { background:rgba(99,102,241,.14); color:#a5b4fc; font-weight:600; }
        .sb-link.active::before { content:''; position:absolute; left:-8px; top:50%; transform:translateY(-50%); width:3px; height:18px; background:#6366f1; border-radius:0 3px 3px 0; }
        .sb-link-icon { width:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

        .sb-divider { height:1px; background:rgba(255,255,255,.05); margin:8px 8px; }
        .sb-user { padding:12px; border-top:1px solid rgba(255,255,255,.05); display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.02); }
        .sb-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:white; flex-shrink:0; }
        .sb-uinfo { flex:1; min-width:0; }
        .sb-uname { font-size:12px; font-weight:600; color:#e8eaf0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sb-uemail { font-size:10.5px; color:#4b5563; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sb-logout { background:none; border:none; cursor:pointer; color:#4b5563; padding:6px; border-radius:6px; display:flex; align-items:center; transition:background .15s,color .15s; }
        .sb-logout:hover { background:rgba(239,68,68,.1); color:#f87171; }

        /* ── main ── */
        .main-area { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .mob-header { display:none; height:52px; background:#13151f; border-bottom:1px solid rgba(255,255,255,.06); padding:0 16px; align-items:center; justify-content:space-between; flex-shrink:0; }
        @media(max-width:768px){ .mob-header{display:flex!important} }
        .mob-logo { display:flex; align-items:center; gap:8px; }
        .mob-logo-dot { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; font-size:13px; }
        .mob-logo-text { font-size:14px; font-weight:800; color:#e8eaf0; }
        .mob-actions { display:flex; align-items:center; gap:8px; }
        .page-scroll { flex:1; overflow-y:auto; padding-bottom:72px; }
        @media(min-width:769px){ .page-scroll{padding-bottom:0} }

        /* ── bottom nav mobile ── */
        .bot-nav { display:none; position:fixed; bottom:0; left:0; right:0; z-index:50; background:#13151f; border-top:1px solid rgba(255,255,255,.06); height:60px; }
        @media(max-width:768px){ .bot-nav{display:flex!important} }
        .bot-link { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; text-decoration:none; font-size:10px; font-weight:500; color:#4b5563; transition:color .15s; }
        .bot-link.active { color:#a5b4fc; }
        .bot-icon { font-size:18px; line-height:1; }

        /* ── badge notif ── */
        .notif-badge { position:absolute; top:-3px; right:-3px; background:#ef4444; color:#fff; font-size:9px; font-weight:700; border-radius:99px; min-width:16px; height:16px; display:flex; align-items:center; justify-content:center; padding:0 3px; }
        .notif-btn { position:relative; background:none; border:none; cursor:pointer; color:#6b7280; padding:6px; border-radius:6px; display:flex; align-items:center; transition:background .15s,color .15s; }
        .notif-btn:hover { background:rgba(255,255,255,.05); color:#e8eaf0; }
        a { color:inherit; text-decoration:none; }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>

      <div className="app-wrap">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-logo-dot">💰</div>
            <div>
              <div className="sb-logo-text">prestamos.app</div>
              <div className="sb-logo-sub">GESTIÓN DE CARTERA</div>
            </div>
          </div>

          <nav className="sb-nav">
            <div className="sb-section-label">Navegación</div>
            {items.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to==='/'} className={({isActive})=>`sb-link${isActive?' active':''}`}>
                <span className="sb-link-icon"><n.Icon /></span>
                {n.label}
              </NavLink>
            ))}

            <div className="sb-divider" />
            <div className="sb-section-label">Sistema</div>

            <NavLink to="/notificaciones" className={({isActive})=>`sb-link${isActive?' active':''}`}>
              <span className="sb-link-icon" style={{ position: 'relative' }}>
                <IcoBell />
                {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
              </span>
              Notificaciones
            </NavLink>

            {isAdmin && (
              <NavLink to="/configuracion" className={({isActive})=>`sb-link${isActive?' active':''}`}>
                <span className="sb-link-icon"><IcoCog /></span>
                Configuración
              </NavLink>
            )}
          </nav>

          <div className="sb-user">
            <div className="sb-avatar">{initial}</div>
            <div className="sb-uinfo">
              <div className="sb-uname">{name}</div>
              <div className="sb-uemail">{user?.email}</div>
            </div>
            <button className="sb-logout" onClick={handleSignOut} title="Cerrar sesión">
              <IcoLogout />
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main-area">
          {/* Mobile header */}
          <header className="mob-header">
            <div className="mob-logo">
              <div className="mob-logo-dot">💰</div>
              <span className="mob-logo-text">prestamos.app</span>
            </div>
            <div className="mob-actions">
              <NavLink to="/notificaciones" style={{ position: 'relative', display: 'flex', alignItems: 'center', color: '#6b7280', padding: 6 }}>
                <IcoBell />
                {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
              </NavLink>
              <button className="sb-logout" onClick={handleSignOut}>
                <IcoLogout />
              </button>
            </div>
          </header>

          <main className="page-scroll">
            <Outlet />
          </main>
        </div>

        {/* ── Bottom nav mobile ── */}
        <nav className="bot-nav">
          {items.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to==='/'} className={({isActive})=>`bot-link${isActive?' active':''}`}>
              <span className="bot-icon"><n.Icon /></span>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/notificaciones" className={({isActive})=>`bot-link${isActive?' active':''}`}>
            <span className="bot-icon" style={{ position: 'relative', display: 'inline-flex' }}>
              <IcoBell />
              {unread > 0 && <span className="notif-badge" style={{ top: -2, right: -4 }}>{unread}</span>}
            </span>
            Notifs
          </NavLink>
        </nav>
      </div>
    </>
  )
}
