import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { C } from '../theme'
import { IconPlan, IconTrash, IconGym, IconCheck, IconClose, IconTrophy } from '../components/icons'
import { useInteractiveStyle, focusRing } from '../hooks/useInteractiveStyle'
import { mejorSerie, pesoMaximo, detectarPR, normalizarNombre } from '../services/oneRepMax'

const RUTINAS = ['Pecho + Tríceps + Core', 'Espalda + Bíceps + Core', 'Hombros + Espalda + Core + Piernas', 'Partido Futsal', 'Cardio', 'Otra']
const SERIE_VACIA = { weight_kg: '', reps: '', rir: '' }

function formatoSerie(s) {
  const base = `${s.weight_kg ?? '—'}kg × ${s.reps ?? '—'}`
  return s.rir != null ? `${base} · RIR ${s.rir}` : base
}

// "4 series · mejor 85 × 5" — null si el ejercicio no tiene series cargadas.
function resumenSeries(series) {
  if (!series?.length) return null
  const mejor = mejorSerie(series)
  const cantidad = `${series.length} serie${series.length !== 1 ? 's' : ''}`
  if (!mejor) return cantidad
  const { weight_kg, reps } = mejor.serie
  return `${cantidad} · mejor ${weight_kg} × ${reps}`
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

function TabButton({ active, onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    {
      padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      background: active ? C.accent : C.surface,
      color: active ? '#fff' : C.textSecondary,
      fontWeight: active ? 700 : 400, fontSize: '14px',
    },
    { hover: active ? null : { background: C.surfaceHigh, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

export default function Gimnasio({ session }) {
  const [sesiones, setSesiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('hoy')
  const [sesionHoy, setSesionHoy] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [formSesion, setFormSesion] = useState({ routine_type: '', notes: '', completed: false })
  const [formEj, setFormEj] = useState({ exercise_name: '', notes: '', series: [{ ...SERIE_VACIA }] })
  const [saving, setSaving] = useState(false)
  const [modalEj, setModalEj] = useState(null)
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false)
  const [historicoPR, setHistoricoPR] = useState({})
  const isMobile = useIsMobile()

  const hoy = new Date().toLocaleDateString('sv-SE')

  useEffect(() => { cargarHoy(); cargarHistorial(); cargarHistoricoPR() }, [])

  // Mejor 1RM histórico por ejercicio (nombre normalizado → { serie, unaRM }),
  // excluyendo la sesión de hoy: si no, el récord de hoy se compararía consigo mismo.
  async function cargarHistoricoPR() {
    const { data } = await supabase
      .from('gym_exercises')
      .select('exercise_name, gym_sets(weight_kg, reps), gym_logs!inner(user_id, date)')
      .eq('gym_logs.user_id', session.user.id)
      .neq('gym_logs.date', hoy)

    const mapa = {}
    for (const ej of data || []) {
      const clave = normalizarNombre(ej.exercise_name)
      const mejor = mejorSerie(ej.gym_sets || [])
      if (!mejor) continue
      if (!mapa[clave] || mejor.unaRM > mapa[clave].unaRM) mapa[clave] = mejor
    }
    setHistoricoPR(mapa)
  }

  // Compara el mejor 1RM de hoy para este ejercicio contra el histórico previo.
  function prDe(ej) {
    return detectarPR(mejorSerie(ej.gym_sets || []), historicoPR[normalizarNombre(ej.exercise_name)])
  }

  async function cargarHoy() {
    const { data: s } = await supabase.from('gym_logs').select('*').eq('user_id', session.user.id).eq('date', hoy)
    const sesion = s?.[0] || null
    setSesionHoy(sesion)
    setFormSesion({ routine_type: sesion?.routine_type || '', notes: sesion?.notes || '', completed: sesion?.completed || false })
    if (sesion) {
      const { data: ejs } = await supabase
        .from('gym_exercises')
        .select('*, gym_sets(*)')
        .eq('log_id', sesion.id)
        .order('id')
        .order('set_number', { referencedTable: 'gym_sets' })
      setEjercicios(ejs || [])
    }
    setLoading(false)
  }

  async function cargarHistorial() {
    const { data } = await supabase
      .from('gym_logs')
      .select('*, gym_exercises(*, gym_sets(*))')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .limit(20)
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
    // El borrado de gym_exercises arrastra sus series por el ON DELETE CASCADE.
    if (ejercicios.length > 0) await supabase.from('gym_exercises').delete().eq('log_id', sesionHoy.id)

    const { data: creados, error: errorCreados } = await supabase
      .from('gym_exercises')
      .insert(plantilla.map(p => ({
        log_id: sesionHoy.id,
        exercise_name: p.exercise_name,
        notes: '',
      })))
      .select()
    if (errorCreados) { alert('No se pudo cargar la plantilla. Reintentá.'); setCargandoPlantilla(false); return }

    // default_sets de la plantilla define cuántas series se siembran.
    const filas = []
    creados?.forEach((ej, i) => {
      const p = plantilla[i]
      const cantidad = Math.max(p.default_sets || 1, 1)
      for (let n = 1; n <= cantidad; n++) {
        filas.push({
          exercise_id: ej.id,
          set_number: n,
          weight_kg: p.default_weight_kg ?? null,
          reps: p.default_reps ?? null,
          rir: null,
        })
      }
    })
    if (filas.length) {
      const { error: errorSets } = await supabase.from('gym_sets').insert(filas)
      if (errorSets) { alert('No se pudieron cargar las series de la plantilla. Reintentá.'); setCargandoPlantilla(false); return }
    }

    await cargarHoy(); await cargarHistoricoPR(); setCargandoPlantilla(false)
  }

  async function limpiarEjercicios() {
    if (!ejercicios.length) { alert('No hay ejercicios para eliminar.'); return }
    if (!confirm(`¿Eliminar los ${ejercicios.length} ejercicios de la sesión de hoy?`)) return
    await supabase.from('gym_exercises').delete().eq('log_id', sesionHoy.id)
    await cargarHoy()
  }

  async function guardarEjercicio() {
    setSaving(true)
    const base = { exercise_name: formEj.exercise_name, notes: formEj.notes, log_id: sesionHoy.id }

    let exerciseId
    if (modalEj === 'nuevo') {
      const { data, error } = await supabase.from('gym_exercises').insert(base).select()
      if (error) { alert('No se pudo guardar el ejercicio. Reintentá.'); setSaving(false); return }
      exerciseId = data?.[0]?.id
    } else {
      exerciseId = modalEj.id
      const { error: errorUpdate } = await supabase.from('gym_exercises').update(base).eq('id', exerciseId)
      if (errorUpdate) { alert('No se pudo guardar el ejercicio. Reintentá.'); setSaving(false); return }
      const { error: errorDelete } = await supabase.from('gym_sets').delete().eq('exercise_id', exerciseId)
      if (errorDelete) { alert('No se pudo guardar el ejercicio. Reintentá.'); setSaving(false); return }
    }

    const filas = formEj.series.map((s, i) => ({
      exercise_id: exerciseId,
      set_number: i + 1,
      weight_kg: s.weight_kg === '' ? null : Number(s.weight_kg),
      reps: s.reps === '' ? null : Number(s.reps),
      // RIR 0 es un valor válido y significativo: comparar contra '' y no usar
      // `Number(x) || null`, que lo convertiría en null.
      rir: s.rir === '' ? null : Number(s.rir),
    }))
    if (filas.length) {
      const { error: errorSets } = await supabase.from('gym_sets').insert(filas)
      if (errorSets) { alert('No se pudo guardar el ejercicio. Reintentá.'); setSaving(false); return }
    }

    await cargarHoy(); await cargarHistorial(); await cargarHistoricoPR(); setSaving(false); setModalEj(null)
  }

  async function eliminarEjercicio(id) {
    if (!confirm('¿Eliminar ejercicio?')) return
    await supabase.from('gym_exercises').delete().eq('id', id)
    await cargarHoy()
  }

  function abrirNuevoEj() {
    setFormEj({ exercise_name: '', notes: '', series: [{ ...SERIE_VACIA }] })
    setModalEj('nuevo')
  }

  function abrirEditarEj(ej) {
    const series = (ej.gym_sets || [])
      .slice()
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({
        weight_kg: s.weight_kg ?? '',
        reps: s.reps ?? '',
        rir: s.rir ?? '',
      }))
    setFormEj({
      exercise_name: ej.exercise_name,
      notes: ej.notes || '',
      series: series.length ? series : [{ ...SERIE_VACIA }],
    })
    setModalEj(ej)
  }

  function actualizarSerie(i, campo, valor) {
    setFormEj(f => ({
      ...f,
      series: f.series.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)),
    }))
  }

  function agregarSerie() {
    setFormEj(f => ({ ...f, series: [...f.series, { ...SERIE_VACIA }] }))
  }

  // Cargar 4 series iguales no puede costar 4 veces el trabajo: es el caso más
  // frecuente y sin esto la carga empeora respecto del formulario anterior.
  function duplicarUltimaSerie() {
    setFormEj(f => ({ ...f, series: [...f.series, { ...f.series[f.series.length - 1] }] }))
  }

  function quitarSerie(i) {
    setFormEj(f => ({ ...f, series: f.series.filter((_, idx) => idx !== i) }))
  }

  const inp = {
    display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 14px',
    border: `1px solid ${C.border}`, borderRadius: '8px', boxSizing: 'border-box',
    background: C.surfaceHigh, color: C.textPrimary, fontSize: '14px', outline: 'none',
  }

  return (
    <div style={{ color: C.textPrimary }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <TabButton active={vista === 'hoy'} onClick={() => setVista('hoy')}>Hoy</TabButton>
        <TabButton active={vista === 'historial'} onClick={() => setVista('historial')}>Historial</TabButton>
      </div>

      {/* ══ HOY ══ */}
      {vista === 'hoy' && (
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '1rem' }}>Entrenamiento de hoy</div>

          {/* Sigue siendo card: es un formulario editable */}
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
                    background: formSesion.completed ? C.accent : C.border, transition: 'background-color 0.2s',
                  }}>
                  <div style={{
                    position: 'absolute', top: '3px', left: formSesion.completed ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <span style={{ fontSize: '13px', color: C.textSecondary }}>Sesión completada</span>
              </label>
              <PrimarySmallButton onClick={guardarSesion} disabled={saving}>
                {saving ? 'Guardando…' : sesionHoy ? 'Actualizar' : 'Crear sesión'}
              </PrimarySmallButton>
            </div>
          </div>

          {sesionHoy && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>
                  Ejercicios <span style={{ color: C.textMuted, fontWeight: 400 }}>({ejercicios.length})</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {formSesion.routine_type && (
                    <ActionButton onClick={cargarPlantilla} disabled={cargandoPlantilla} tone="blue">
                      <IconPlan size={13} />{cargandoPlantilla ? 'Cargando…' : 'Plantilla'}
                    </ActionButton>
                  )}
                  {ejercicios.length > 0 && (
                    <ActionButton onClick={limpiarEjercicios} tone="red"><IconTrash size={13} />Limpiar</ActionButton>
                  )}
                  <PrimarySmallButton onClick={abrirNuevoEj}>+ Agregar</PrimarySmallButton>
                </div>
              </div>

              {ejercicios.length === 0 ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><IconGym size={28} color={C.textMuted} /></div>
                  <div style={{ color: C.textMuted, fontSize: '14px' }}>
                    Sin ejercicios.{formSesion.routine_type && ' Tocá Plantilla para cargar los ejercicios.'}
                  </div>
                </div>
              ) : isMobile ? (
                <div>
                  {ejercicios.map(ej => (
                    <div key={ej.id} style={{ padding: '14px 4px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{ej.exercise_name}</span>
                          {prDe(ej).esPR && <BadgePR mejora={prDe(ej).mejora} />}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <TinyGhostButton onClick={() => abrirEditarEj(ej)}>Editar</TinyGhostButton>
                          <TinyDangerButton onClick={() => eliminarEjercicio(ej.id)}><IconClose size={11} /></TinyDangerButton>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: C.textSecondary }}>{resumenSeries(ej.gym_sets) || 'Sin series'}</span>
                        {mejorSerie(ej.gym_sets || []) && (
                          <Pill label="1RM est." value={`${Math.round(mejorSerie(ej.gym_sets).unaRM)} kg`} accent />
                        )}
                      </div>
                      {ej.gym_sets?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {ej.gym_sets.map(s => (
                            <span key={s.id} style={{ fontSize: '12px', background: C.surfaceHigh, color: C.textSecondary, padding: '3px 10px', borderRadius: '8px', fontVariantNumeric: 'tabular-nums' }}>
                              {formatoSerie(s)}
                            </span>
                          ))}
                        </div>
                      )}
                      {ej.notes && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '8px', fontStyle: 'italic' }}>{ej.notes}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Ejercicio', 'Series', '1RM est.', 'Notas', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ejercicios.map((ej, i) => (
                        <tr key={ej.id} style={{ borderBottom: i < ejercicios.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: C.textPrimary }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{ej.exercise_name}</span>
                              {prDe(ej).esPR && <BadgePR mejora={prDe(ej).mejora} />}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', color: C.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                            {ej.gym_sets?.length > 0 ? ej.gym_sets.map(formatoSerie).join('  ·  ') : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', color: C.accentText, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {mejorSerie(ej.gym_sets || []) ? `${Math.round(mejorSerie(ej.gym_sets).unaRM)} kg` : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', color: C.textMuted, fontSize: '12px' }}>{ej.notes || ''}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <TinyGhostButton onClick={() => abrirEditarEj(ej)}>Editar</TinyGhostButton>
                              <TinyDangerButton onClick={() => eliminarEjercicio(ej.id)}><IconClose size={11} /></TinyDangerButton>
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
            <div>
              {sesiones.map(s => (
                <div key={s.id} style={{ padding: '14px 4px', borderBottom: `1px solid ${C.border}` }}>
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
                      display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                      background: s.completed ? C.accentDim : C.surfaceHigh,
                      color: s.completed ? C.accentText : C.textMuted,
                      border: `1px solid ${s.completed ? C.accent + '40' : C.border}`,
                    }}>
                      {s.completed && <IconCheck size={10} color={C.accentText} />}
                      {s.completed ? 'Completado' : 'Incompleto'}
                    </span>
                  </div>
                  {s.gym_exercises?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {s.gym_exercises.map(ej => {
                        const kg = pesoMaximo(ej.gym_sets || [])
                        return (
                          <span key={ej.id} style={{ fontSize: '12px', background: C.surfaceHigh, color: C.textSecondary, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${C.border}` }}>
                            {ej.exercise_name}{kg ? ` · ${kg}kg` : ''}
                          </span>
                        )
                      })}
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

            <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '6px' }}>Series</div>

            {formEj.series.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr 32px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <input type="number" inputMode="decimal" value={s.weight_kg} placeholder="kg"
                  onChange={e => actualizarSerie(i, 'weight_kg', e.target.value)} style={{ ...inp, margin: 0 }} />
                <input type="number" inputMode="numeric" value={s.reps} placeholder="reps"
                  onChange={e => actualizarSerie(i, 'reps', e.target.value)} style={{ ...inp, margin: 0 }} />
                <input type="number" inputMode="numeric" value={s.rir} placeholder="RIR"
                  onChange={e => actualizarSerie(i, 'rir', e.target.value)} style={{ ...inp, margin: 0 }} />
                {formEj.series.length > 1
                  ? <TinyDangerButton onClick={() => quitarSerie(i)}><IconClose size={11} /></TinyDangerButton>
                  : <span />}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', margin: '4px 0 16px' }}>
              <TinyGhostButton onClick={agregarSerie}>+ Serie</TinyGhostButton>
              <TinyGhostButton onClick={duplicarUltimaSerie}>Duplicar última</TinyGhostButton>
            </div>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Observaciones</label>
            <textarea value={formEj.notes} onChange={e => setFormEj({ ...formEj, notes: e.target.value })} style={{ ...inp, height: '60px', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <ModalPrimaryButton onClick={guardarEjercicio} disabled={saving || !formEj.exercise_name}>{saving ? 'Guardando…' : 'Guardar'}</ModalPrimaryButton>
              <ModalSecondaryButton onClick={() => setModalEj(null)}>Cancelar</ModalSecondaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BadgePR({ mejora }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
      background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}40`,
    }}>
      <IconTrophy size={11} color={C.yellow} />
      PR +{mejora.toFixed(1)} kg
    </span>
  )
}

function Pill({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: accent ? C.accentDim : C.surfaceHigh, borderRadius: '8px', padding: '4px 12px', minWidth: '44px' }}>
      <span style={{ fontSize: '14px', fontWeight: 700, color: accent ? C.accentText : C.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: '10px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}

function PrimarySmallButton({ onClick, disabled, children }) {
  const { style, handlers } = useInteractiveStyle(
    { background: C.accent, color: 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', opacity: disabled ? 0.7 : 1 },
    { hover: disabled ? null : { filter: 'brightness(1.08)' }, focus: focusRing }
  )
  return <button onClick={onClick} disabled={disabled} style={style} {...handlers}>{children}</button>
}

function ActionButton({ onClick, disabled, tone = 'default', children }) {
  const tones = {
    blue: { base: { background: C.blueDim, color: C.blue, border: `1px solid ${C.blue}40` }, hover: { background: C.blue, color: '#fff' } },
    red: { base: { background: '#EF444415', color: C.red, border: `1px solid ${C.red}40` }, hover: { background: C.red, color: '#fff' } },
  }
  const t = tones[tone]
  const { style, handlers } = useInteractiveStyle(
    { ...t.base, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: disabled ? 0.7 : 1 },
    { hover: disabled ? null : t.hover, focus: focusRing }
  )
  return <button onClick={onClick} disabled={disabled} style={style} {...handlers}>{children}</button>
}

function TinyGhostButton({ onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    { fontSize: '12px', border: `1px solid ${C.border}`, padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: C.textSecondary },
    { hover: { borderColor: C.textMuted, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

function TinyDangerButton({ onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    { display: 'flex', alignItems: 'center', fontSize: '12px', border: `1px solid ${C.red}40`, color: C.red, padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', background: 'transparent' },
    { hover: { background: C.red, color: '#fff' }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

function ModalPrimaryButton({ onClick, disabled, children }) {
  const { style, handlers } = useInteractiveStyle(
    { flex: 1, background: C.accent, color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', opacity: disabled ? 0.5 : 1 },
    { hover: disabled ? null : { filter: 'brightness(1.08)' }, focus: focusRing }
  )
  return <button onClick={onClick} disabled={disabled} style={style} {...handlers}>{children}</button>
}
function ModalSecondaryButton({ onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    { padding: '13px 20px', border: `1px solid ${C.border}`, borderRadius: '10px', cursor: 'pointer', background: 'transparent', color: C.textSecondary, fontSize: '15px' },
    { hover: { borderColor: C.textMuted, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}
