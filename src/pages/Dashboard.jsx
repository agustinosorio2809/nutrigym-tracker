import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import * as XLSX from 'xlsx'
import { Link } from 'react-router-dom'

const SLOTS = ['desayuno', 'almuerzo', 'merienda', 'cena']
const ESTADOS = ['cumplida', 'con_cambios', 'no_cumplida', 'omitida']
const ESTADO_LABELS = { cumplida: 'Cumplida', con_cambios: 'Con cambios', no_cumplida: 'No cumplida', omitida: 'Omitida' }
const ESTADO_COLORS = { cumplida: '#10B981', con_cambios: '#F59E0B', no_cumplida: '#EF4444', omitida: '#6B7280' }
const EXCEPCIONES = ['Partido de futsal', 'Cumpleaños / evento social', 'Trabajo / horario extendido', 'Falta de stock o vianda', 'Cansancio', 'Otro']

const C = {
  bg: '#0F1117', surface: '#1A1D27', surfaceHigh: '#22263A',
  border: '#2A2D3E', accent: '#10B981', accentDim: '#10B98118',
  accentText: '#34D399', blue: '#3B82F6', blueDim: '#3B82F618',
  red: '#EF4444', redDim: '#EF444418', yellow: '#F59E0B', yellowDim: '#F59E0B18',
  textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#4B5563',
}

const SLOT_ICONS = { desayuno: '🌅', almuerzo: '☀️', merienda: '🍎', cena: '🌙' }

