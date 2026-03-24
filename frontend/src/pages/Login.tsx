import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function Login() {
  const { signIn, loading, user } = useAuthStore()
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try { await signIn(email, password); navigate('/') }
    catch (err) { setError((err as Error).message || 'Credenciales incorrectas') }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .lp * { box-sizing: border-box; }
        .lp { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-height:100vh; background:#111318; display:flex; align-items:center; justify-content:center; padding:20px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        .fade-up { animation: fadeUp .4s ease forwards; opacity:0; }
        .d1{animation-delay:.05s} .d2{animation-delay:.12s} .d3{animation-delay:.19s} .d4{animation-delay:.26s}
        .login-card { background:#1c1e27; border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:40px; width:100%; max-width:400px; box-shadow:0 24px 60px rgba(0,0,0,0.5); }
        .lp-input { display:block; width:100%; padding:13px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:10px; font-size:14px; font-family:inherit; color:#e4e6eb; outline:none; transition:border-color .2s,background .2s,box-shadow .2s; }
        .lp-input::placeholder { color:rgba(148,163,184,0.45); }
        .lp-input:focus { border-color:rgba(99,102,241,0.5); background:rgba(99,102,241,0.05); box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .lp-btn { width:100%; padding:13px; background:#6366f1; border:none; border-radius:10px; font-size:14px; font-weight:700; font-family:inherit; color:white; cursor:pointer; transition:background .2s,transform .1s,opacity .2s; }
        .lp-btn:hover:not(:disabled) { background:#4f46e5; }
        .lp-btn:disabled { opacity:.5; cursor:not-allowed; }
        .err-box { animation: shake .35s ease; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:10px; padding:11px 14px; display:flex; align-items:center; gap:10px; margin-bottom:16px; }
        .pw-wrap { position:relative; }
        .pw-toggle { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:rgba(148,163,184,0.5); padding:4px; display:flex; align-items:center; }
        .pw-toggle:hover { color:rgba(148,163,184,0.9); }
        .divider { width:100%; height:1px; background:rgba(255,255,255,0.06); margin:28px 0; }
        .feature-list { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:28px; }
        .feature-item { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px 14px; }
        .feature-dot { width:6px; height:6px; border-radius:50%; margin-bottom:8px; }
      `}</style>

      <div className="lp">
        <div className="login-card">
          {/* Logo */}
          <div className="fade-up d1" style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'32px'}}>
            <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'#6366f1',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
            </div>
            <span style={{fontSize:'15px',fontWeight:700,color:'#e4e6eb',letterSpacing:'-0.01em'}}>prestamos.app</span>
            <span style={{marginLeft:'auto',fontSize:'11px',background:'rgba(99,102,241,0.12)',color:'#a5b4fc',borderRadius:'6px',padding:'2px 8px',fontWeight:600}}>v1.0</span>
          </div>

          {/* Heading */}
          <div className="fade-up d1" style={{marginBottom:'28px'}}>
            <h1 style={{fontSize:'22px',fontWeight:800,color:'#e4e6eb',letterSpacing:'-0.02em',marginBottom:'4px'}}>Iniciar sesión</h1>
            <p style={{fontSize:'14px',color:'#6b7280',fontWeight:400}}>Accedé a tu panel de gestión</p>
          </div>

          {/* Error */}
          {error && (
            <div className="err-box">
              <span style={{color:'#fca5a5',fontSize:'13px',flex:1}}>{error}</span>
              <button onClick={()=>setError(null)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(252,165,165,0.6)',padding:0,flexShrink:0,display:'flex',alignItems:'center'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <div className="fade-up d2">
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="Correo electrónico" className="lp-input"/>
            </div>

            <div className="fade-up d3 pw-wrap">
              <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="Contraseña" className="lp-input" style={{paddingRight:'42px'}}/>
              <button type="button" className="pw-toggle" onClick={()=>setShowPass(!showPass)}>
                {showPass
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>

            <div className="fade-up d4" style={{paddingTop:'4px'}}>
              <button type="submit" disabled={loading} className="lp-btn">
                {loading
                  ? <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                      <svg style={{animation:'spin .7s linear infinite'}} width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                        <path fill="white" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                      Verificando...
                    </span>
                  : 'Ingresar al panel'
                }
              </button>
            </div>
          </form>

          <div className="divider"/>

          {/* Feature grid */}
          <div className="feature-list fade-up d4">
            {[
              {dot:'#34d399',t:'Cobros del día',d:'Por zona y semáforo'},
              {dot:'#6366f1',t:'PDFs automáticos',d:'Contratos y recibos'},
              {dot:'#f59e0b',t:'Control de mora',d:'Job nocturno'},
              {dot:'#3b82f6',t:'Reportes',d:'KPIs en tiempo real'},
            ].map(f=>(
              <div className="feature-item" key={f.t}>
                <div className="feature-dot" style={{background:f.dot}}/>
                <div style={{fontSize:'12px',fontWeight:600,color:'#d1d5db',marginBottom:'2px'}}>{f.t}</div>
                <div style={{fontSize:'11px',color:'#6b7280'}}>{f.d}</div>
              </div>
            ))}
          </div>

          <p style={{marginTop:'24px',textAlign:'center',fontSize:'11px',color:'rgba(107,114,128,0.5)'}}>
            prestamos.app · v1.0.0
          </p>
        </div>
      </div>
    </>
  )
}
