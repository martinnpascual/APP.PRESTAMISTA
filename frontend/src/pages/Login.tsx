import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

/* ─── Floating symbol component ─────────────────────────────────────── */
function FloatSymbol({ char, style }: { char: string; style: React.CSSProperties }) {
  return (
    <span
      className="pointer-events-none absolute select-none font-mono text-white/[0.04] font-bold"
      style={style}
    >
      {char}
    </span>
  )
}

const symbols = ['$', '%', '₿', '#', '§', '$', '%', '$', '#', '%', '$', '₿']
const positions = [
  { top: '8%',  left: '4%',  fontSize: '7rem',  animationDelay: '0s',    animationDuration: '18s' },
  { top: '18%', left: '82%', fontSize: '5rem',  animationDelay: '3s',    animationDuration: '22s' },
  { top: '55%', left: '6%',  fontSize: '9rem',  animationDelay: '1.5s',  animationDuration: '20s' },
  { top: '70%', left: '75%', fontSize: '6rem',  animationDelay: '4s',    animationDuration: '16s' },
  { top: '35%', left: '45%', fontSize: '4rem',  animationDelay: '2s',    animationDuration: '24s' },
  { top: '85%', left: '20%', fontSize: '8rem',  animationDelay: '0.5s',  animationDuration: '19s' },
  { top: '5%',  left: '55%', fontSize: '5.5rem',animationDelay: '6s',    animationDuration: '21s' },
  { top: '45%', left: '88%', fontSize: '7.5rem',animationDelay: '2.5s',  animationDuration: '17s' },
  { top: '60%', left: '35%', fontSize: '3.5rem',animationDelay: '5s',    animationDuration: '23s' },
  { top: '25%', left: '15%', fontSize: '6.5rem',animationDelay: '3.5s',  animationDuration: '25s' },
  { top: '78%', left: '55%', fontSize: '5rem',  animationDelay: '1s',    animationDuration: '15s' },
  { top: '92%', left: '88%', fontSize: '4.5rem',animationDelay: '7s',    animationDuration: '20s' },
]

