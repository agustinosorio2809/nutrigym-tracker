import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './pages/Dashboard'
import PlanSemanal from './pages/PlanSemanal'
import Viandas from './pages/Viandas'
import Gimnasio from './pages/Gimnasio'

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
      <form>
        <div style={{ marginBottom: '1rem' }}>
          <label>Email</label><br />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Contraseña</label><br />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </div>
        <button onClick={handleLogin} disabled={loading}>
          {loading ? 'Cargando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )

  return (
    <BrowserRouter>
      <div style={{ fontFamily: 'sans-serif', minHeight: '100vh' }}>
        <nav style={{ background: '#1A5276', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>NutriGym Tracker</span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {[['/', 'Dashboard'], ['/plan', 'Plan semanal'], ['/viandas', 'Viandas'], ['/gimnasio', 'Gimnasio']].map(([path, label]) => (
              <NavLink key={path} to={path} end style={({ isActive }) => ({
                color: isActive ? '#A9CCE3' : 'white', textDecoration: 'none', fontSize: '0.9rem'
              })}>{label}</NavLink>
            ))}
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '0.25rem 0.75rem', cursor: 'pointer', borderRadius: '4px' }}>
            Salir
          </button>
        </nav>
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