import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const RUTINAS = ['Tren Inferior + Core', 'Full Body Funcional', 'Tren Superior + Core', 'Intermitente Fútbol', 'Recuperación Activa', 'Partido Futsal', 'Otra']

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export default function Gimnasio({ session }) {
  const [sesiones, setSesiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('hoy')
  const [sesionHoy, setSesionHoy] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [formSesion, setFormSesion] = useState({ routine_type: '', notes: '', completed: false })
  const [formEj, setFormEj] = useState({ exercise_name: '', sets: '', reps: '', weight_kg: '', rir: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [modalEj, setModalEj] = useState(null)
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false)
  const isMobile = useIsMobile()

  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => { cargarHoy(); cargarHistorial() }, [])

  async function cargarHoy() {
    const { data: s } = await supabase.from('gym_logs').select('*').eq('user_id', session.user.id).eq('date', hoy)
    const sesion = s?.[0] || null
    setSesionHoy(sesion)
    setFormSesion({ routine_type: sesion?.routine_type || '', notes: sesion?.notes || '', completed: sesion?.completed || false })
    if (sesion) {
      const { data: ejs } = await supabase.from('gym_exercises').select('*').eq('log_id', sesion.id).order('id')
      setEjercicios(ejs || [])
    }
    setLoading(false)
  }

  async function cargarHistorial() {
    const { data } = await supabase.from('gym_logs').select('*, gym_exercises(*)').eq('user_id', session.user.id).order('date', { ascending: false }).limit(20)
    setSesiones(data || [])
  }

  async function guardarSesion() {
    setSaving(true)
    if (sesionHoy) {
      await supabase.from('gym_logs').update({ ...formSesion }).eq('id', sesionHoy.id)
    } else {
      const { data } = await supabase.from('gym_logs').insert({ ...formSesion, user_id: session.user.id, date: hoy }).select()
      setSesionHoy(data?.[0])
    }
    await cargarHoy()
    await cargarHistorial()
    setSaving(false)
  }

  async function cargarPlantilla() {
    if (!sesionHoy) { alert('Primero creá la sesión.'); return }
    if (ejercicios.length > 0 && !confirm('Ya tenés ejercicios cargados. ¿Reemplazarlos con la plantilla?')) return
    setCargandoPlantilla(true)
    const { data: plantilla } = await supabase.from('routine_templates').select('*')
      .eq('user_id', session.user.id).eq('routine_type', formSesion.routine_type).order('sort_order')
    if (!plantilla?.length) { alert('No hay plantilla para este tipo de rutina.'); setCargandoPlantilla(false); return }
    if (ejercicios.length > 0) await supabase.from('gym_exercises').delete().eq('log_id', sesionHoy.id)
    const nuevos = plantilla.map(p => ({
      log_id: sesionHoy.id, exercise_name: p.exercise_name,
      sets: p.default_sets, reps: p.default_reps, weight_kg: p.default_weight_kg, rir: null, notes: ''
    }))
    await supabase.from('gym_exercises').insert(nuevos)
    await cargarHoy()
    setCargandoPlantilla(false)
  }

  async function guardarEjercicio() {
    setSaving(true)
    const datos = {
      ...formEj,
      sets: Number(formEj.sets) || null, reps: Number(formEj.reps) || null,
      weight_kg: Number(formEj.weight_kg) || null, rir: Number(formEj.rir) || null,
      log_id: sesionHoy.id
    }
    if (modalEj === 'nuevo') {
      await supabase.from('gym_exercises').insert(datos)
    } else {
      await supabase.from('gym_exercises').update(datos).eq('id', modalEj.id)
    }
    await cargarHoy(); await cargarHistorial()
    setSaving(false); setModalEj(null)
  }

  async function eliminarEjercicio(id) {
    if (!confirm('¿Eliminar ejercicio?')) return
    await supabase.from('gym_exercises').delete().eq('id', id)
    await cargarHoy()
  }

  function abrirNuevoEj() {
    setFormEj({ exercise_name: '', sets: '', reps: '', weight_kg: '', rir: '', notes: '' })
    setModalEj('nuevo')
  }

  function abrirEditarEj(ej) {
    setFormEj({ exercise_name: ej.exercise_name, sets: ej.sets || '', reps: ej.reps || '', weight_kg: ej.weight_kg || '', rir: ej.rir || '', notes: ej.notes || '' })
    setModalEj(ej)
  }

  const inp = { display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }

  // ── Tabla desktop ──
  const tablaEjercicios = (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
      <thead>
        <tr style={{ background: '#1A5276', color: 'white' }}>
          {['Ejercicio', 'Series', 'Reps', 'Kg', 'RIR', 'Notas', ''].map(h => (
            <th key={h} style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 500 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ejercicios.map((ej, i) => (
          <tr key={ej.id} style={{ background: i % 2 === 0 ? '#f9f9f9' : 'white' }}>
            <td style={{ padding: '0.5rem', fontWeight: 500 }}>{ej.exercise_name}</td>
            <td style={{ padding: '0.5rem' }}>{ej.sets || '—'}</td>
            <td style={{ padding: '0.5rem' }}>{ej.reps || '—'}</td>
            <td style={{ padding: '0.5rem' }}>{ej.weight_kg || '—'}</td>
            <td style={{ padding: '0.5rem' }}>{ej.rir ?? '—'}</td>
            <td style={{ padding: '0.5rem', color: '#666', fontSize: '0.8rem' }}>{ej.notes || ''}</td>
            <td style={{ padding: '0.5rem' }}>
              <button onClick={() => abrirEditarEj(ej)} style={{ fontSize: '0.75rem', marginRight: '0.25rem', border: '1px solid #ccc', padding: '0.15rem 0.5rem', borderRadius: '3px', cursor: 'pointer' }}>Editar</button>
              <button onClick={() => eliminarEjercicio(ej.id)} style={{ fontSize: '0.75rem', border: '1px solid #C0392B', color: '#C0392B', padding: '0.15rem 0.5rem', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}>✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  // ── Cards mobile ──
  const cardsEjercicios = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {ejercicios.map(ej => (
        <div key={ej.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '0.75rem 1rem', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{ej.exercise_name}</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => abrirEditarEj(ej)} style={{ fontSize: '0.75rem', border: '1px solid #ccc', padding: '0.15rem 0.5rem', borderRadius: '3px', cursor: 'pointer' }}>Editar</button>
              <button onClick={() => eliminarEjercicio(ej.id)} style={{ fontSize: '0.75rem', border: '1px solid #C0392B', color: '#C0392B', padding: '0.15rem 0.5rem', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#444' }}>
            {ej.sets && <span><strong>{ej.sets}</strong> series</span>}
            {ej.reps && <span><strong>{ej.reps}</strong> reps</span>}
            {ej.weight_kg && <span><strong>{ej.weight_kg}</strong> kg</span>}
            {ej.rir != null && ej.rir !== '' && <span>RIR <strong>{ej.rir}</strong></span>}
          </div>
          {ej.notes && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.4rem', fontStyle: 'italic' }}>{ej.notes}</div>}
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {/* Tabs Hoy / Historial */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setVista('hoy')} style={{ padding: '0.4rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: vista === 'hoy' ? '#1A5276' : '#eee', color: vista === 'hoy' ? 'white' : '#333' }}>Hoy</button>
        <button onClick={() => setVista('historial')} style={{ padding: '0.4rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: vista === 'historial' ? '#1A5276' : '#eee', color: vista === 'historial' ? 'white' : '#333' }}>Historial</button>
      </div>

      {vista === 'hoy' && (
        <div>
          <h2 style={{ marginTop: 0 }}>Entrenamiento de hoy</h2>

          {/* Controles de sesión */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.85rem' }}>Tipo de rutina</label>
              <select value={formSesion.routine_type} onChange={e => setFormSesion({ ...formSesion, routine_type: e.target.value })}
                style={{ display: 'block', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', marginTop: '0.25rem', width: isMobile ? '100%' : 'auto' }}>
                <option value="">— seleccioná —</option>
                {RUTINAS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={formSesion.completed} onChange={e => setFormSesion({ ...formSesion, completed: e.target.checked })} />
              Sesión completada
            </label>
            <button onClick={guardarSesion} disabled={saving}
              style={{ background: '#148F77', color: 'white', border: 'none', padding: '0.45rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
              {saving ? 'Guardando...' : sesionHoy ? 'Actualizar' : 'Crear sesión'}
            </button>
          </div>

          {sesionHoy && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>Ejercicios ({ejercicios.length})</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {formSesion.routine_type && (
                    <button onClick={cargarPlantilla} disabled={cargandoPlantilla}
                      style={{ background: '#D6EAF8', color: '#1A5276', border: '1px solid #AED6F1', padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      {cargandoPlantilla ? 'Cargando...' : '📋 Cargar plantilla'}
                    </button>
                  )}
                  <button onClick={abrirNuevoEj}
                    style={{ background: '#1A5276', color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer' }}>
                    + Agregar
                  </button>
                </div>
              </div>

              {ejercicios.length === 0 ? (
                <p style={{ color: '#888' }}>
                  Sin ejercicios todavía.
                  {formSesion.routine_type && <span> Tocá <strong>Cargar plantilla</strong> para pre-cargar los ejercicios de {formSesion.routine_type}.</span>}
                </p>
              ) : (
                isMobile ? cardsEjercicios : tablaEjercicios
              )}
            </div>
          )}
        </div>
      )}

      {vista === 'historial' && (
        <div>
          <h2 style={{ marginTop: 0 }}>Historial de entrenamientos</h2>
          {sesiones.length === 0 ? <p style={{ color: '#888' }}>Sin entrenamientos registrados.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sesiones.map(s => (
                <div key={s.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div>
                      <strong>{new Date(s.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                      {s.routine_type && <span style={{ marginLeft: '0.75rem', background: '#D6EAF8', color: '#1A5276', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>{s.routine_type}</span>}
                    </div>
                    <span style={{ color: s.completed ? '#148F77' : '#888', fontSize: '0.85rem' }}>{s.completed ? '✓ Completado' : 'No completado'}</span>
                  </div>
                  {s.gym_exercises?.length > 0 && (
                    <div style={{ fontSize: '0.85rem', color: '#555' }}>
                      {s.gym_exercises.map(ej => (
                        <span key={ej.id} style={{ display: 'inline-block', margin: '0.15rem 0.3rem 0.15rem 0', background: '#f0f0f0', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          {ej.exercise_name} {ej.weight_kg ? `${ej.weight_kg}kg` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal ejercicio */}
      {modalEj && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{modalEj === 'nuevo' ? 'Agregar ejercicio' : 'Editar ejercicio'}</h3>
            <label>Ejercicio</label>
            <input value={formEj.exercise_name} onChange={e => setFormEj({ ...formEj, exercise_name: e.target.value })} style={inp} placeholder="Ej: Sentadilla con barra" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label>Series</label>
                <input type="number" value={formEj.sets} onChange={e => setFormEj({ ...formEj, sets: e.target.value })} style={inp} placeholder="4" />
              </div>
              <div>
                <label>Reps</label>
                <input type="number" value={formEj.reps} onChange={e => setFormEj({ ...formEj, reps: e.target.value })} style={inp} placeholder="8" />
              </div>
              <div>
                <label>Peso (kg)</label>
                <input type="number" value={formEj.weight_kg} onChange={e => setFormEj({ ...formEj, weight_kg: e.target.value })} style={inp} placeholder="80" />
              </div>
              <div>
                <label>RIR</label>
                <input type="number" min="0" max="4" value={formEj.rir} onChange={e => setFormEj({ ...formEj, rir: e.target.value })} style={inp} placeholder="2" />
              </div>
            </div>
            <label>Observaciones</label>
            <textarea value={formEj.notes} onChange={e => setFormEj({ ...formEj, notes: e.target.value })} style={{ ...inp, height: '55px', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={guardarEjercicio} disabled={saving || !formEj.exercise_name}
                style={{ background: '#1A5276', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModalEj(null)}
                style={{ border: '1px solid #ccc', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}