/* ─── Feature row ────────────────────────────────────────────────────── */
function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400 ring-1 ring-cyan-400/20">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────────────── */
export default function Login() {
  const { signIn, loading, user } = useAuthStore()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError((err as Error).message || 'Credenciales incorrectas')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        .login-root { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Syne', sans-serif; }

        @keyframes floatY {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-18px) rotate(1deg); }
          66%       { transform: translateY(8px) rotate(-1deg); }
        }
        @keyframes blobPulse {
          0%, 100% { transform: scale(1) translate(0,0); }
          50%       { transform: scale(1.12) translate(20px, -15px); }
        }
        @keyframes blobPulse2 {
          0%, 100% { transform: scale(1) translate(0,0); }
          50%       { transform: scale(0.9) translate(-15px, 20px); }
        }
        @keyframes blobPulse3 {
          0%, 100% { transform: scale(1.05) translate(0,0); }
          50%       { transform: scale(0.95) translate(10px, 10px); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes errorShake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }

        .float-sym { animation: floatY var(--dur, 20s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
        .blob1 { animation: blobPulse 12s ease-in-out infinite; }
        .blob2 { animation: blobPulse2 15s ease-in-out infinite; }
        .blob3 { animation: blobPulse3 10s ease-in-out infinite; }

        .anim-slide { animation: slideUp 0.5s ease forwards; opacity: 0; }
        .anim-slide-d1 { animation-delay: 0.1s; }
        .anim-slide-d2 { animation-delay: 0.2s; }
        .anim-slide-d3 { animation-delay: 0.3s; }
        .anim-slide-d4 { animation-delay: 0.4s; }
        .anim-slide-d5 { animation-delay: 0.5s; }

        .shimmer-text {
          background: linear-gradient(90deg, #67e8f9 0%, #ffffff 40%, #67e8f9 60%, #ffffff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        .ticker-wrap { overflow: hidden; }
        .ticker-inner { display: flex; width: max-content; animation: ticker 28s linear infinite; }

        .glass-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: white;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .glass-input::placeholder { color: rgba(148,163,184,0.5); }
        .glass-input:focus {
          outline: none;
          border-color: rgba(34,211,238,0.4);
          background: rgba(255,255,255,0.07);
          box-shadow: 0 0 0 3px rgba(34,211,238,0.08), inset 0 0 20px rgba(34,211,238,0.03);
        }

        .btn-glow {
          background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
          box-shadow: 0 0 20px rgba(6,182,212,0.25), 0 4px 15px rgba(59,130,246,0.2);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
        }
        .btn-glow:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 0 30px rgba(6,182,212,0.4), 0 6px 20px rgba(59,130,246,0.3);
        }
        .btn-glow:active:not(:disabled) { transform: translateY(0); }

        .error-shake { animation: errorShake 0.4s ease; }

        .grid-bg {
          background-image:
            linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .stat-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(4px);
          transition: border-color 0.2s, background 0.2s;
        }
        .stat-card:hover {
          border-color: rgba(34,211,238,0.15);
          background: rgba(34,211,238,0.03);
        }
      `}</style>

      <div className="login-root relative flex min-h-screen overflow-hidden bg-[#060c1a]">

        {/* ── Grid ── */}
        <div className="pointer-events-none absolute inset-0 grid-bg" />

        {/* ── Blobs ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="blob1 absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="blob2 absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-blue-600/12 blur-[90px]" />
          <div className="blob3 absolute -bottom-20 left-1/4 h-[350px] w-[350px] rounded-full bg-indigo-500/8 blur-[80px]" />
        </div>

        {/* ── Floating symbols ── */}
        {mounted && symbols.map((char, i) => (
          <FloatSymbol
            key={i}
            char={char}
            style={{
              ...positions[i],
              '--dur': positions[i].animationDuration,
              '--delay': positions[i].animationDelay,
            } as React.CSSProperties}
          />
        ))}

        {/* ══════════ LEFT PANEL ══════════ */}
        <div className="relative hidden flex-col justify-between px-14 py-12 lg:flex lg:w-[52%]">

          {/* Logo */}
          <div className={`flex items-center gap-3 ${mounted ? 'anim-slide anim-slide-d1' : 'opacity-0'}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
              <svg className="h-4.5 w-4.5 text-white" style={{height:'18px',width:'18px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-display text-base font-700 tracking-tight text-white" style={{fontWeight:700}}>prestamos.app</span>
            <span className="ml-1 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-400 ring-1 ring-cyan-400/20">v1.0</span>
          </div>

          {/* Headline */}
          <div className="mt-auto mb-auto">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 ${mounted ? 'anim-slide anim-slide-d2' : 'opacity-0'}`}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              <span className="text-xs font-medium text-cyan-300">Sistema activo · Sudamérica</span>
            </div>

            <h1 className={`font-display mb-5 leading-[1.1] ${mounted ? 'anim-slide anim-slide-d2' : 'opacity-0'}`}
                style={{fontWeight:800, fontSize:'clamp(2.4rem,4vw,3.6rem)'}}>
              <span className="text-white">Controlá tu</span><br />
              <span className="shimmer-text">cartera de</span><br />
              <span className="text-white">préstamos.</span>
            </h1>

            <p className={`mb-10 max-w-sm text-[0.9rem] leading-relaxed text-slate-400 ${mounted ? 'anim-slide anim-slide-d3' : 'opacity-0'}`}>
              Clientes, cobros, pagos y reportes unificados.<br />
              Diseñado para prestamistas independientes.
            </p>

            {/* Features */}
            <div className={`space-y-4 ${mounted ? 'anim-slide anim-slide-d3' : 'opacity-0'}`}>
              <Feature
                title="Cobros del día"
                desc="Lista automática por zona con semáforo visual"
                icon={<svg style={{height:'14px',width:'14px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>}
              />
              <Feature
                title="PDFs automáticos"
                desc="Contratos, recibos y tabla de amortización al instante"
                icon={<svg style={{height:'14px',width:'14px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
              />
              <Feature
                title="Reportes en tiempo real"
                desc="KPIs, mora y recaudación actualizados al momento"
                icon={<svg style={{height:'14px',width:'14px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
              />
            </div>

            {/* Stats row */}
            <div className={`mt-10 grid grid-cols-3 gap-3 ${mounted ? 'anim-slide anim-slide-d4' : 'opacity-0'}`}>
              {[
                { n: '100%', l: 'Nube' },
                { n: '0 papel', l: 'Digital' },
                { n: '24/7', l: 'Disponible' },
              ].map((s) => (
                <div key={s.l} className="stat-card rounded-xl p-3 text-center">
                  <div className="font-display text-base font-bold text-cyan-400" style={{fontWeight:700}}>{s.n}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ticker */}
          <div className={`ticker-wrap border-t border-white/5 pt-4 ${mounted ? 'anim-slide anim-slide-d5' : 'opacity-0'}`}>
            <div className="ticker-inner text-[11px] text-slate-600">
              {['COBROS DEL DÍA', 'MORA AUTOMÁTICA', 'RUTAS POR ZONA', 'FIRMA DIGITAL', 'BACKUP DIARIO', 'NOTIFICACIONES TELEGRAM', 'COBROS DEL DÍA', 'MORA AUTOMÁTICA', 'RUTAS POR ZONA', 'FIRMA DIGITAL', 'BACKUP DIARIO', 'NOTIFICACIONES TELEGRAM'].map((t, i) => (
                <span key={i} className="mx-6 inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-cyan-400/40" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════ RIGHT PANEL — FORM ══════════ */}
        <div className="relative flex w-full items-center justify-center px-5 py-10 lg:w-[48%]">
          {/* Divider line */}
          <div className="pointer-events-none absolute left-0 top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-white/8 to-transparent lg:block" />

          <div className="w-full max-w-[400px]">

            {/* Mobile logo */}
            <div className={`mb-8 flex items-center gap-3 lg:hidden ${mounted ? 'anim-slide anim-slide-d1' : 'opacity-0'}`}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600">
                <svg style={{height:'18px',width:'18px'}} className="text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-display font-bold text-white" style={{fontWeight:700}}>prestamos.app</span>
            </div>

            {/* Card */}
            <div
              className={`rounded-2xl p-8 ${mounted ? 'anim-slide anim-slide-d2' : 'opacity-0'}`}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {/* Header */}
              <div className="mb-7">
                <h2 className="font-display text-2xl font-bold text-white" style={{fontWeight:800}}>Iniciar sesión</h2>
                <p className="mt-1 text-sm text-slate-400">Accedé a tu panel de gestión</p>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="error-shake mb-5 flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-red-300 flex-1">{error}</span>
                  <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-200 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className={mounted ? 'anim-slide anim-slide-d3' : 'opacity-0'}>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="tu@email.com"
                      className="glass-input w-full rounded-xl py-3 pl-10 pr-4 text-sm"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className={mounted ? 'anim-slide anim-slide-d4' : 'opacity-0'}>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="glass-input w-full rounded-xl py-3 pl-10 pr-11 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute inset-y-0 right-3 flex items-center px-1 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPass ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <div className={`pt-1 ${mounted ? 'anim-slide anim-slide-d5' : 'opacity-0'}`}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-glow w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Verificando...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Ingresar al panel
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <p className={`mt-5 text-center text-[11px] text-slate-600 ${mounted ? 'anim-slide anim-slide-d5' : 'opacity-0'}`}>
              prestamos.app · v1.0.0 · Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
