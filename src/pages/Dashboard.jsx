import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import * as XLSX from 'xlsx'
import { Link } from 'react-router-dom'

const SLOTS = ['desayuno', 'almuerzo', 'merienda', 'cena']
const ESTADOS = ['cumplida', 'con_cambios', 'no_cumplida', 'omitida']
const ESTADO_LABELS = { cumplida: '✓ Cumplida', con_cambios: '~ Con cambios', no_cumplida: '✗ No cumplida', omitida: '— Omitida' }
const ESTADO_COLORS = { cumplida: '#148F77', con_cambios: '#D4AC0D', no_cumplida: '#C0392B', omitida: '#888' }
const EXCEPCIONES = ['Partido de futsal', 'Cumpleaños / evento social', 'Trabajo / horario extendido', 'Falta de stock o vianda', 'Cansancio', 'Otro']

function getLunes(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatFecha(date) { return date.toISOString().split('T')[0] }

function formatSemana(lunesDate) {
  const domingo = new Date(lunesDate.getTime() + 6 * 86400000)
  return `${lunesDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — ${domingo.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
}

export default function Dashboard({ session }) {
  const [vista, setVista] = useState('hoy')
  const [comidas, setComidas] = useState([])
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ status: '', actual_meal: '', exception_type: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [reporteVista, setReporteVista] = useState('adherencia')
  const [semanaReporte, setSemanaReporte] = useState(getLunes(new Date()))
  const [adherenciaSemanal, setAdherenciaSemanal] = useState(null)
  const [loadingReporte, setLoadingReporte] = useState(false)
  const [excepcionesFrecuentes, setExcepcionesFrecuentes] = useState([])
  const [viandasResumen, setViandasResumen] = useState([])
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState('')
  const [ejerciciosDisponibles, setEjerciciosDisponibles] = useState([])
  const [evolucionCargas, setEvolucionCargas] = useState([])
  const [sesionGymHoy, setSesionGymHoy] = useState(null)

  const hoy = new Date()
  const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
  const lunes = getLunes(hoy)

  useEffect(() => { cargarHoy() }, [])
  useEffect(() => { if (vista === 'reportes') cargarReportes() }, [vista, semanaReporte, reporteVista])
  useEffect(() => { if (reporteVista === 'cargas' && ejercicioSeleccionado) cargarEvolucion() }, [ejercicioSeleccionado])

async function cargarHoy() {
  setLoading(true)
  const fechaHoy = formatFecha(hoy)
  const fechaLunes = formatFecha(lunes)

  // Gym — siempre se carga, independiente del plan
  const { data: gymHoy } = await supabase.from('gym_logs').select('*').eq('user_id', session.user.id).eq('date', fechaHoy)
  setSesionGymHoy(gymHoy?.[0] || null)

  let { data: planes } = await supabase.from('meal_plans').select('*').eq('week_start', fechaLunes)
  const plan = planes?.[0]
  if (!plan) { setLoading(false); return }

  const { data: meals } = await supabase.from('planned_meals').select('*')
    .eq('plan_id', plan.id).eq('day_of_week', diaSemana).order('slot')
  const ordered = SLOTS.map(s => meals?.find(m => m.slot === s)).filter(Boolean)
  setComidas(ordered)

  if (meals?.length) {
    const ids = meals.map(m => m.id)
    const { data: logsData } = await supabase.from('meal_logs').select('*').in('planned_meal_id', ids)
    const mapa = {}
    logsData?.forEach(l => { mapa[l.planned_meal_id] = l })
    setLogs(mapa)
  }

  setLoading(false)
}

  async function cargarReportes() {
    setLoadingReporte(true)
    if (reporteVista === 'adherencia') await cargarAdherencia()
    if (reporteVista === 'excepciones') await cargarExcepciones()
    if (reporteVista === 'viandas') await cargarViandas()
    if (reporteVista === 'cargas') await cargarEjercicios()
    setLoadingReporte(false)
  }

  async function cargarAdherencia() {
    const fecha = formatFecha(semanaReporte)
    const { data: planes } = await supabase.from('meal_plans').select('*').eq('week_start', fecha)
    const plan = planes?.[0]
    if (!plan) { setAdherenciaSemanal(null); return }
    const { data: meals } = await supabase.from('planned_meals').select('*').eq('plan_id', plan.id)
    if (!meals?.length) { setAdherenciaSemanal(null); return }
    const ids = meals.map(m => m.id)
    const { data: logsData } = await supabase.from('meal_logs').select('*').in('planned_meal_id', ids)
    const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const porDia = DIAS.map((nombre, i) => {
      const comidasDia = meals.filter(m => m.day_of_week === i)
      const logsDia = logsData?.filter(l => comidasDia.some(m => m.id === l.planned_meal_id)) || []
      const cumplidas = logsDia.filter(l => l.status === 'cumplida' || l.status === 'con_cambios').length
      return { dia: nombre, cumplidas, total: comidasDia.length, pct: comidasDia.length > 0 ? Math.round((cumplidas / comidasDia.length) * 100) : 0 }
    })
    const totalCumplidas = logsData?.filter(l => l.status === 'cumplida' || l.status === 'con_cambios').length || 0
    const totalComidas = meals.length
    setAdherenciaSemanal({ porDia, totalCumplidas, totalComidas, pct: totalComidas > 0 ? Math.round((totalCumplidas / totalComidas) * 100) : 0 })
  }

  async function cargarExcepciones() {
    const desde = new Date(semanaReporte)
    desde.setDate(desde.getDate() - 21)
    const { data: planes } = await supabase.from('meal_plans').select('*').gte('week_start', formatFecha(desde)).lte('week_start', formatFecha(semanaReporte))
    if (!planes?.length) { setExcepcionesFrecuentes([]); return }
    const ids = planes.map(p => p.id)
    const { data: meals } = await supabase.from('planned_meals').select('*').in('plan_id', ids)
    if (!meals?.length) { setExcepcionesFrecuentes([]); return }
    const mealIds = meals.map(m => m.id)
    const { data: logsData } = await supabase.from('meal_logs').select('*').in('planned_meal_id', mealIds).not('exception_type', 'is', null)
    const conteo = {}
    logsData?.forEach(l => { if (l.exception_type) conteo[l.exception_type] = (conteo[l.exception_type] || 0) + 1 })
    const sorted = Object.entries(conteo).map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad)
    setExcepcionesFrecuentes(sorted)
  }

  async function cargarViandas() {
    const fecha = formatFecha(semanaReporte)
    const { data: planes } = await supabase.from('meal_plans').select('*').eq('week_start', fecha)
    const plan = planes?.[0]
    if (!plan) { setViandasResumen([]); return }
    const { data: meals } = await supabase.from('planned_meals').select('*').eq('plan_id', plan.id).eq('is_vianda', true)
    if (!meals?.length) { setViandasResumen([]); return }
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    const resumen = meals.map(m => ({
      dia: DIAS[m.day_of_week], slot: m.slot, descripcion: m.description
    })).sort((a, b) => {
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      return dias.indexOf(a.dia) - dias.indexOf(b.dia)
    })
    setViandasResumen(resumen)
  }

  async function cargarEjercicios() {
    const { data: todos } = await supabase.from('gym_logs').select('id').eq('user_id', session.user.id)
    if (!todos?.length) { setEjerciciosDisponibles([]); return }
    const logIds = todos.map(l => l.id)
    const { data: ejercicios } = await supabase.from('gym_exercises').select('exercise_name').in('log_id', logIds)
    const unicos = [...new Set(ejercicios?.map(e => e.exercise_name) || [])].sort()
    setEjerciciosDisponibles(unicos)
    if (unicos.length && !ejercicioSeleccionado) setEjercicioSeleccionado(unicos[0])
  }

  async function cargarEvolucion() {
    const { data: gymLogs } = await supabase.from('gym_logs').select('id, date').eq('user_id', session.user.id).order('date')
    if (!gymLogs?.length) { setEvolucionCargas([]); return }
    const logIds = gymLogs.map(l => l.id)
    const { data: ejs } = await supabase.from('gym_exercises').select('*').in('log_id', logIds).eq('exercise_name', ejercicioSeleccionado)
    if (!ejs?.length) { setEvolucionCargas([]); return }
    const evolucion = ejs.map(ej => {
      const sesion = gymLogs.find(l => l.id === ej.log_id)
      return {
        fecha: new Date(sesion.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        kg: ej.weight_kg || 0, series: ej.sets || 0, reps: ej.reps || 0
      }
    }).filter(e => e.kg > 0)
    setEvolucionCargas(evolucion)
  }

  function abrirModal(comida) {
    const log = logs[comida.id]
    setForm({ status: log?.status || '', actual_meal: log?.actual_meal || '', exception_type: log?.exception_type || '', notes: log?.notes || '' })
    setModal(comida)
  }

  async function guardarLog() {
    setSaving(true)
    const log = logs[modal.id]
    if (log) {
      await supabase.from('meal_logs').update(form).eq('id', log.id)
    } else {
      await supabase.from('meal_logs').insert({ ...form, planned_meal_id: modal.id })
    }
    await cargarHoy()
    setSaving(false)
    setModal(null)
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new()

    // Hoja 1: Adherencia
    if (adherenciaSemanal) {
      const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const filas = adherenciaSemanal.porDia.map((d, i) => ({
        Día: DIAS_FULL[i],
        'Comidas planificadas': d.total,
        'Comidas cumplidas': d.cumplidas,
        'Adherencia (%)': d.total > 0 ? d.pct : '—'
      }))
      filas.push({ Día: 'TOTAL', 'Comidas planificadas': adherenciaSemanal.totalComidas, 'Comidas cumplidas': adherenciaSemanal.totalCumplidas, 'Adherencia (%)': adherenciaSemanal.pct })
      const ws1 = XLSX.utils.json_to_sheet(filas)
      ws1['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, ws1, 'Adherencia')
    }

    // Hoja 2: Viandas
    if (viandasResumen.length > 0) {
      const filas = viandasResumen.map(v => ({ Día: v.dia, Slot: v.slot, Descripción: v.descripcion }))
      const ws2 = XLSX.utils.json_to_sheet(filas)
      ws2['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Viandas')
    }

    // Hoja 3: Cargas
    if (evolucionCargas.length > 0) {
      const filas = evolucionCargas.map(e => ({
        Fecha: e.fecha, Ejercicio: ejercicioSeleccionado,
        Series: e.series || '—', Reps: e.reps || '—', 'Peso (kg)': e.kg
      }))
      const ws3 = XLSX.utils.json_to_sheet(filas)
      ws3['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws3, 'Cargas')
    }

    const semanaStr = formatSemana(semanaReporte).replace(' — ', '_')
    XLSX.writeFile(wb, `NutriGym_${semanaStr}.xlsx`)
  }

  const cumplidas = Object.values(logs).filter(l => l.status === 'cumplida' || l.status === 'con_cambios').length
  const total = comidas.length
  const adherencia = total > 0 ? Math.round((cumplidas / total) * 100) : 0

  const tabStyle = (activo) => ({
    padding: '0.5rem 1.25rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
    background: activo ? '#1A5276' : '#eee', color: activo ? 'white' : '#333',
    fontWeight: activo ? 600 : 400, fontSize: '0.9rem'
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setVista('hoy')} style={tabStyle(vista === 'hoy')}>Hoy</button>
        <button onClick={() => setVista('reportes')} style={tabStyle(vista === 'reportes')}>Reportes</button>
      </div>

      {/* ══════════════ VISTA HOY ══════════════ */}
      {vista === 'hoy' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 4vw, 1.4rem)' }}>
              Hoy — {hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            {total > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: adherencia >= 75 ? '#148F77' : adherencia >= 50 ? '#D4AC0D' : '#C0392B' }}>
                  {adherencia}%
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{cumplidas}/{total} comidas</div>
              </div>
            )}
          </div>
		  {/* ── Gym hoy ── */}
<div style={{
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1rem',
  background: sesionGymHoy ? '#f0f9f6' : '#fafafa',
  border: `1px solid ${sesionGymHoy ? '#148F77' : '#ddd'}`
}}>
  <span style={{ fontSize: '1.1rem' }}>🏋️</span>
  {sesionGymHoy ? (
    <div style={{ flex: 1 }}>
      <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1A5276' }}>{sesionGymHoy.routine_type || 'Entrenamiento'}</span>
      <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: sesionGymHoy.completed ? '#148F77' : '#D4AC0D' }}>
        {sesionGymHoy.completed ? '✓ Completado' : '⏳ En progreso'}
      </span>
    </div>
  ) : (
    <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Sin entrenamiento registrado hoy</span>
  )}
</div>
          {loading ? <p>Cargando...</p> : comidas.length === 0 ? (
            

<p style={{ color: '#888' }}>No hay comidas planificadas para hoy. Cargalas en <Link to="/plan">Plan semanal</Link>.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {comidas.map(comida => {
                const log = logs[comida.id]
                const estado = log?.status
                return (
                  <div key={comida.id} onClick={() => abrirModal(comida)} style={{
                    border: `2px solid ${estado ? ESTADO_COLORS[estado] : '#ddd'}`,
                    borderRadius: '8px', padding: '0.75rem 1rem', cursor: 'pointer',
                    background: estado ? `${ESTADO_COLORS[estado]}11` : 'white',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'capitalize' }}>{comida.slot}</div>
                      <div style={{ fontWeight: 500 }}>{comida.description}</div>
                      {comida.meal_goal && <div style={{ fontSize: '0.8rem', color: '#666' }}>{comida.meal_goal}</div>}
                      {comida.is_vianda && <div style={{ fontSize: '0.75rem', color: '#148F77' }}>vianda</div>}
                      {log?.actual_meal && <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.25rem' }}>→ {log.actual_meal}</div>}
                      {log?.exception_type && <div style={{ fontSize: '0.75rem', color: '#D4AC0D' }}>⚡ {log.exception_type}</div>}
                    </div>
                    <div style={{ color: estado ? ESTADO_COLORS[estado] : '#ccc', fontWeight: 500, fontSize: '0.85rem', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {estado ? ESTADO_LABELS[estado] : 'Sin registrar'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ VISTA REPORTES ══════════════ */}
      {vista === 'reportes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Reportes</h2>
            <button onClick={exportarExcel} style={{
              background: '#148F77', color: 'white', border: 'none',
              padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer',
              fontSize: '0.85rem'
            }}>
              ⬇ Exportar Excel
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[['adherencia', 'Adherencia'], ['viandas', 'Viandas'], ['cargas', 'Cargas']].map(([key, label]) => (
              <button key={key} onClick={() => setReporteVista(key)} style={{
                padding: '0.35rem 0.9rem', borderRadius: '20px', border: '1px solid #1A5276', cursor: 'pointer',
                background: reporteVista === key ? '#1A5276' : 'white',
                color: reporteVista === key ? 'white' : '#1A5276', fontSize: '0.85rem'
              }}>{label}</button>
            ))}
          </div>

          {(reporteVista === 'adherencia' || reporteVista === 'viandas') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <button onClick={() => { const d = new Date(semanaReporte); d.setDate(d.getDate() - 7); setSemanaReporte(d) }}
                style={{ padding: '0.3rem 0.7rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: 'white' }}>←</button>
              <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{formatSemana(semanaReporte)}</span>
              <button onClick={() => { const d = new Date(semanaReporte); d.setDate(d.getDate() + 7); setSemanaReporte(d) }}
                style={{ padding: '0.3rem 0.7rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: 'white' }}>→</button>
            </div>
          )}

          {loadingReporte ? <p>Cargando...</p> : (
            <>
              {/* ── Adherencia ── */}
              {reporteVista === 'adherencia' && (
                <div>
                  {!adherenciaSemanal ? (
                    <p style={{ color: '#888' }}>No hay datos para esta semana.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '140px', background: '#f0f9f6', border: '1px solid #148F77', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: adherenciaSemanal.pct >= 75 ? '#148F77' : adherenciaSemanal.pct >= 50 ? '#D4AC0D' : '#C0392B' }}>
                            {adherenciaSemanal.pct}%
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#555' }}>Adherencia semanal</div>
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>{adherenciaSemanal.totalCumplidas}/{adherenciaSemanal.totalComidas} comidas</div>
                        </div>
                      </div>
                      <h4 style={{ margin: '0 0 0.75rem' }}>Adherencia por día</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={adherenciaSemanal.porDia} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v) => `${v}%`} />
                          <Bar dataKey="pct" fill="#1A5276" radius={[4, 4, 0, 0]} name="Adherencia" />
                        </BarChart>
                      </ResponsiveContainer>
                      <h4 style={{ margin: '1.25rem 0 0.75rem' }}>Detalle por día</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {adherenciaSemanal.porDia.map(d => (
                          <div key={d.dia} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#fafafa', borderRadius: '6px', border: '1px solid #eee' }}>
                            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{d.dia}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.8rem', color: '#888' }}>{d.cumplidas}/{d.total}</span>
                              <span style={{ fontWeight: 600, color: d.pct >= 75 ? '#148F77' : d.pct >= 50 ? '#D4AC0D' : d.total === 0 ? '#ccc' : '#C0392B', minWidth: '40px', textAlign: 'right' }}>
                                {d.total === 0 ? '—' : `${d.pct}%`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Viandas ── */}
              {reporteVista === 'viandas' && (
                <div>
                  {viandasResumen.length === 0 ? (
                    <p style={{ color: '#888' }}>No hay viandas asignadas en el plan de esta semana.</p>
                  ) : (
                    <>
                      <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#E8F4FD', borderRadius: '8px', border: '1px solid #AED6F1' }}>
                        <span style={{ fontWeight: 600, color: '#1A5276' }}>{viandasResumen.length}</span>
                        <span style={{ color: '#555', fontSize: '0.9rem' }}> viandas asignadas esta semana</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {viandasResumen.map((v, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: 'white' }}>
                            <div style={{ textAlign: 'center', minWidth: '52px' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1A5276' }}>{v.dia.slice(0, 3)}</div>
                              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'capitalize' }}>{v.slot}</div>
                            </div>
                            <div style={{ fontSize: '0.88rem', color: '#333' }}>{v.descripcion}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Cargas ── */}
              {reporteVista === 'cargas' && (
                <div>
                  {ejerciciosDisponibles.length === 0 ? (
                    <p style={{ color: '#888' }}>No hay ejercicios registrados todavía.</p>
                  ) : (
                    <>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Ejercicio</label>
                        <select value={ejercicioSeleccionado} onChange={e => setEjercicioSeleccionado(e.target.value)}
                          style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.9rem', width: '100%', maxWidth: '320px' }}>
                          {ejerciciosDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      {evolucionCargas.length === 0 ? (
                        <p style={{ color: '#888' }}>No hay registros de peso para este ejercicio.</p>
                      ) : (
                        <>
                          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#f0f9f6', borderRadius: '8px', border: '1px solid #148F77', display: 'inline-block' }}>
                            <span style={{ fontSize: '0.8rem', color: '#555' }}>Máximo registrado </span>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#148F77' }}>{Math.max(...evolucionCargas.map(e => e.kg))} kg</span>
                          </div>
                          <h4 style={{ margin: '0.5rem 0 0.75rem' }}>Evolución de carga (kg)</h4>
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={evolucionCargas} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(v) => `${v} kg`} />
                              <Line type="monotone" dataKey="kg" stroke="#148F77" strokeWidth={2} dot={{ r: 4, fill: '#148F77' }} name="Peso (kg)" />
                            </LineChart>
                          </ResponsiveContainer>
                          <h4 style={{ margin: '1.25rem 0 0.75rem' }}>Historial</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {[...evolucionCargas].reverse().map((e, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#fafafa', borderRadius: '6px', border: '1px solid #eee', fontSize: '0.88rem' }}>
                                <span style={{ color: '#555' }}>{e.fecha}</span>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                  {e.series > 0 && <span>{e.series}×{e.reps}</span>}
                                  <span style={{ fontWeight: 600, color: '#1A5276' }}>{e.kg} kg</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal log comida ── */}
      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{modal.slot} — {modal.description}</h3>
            <label>Estado</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}>
              <option value="">— seleccioná —</option>
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
            </select>
            {(form.status === 'con_cambios' || form.status === 'no_cumplida') && (<>
              <label>¿Qué comiste?</label>
              <input value={form.actual_meal} onChange={e => setForm({ ...form, actual_meal: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                placeholder="Ej: Pizza" />
              <label>Motivo</label>
              <select value={form.exception_type} onChange={e => setForm({ ...form, exception_type: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}>
                <option value="">— seleccioná —</option>
                {EXCEPCIONES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </>)}
            <label>Observaciones</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px', height: '60px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={guardarLog} disabled={saving || !form.status}
                style={{ background: '#1A5276', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModal(null)}
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