function getLunes(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff); d.setHours(0, 0, 0, 0)
  return d
}
function formatFecha(date) { return date.toISOString().split('T')[0] }
function formatSemana(lunesDate) {
  const domingo = new Date(lunesDate.getTime() + 6 * 86400000)
  return `${lunesDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — ${domingo.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
}

// Tooltip personalizado para gráficos dark
function DarkTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px' }}>
      <div style={{ color: C.textSecondary, fontSize: '12px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: C.accentText, fontWeight: 700, fontSize: '15px' }}>{payload[0].value}{suffix}</div>
    </div>
  )
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

 const hoyDate = new Date()
const hoy = hoyDate.toLocaleDateString('sv-SE')
const diaSemana = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1
const lunes = getLunes(hoyDate)


  useEffect(() => { cargarHoy() }, [])
  useEffect(() => { if (vista === 'reportes') cargarReportes() }, [vista, semanaReporte, reporteVista])
  useEffect(() => { if (reporteVista === 'cargas' && ejercicioSeleccionado) cargarEvolucion() }, [ejercicioSeleccionado])

  async function cargarHoy() {
    setLoading(true)
    const fechaHoy = formatFecha(hoy)
    const fechaLunes = formatFecha(lunes)
    const { data: gymHoy } = await supabase.from('gym_logs').select('*').eq('user_id', session.user.id).eq('date', fechaHoy)
    setSesionGymHoy(gymHoy?.[0] || null)
    let { data: planes } = await supabase.from('meal_plans').select('*').eq('week_start', fechaLunes)
    const plan = planes?.[0]
    if (!plan) { setLoading(false); return }
    const { data: meals } = await supabase.from('planned_meals').select('*').eq('plan_id', plan.id).eq('day_of_week', diaSemana).order('slot')
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
    const desde = new Date(semanaReporte); desde.setDate(desde.getDate() - 21)
    const { data: planes } = await supabase.from('meal_plans').select('*').gte('week_start', formatFecha(desde)).lte('week_start', formatFecha(semanaReporte))
    if (!planes?.length) { setExcepcionesFrecuentes([]); return }
    const ids = planes.map(p => p.id)
    const { data: meals } = await supabase.from('planned_meals').select('*').in('plan_id', ids)
    if (!meals?.length) { setExcepcionesFrecuentes([]); return }
    const mealIds = meals.map(m => m.id)
    const { data: logsData } = await supabase.from('meal_logs').select('*').in('planned_meal_id', mealIds).not('exception_type', 'is', null)
    const conteo = {}
    logsData?.forEach(l => { if (l.exception_type) conteo[l.exception_type] = (conteo[l.exception_type] || 0) + 1 })
    setExcepcionesFrecuentes(Object.entries(conteo).map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad))
  }

  async function cargarViandas() {
    const fecha = formatFecha(semanaReporte)
    const { data: planes } = await supabase.from('meal_plans').select('*').eq('week_start', fecha)
    const plan = planes?.[0]
    if (!plan) { setViandasResumen([]); return }
    const { data: meals } = await supabase.from('planned_meals').select('*').eq('plan_id', plan.id).eq('is_vianda', true)
    if (!meals?.length) { setViandasResumen([]); return }
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    const resumen = meals.map(m => ({ dia: DIAS[m.day_of_week], slot: m.slot, descripcion: m.description }))
      .sort((a, b) => { const d = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']; return d.indexOf(a.dia) - d.indexOf(b.dia) })
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
      return { fecha: new Date(sesion.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }), kg: ej.weight_kg || 0, series: ej.sets || 0, reps: ej.reps || 0 }
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
    if (log) { await supabase.from('meal_logs').update(form).eq('id', log.id) }
    else { await supabase.from('meal_logs').insert({ ...form, planned_meal_id: modal.id }) }
    await cargarHoy(); setSaving(false); setModal(null)
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new()
    if (adherenciaSemanal) {
      const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const filas = adherenciaSemanal.porDia.map((d, i) => ({ Día: DIAS_FULL[i], 'Comidas planificadas': d.total, 'Comidas cumplidas': d.cumplidas, 'Adherencia (%)': d.total > 0 ? d.pct : '—' }))
      filas.push({ Día: 'TOTAL', 'Comidas planificadas': adherenciaSemanal.totalComidas, 'Comidas cumplidas': adherenciaSemanal.totalCumplidas, 'Adherencia (%)': adherenciaSemanal.pct })
      const ws1 = XLSX.utils.json_to_sheet(filas)
      ws1['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, ws1, 'Adherencia')
    }
    if (viandasResumen.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(viandasResumen.map(v => ({ Día: v.dia, Slot: v.slot, Descripción: v.descripcion })))
      ws2['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Viandas')
    }
    if (evolucionCargas.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(evolucionCargas.map(e => ({ Fecha: e.fecha, Ejercicio: ejercicioSeleccionado, Series: e.series || '—', Reps: e.reps || '—', 'Peso (kg)': e.kg })))
      ws3['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws3, 'Cargas')
    }
    XLSX.writeFile(wb, `NutriGym_${formatSemana(semanaReporte).replace(' — ', '_')}.xlsx`)
  }

  const cumplidas = Object.values(logs).filter(l => l.status === 'cumplida' || l.status === 'con_cambios').length
  const total = comidas.length
  const adherencia = total > 0 ? Math.round((cumplidas / total) * 100) : 0
  const adherenciaColor = adherencia >= 75 ? C.accent : adherencia >= 50 ? C.yellow : C.red

  const inp = {
    display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 14px',
    border: `1px solid ${C.border}`, borderRadius: '8px', boxSizing: 'border-box',
    background: C.surface, color: C.textPrimary, fontSize: '14px', outline: 'none',
  }

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setVista(key)} style={{
      padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      background: vista === key ? C.accent : C.surface,
      color: vista === key ? '#fff' : C.textSecondary,
      fontWeight: vista === key ? 700 : 400, fontSize: '14px',
      transition: 'all 0.15s',
    }}>{label}</button>
  )

  const subTabBtn = (key, label) => (
    <button key={key} onClick={() => setReporteVista(key)} style={{
      padding: '6px 14px', borderRadius: '20px', border: `1px solid ${reporteVista === key ? C.accent : C.border}`,
      cursor: 'pointer', fontSize: '13px',
      background: reporteVista === key ? C.accentDim : 'transparent',
      color: reporteVista === key ? C.accentText : C.textSecondary,
      transition: 'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ color: C.textPrimary }}>
      {/* Tabs principales */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        {tabBtn('hoy', 'Hoy')}
        {tabBtn('reportes', 'Reportes')}
      </div>

      {/* ══ VISTA HOY ══ */}
      {vista === 'hoy' && (
        <div>
          {/* Header con fecha y adherencia */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '13px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                {hoy.toLocaleDateString('es-AR', { weekday: 'long' })}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.textPrimary }}>
                {hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              </div>
            </div>
            {total > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, color: adherenciaColor, lineHeight: 1 }}>{adherencia}%</div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{cumplidas}/{total} comidas</div>
              </div>
            )}
          </div>

          {/* Card gym hoy */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px', borderRadius: '12px', marginBottom: '1rem',
            background: sesionGymHoy ? C.accentDim : C.surface,
            border: `1px solid ${sesionGymHoy ? C.accent : C.border}`,
          }}>
            <span style={{ fontSize: '20px' }}>🏋️</span>
            {sesionGymHoy ? (
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{sesionGymHoy.routine_type || 'Entrenamiento'}</div>
                <div style={{ fontSize: '12px', color: sesionGymHoy.completed ? C.accentText : C.yellow, marginTop: '2px' }}>
                  {sesionGymHoy.completed ? '✓ Completado' : '⏳ En progreso'}
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: C.textMuted }}>Sin entrenamiento registrado hoy</span>
            )}
          </div>

          {/* Comidas */}
          {loading ? (
            <div style={{ color: C.textMuted, padding: '2rem', textAlign: 'center' }}>Cargando...</div>
          ) : comidas.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
              <div style={{ color: C.textSecondary, fontSize: '14px' }}>
                No hay comidas planificadas para hoy.{' '}
                <Link to="/plan" style={{ color: C.accentText }}>Ir al plan semanal</Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {comidas.map(comida => {
                const log = logs[comida.id]
                const estado = log?.status
                const color = estado ? ESTADO_COLORS[estado] : C.border
                return (
                  <div key={comida.id} onClick={() => abrirModal(comida)} style={{
                    border: `1px solid ${estado ? color + '60' : C.border}`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: '12px', padding: '14px 16px', cursor: 'pointer',
                    background: estado ? color + '10' : C.surface,
                    transition: 'background 0.15s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px' }}>{SLOT_ICONS[comida.slot] || '🍽️'}</span>
                          <span style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{comida.slot}</span>
                          {comida.is_vianda && <span style={{ fontSize: '10px', background: C.accentDim, color: C.accentText, padding: '1px 6px', borderRadius: '10px' }}>vianda</span>}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{comida.description}</div>
                        {comida.meal_goal && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{comida.meal_goal}</div>}
                        {log?.actual_meal && <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>→ {log.actual_meal}</div>}
                        {log?.exception_type && <div style={{ fontSize: '11px', color: C.yellow, marginTop: '2px' }}>⚡ {log.exception_type}</div>}
                      </div>
                      <div style={{
                        fontSize: '11px', fontWeight: 600, color: estado ? color : C.textMuted,
                        background: estado ? color + '15' : C.surfaceHigh,
                        padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {estado ? ESTADO_LABELS[estado] : 'Sin registrar'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ VISTA REPORTES ══ */}
      {vista === 'reportes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Reportes</div>
            <button onClick={exportarExcel} style={{
              background: C.accentDim, color: C.accentText,
              border: `1px solid ${C.accent}`, padding: '6px 14px',
              borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}>⬇ Exportar Excel</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[['adherencia', 'Adherencia'], ['viandas', 'Viandas'], ['cargas', 'Cargas']].map(([k, l]) => subTabBtn(k, l))}
          </div>

          {(reporteVista === 'adherencia' || reporteVista === 'viandas') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
              <button onClick={() => { const d = new Date(semanaReporte); d.setDate(d.getDate() - 7); setSemanaReporte(d) }}
                style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', background: C.surface, color: C.textSecondary }}>←</button>
              <span style={{ fontWeight: 500, fontSize: '13px', color: C.textSecondary }}>{formatSemana(semanaReporte)}</span>
              <button onClick={() => { const d = new Date(semanaReporte); d.setDate(d.getDate() + 7); setSemanaReporte(d) }}
                style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', background: C.surface, color: C.textSecondary }}>→</button>
            </div>
          )}

          {loadingReporte ? (
            <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>Cargando...</div>
          ) : (
            <>
              {/* Adherencia */}
              {reporteVista === 'adherencia' && (
                !adherenciaSemanal ? (
                  <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>No hay datos para esta semana.</div>
                ) : (
                  <div>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '1.25rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '48px', fontWeight: 800, color: adherenciaSemanal.pct >= 75 ? C.accent : adherenciaSemanal.pct >= 50 ? C.yellow : C.red, lineHeight: 1 }}>
                        {adherenciaSemanal.pct}%
                      </div>
                      <div style={{ fontSize: '13px', color: C.textSecondary, marginTop: '6px' }}>Adherencia semanal</div>
                      <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{adherenciaSemanal.totalCumplidas}/{adherenciaSemanal.totalComidas} comidas</div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={adherenciaSemanal.porDia} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                        <Tooltip content={<DarkTooltip suffix="%" />} />
                        <Bar dataKey="pct" fill={C.accent} radius={[6, 6, 0, 0]} name="Adherencia" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '1rem' }}>
                      {adherenciaSemanal.porDia.map(d => (
                        <div key={d.dia} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: C.textPrimary }}>{d.dia}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: C.textMuted }}>{d.cumplidas}/{d.total}</span>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: d.pct >= 75 ? C.accent : d.pct >= 50 ? C.yellow : d.total === 0 ? C.textMuted : C.red, minWidth: '40px', textAlign: 'right' }}>
                              {d.total === 0 ? '—' : `${d.pct}%`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Viandas */}
              {reporteVista === 'viandas' && (
                viandasResumen.length === 0 ? (
                  <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>No hay viandas asignadas esta semana.</div>
                ) : (
                  <div>
                    <div style={{ background: C.accentDim, border: `1px solid ${C.accent}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 700, color: C.accentText }}>{viandasResumen.length}</span>
                      <span style={{ color: C.textSecondary, fontSize: '13px' }}> viandas asignadas esta semana</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {viandasResumen.map((v, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', background: C.surface }}>
                          <div style={{ textAlign: 'center', minWidth: '48px' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: C.accentText }}>{v.dia.slice(0, 3)}</div>
                            <div style={{ fontSize: '10px', color: C.textMuted, textTransform: 'capitalize' }}>{v.slot}</div>
                          </div>
                          <div style={{ fontSize: '13px', color: C.textSecondary }}>{v.descripcion}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Cargas */}
              {reporteVista === 'cargas' && (
                ejerciciosDisponibles.length === 0 ? (
                  <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>No hay ejercicios registrados todavía.</div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '12px', color: C.textMuted, display: 'block', marginBottom: '6px' }}>Ejercicio</label>
                      <select value={ejercicioSeleccionado} onChange={e => setEjercicioSeleccionado(e.target.value)}
                        style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', width: '100%', maxWidth: '320px', background: C.surface, color: C.textPrimary }}>
                        {ejerciciosDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    {evolucionCargas.length === 0 ? (
                      <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>No hay registros de peso para este ejercicio.</div>
                    ) : (
                      <>
                        <div style={{ background: C.accentDim, border: `1px solid ${C.accent}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '1rem', display: 'inline-block' }}>
                          <div style={{ fontSize: '11px', color: C.textMuted }}>Máximo registrado</div>
                          <div style={{ fontWeight: 800, fontSize: '22px', color: C.accentText }}>{Math.max(...evolucionCargas.map(e => e.kg))} kg</div>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={evolucionCargas} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                            <Tooltip content={<DarkTooltip suffix=" kg" />} />
                            <Line type="monotone" dataKey="kg" stroke={C.accent} strokeWidth={2.5} dot={{ r: 4, fill: C.accent, strokeWidth: 0 }} name="Peso (kg)" />
                          </LineChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '1rem' }}>
                          {[...evolucionCargas].reverse().map((e, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '13px' }}>
                              <span style={{ color: C.textMuted }}>{e.fecha}</span>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                {e.series > 0 && <span style={{ color: C.textSecondary }}>{e.series}×{e.reps}</span>}
                                <span style={{ fontWeight: 700, color: C.accentText }}>{e.kg} kg</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* ══ MODAL LOG ══ */}
      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ width: '40px', height: '4px', background: C.border, borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{modal.slot}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.textPrimary, marginBottom: '1.25rem' }}>{modal.description}</div>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Estado</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp}>
              <option value="">— seleccioná —</option>
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
            </select>

            {(form.status === 'con_cambios' || form.status === 'no_cumplida') && (
              <>
                <label style={{ fontSize: '12px', color: C.textMuted }}>¿Qué comiste?</label>
                <input value={form.actual_meal} onChange={e => setForm({ ...form, actual_meal: e.target.value })} style={inp} placeholder="Ej: Pizza" />
                <label style={{ fontSize: '12px', color: C.textMuted }}>Motivo</label>
                <select value={form.exception_type} onChange={e => setForm({ ...form, exception_type: e.target.value })} style={inp}>
                  <option value="">— seleccioná —</option>
                  {EXCEPCIONES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </>
            )}

            <label style={{ fontSize: '12px', color: C.textMuted }}>Observaciones</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inp, height: '70px', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={guardarLog} disabled={saving || !form.status} style={{
                flex: 1, background: C.accent, color: 'white', border: 'none',
                padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px',
                opacity: saving || !form.status ? 0.5 : 1,
              }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModal(null)} style={{
                padding: '13px 20px', border: `1px solid ${C.border}`, borderRadius: '10px',
                cursor: 'pointer', background: 'transparent', color: C.textSecondary, fontSize: '15px',
              }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
