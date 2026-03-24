import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

/* ── Mini UI Cards shown on left panel ─────────────────────────────── */
function CardCobros() {
  return (
    <div style={{
      background:'rgba(255,255,255,0.06)',
      border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:'16px',
      padding:'16px',
      width:'220px',
      backdropFilter:'blur(12px)',
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',letterSpacing:'0.08em',textTransform:'uppercase'}}>Cobros del día</span>
        <span style={{fontSize:'11px',background:'rgba(16,185,129,0.15)',color:'#34d399',borderRadius:'20px',padding:'2px 8px',fontWeight:600}}>8 pendientes</span>
      </div>
      {[
        { nombre:'García, Luis',   monto:'$1.200', color:'#34d399' },
        { nombre:'Méndez, Ana',    monto:'$850',   color:'#fbbf24' },
        { nombre:'Torres, Pedro',  monto:'$2.400', color:'#f87171' },
      ].map((r) => (
        <div key={r.nombre} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:r.color,flexShrink:0}} />
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.75)'}}>{r.nombre}</span>
          </div>
          <span style={{fontSize:'12px',fontWeight:600,color:'white'}}>{r.monto}</span>
        </div>
      ))}
    </div>
  )
}

function CardKPI() {
  return (
    <div style={{
      background:'rgba(255,255,255,0.06)',
      border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:'16px',
      padding:'16px',
      width:'180px',
      backdropFilter:'blur(12px)',
    }}>
      <p style={{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'8px'}}>Recaudado hoy</p>
      <p style={{fontSize:'26px',fontWeight:800,color:'white',lineHeight:1,marginBottom:'4px'}}>$24.800</p>
      <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/></svg>
        <span style={{fontSize:'11px',color:'#34d399',fontWeight:600}}>+12% vs ayer</span>
      </div>
      {/* mini bar chart */}
      <div style={{display:'flex',alignItems:'flex-end',gap:'3px',marginTop:'12px',height:'28px'}}>
        {[40,65,45,80,55,90,70].map((h,i)=>(
          <div key={i} style={{flex:1,height:`${h}%`,borderRadius:'3px',background: i===5 ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.12)'}} />
        ))}
      </div>
    </div>
  )
}

function CardNotif() {
  return (
    <div style={{
      background:'rgba(99,102,241,0.15)',
      border:'1px solid rgba(99,102,241,0.3)',
      borderRadius:'14px',
      padding:'12px 14px',
      width:'200px',
      backdropFilter:'blur(12px)',
      display:'flex',
      alignItems:'flex-start',
      gap:'10px',
    }}>
      <div style={{width:'32px',height:'32px',borderRadius:'10px',background:'rgba(99,102,241,0.3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(165,180,252,1)" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      </div>
      <div>
        <p style={{fontSize:'12px',fontWeight:600,color:'white',marginBottom:'2px'}}>Pago registrado</p>
        <p style={{fontSize:'11px',color:'rgba(165,180,252,0.8)'}}>García · $1.200 · ahora</p>
      </div>
    </div>
  )
}

/* ─── Main ──────────────────────────────────────────────────────────── */
export default function Login() {
  const { signIn, loading, user } = useAuthStore()
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [ready,    setReady]    = useState(false)

  useEffect(() => { setTimeout(()=>setReady(true), 60) }, [])
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .lp { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes up1 { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-14px) rotate(1deg)} }
        @keyframes up2 { 0%,100%{transform:translateY(0) rotate(2deg)}  50%{transform:translateY(-10px) rotate(-1deg)} }
        @keyframes up3 { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-18px) rotate(2deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes errShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} 80%{transform:translateX(-3px)} }
        .card1 { animation: up1 7s ease-in-out infinite; }
        .card2 { animation: up2 9s ease-in-out infinite 1s; }
        .card3 { animation: up3 8s ease-in-out infinite 2s; }
        .fade-up { opacity:0; animation: fadeUp 0.5s ease forwards; }
        .d1{animation-delay:.05s} .d2{animation-delay:.15s} .d3{animation-delay:.25s}
        .d4{animation-delay:.35s} .d5{animation-delay:.45s}
        .err-shake { animation: errShake 0.35s ease; }
        .lp-input {
          width:100%; background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.09); border-radius:12px;
          padding:14px 16px; font-size:14px; color:white;
          font-family:'Plus Jakarta Sans',sans-serif;
          transition: border-color .2s, background .2s, box-shadow .2s;
          outline:none;
        }
        .lp-input::placeholder { color:rgba(148,163,184,0.55); }
        .lp-input:focus {
          border-color:rgba(99,102,241,0.5);
          background:rgba(99,102,241,0.05);
          box-shadow:0 0 0 3px rgba(99,102,241,0.1);
        }
        .lp-btn {
          width:100%; padding:14px;
          background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border:none; border-radius:12px; font-size:14px; font-weight:700;
          color:white; font-family:'Plus Jakarta Sans',sans-serif;
          cursor:pointer; transition: transform .15s, box-shadow .15s, opacity .15s;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
        }
        .lp-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 25px rgba(99,102,241,0.45); }
        .lp-btn:active:not(:disabled) { transform:translateY(0); }
        .lp-btn:disabled { opacity:.55; cursor:not-allowed; }
      `}</style>

      <div className="lp" style={{
        minHeight:'100vh', display:'flex', background:'#111318', overflow:'hidden', position:'relative',
      }}>
        {/* subtle gradient */}
        <div style={{position:'absolute',inset:0,pointerEvents:'none',
          background:'radial-gradient(ellipse 70% 60% at 20% 50%, rgba(99,102,241,0.07) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(16,185,129,0.04) 0%, transparent 60%)'
        }} />

        {/* ══ LEFT ══ */}
        <div style={{
          flex:1, display:'none', flexDirection:'column', justifyContent:'center',
          padding:'60px 60px 60px 80px', position:'relative',
        }} className="lg-left">
          <style>{`.lg-left { display:none; } @media(min-width:900px){.lg-left{display:flex!important;}}`}</style>

          {/* Logo */}
          <div className={ready ? 'fade-up d1' : ''} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'56px'}}>
            <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'linear-gradient(135deg,#6366f1,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(99,102,241,0.4)'}}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span style={{fontSize:'15px',fontWeight:700,color:'white',letterSpacing:'-0.01em'}}>prestamos.app</span>
          </div>

          {/* Headline */}
          <div className={ready ? 'fade-up d2' : ''} style={{maxWidth:'420px',marginBottom:'56px'}}>
            <h1 style={{fontSize:'clamp(2.2rem,3.5vw,3rem)',fontWeight:800,lineHeight:1.15,letterSpacing:'-0.03em',color:'white',marginBottom:'16px'}}>
              Controlá tu<br />
              <span style={{color:'rgba(255,255,255,0.35)'}}>cartera de</span>{' '}
              préstamos.
            </h1>
            <p style={{fontSize:'15px',color:'rgba(148,163,184,0.8)',lineHeight:1.7,fontWeight:400}}>
              Cobros, pagos, reportes y PDFs automáticos.<br />
              Todo en un solo lugar.
            </p>
          </div>

          {/* Floating cards */}
          <div className={ready ? 'fade-up d3' : ''} style={{position:'relative',height:'280px',width:'100%',maxWidth:'460px'}}>
            <div className="card1" style={{position:'absolute',top:0,left:0,zIndex:3}}>
              <CardCobros />
            </div>
            <div className="card2" style={{position:'absolute',top:'40px',right:'0',zIndex:2}}>
              <CardKPI />
            </div>
            <div className="card3" style={{position:'absolute',bottom:'0',left:'120px',zIndex:4}}>
              <CardNotif />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{width:'1px',background:'rgba(255,255,255,0.06)',flexShrink:0}} className="lg-divider">
          <style>{`@media(max-width:899px){.lg-divider{display:none}}`}</style>
        </div>

        {/* ══ RIGHT — FORM ══ */}
        <div style={{
          width:'100%',maxWidth:'100%',display:'flex',flexDirection:'column',
          justifyContent:'center',alignItems:'center',padding:'40px 24px',
        }} className="form-right">
          <style>{`@media(min-width:900px){.form-right{width:420px!important;flexShrink:0;padding:60px 56px!important;}}`}</style>

          {/* Mobile logo */}
          <div className="mobile-logo" style={{marginBottom:'36px',display:'flex',alignItems:'center',gap:'10px'}}>
            <style>{`@media(min-width:900px){.mobile-logo{display:none!important}}`}</style>
            <div style={{width:'34px',height:'34px',borderRadius:'10px',background:'linear-gradient(135deg,#6366f1,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span style={{fontSize:'15px',fontWeight:700,color:'white'}}>prestamos.app</span>
          </div>

          <div style={{width:'100%',maxWidth:'360px'}}>
            {/* Heading */}
            <div className={ready ? 'fade-up d1' : ''} style={{marginBottom:'32px'}}>
              <h2 style={{fontSize:'22px',fontWeight:800,color:'white',letterSpacing:'-0.02em',marginBottom:'6px'}}>
                Iniciar sesión
              </h2>
              <p style={{fontSize:'14px',color:'rgba(148,163,184,0.7)',fontWeight:400}}>
                Accedé a tu panel de gestión
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="err-shake" style={{
                marginBottom:'20px',display:'flex',alignItems:'flex-start',gap:'10px',
                background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.18)',
                borderRadius:'12px',padding:'12px 14px',
              }}>
                <svg style={{marginTop:'1px',flexShrink:0}} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span style={{fontSize:'13px',color:'#fca5a5',flex:1}}>{error}</span>
                <button onClick={()=>setError(null)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(248,113,113,0.6)',padding:0,lineHeight:1}}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className={ready ? 'fade-up d2' : ''} style={{marginBottom:'12px'}}>
                <input
                  type="email"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Correo electrónico"
                  className="lp-input"
                />
              </div>

              {/* Password */}
              <div className={ready ? 'fade-up d3' : ''} style={{position:'relative',marginBottom:'20px'}}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Contraseña"
                  className="lp-input"
                  style={{paddingRight:'44px'}}
                />
                <button
                  type="button"
                  onClick={()=>setShowPass(!showPass)}
                  style={{position:'absolute',right:'14px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'rgba(148,163,184,0.5)',padding:0,display:'flex',alignItems:'center',transition:'color .15s'}}
                  onMouseEnter={e=>(e.currentTarget.style.color='rgba(148,163,184,0.9)')}
                  onMouseLeave={e=>(e.currentTarget.style.color='rgba(148,163,184,0.5)')}
                >
                  {showPass
                    ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  }
                </button>
              </div>

              {/* Button */}
              <div className={ready ? 'fade-up d4' : ''}>
                <button type="submit" disabled={loading} className="lp-btn">
                  {loading
                    ? <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                        <svg style={{animation:'spin 0.8s linear infinite'}} width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
                          <path fill="white" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                        </svg>
                        Verificando...
                      </span>
                    : 'Ingresar'
                  }
                </button>
              </div>
            </form>

            {/* Footer */}
            <p className={ready ? 'fade-up d5' : ''} style={{marginTop:'28px',textAlign:'center',fontSize:'12px',color:'rgba(148,163,184,0.35)',fontWeight:400}}>
              prestamos.app · v1.0 · Sistema de gestión de préstamos
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
