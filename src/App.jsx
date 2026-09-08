import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { supabase, faltaConfiguracion } from './supabase'
import Dashboard from './pages/Dashboard'
import PlanSemanal from './pages/PlanSemanal'
import Viandas from './pages/Viandas'
import Gimnasio from './pages/Gimnasio'
import Perfil from './pages/Perfil'
import { programarNotificaciones } from './services/notifications'
import { C } from './theme'
import { IconDashboard, IconPlan, IconViandas, IconGym, IconPerfil } from './components/icons'
import { useInteractiveStyle, focusRing } from './hooks/useInteractiveStyle'

const RAIL_WIDTH = '76px'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

const LINKS = [
  { path: '/', label: 'Dashboard', Icon: IconDashboard },
  { path: '/plan', label: 'Plan', Icon: IconPlan },
  { path: '/viandas', label: 'Viandas', Icon: IconViandas },
  { path: '/gimnasio', label: 'Gym', Icon: IconGym },
  { path: '/perfil', label: 'Perfil', Icon: IconPerfil },
]

// ── Bottom-nav mobile — tab bar nativo, se mantiene igual (no es un tell) ──
function BottomNav() {
  const location = useLocation()
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: C.navHeight,
      background: C.navBg,
      borderTop: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'stretch',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {LINKS.map(({ path, label, Icon }) => {
        const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
        return (
          <NavLink key={path} to={path} end={path === '/'}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '3px', textDecoration: 'none',
              color: active ? C.accentText : C.textMuted,
              fontSize: '10px', fontWeight: active ? 600 : 400,
              letterSpacing: '0.02em',
              position: 'relative',
            }}>
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '20%', right: '20%',
                height: '2px', background: C.accent, borderRadius: '0 0 2px 2px',
              }} />
            )}
            <Icon size={22} color={active ? C.accent : C.textMuted} />
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}

