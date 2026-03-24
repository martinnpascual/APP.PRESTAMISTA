import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const NAV = [
  { to: '/',          label: 'Inicio',     emoji: '⚡' },
  { to: '/clientes',  label: 'Clientes',   emoji: '👥' },
  { to: '/prestamos', label: 'Préstamos',  emoji: '💰' },
  { to: '/cobros',    label: 'Cobros',     emoji: '📋' },
  { to: '/reportes',  label: 'Reportes',   emoji: '📊' },
  { to: '/usuarios',  label: 'Usuarios',   emoji: '⚙️', adminOnly: true },
]

export default function Layout() {
  const { user, signOut, session } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = session?.user?.app_metadata?.rol === 'admin' || session?.user?.user_metadata?.rol === 'admin'
  const name = user?.email?.split('@')[0] ?? 'Usuario'
  const initial = name[0]?.toUpperCase() ?? 'U'

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const items = NAV.filter(n => !n.adminOnly || isAdmin)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin:0; background:#111318; font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
        .app-wrap  { display:flex; height:100vh; overflow:hidden; background:#111318; }
        /* ── sidebar ── */
        .sidebar { width:220px; flex-shrink:0; display:flex; flex-direction:column; background:#1c1e27; border-right:1px solid rgba(255,255,255,0.06); }
        @media(max-width:768px){ .sidebar{display:none!important} }
        .sb-logo  { display:flex; align-items:center; gap:10px; padding:20px 18px 18px; border-bottom:1px solid rgba(255,255,255,0.05); }
        .sb-logo-dot { width:30px; height:30px; border-radius:8px; background:#6366f1; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:14px; }
        .sb-logo-text { font-size:14px; font-weight:700; color:#e4e6eb; letter-spacing:-0.01em; }
        .sb-nav { flex:1; padding:12px 10px; display:flex; flex-direction:column; gap:2px; }
        .sb-link { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px; text-decoration:none; font-size:13.5px; font-weight:500; color:#9ca3af; transition:background .15s,color .15s; }
        .sb-link:hover { background:rgba(255,255,255,0.05); color:#e4e6eb; }
        .sb-link.active { background:rgba(99,102,241,0.12); color:#a5b4fc; font-weight:600; }
        .sb-link-icon { font-size:15px; width:20px; text-align:center; }
        .sb-user { padding:12px; border-top:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:10px; }
        .sb-avatar { width:32px; height:32px; border-radius:50%; background:#6366f1; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:white; flex-shrink:0; }
        .sb-uinfo { flex:1; min-width:0; }
        .sb-uname { font-size:12px; font-weight:600; color:#e4e6eb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sb-uemail { font-size:11px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sb-logout { background:none; border:none; cursor:pointer; color:#6b7280; padding:6px; border-radius:6px; display:flex; align-items:center; transition:background .15s,color .15s; }
        .sb-logout:hover { background:rgba(239,68,68,0.1); color:#f87171; }
        /* ── main ── */
        .main-area { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .mob-header { display:none; height:52px; background:#1c1e27; border-bottom:1px solid rgba(255,255,255,0.06); padding:0 16px; align-items:center; justify-content:space-between; flex-shrink:0; }
        @media(max-width:768px){ .mob-header{display:flex!important} }
        .mob-logo { display:flex; align-items:center; gap:8px; }
        .mob-logo-dot { width:26px; height:26px; border-radius:7px; background:#6366f1; display:flex; align-items:center; justify-content:center; font-size:12px; }
        .mob-logo-text { font-size:14px; font-weight:700; color:#e4e6eb; }
        .page-scroll { flex:1; overflow-y:auto; padding-bottom:72px; }
        @media(min-width:769px){ .page-scroll{padding-bottom:0} }
        /* ── bottom nav mobile ── */
        .bot-nav { display:none; position:fixed; bottom:0; left:0; right:0; z-index:50; background:#1c1e27; border-top:1px solid rgba(255,255,255,0.06); height:60px; }
        @media(max-width:768px){ .bot-nav{display:flex!important} }
        .bot-link { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; text-decoration:none; font-size:10px; font-weight:500; color:#6b7280; transition:color .15s; }
        .bot-link.active { color:#a5b4fc; }
        .bot-icon { font-size:18px; line-height:1; }
      `}</style>

      <div className="app-wrap">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-logo-dot">💰</div>
            <span className="sb-logo-text">prestamos.app</span>
          </div>

          <nav className="sb-nav">
            {items.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to==='/'} className={({isActive})=>`sb-link${isActive?' active':''}`}>
                <span className="sb-link-icon">{n.emoji}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="sb-user">
            <div className="sb-avatar">{initial}</div>
            <div className="sb-uinfo">
              <div className="sb-uname">{name}</div>
              <div className="sb-uemail">{user?.email}</div>
            </div>
            <button className="sb-logout" onClick={handleSignOut} title="Cerrar sesión">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
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
            <button className="sb-logout" onClick={handleSignOut}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </header>

          <main className="page-scroll">
            <Outlet />
          </main>
        </div>

        {/* ── Bottom nav mobile ── */}
        <nav className="bot-nav">
          {items.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to==='/'} className={({isActive})=>`bot-link${isActive?' active':''}`}>
              <span className="bot-icon">{n.emoji}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  )
}
