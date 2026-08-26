import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import ExcelJS from 'exceljs'
import { Link } from 'react-router-dom'
import { mejorSerie } from '../services/oneRepMax'
import { C, ESTADO_COLORS } from '../theme'
import { IconSunrise, IconSun, IconApple, IconMoon, IconGym, IconPlan, IconWarning, IconDownload, IconMeal } from '../components/icons'
import { useInteractiveStyle, focusRing } from '../hooks/useInteractiveStyle'

const SLOTS = ['desayuno', 'almuerzo', 'merienda', 'cena']
const ESTADOS = ['cumplida', 'con_cambios', 'no_cumplida', 'omitida']
const ESTADO_LABELS = { cumplida: 'Cumplida', con_cambios: 'Con cambios', no_cumplida: 'No cumplida', omitida: 'Omitida' }
const EXCEPCIONES = ['Partido de futsal', 'Cumpleaños / evento social', 'Trabajo / horario extendido', 'Falta de stock o vianda', 'Cansancio', 'Otro']
const SLOT_ICON_CMP = { desayuno: IconSunrise, almuerzo: IconSun, merienda: IconApple, cena: IconMoon }

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

function DarkTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px' }}>
      <div style={{ color: C.textSecondary, fontSize: '12px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: C.accentText, fontWeight: 700, fontSize: '15px' }}>{payload[0].value}{suffix}</div>
    </div>
  )
}

// Tab de la barra principal — con estados hover/focus reales (la app es 100% inline).
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

function SubTabButton({ active, onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    {
      padding: '6px 14px', borderRadius: '20px', border: `1px solid ${active ? C.accent : C.border}`,
      cursor: 'pointer', fontSize: '13px',
      background: active ? C.accentDim : 'transparent',
      color: active ? C.accentText : C.textSecondary,
    },
    { hover: active ? null : { borderColor: C.textMuted, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

// Fila de lista — reemplaza el "card para todo": sin borde ni radius, hairline divider.
function MealRow({ comida, log, onClick }) {
  const estado = log?.status
  const color = estado ? ESTADO_COLORS[estado] : null
  const Icon = SLOT_ICON_CMP[comida.slot] || IconMeal
  const { style, handlers } = useInteractiveStyle(
    { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 4px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' },
    { hover: { background: C.surfaceHigh }, focus: focusRing }
  )
  return (
    <div onClick={onClick} style={style} tabIndex={0} role="button" {...handlers}>
      <div style={{
        width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color ? color + '18' : C.surfaceHigh,
        border: `1px solid ${color ? color + '40' : C.border}`,
      }}>
        <Icon size={16} color={color || C.textMuted} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{comida.slot}</span>
          {comida.is_vianda && <span style={{ fontSize: '10px', background: C.accentDim, color: C.accentText, padding: '1px 6px', borderRadius: '10px' }}>vianda</span>}
        </div>
        <div style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{comida.description}</div>
        {comida.meal_goal && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{comida.meal_goal}</div>}
        {log?.actual_meal && <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>→ {log.actual_meal}</div>}
        {log?.exception_type && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: C.yellow, marginTop: '2px' }}>
            <IconWarning size={11} color={C.yellow} />{log.exception_type}
          </div>
        )}
      </div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: estado ? color : C.textMuted,
        whiteSpace: 'nowrap', flexShrink: 0, marginTop: '2px',
      }}>
        {estado ? ESTADO_LABELS[estado] : 'Sin registrar'}
      </div>
    </div>
  )
}