// ── Top bar mobile (sin nav de links — eso vive en el bottom-nav) ──
function TopBar({ onLogout }) {
  const location = useLocation()
  const labels = { '/': 'Dashboard', '/plan': 'Plan Semanal', '/viandas': 'Viandas', '/gimnasio': 'Gimnasio', '/perfil': 'Perfil' }
  const title = labels[location.pathname] || 'NutriGym'
  const { style, handlers } = useInteractiveStyle(
    { background: 'transparent', border: `1px solid ${C.border}`, color: C.textSecondary, padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 },
    { hover: { borderColor: C.textMuted }, focus: focusRing }
  )
  return (
    <header style={{
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 1.25rem',
      height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <span style={{ color: C.textPrimary, fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
        {title}
      </span>
      <button onClick={onLogout} style={style} {...handlers}>Salir</button>
    </header>
  )
}

// ── Side-rail desktop — reemplaza el "AI nav" genérico (wordmark + links + CTA) ──
function RailLink({ path, label, Icon, active }) {
  const { style, handlers } = useInteractiveStyle(
    {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      padding: '10px 4px', borderRadius: '10px', textDecoration: 'none',
      color: active ? C.accentText : C.textMuted,
      fontSize: '10px', fontWeight: active ? 600 : 400,
      width: '56px',
    },
    { hover: { background: C.surfaceHigh, color: C.textSecondary }, focus: focusRing }
  )
  return (
    <NavLink to={path} end={path === '/'} style={style} {...handlers}>
      <Icon size={20} color={active ? C.accent : 'currentColor'} />
      {label}
    </NavLink>
  )
}

function DesktopRail({ onLogout }) {
  const location = useLocation()
  const { style: logoutStyle, handlers: logoutHandlers } = useInteractiveStyle(
    { background: 'transparent', border: 'none', color: C.textMuted, padding: '8px', borderRadius: '8px', cursor: 'pointer' },
    { hover: { background: C.redDim, color: C.red }, focus: focusRing }
  )
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: RAIL_WIDTH,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '1.25rem 0', zIndex: 100,
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', background: C.accentDim,
        border: `1px solid ${C.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.75rem',
      }}>
        <IconGym size={18} color={C.accent} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {LINKS.map(({ path, label, Icon }) => {
          const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
          return <RailLink key={path} path={path} label={label} Icon={Icon} active={active} />
        })}
      </div>
      <button onClick={onLogout} style={logoutStyle} {...logoutHandlers} title="Salir" aria-label="Salir">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
        </svg>
      </button>
    </nav>
  )
}

// ── Login / Registro ───────────────────────────────────────────────
function AuthScreen() {
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const isMobile = useIsMobile()

  function cambiarModo(m) {
    setModo(m); setError(''); setMensaje(''); setEmail(''); setPassword(''); setPasswordConfirm('')
  }

  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o contraseña incorrectos.')
    setLoading(false)
  }

  async function handleRegistro(e) {
    e.preventDefault(); setError('')
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message) }
    else {
      setMensaje('Cuenta creada. Revisá tu email para confirmar.')
      setModo('login'); setEmail(''); setPassword(''); setPasswordConfirm('')
    }
    setLoading(false)
  }

  const inp = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: '10px', color: C.textPrimary, fontSize: '15px',
    outline: 'none',
  }

  const SubmitButton = () => {
    const { style, handlers } = useInteractiveStyle(
      {
        width: '100%', padding: '13px',
        background: modo === 'login' ? C.accent : C.blue,
        color: 'white', border: 'none', borderRadius: '10px',
        cursor: loading ? 'wait' : 'pointer', fontSize: '1rem', fontWeight: 700,
        marginTop: '4px', letterSpacing: '-0.01em',
        opacity: loading ? 0.7 : 1,
      },
      { hover: loading ? null : { filter: 'brightness(1.08)' }, focus: focusRing }
    )
    return (
      <button type="submit" disabled={loading} style={style} {...handlers}>
        {loading ? 'Cargando...' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
      </button>
    )
  }

  const ToggleButton = ({ m, label }) => {
    const { style, handlers } = useInteractiveStyle(
      {
        flex: 1, padding: '9px', border: 'none', borderRadius: '7px', cursor: 'pointer',
        background: modo === m ? C.accent : 'transparent',
        color: modo === m ? '#fff' : C.textSecondary,
        fontWeight: modo === m ? 700 : 400, fontSize: '0.9rem',
      },
      { focus: focusRing }
    )
    return <button key={m} onClick={() => cambiarModo(m)} style={style} {...handlers}>{label}</button>
  }

  const form = (
    <form onSubmit={modo === 'login' ? handleLogin : handleRegistro} style={{ width: '100%' }}>
      <div style={{
        display: 'flex', background: C.surface, borderRadius: '10px',
        padding: '4px', marginBottom: '1.5rem', border: `1px solid ${C.border}`,
      }}>
        <ToggleButton m="login" label="Ingresar" />
        <ToggleButton m="registro" label="Crear cuenta" />
      </div>

      {error && (
        <div style={{ background: '#EF444420', border: '1px solid #EF4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', color: '#FCA5A5', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      {mensaje && (
        <div style={{ background: C.accentDim, border: `1px solid ${C.accent}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', color: C.accentText, fontSize: '0.875rem' }}>
          {mensaje}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ color: C.textSecondary, fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} required placeholder="tu@email.com" />
        </div>
        <div>
          <label style={{ color: C.textSecondary, fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} required placeholder="••••••••" />
        </div>
        {modo === 'registro' && (
          <div>
            <label style={{ color: C.textSecondary, fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Confirmar contraseña</label>
            <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} style={inp} required placeholder="••••••••" />
          </div>
        )}
        <SubmitButton />
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <div style={{
        minHeight: '100vh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px', background: C.accentDim,
              border: `1px solid ${C.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <IconGym size={26} color={C.accent} />
            </div>
            <h1 style={{ color: C.textPrimary, margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              NutriGym<span style={{ color: C.accentText }}> Tracker</span>
            </h1>
            <p style={{ color: C.textSecondary, margin: '6px 0 0', fontSize: '0.875rem' }}>
              Tu seguimiento de nutrición y entrenamiento
            </p>
          </div>
          {form}
        </div>
      </div>
    )
  }

  // Desktop: panel de marca a la izquierda (sesga el layout, rompe el centrado total),
  // formulario a la derecha en su propia columna angosta.
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        flex: '1 1 55%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '4rem', borderRight: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px', background: C.accentDim,
          border: `1px solid ${C.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.5rem',
        }}>
          <IconGym size={28} color={C.accent} />
        </div>
        <h1 style={{ color: C.textPrimary, margin: 0, fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', maxWidth: '420px' }}>
          NutriGym<span style={{ color: C.accentText }}> Tracker</span>
        </h1>
        <p style={{ color: C.textSecondary, margin: '10px 0 0', fontSize: '1rem', maxWidth: '360px', lineHeight: 1.5 }}>
          Plan semanal, viandas y entrenamiento en un solo lugar — sin depender de una app genérica.
        </p>
      </div>
      <div style={{ flex: '1 1 45%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>{form}</div>
      </div>
    </div>
  )
}

// ── App principal ──────────────────────────────────────────────────
function AppLayout({ session, onLogout }) {
  const isMobile = useIsMobile()

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      minHeight: '100vh',
      background: C.bg,
      color: C.textPrimary,
    }}>
      {isMobile ? <TopBar onLogout={onLogout} /> : <DesktopRail onLogout={onLogout} />}

      <main style={{
        padding: isMobile ? '1rem 1rem calc(1rem + 64px)' : '2rem 2.5rem',
        maxWidth: isMobile ? '100%' : '1400px',
        marginLeft: isMobile ? 0 : RAIL_WIDTH,
      }}>
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/plan" element={<PlanSemanal session={session} />} />
          <Route path="/viandas" element={<Viandas session={session} />} />
          <Route path="/gimnasio" element={<Gimnasio session={session} />} />
          <Route path="/perfil" element={<Perfil session={session} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {isMobile && <BottomNav />}
    </div>
  )
}

function ConfiguracionFaltante() {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        maxWidth: '420px', background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: '10px', padding: '1.5rem',
      }}>
        <h1 style={{ color: C.textPrimary, fontSize: '1.125rem', fontWeight: 700, margin: '0 0 12px' }}>
          Falta la configuración de Supabase
        </h1>
        <p style={{ color: C.textSecondary, fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
          Esta versión se compiló sin <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_KEY</code>,
          así que no puede conectarse a la base. Si es el APK, revisá que los secrets estén
          cargados en GitHub Actions y volvé a generarlo.
        </p>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    if (faltaConfiguracion) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        supabase.from('user_profile').select('*').eq('user_id', session.user.id).single()
          .then(({ data }) => { if (data) programarNotificaciones(data) })
      }
    })
    supabase.auth.onAuthStateChange((_e, session) => setSession(session))
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (faltaConfiguracion) return <ConfiguracionFaltante />
  if (!session) return <AuthScreen />

  return (
    <BrowserRouter>
      <AppLayout session={session} onLogout={handleLogout} />
    </BrowserRouter>
  )
}

export default App
