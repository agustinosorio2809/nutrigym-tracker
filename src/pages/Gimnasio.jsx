import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const RUTINAS = ['Pecho + Tríceps + Core', 'Espalda + Bíceps + Core', 'Hombros + Espalda + Core + Piernas', 'Partido Futsal', 'Cardio', 'Otra']

const C = {
  bg: '#0F1117', surface: '#1A1D27', surfaceHigh: '#22263A',
  border: '#2A2D3E', accent: '#10B981', accentDim: '#10B98118',
  accentText: '#34D399', blue: '#3B82F6', blueDim: '#3B82F618',
  red: '#EF4444', redDim: '#EF444418', yellow: '#F59E0B',
  textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#4B5563',
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
    await cargarHoy(); await cargarHistorial(); setSaving(false)
  }

  async function cargarPlantilla() {
    if (!sesionHoy) { alert('Primero creá la sesión.'); return }
    if (ejercicios.length > 0 && !confirm('¿Reemplazar ejercicios con la plantilla?')) return
    setCargandoPlantilla(true)
    const { data: plantilla } = await supabase.from('routine_templates').select('*').eq('user_id', session.user.id).eq('routine_type', formSesion.routine_type).order('sort_order')
    if (!plantilla?.length) { alert('No hay plantilla para este tipo de rutina.'); setCargandoPlantilla(false); return }
    if (ejercicios.length > 0) await supabase.from('gym_exercises').delete().eq('log_id', sesionHoy.id)
    await supabase.from('gym_exercises').insert(plantilla.map(p => ({ log_id: sesionHoy.id, exercise_name: p.exercise_name, sets: p.default_sets, reps: p.default_reps, weight_kg: p.default_weight_kg, rir: null, notes: '' })))
    await cargarHoy(); setCargandoPlantilla(false)
  }

  async function limpiarEjercicios() {
    if (!ejercicios.length) { alert('No hay ejercicios para eliminar.'); return }
    if (!confirm(`¿Eliminar los ${ejercicios.length} ejercicios de la sesión de hoy?`)) return
    await supabase.from('gym_exercises').delete().eq('log_id', sesionHoy.id)
    await cargarHoy()
  }

  async function guardarEjercicio() {
    setSaving(true)
    const datos = { ...formEj, sets: Number(formEj.sets) || null, reps: Number(formEj.reps) || null, weight_kg: Number(formEj.weight_kg) || null, rir: Number(formEj.rir) || null, log_id: sesionHoy.id }
    if (modalEj === 'nuevo') { await supabase.from('gym_exercises').insert(datos) }
    else { await supabase.from('gym_exercises').update(datos).eq('id', modalEj.id) }
    await cargarHoy(); await cargarHistorial(); setSaving(false); setModalEj(null)
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

  const inp = {
    display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 14px',
    border: `1px solid ${C.border}`, borderRadius: '8px', boxSizing: 'border-box',
    background: C.surfaceHigh, color: C.textPrimary, fontSize: '14px', outline: 'none',
  }

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setVista(key)} style={{
      padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      background: vista === key ? C.accent : C.surface,
      color: vista === key ? '#fff' : C.textSecondary,
      fontWeight: vista === key ? 700 : 400, fontSize: '14px', transition: 'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ color: C.textPrimary }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        {tabBtn('hoy', 'Hoy')}
        {tabBtn('historial', 'Historial')}
      </div>

      {/* ══ HOY ══ */}
      {vista === 'hoy' && (
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '1rem' }}>Entrenamiento de hoy</div>

          {/* Card sesión */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo de rutina</div>
            <select value={formSesion.routine_type} onChange={e => setFormSesion({ ...formSesion, routine_type: e.target.value })}
              style={{ ...inp, margin: '0 0 12px', background: C.surfaceHigh }}>
              <option value="">— seleccioná —</option>
              {RUTINAS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <div onClick={() => setFormSesion({ ...formSesion, completed: !formSesion.completed })}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer',
                    background: formSesion.completed ? C.accent : C.border, transition: 'background 0.2s',
                  }}>
                  <div style={{
                    position: 'absolute', top: '3px', left: formSesion.completed ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <span style={{ fontSize: '13px', color: C.textSecondary }}>Sesión completada</span>
              </label>
              <button onClick={guardarSesion} disabled={saving} style={{
                background: C.accent, color: 'white', border: 'none',
                padding: '9px 20px', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, fontSize: '14px', opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'Guardando...' : sesionHoy ? 'Actualizar' : 'Crear sesión'}
              </button>
            </div>
          </div>

          {/* Ejercicios */}
          {sesionHoy && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>
                  Ejercicios <span style={{ color: C.textMuted, fontWeight: 400 }}>({ejercicios.length})</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {formSesion.routine_type && (
                    <button onClick={cargarPlantilla} disabled={cargandoPlantilla} style={{
                      background: C.blueDim, color: C.blue, border: `1px solid ${C.blue}40`,
                      padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    }}>
                      {cargandoPlantilla ? 'Cargando...' : '📋 Plantilla'}
                    </button>
                  )}
                  {ejercicios.length > 0 && (
                    <button onClick={limpiarEjercicios} style={{
                      background: '#EF444415', color: C.red, border: `1px solid ${C.red}40`,
                      padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                    }}>🗑 Limpiar</button>
                  )}
                  <button onClick={abrirNuevoEj} style={{
                    background: C.accent, color: 'white', border: 'none',
                    padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                  }}>+ Agregar</button>
                </div>
              </div>

              {ejercicios.length === 0 ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💪</div>
                  <div style={{ color: C.textMuted, fontSize: '14px' }}>
                    Sin ejercicios.{formSesion.routine_type && ' Tocá Plantilla para cargar los ejercicios.'}
                  </div>
                </div>
              ) : isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ejercicios.map(ej => (
                    <div key={ej.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{ej.exercise_name}</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => abrirEditarEj(ej)} style={{ fontSize: '12px', border: `1px solid ${C.border}`, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: C.textSecondary }}>Editar</button>
                          <button onClick={() => eliminarEjercicio(ej.id)} style={{ fontSize: '12px', border: `1px solid ${C.red}40`, color: C.red, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {ej.sets && <Pill label="Series" value={ej.sets} />}
                        {ej.reps && <Pill label="Reps" value={ej.reps} />}
                        {ej.weight_kg && <Pill label="Kg" value={ej.weight_kg} accent />}
                        {ej.rir != null && ej.rir !== '' && <Pill label="RIR" value={ej.rir} />}
                      </div>
                      {ej.notes && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '8px', fontStyle: 'italic' }}>{ej.notes}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Ejercicio', 'Series', 'Reps', 'Kg', 'RIR', 'Notas', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ejercicios.map((ej, i) => (
                        <tr key={ej.id} style={{ borderBottom: i < ejercicios.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: C.textPrimary }}>{ej.exercise_name}</td>
                          <td style={{ padding: '12px 14px', color: C.textSecondary }}>{ej.sets || '—'}</td>
                          <td style={{ padding: '12px 14px', color: C.textSecondary }}>{ej.reps || '—'}</td>
                          <td style={{ padding: '12px 14px', color: C.accentText, fontWeight: 600 }}>{ej.weight_kg ? `${ej.weight_kg} kg` : '—'}</td>
                          <td style={{ padding: '12px 14px', color: C.textSecondary }}>{ej.rir ?? '—'}</td>
                          <td style={{ padding: '12px 14px', color: C.textMuted, fontSize: '12px' }}>{ej.notes || ''}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => abrirEditarEj(ej)} style={{ fontSize: '12px', border: `1px solid ${C.border}`, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: C.textSecondary }}>Editar</button>
                              <button onClick={() => eliminarEjercicio(ej.id)} style={{ fontSize: '12px', border: `1px solid ${C.red}40`, color: C.red, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ HISTORIAL ══ */}
      {vista === 'historial' && (
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '1rem' }}>Historial</div>
          {sesiones.length === 0 ? (
            <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>Sin entrenamientos registrados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sesiones.map(s => (
                <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: C.textPrimary }}>
                        {new Date(s.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                      {s.routine_type && (
                        <div style={{ fontSize: '12px', color: C.accentText, marginTop: '2px' }}>{s.routine_type}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                      background: s.completed ? C.accentDim : C.surfaceHigh,
                      color: s.completed ? C.accentText : C.textMuted,
                      border: `1px solid ${s.completed ? C.accent + '40' : C.border}`,
                    }}>
                      {s.completed ? '✓ Completado' : 'Incompleto'}
                    </span>
                  </div>
                  {s.gym_exercises?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {s.gym_exercises.map(ej => (
                        <span key={ej.id} style={{ fontSize: '12px', background: C.surfaceHigh, color: C.textSecondary, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${C.border}` }}>
                          {ej.exercise_name}{ej.weight_kg ? ` · ${ej.weight_kg}kg` : ''}
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

      {/* ══ MODAL EJERCICIO ══ */}
      {modalEj && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ width: '40px', height: '4px', background: C.border, borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.textPrimary, marginBottom: '1.25rem' }}>
              {modalEj === 'nuevo' ? 'Agregar ejercicio' : 'Editar ejercicio'}
            </div>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Ejercicio</label>
            <input value={formEj.exercise_name} onChange={e => setFormEj({ ...formEj, exercise_name: e.target.value })} style={inp} placeholder="Ej: Sentadilla con barra" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[['sets', 'Series', '4'], ['reps', 'Reps', '8'], ['weight_kg', 'Peso (kg)', '80'], ['rir', 'RIR', '2']].map(([key, label, ph]) => (
                <div key={key}>
                  <label style={{ fontSize: '12px', color: C.textMuted }}>{label}</label>
                  <input type="number" value={formEj[key]} onChange={e => setFormEj({ ...formEj, [key]: e.target.value })}
                    style={inp} placeholder={ph} />
                </div>
              ))}
            </div>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Observaciones</label>
            <textarea value={formEj.notes} onChange={e => setFormEj({ ...formEj, notes: e.target.value })} style={{ ...inp, height: '60px', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={guardarEjercicio} disabled={saving || !formEj.exercise_name} style={{
                flex: 1, background: C.accent, color: 'white', border: 'none',
                padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px',
                opacity: saving || !formEj.exercise_name ? 0.5 : 1,
              }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModalEj(null)} style={{
                padding: '13px 20px', border: `1px solid ${C.border}`, borderRadius: '10px',
                cursor: 'pointer', background: 'transparent', color: C.textSecondary, fontSize: '15px',
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Pill({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: accent ? '#10B98118' : '#22263A', borderRadius: '8px', padding: '4px 12px', minWidth: '44px' }}>
      <span style={{ fontSize: '14px', fontWeight: 700, color: accent ? '#34D399' : '#F1F5F9' }}>{value}</span>
      <span style={{ fontSize: '10px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}