// Stat tipográfico — número grande + label + regla, sin card wrapper.
function Stat({ value, label, sub, color, align = 'left' }) {
  return (
    <div style={{ textAlign: align, borderTop: `2px solid ${color || C.border}`, paddingTop: '10px' }}>
      <div style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1, color: color || C.textPrimary, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '13px', color: C.textSecondary, marginTop: '6px' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{sub}</div>}
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
    const fechaHoy = hoy
    const fechaLunes = formatFecha(lunes)
    const { data: gymHoy } = await supabase.from('gym_logs').select('*').eq('user_id', session.user.id).eq('date', fechaHoy)
    setSesionGymHoy(gymHoy?.[0] || null)
    let { data: planes } = await supabase.from('meal_plans').select('*').eq('user_id', session.user.id).eq('week_start', fechaLunes)
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
    const { data: planes } = await supabase.from('meal_plans').select('*').eq('user_id', session.user.id).eq('week_start', fecha)
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
    const { data: planes } = await supabase.from('meal_plans').select('*').eq('user_id', session.user.id).gte('week_start', formatFecha(desde)).lte('week_start', formatFecha(semanaReporte))
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
    const { data: planes } = await supabase.from('meal_plans').select('*').eq('user_id', session.user.id).eq('week_start', fecha)
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
    const { data: ejs } = await supabase
      .from('gym_exercises')
      .select('log_id, gym_sets(weight_kg, reps)')
      .in('log_id', logIds)
      .eq('exercise_name', ejercicioSeleccionado)
    if (!ejs?.length) { setEvolucionCargas([]); return }
    const evolucion = ejs.map(ej => {
      const sesion = gymLogs.find(l => l.id === ej.log_id)
      const mejor = mejorSerie(ej.gym_sets || [])
      return {
        fecha: new Date(sesion.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        kg: mejor ? mejor.serie.weight_kg : 0,
        series: ej.gym_sets?.length || 0,
        reps: mejor ? mejor.serie.reps : 0,
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
    if (log) { await supabase.from('meal_logs').update(form).eq('id', log.id) }
    else { await supabase.from('meal_logs').insert({ ...form, planned_meal_id: modal.id }) }
    await cargarHoy(); setSaving(false); setModal(null)
  }

  function agregarHoja(wb, nombre, filas, anchos) {
    if (!filas.length) return
    const ws = wb.addWorksheet(nombre)
    const headers = Object.keys(filas[0])
    ws.columns = headers.map((h, i) => ({ header: h, key: h, width: anchos?.[i] }))
    filas.forEach(fila => ws.addRow(fila))
  }

  async function exportarExcel() {
    const wb = new ExcelJS.Workbook()
    if (adherenciaSemanal) {
      const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const filas = adherenciaSemanal.porDia.map((d, i) => ({ Día: DIAS_FULL[i], 'Comidas planificadas': d.total, 'Comidas cumplidas': d.cumplidas, 'Adherencia (%)': d.total > 0 ? d.pct : '—' }))
      filas.push({ Día: 'TOTAL', 'Comidas planificadas': adherenciaSemanal.totalComidas, 'Comidas cumplidas': adherenciaSemanal.totalCumplidas, 'Adherencia (%)': adherenciaSemanal.pct })
      agregarHoja(wb, 'Adherencia', filas, [12, 22, 20, 16])
    }
    if (viandasResumen.length > 0) {
      agregarHoja(wb, 'Viandas', viandasResumen.map(v => ({ Día: v.dia, Slot: v.slot, Descripción: v.descripcion })), [12, 12, 40])
    }
    if (evolucionCargas.length > 0) {
      agregarHoja(wb, 'Cargas', evolucionCargas.map(e => ({ Fecha: e.fecha, Ejercicio: ejercicioSeleccionado, Series: e.series || '—', Reps: e.reps || '—', 'Peso (kg)': e.kg })), [12, 24, 8, 8, 10])
    }
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `NutriGym_${formatSemana(semanaReporte).replace(' — ', '_')}.xlsx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  return (
    <div style={{ color: C.textPrimary }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <TabButton active={vista === 'hoy'} onClick={() => setVista('hoy')}>Hoy</TabButton>
        <TabButton active={vista === 'reportes'} onClick={() => setVista('reportes')}>Reportes</TabButton>
      </div>

      {/* ══ VISTA HOY ══ */}
      {vista === 'hoy' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '13px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                {hoyDate.toLocaleDateString('es-AR', { weekday: 'long' })}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.textPrimary }}>
                {hoyDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              </div>
            </div>
            {total > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, color: adherenciaColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{adherencia}%</div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{cumplidas}/{total} comidas</div>
              </div>
            )}
          </div>

          {/* Card gym hoy — sigue siendo card: es una entidad accionable */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px', borderRadius: '10px', marginBottom: '1.25rem',
            background: sesionGymHoy ? C.accentDim : C.surface,
            border: `1px solid ${sesionGymHoy ? C.accent + '50' : C.border}`,
          }}>
            <IconGym size={20} color={sesionGymHoy ? C.accent : C.textMuted} />
            {sesionGymHoy ? (
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: C.textPrimary }}>{sesionGymHoy.routine_type || 'Entrenamiento'}</div>
                <div style={{ fontSize: '12px', color: sesionGymHoy.completed ? C.accentText : C.yellow, marginTop: '2px' }}>
                  {sesionGymHoy.completed ? 'Completado' : 'En progreso'}
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: C.textMuted }}>Sin entrenamiento registrado hoy</span>
            )}
          </div>

          {loading ? (
            <div style={{ color: C.textMuted, padding: '2rem', textAlign: 'center' }}>Cargando…</div>
          ) : comidas.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ color: C.textSecondary, fontSize: '14px' }}>
                No hay comidas planificadas para hoy.{' '}
                <Link to="/plan" style={{ color: C.accentText }}>Ir al plan semanal</Link>
              </div>
            </div>
          ) : (
            <div>
              {comidas.map(comida => (
                <MealRow key={comida.id} comida={comida} log={logs[comida.id]} onClick={() => abrirModal(comida)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ VISTA REPORTES ══ */}
      {vista === 'reportes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>Reportes</div>
            <ExportButton onClick={exportarExcel} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[['adherencia', 'Adherencia'], ['viandas', 'Viandas'], ['cargas', 'Cargas']].map(([k, l]) => (
              <SubTabButton key={k} active={reporteVista === k} onClick={() => setReporteVista(k)}>{l}</SubTabButton>
            ))}
          </div>

          {(reporteVista === 'adherencia' || reporteVista === 'viandas') && (
            <WeekNav
              label={formatSemana(semanaReporte)}
              onPrev={() => { const d = new Date(semanaReporte); d.setDate(d.getDate() - 7); setSemanaReporte(d) }}
              onNext={() => { const d = new Date(semanaReporte); d.setDate(d.getDate() + 7); setSemanaReporte(d) }}
            />
          )}

          {loadingReporte ? (
            <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>Cargando…</div>
          ) : (
            <>
              {reporteVista === 'adherencia' && (
                !adherenciaSemanal ? (
                  <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>No hay datos para esta semana.</div>
                ) : (
                  <div>
                    <Stat
                      value={`${adherenciaSemanal.pct}%`}
                      label="Adherencia semanal"
                      sub={`${adherenciaSemanal.totalCumplidas}/${adherenciaSemanal.totalComidas} comidas`}
                      color={adherenciaSemanal.pct >= 75 ? C.accent : adherenciaSemanal.pct >= 50 ? C.yellow : C.red}
                    />
                    <div style={{ marginTop: '1.25rem' }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={adherenciaSemanal.porDia} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                          <XAxis dataKey="dia" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                          <Tooltip content={<DarkTooltip suffix="%" />} />
                          <Bar dataKey="pct" fill={C.accent} radius={[4, 4, 0, 0]} name="Adherencia" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      {adherenciaSemanal.porDia.map(d => (
                        <div key={d.dia} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: C.textPrimary }}>{d.dia}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: C.textMuted }}>{d.cumplidas}/{d.total}</span>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: d.pct >= 75 ? C.accent : d.pct >= 50 ? C.yellow : d.total === 0 ? C.textMuted : C.red, minWidth: '40px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {d.total === 0 ? '—' : `${d.pct}%`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {reporteVista === 'viandas' && (
                viandasResumen.length === 0 ? (
                  <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>No hay viandas asignadas esta semana.</div>
                ) : (
                  <div>
                    <div style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: C.accentText, fontVariantNumeric: 'tabular-nums' }}>{viandasResumen.length}</span> viandas asignadas esta semana
                    </div>
                    {viandasResumen.map((v, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 4px', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ textAlign: 'center', minWidth: '48px' }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: C.accentText }}>{v.dia.slice(0, 3)}</div>
                          <div style={{ fontSize: '10px', color: C.textMuted, textTransform: 'capitalize' }}>{v.slot}</div>
                        </div>
                        <div style={{ fontSize: '13px', color: C.textSecondary }}>{v.descripcion}</div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {reporteVista === 'cargas' && (
                ejerciciosDisponibles.length === 0 ? (
                  <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>No hay ejercicios registrados todavía.</div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '1.25rem' }}>
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
                        <Stat value={`${Math.max(...evolucionCargas.map(e => e.kg))} kg`} label="Máximo registrado" color={C.accentText} />
                        <div style={{ marginTop: '1.25rem' }}>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={evolucionCargas} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                              <Tooltip content={<DarkTooltip suffix=" kg" />} />
                              <Line type="monotone" dataKey="kg" stroke={C.accent} strokeWidth={2.5} dot={{ r: 4, fill: C.accent, strokeWidth: 0 }} name="Peso (kg)" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                          {[...evolucionCargas].reverse().map((e, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
                              <span style={{ color: C.textMuted }}>{e.fecha}</span>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                {e.series > 0 && <span style={{ color: C.textSecondary }}>{e.series}×{e.reps}</span>}
                                <span style={{ fontWeight: 700, color: C.accentText, fontVariantNumeric: 'tabular-nums' }}>{e.kg} kg</span>
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
              <ModalPrimaryButton onClick={guardarLog} disabled={saving || !form.status}>
                {saving ? 'Guardando…' : 'Guardar'}
              </ModalPrimaryButton>
              <ModalSecondaryButton onClick={() => setModal(null)}>Cancelar</ModalSecondaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WeekNav({ label, onPrev, onNext }) {
  const btn = (onClick, children) => {
    const { style, handlers } = useInteractiveStyle(
      { padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', background: C.surface, color: C.textSecondary },
      { hover: { borderColor: C.textMuted, color: C.textPrimary }, focus: focusRing }
    )
    return <button onClick={onClick} style={style} {...handlers}>{children}</button>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
      {btn(onPrev, '←')}
      <span style={{ fontWeight: 500, fontSize: '13px', color: C.textSecondary }}>{label}</span>
      {btn(onNext, '→')}
    </div>
  )
}

function ExportButton({ onClick }) {
  const { style, handlers } = useInteractiveStyle(
    { display: 'flex', alignItems: 'center', gap: '6px', background: C.accentDim, color: C.accentText, border: `1px solid ${C.accent}`, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
    { hover: { background: C.accent, color: '#fff' }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}><IconDownload size={14} />Exportar Excel</button>
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
