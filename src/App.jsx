import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './pages/Dashboard'
import PlanSemanal from './pages/PlanSemanal'
import Viandas from './pages/Viandas'
import Gimnasio from './pages/Gimnasio'

// ── Íconos SVG inline ──────────────────────────────────────────────
function IconDashboard({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10B981' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconPlan({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10B981' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  )
}
function IconViandas({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10B981' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  )
}
function IconGym({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10B981' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
    </svg>
  )
}

// ── Colores y tokens ───────────────────────────────────────────────
const C = {
  bg: '#0F1117',
  surface: '#1A1D27',
  surfaceHover: '#22263A',
  border: '#2A2D3E',
  accent: '#10B981',
  accentDim: '#10B98120',
  accentText: '#34D399',
  blue: '#1A5276',
  red: '#EF4444',
  yellow: '#F59E0B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#4B5563',
  navBg: '#13151F',
  navHeight: '64px',
}

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
]

function BottomNav({ onLogout }) {
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
              transition: 'color 0.15s',
              position: 'relative',
            }}>
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '20%', right: '20%',
                height: '2px', background: C.accent, borderRadius: '0 0 2px 2px',
              }} />
            )}
            <Icon active={active} />
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}

function TopBar({ onLogout }) {
  const location = useLocation()
  const labels = { '/': 'Dashboard', '/plan': 'Plan Semanal', '/viandas': 'Viandas', '/gimnasio': 'Gimnasio' }
  const title = labels[location.pathname] || 'NutriGym'
  return (
    <header style={{
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 1.25rem',
      height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>💪</span>
        <span style={{ color: C.textPrimary, fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
      <button onClick={onLogout} style={{
        background: 'transparent', border: `1px solid ${C.border}`,
        color: C.textSecondary, padding: '4px 12px', borderRadius: '6px',
        cursor: 'pointer', fontSize: '12px', fontWeight: 500,
      }}>
        Salir
      </button>
    </header>
  )
}

function DesktopNav({ onLogout }) {
  return (
    <nav style={{
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 2rem',
      height: '56px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>💪</span>
        <span style={{ color: C.textPrimary, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
          NutriGym <span style={{ color: C.accentText }}>Tracker</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        {LINKS.map(({ path, label }) => (
          <NavLink key={path} to={path} end={path === '/'}
            style={({ isActive }) => ({
              color: isActive ? C.accentText : C.textSecondary,
              textDecoration: 'none', fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 400,
              padding: '6px 14px', borderRadius: '6px',
              background: isActive ? C.accentDim : 'transparent',
              transition: 'all 0.15s',
            })}>
            {label}
          </NavLink>
        ))}
        <button onClick={onLogout} style={{
          marginLeft: '0.75rem',
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.textSecondary, padding: '5px 14px', borderRadius: '6px',
          cursor: 'pointer', fontSize: '0.85rem',
        }}>
          Salir
        </button>
      </div>
    </nav>
  )
}

// ── Login / Registro ───────────────────────────────────────────────
function AuthScreen({ }) {
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

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
    outline: 'none', transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💪</div>
          <h1 style={{ color: C.textPrimary, margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            NutriGym<span style={{ color: C.accentText }}> Tracker</span>
          </h1>
          <p style={{ color: C.textSecondary, margin: '6px 0 0', fontSize: '0.9rem' }}>
            Tu seguimiento de nutrición y entrenamiento
          </p>
        </div>

        {/* Toggle */}
        <div style={{
          display: 'flex', background: C.surface, borderRadius: '10px',
          padding: '4px', marginBottom: '1.5rem', border: `1px solid ${C.border}`,
        }}>
          {[['login', 'Ingresar'], ['registro', 'Crear cuenta']].map(([m, label]) => (
            <button key={m} onClick={() => cambiarModo(m)} style={{
              flex: 1, padding: '9px', border: 'none', borderRadius: '7px', cursor: 'pointer',
              background: modo === m ? C.accent : 'transparent',
              color: modo === m ? '#fff' : C.textSecondary,
              fontWeight: modo === m ? 700 : 400, fontSize: '0.9rem',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
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

        <form onSubmit={modo === 'login' ? handleLogin : handleRegistro}>
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
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: modo === 'login' ? C.accent : '#1A5276',
              color: 'white', border: 'none', borderRadius: '10px',
              cursor: loading ? 'wait' : 'pointer', fontSize: '1rem', fontWeight: 700,
              marginTop: '4px', letterSpacing: '-0.01em',
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
            }}>
              {loading ? 'Cargando...' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </div>
        </form>
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
      {isMobile ? <TopBar onLogout={onLogout} /> : <DesktopNav onLogout={onLogout} />}

      <main style={{
        padding: isMobile ? '1rem 1rem calc(1rem + 64px)' : '1.5rem 2rem',
        maxWidth: isMobile ? '100%' : '1100px',
        margin: '0 auto',
      }}>
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/plan" element={<PlanSemanal session={session} />} />
          <Route path="/viandas" element={<Viandas session={session} />} />
          <Route path="/gimnasio" element={<Gimnasio session={session} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {isMobile && <BottomNav onLogout={onLogout} />}
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_e, session) => setSession(session))
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!session) return <AuthScreen />

  return (
    <BrowserRouter>
      <AppLayout session={session} onLogout={handleLogout} />
    </BrowserRouter>
  )
}

export default App
