import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './pages/Dashboard'
import PlanSemanal from './pages/PlanSemanal'
import Viandas from './pages/Viandas'
import Gimnasio from './pages/Gimnasio'

const LINKS = [
  ['/', 'Dashboard'],
  ['/plan', 'Plan semanal'],
  ['/viandas', 'Viandas'],
  ['/gimnasio', 'Gimnasio'],
]

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

function Navbar({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  const menuRef = useRef(null)
  const location = useLocation()

  // Cerrar menú al cambiar de ruta
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <nav ref={menuRef} style={{ background: '#1A5276', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 100 }}>
      <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>NutriGym Tracker</span>

      {isMobile ? (
        /* ── MOBILE: hamburger ── */
        <>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', flexDirection: 'column', gap: '5px' }}
            aria-label="Menú"
          >
            {/* 3 líneas del hamburger, se transforman en X cuando está abierto */}
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'block', width: '22px', height: '2px', background: 'white', borderRadius: '2px',
                transition: 'transform 0.2s, opacity 0.2s',
                transform: menuOpen
                  ? i === 0 ? 'translateY(7px) rotate(45deg)'
                  : i === 1 ? 'scaleX(0)'
                  : 'translateY(-7px) rotate(-45deg)'
                  : 'none',
                opacity: menuOpen && i === 1 ? 0 : 1
              }} />
            ))}
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#154360', display: 'flex', flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              {LINKS.map(([path, label]) => (
                <NavLink key={path} to={path} end style={({ isActive }) => ({
                  color: isActive ? '#A9CCE3' : 'white',
                  textDecoration: 'none',
                  padding: '0.9rem 1.5rem',
                  fontSize: '1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? 'rgba(169,204,227,0.1)' : 'transparent'
                })}>
                  {label}
                </NavLink>
              ))}
              <button onClick={onLogout} style={{
                background: 'transparent', border: 'none', color: '#A9CCE3',
                padding: '0.9rem 1.5rem', textAlign: 'left', cursor: 'pointer',
                fontSize: '1rem', borderTop: '1px solid rgba(255,255,255,0.15)'
              }}>
                Salir
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── DESKTOP: links horizontales ── */
        <>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {LINKS.map(([path, label]) => (
              <NavLink key={path} to={path} end style={({ isActive }) => ({
                color: isActive ? '#A9CCE3' : 'white', textDecoration: 'none', fontSize: '0.9rem'
              })}>
                {label}
              </NavLink>
            ))}
          </div>
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '0.25rem 0.75rem', cursor: 'pointer', borderRadius: '4px' }}>
            Salir
          </button>
        </>
      )}
    </nav>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_e, session) => setSession(session))
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!session) return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto' }}>
      <h1>NutriGym Tracker</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Email</label><br />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Contraseña</label><br />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', boxSizing: 'border-box' }} />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Cargando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )

  return (
    <BrowserRouter>
      <div style={{ fontFamily: 'sans-serif', minHeight: '100vh' }}>
        <Navbar onLogout={handleLogout} />
        <main style={{ padding: '1.5rem' }}>
          <Routes>
            <Route path="/" element={<Dashboard session={session} />} />
            <Route path="/plan" element={<PlanSemanal session={session} />} />
            <Route path="/viandas" element={<Viandas session={session} />} />
            <Route path="/gimnasio" element={<Gimnasio session={session} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App