import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import { generarPlanSemanal } from '../services/geminiPlan'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SLOTS = ['desayuno', 'almuerzo', 'merienda', 'cena']
const SLOT_ICONS = { desayuno: '🌅', almuerzo: '☀️', merienda: '🍎', cena: '🌙' }

const C = {
  bg: '#0F1117', surface: '#1A1D27', surfaceHigh: '#22263A',
  border: '#2A2D3E', accent: '#10B981', accentDim: '#10B98118',
  accentText: '#34D399', blue: '#3B82F6', blueDim: '#3B82F618',
  red: '#EF4444', textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#4B5563',
}

function getLunes(date) {
  const d = new Date(date); const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff); d.setHours(0, 0, 0, 0); return d
}
function formatFecha(date) { return date.toISOString().split('T')[0] }

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

function parsearExcel(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const semanas = []; let i = 0
  while (i < rows.length) {
    const celda = String(rows[i][0] || '').trim()
    if (celda.toUpperCase().startsWith('SEMANA')) {
      const labelSemana = celda; i++
      while (i < rows.length && !String(rows[i][0] || '').toLowerCase().includes('día')) i++
      if (i >= rows.length) break
      const headers = rows[i].map(h => String(h).trim())
      const idxDesayuno = headers.findIndex(h => h.toLowerCase().includes('desayuno'))
      const idxAlmuerzo = headers.findIndex(h => h.toLowerCase().includes('almuerzo'))
      const idxMerienda = headers.findIndex(h => h.toLowerCase().includes('merienda'))
      const idxCena = headers.findIndex(h => h.toLowerCase().includes('cena'))
      i++
      const diasSemana = []
      while (i < rows.length) {
        const fila = rows[i]; const diaRaw = String(fila[0] || '').trim()
        if (!diaRaw || diaRaw.toUpperCase().startsWith('SEMANA')) break
        const diaLower = diaRaw.toLowerCase(); let diaIdx = -1
        if (diaLower.includes('lunes')) diaIdx = 0
        else if (diaLower.includes('martes')) diaIdx = 1
        else if (diaLower.includes('miér') || diaLower.includes('mier')) diaIdx = 2
        else if (diaLower.includes('jueves')) diaIdx = 3
        else if (diaLower.includes('viernes')) diaIdx = 4
        else if (diaLower.includes('sábado') || diaLower.includes('sabado')) diaIdx = 5
        else if (diaLower.includes('domingo')) diaIdx = 6
        if (diaIdx >= 0) diasSemana.push({ diaIdx, desayuno: String(fila[idxDesayuno] || '').trim(), almuerzo: String(fila[idxAlmuerzo] || '').trim(), merienda: String(fila[idxMerienda] || '').trim(), cena: String(fila[idxCena] || '').trim() })
        i++
      }
      if (diasSemana.length > 0) semanas.push({ label: labelSemana, dias: diasSemana })
    } else { i++ }
  }
  return semanas
}

function descargarTemplate() {
  const wb = XLSX.utils.book_new()
  const datos = [
    ['SEMANA 01/01', '', '', '', '', ''],
    ['Día', 'Entreno', 'Desayuno', 'Almuerzo', 'Merienda', 'Cena'],
    ['Lunes', 'Tren Inferior', 'Yogur + banana', 'Pollo con arroz', 'Fruta', 'Omelette'],
    ['Martes', 'Cardio', 'Café + tostadas', 'Milanesa con puré', 'Yogur', 'Ensalada + atún'],
    ['Miércoles', 'Full Body', 'Yogur + cereales', 'Carne a la plancha', 'Frutos secos', 'Pollo + verduras'],
    ['Jueves', 'Descanso', 'Banana', 'Pasta con estofado', 'Yogur', 'Omelette con queso'],
    ['Viernes', 'Tren Superior', 'Café con leche', 'Pescado + papas', 'Fruta + frutos secos', 'Pollo a la parrilla'],
    ['', '', '', '', '', ''],
    ['SEMANA 08/01', '', '', '', '', ''],
    ['Día', 'Entreno', 'Desayuno', 'Almuerzo', 'Merienda', 'Cena'],
    ['Lunes', '', '', '', '', ''], ['Martes', '', '', '', '', ''],
    ['Miércoles', '', '', '', '', ''], ['Jueves', '', '', '', '', ''], ['Viernes', '', '', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(datos)
  ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Planes Semanales')
  XLSX.writeFile(wb, 'NutriGym_Template.xlsx')
}

export default function PlanSemanal({ session }) {
  const [weekStart, setWeekStart] = useState(getLunes(new Date()))
  const [planId, setPlanId] = useState(null)
  const [comidas, setComidas] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ description: '', meal_goal: '', is_vianda: false, notes: '' })
  const [saving, setSaving] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => { const hoy = new Date().getDay(); return hoy === 0 ? 6 : hoy - 1 })
  const isMobile = useIsMobile()
  const [semanasExcel, setSemanasExcel] = useState([])
  const [semanaElegida, setSemanaElegida] = useState(null)
  const [importando, setImportando] = useState(false)
  const [modalImport, setModalImport] = useState(false)
  const [modalIA, setModalIA] = useState(false)
  const [diaPartidoIA, setDiaPartidoIA] = useState('martes')
  const [generando, setGenerando] = useState(false)
  const [errorIA, setErrorIA] = useState('')
  const fileRef = useRef(null)

  useEffect(() => { cargarSemana() }, [weekStart])

  async function cargarSemana() {
    setLoading(true)
    const fecha = formatFecha(weekStart)
    let { data: planes } = await supabase.from('meal_plans').select('*').eq('user_id', session.user.id).eq('week_start', fecha)
    let plan = planes?.[0]
    if (!plan) {
      const { data: nuevo } = await supabase.from('meal_plans').insert({ user_id: session.user.id, week_start: fecha }).select()
      plan = nuevo?.[0]
    }
    setPlanId(plan.id)
    const { data: meals } = await supabase.from('planned_meals').select('*').eq('plan_id', plan.id)
    const mapa = {}; meals?.forEach(m => { mapa[`${m.day_of_week}-${m.slot}`] = m })
    setComidas(mapa); setLoading(false)
  }

  function semanaAnterior() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  function semanaSiguiente() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  async function generarConIA() {
    setGenerando(true)
    setErrorIA('')
    try {
      // Cargar perfil y viandas
      const [{ data: perfilData }, { data: viandasData }] = await Promise.all([
        supabase.from('user_profile').select('*').eq('user_id', session.user.id).single(),
        supabase.from('viandas').select('*').eq('user_id', session.user.id).gt('portions', 0).order('name'),
      ])

      const plan = await generarPlanSemanal({
        perfil: perfilData,
        viandas: viandasData || [],
        diaPartido: diaPartidoIA,
        fechaSemana: formatFecha(weekStart),
        accessToken: session.access_token,
      })

      // Borrar comidas existentes de la semana
      const existentes = Object.values(comidas)
      if (existentes.length > 0) {
        await supabase.from('planned_meals').delete().in('id', existentes.map(c => c.id))
      }

      // Insertar el plan generado
      const SLOT_MAP = { desayuno: 'desayuno', almuerzo: 'almuerzo', merienda: 'merienda', cena: 'cena' }
      const nuevas = []
      plan.forEach(diaObj => {
        Object.keys(SLOT_MAP).forEach(slot => {
          const desc = diaObj[slot]
          if (desc && desc.trim()) {
            nuevas.push({
              plan_id: planId,
              day_of_week: diaObj.dia,
              slot,
              description: desc.trim(),
              is_vianda: slot === 'almuerzo',
            })
          }
        })
      })

      if (nuevas.length > 0) await supabase.from('planned_meals').insert(nuevas)
      await cargarSemana()
      setModalIA(false)
    } catch (err) {
      setErrorIA(err.message || 'Error al generar el plan')
    }
    setGenerando(false)
  }

  async function limpiarSemana() {
    const existentes = Object.values(comidas)
    if (!existentes.length) { alert('No hay comidas para eliminar.'); return }
    if (!confirm(`¿Eliminar las ${existentes.length} comidas de esta semana? Esta acción no se puede deshacer.`)) return
    await supabase.from('planned_meals').delete().in('id', existentes.map(c => c.id))
    await cargarSemana()
  }

  async function duplicarSemanaAnterior() {
    if (!confirm('¿Duplicar todas las comidas de la semana anterior?')) return
    const fechaAnterior = formatFecha(new Date(weekStart.getTime() - 7 * 86400000))
    let { data: planesAnt } = await supabase.from('meal_plans').select('*').eq('user_id', session.user.id).eq('week_start', fechaAnterior)
    const planAnterior = planesAnt?.[0]
    if (!planAnterior) { alert('No hay plan en la semana anterior.'); return }
    const { data: comidasAnt } = await supabase.from('planned_meals').select('*').eq('plan_id', planAnterior.id)
    if (!comidasAnt?.length) { alert('La semana anterior no tiene comidas cargadas.'); return }
    await supabase.from('planned_meals').insert(comidasAnt.map(({ id, plan_id, ...rest }) => ({ ...rest, plan_id: planId })))
    await cargarSemana()
  }

  function onFileChange(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array', codepage: 65001 })
      const semanas = parsearExcel(wb)
      if (!semanas.length) { alert('No se encontraron semanas en el archivo.'); return }
      setSemanasExcel(semanas); setSemanaElegida(semanas[semanas.length - 1]); setModalImport(true)
    }
    reader.readAsArrayBuffer(file); e.target.value = ''
  }

  async function confirmarImport() {
    if (!semanaElegida) return
    if (!confirm(`¿Importar "${semanaElegida.label}" a la semana actual? Esto reemplazará las comidas existentes.`)) return
    setImportando(true)
    const existentes = Object.values(comidas)
    if (existentes.length > 0) await supabase.from('planned_meals').delete().in('id', existentes.map(c => c.id))
    const nuevas = []
    semanaElegida.dias.forEach(dia => {
      const slotMap = { desayuno: dia.desayuno, almuerzo: dia.almuerzo, merienda: dia.merienda, cena: dia.cena }
      SLOTS.forEach(slot => { const desc = slotMap[slot]; if (desc) nuevas.push({ plan_id: planId, day_of_week: dia.diaIdx, slot, description: desc }) })
    })
    if (nuevas.length > 0) await supabase.from('planned_meals').insert(nuevas)
    await cargarSemana(); setImportando(false); setModalImport(false); setSemanasExcel([])
  }

  function abrirModal(dia, slot) {
    const key = `${dia}-${slot}`; const comida = comidas[key]
    setForm({ description: comida?.description || '', meal_goal: comida?.meal_goal || '', is_vianda: comida?.is_vianda || false, notes: comida?.notes || '' })
    setModal({ dia, slot })
  }

  async function guardarComida() {
    setSaving(true)
    const key = `${modal.dia}-${modal.slot}`; const existente = comidas[key]
    if (existente) { await supabase.from('planned_meals').update(form).eq('id', existente.id) }
    else { await supabase.from('planned_meals').insert({ ...form, plan_id: planId, day_of_week: modal.dia, slot: modal.slot }) }
    await cargarSemana(); setSaving(false); setModal(null)
  }

  async function eliminarComida() {
    const existente = comidas[`${modal.dia}-${modal.slot}`]
    if (existente) await supabase.from('planned_meals').delete().eq('id', existente.id)
    await cargarSemana(); setModal(null)
  }

  const fechaLunes = weekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  const fechaDomingo = new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })

  const inp = {
    display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 14px',
    border: `1px solid ${C.border}`, borderRadius: '8px', boxSizing: 'border-box',
    background: C.surfaceHigh, color: C.textPrimary, fontSize: '14px', outline: 'none',
  }

  return (
    <div style={{ color: C.textPrimary }}>
      {/* Header navegación semana */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button onClick={semanaAnterior} style={{ padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', background: C.surface, color: C.textSecondary }}>←</button>
          <span style={{ fontWeight: 700, fontSize: '15px', color: C.textPrimary }}>{fechaLunes} — {fechaDomingo}</span>
          <button onClick={semanaSiguiente} style={{ padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', background: C.surface, color: C.textSecondary }}>→</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={duplicarSemanaAnterior} style={{ background: C.accentDim, color: C.accentText, border: `1px solid ${C.accent}40`, padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Duplicar semana anterior
          </button>
          <button onClick={() => { setModalIA(true); setErrorIA('') }} style={{ background: '#7C3AED18', color: '#A78BFA', border: '1px solid #7C3AED40', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
            ✨ Generar con IA
          </button>
          <button onClick={() => fileRef.current.click()} style={{ background: C.blueDim, color: C.blue, border: `1px solid ${C.blue}40`, padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            ⬆ Importar Excel
          </button>
          <button onClick={descargarTemplate} style={{ background: 'transparent', color: C.textSecondary, border: `1px solid ${C.border}`, padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
            ⬇ Template
          </button>
          <button onClick={limpiarSemana} style={{ background: '#EF444415', color: C.red, border: `1px solid ${C.red}40`, padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            🗑 Limpiar semana
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileChange} />
        </div>
      </div>

      {loading ? (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>Cargando...</div>
      ) : isMobile ? (
        // ── Vista Mobile ──
        <div>
          <div style={{ display: 'flex', overflowX: 'auto', gap: '6px', marginBottom: '1rem', paddingBottom: '4px' }}>
            {DIAS.map((dia, i) => {
              const tieneDatos = SLOTS.some(s => comidas[`${i}-${s}`])
              return (
                <button key={i} onClick={() => setDiaSeleccionado(i)} style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: '20px', border: 'none',
                  cursor: 'pointer', fontSize: '13px', fontWeight: diaSeleccionado === i ? 700 : 400,
                  background: diaSeleccionado === i ? C.accent : C.surface,
                  color: diaSeleccionado === i ? 'white' : tieneDatos ? C.textSecondary : C.textMuted,
                  position: 'relative', transition: 'all 0.15s',
                }}>
                  {dia.slice(0, 3)}
                  {tieneDatos && diaSeleccionado !== i && (
                    <span style={{ position: 'absolute', top: '4px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: C.accent }} />
                  )}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SLOTS.map(slot => {
              const comida = comidas[`${diaSeleccionado}-${slot}`]
              return (
                <div key={slot} onClick={() => abrirModal(diaSeleccionado, slot)} style={{
                  border: `1px solid ${comida ? C.accent + '30' : C.border}`,
                  borderLeft: `3px solid ${comida ? C.accent : C.border}`,
                  borderRadius: '12px', padding: '14px 16px', cursor: 'pointer',
                  background: comida ? C.accentDim : C.surface, transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span>{SLOT_ICONS[slot]}</span>
                        <span style={{ fontSize: '11px', color: C.textMuted, textTransform: 'capitalize', letterSpacing: '0.05em' }}>{slot}</span>
                        {comida?.is_vianda && <span style={{ fontSize: '10px', background: C.accentDim, color: C.accentText, padding: '1px 6px', borderRadius: '10px', border: `1px solid ${C.accent}30` }}>vianda</span>}
                      </div>
                      {comida ? (
                        <>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: C.textPrimary }}>{comida.description}</div>
                          {comida.meal_goal && <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>{comida.meal_goal}</div>}
                        </>
                      ) : (
                        <div style={{ fontSize: '13px', color: C.textMuted }}>+ agregar</div>
                      )}
                    </div>
                    <span style={{ color: C.textMuted, fontSize: '16px', marginLeft: '8px' }}>›</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // ── Vista Desktop ──
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, width: '90px' }}></th>
                {DIAS.map(d => (
                  <th key={d} style={{ padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, color: C.textSecondary, fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => (
                <tr key={slot}>
                  <td style={{ padding: '10px 14px', background: C.surfaceHigh, border: `1px solid ${C.border}`, fontWeight: 600, fontSize: '12px', textTransform: 'capitalize', color: C.textSecondary }}>
                    {SLOT_ICONS[slot]} {slot}
                  </td>
                  {DIAS.map((_, i) => {
                    const comida = comidas[`${i}-${slot}`]
                    return (
                      <td key={i} onClick={() => abrirModal(i, slot)} style={{
                        padding: '10px 12px', border: `1px solid ${C.border}`, cursor: 'pointer',
                        verticalAlign: 'top', minWidth: '110px',
                        background: comida ? C.accentDim : C.surface,
                        transition: 'background 0.15s',
                      }}>
                        {comida ? (
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: C.textPrimary }}>{comida.description}</div>
                            {comida.meal_goal && <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>{comida.meal_goal}</div>}
                            {comida.is_vianda && <div style={{ fontSize: '10px', color: C.accentText, marginTop: '2px' }}>vianda</div>}
                          </div>
                        ) : (
                          <span style={{ color: C.textMuted, fontSize: '12px' }}>+ agregar</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal IA ── */}
      {modalIA && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
            <div style={{ width: '40px', height: '4px', background: C.border, borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#A78BFA', marginBottom: '4px' }}>✨ Generar plan con IA</div>
            <div style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '1.25rem' }}>
              Gemini va a generar el plan semanal completo usando tu perfil y el stock de viandas actual.
            </div>

            <div style={{ background: C.surfaceHigh, borderRadius: '10px', padding: '12px 14px', marginBottom: '1.25rem', fontSize: '12px', color: C.textMuted }}>
              <div style={{ fontWeight: 600, color: C.textSecondary, marginBottom: '4px' }}>Semana a generar:</div>
              <div style={{ color: C.textPrimary }}>{fechaLunes} — {fechaDomingo}</div>
              <div style={{ color: '#F59E0B', marginTop: '4px', fontSize: '11px' }}>⚠ Esto reemplazará las comidas existentes de esta semana.</div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '12px', color: C.textSecondary, display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                ⚽ ¿Qué día jugás el partido esta semana?
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'ninguno'].map(dia => (
                  <button key={dia} onClick={() => setDiaPartidoIA(dia)} style={{
                    flex: 1, padding: '8px 4px', borderRadius: '8px', border: `1px solid ${diaPartidoIA === dia ? '#F59E0B' : C.border}`,
                    background: diaPartidoIA === dia ? '#F59E0B18' : 'transparent',
                    color: diaPartidoIA === dia ? '#F59E0B' : C.textMuted,
                    cursor: 'pointer', fontSize: '11px', fontWeight: diaPartidoIA === dia ? 700 : 400,
                  }}>
                    {dia === 'ninguno' ? 'Ninguno' : dia.slice(0, 3).charAt(0).toUpperCase() + dia.slice(1, 3)}
                  </button>
                ))}
              </div>
            </div>

            {errorIA && (
              <div style={{ background: '#EF444418', border: '1px solid #EF444440', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', color: '#FCA5A5', fontSize: '13px' }}>
                {errorIA}
              </div>
            )}

            {generando && (
              <div style={{ background: '#7C3AED15', border: '1px solid #7C3AED40', borderRadius: '8px', padding: '12px 14px', marginBottom: '1rem', color: '#A78BFA', fontSize: '13px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>🤖</div>
                Generando tu plan semanal... esto puede tardar unos segundos.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={generarConIA} disabled={generando} style={{
                flex: 1, background: '#7C3AED', color: 'white', border: 'none',
                padding: '13px', borderRadius: '10px', cursor: generando ? 'wait' : 'pointer',
                fontWeight: 700, fontSize: '15px', opacity: generando ? 0.7 : 1,
              }}>
                {generando ? 'Generando...' : '✨ Generar plan'}
              </button>
              <button onClick={() => setModalIA(false)} disabled={generando} style={{
                padding: '13px 20px', border: `1px solid ${C.border}`, borderRadius: '10px',
                cursor: 'pointer', background: 'transparent', color: C.textSecondary, fontSize: '15px',
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal import Excel ── */}
      {modalImport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ width: '40px', height: '4px', background: C.border, borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.textPrimary, marginBottom: '6px' }}>Importar desde Excel</div>
            <div style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '1rem' }}>
              {semanasExcel.length} semana{semanasExcel.length !== 1 ? 's' : ''} encontrada{semanasExcel.length !== 1 ? 's' : ''}. Elegí cuál importar a <strong style={{ color: C.textPrimary }}>{fechaLunes} — {fechaDomingo}</strong>:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.25rem', maxHeight: '200px', overflowY: 'auto' }}>
              {semanasExcel.map((s, i) => (
                <div key={i} onClick={() => setSemanaElegida(s)} style={{
                  padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                  border: `1px solid ${semanaElegida === s ? C.accent : C.border}`,
                  background: semanaElegida === s ? C.accentDim : C.surfaceHigh,
                  fontSize: '14px', fontWeight: semanaElegida === s ? 700 : 400,
                  color: semanaElegida === s ? C.accentText : C.textSecondary,
                  transition: 'all 0.15s',
                }}>
                  {s.label}
                  <span style={{ fontSize: '12px', color: C.textMuted, marginLeft: '8px' }}>({s.dias.length} días)</span>
                </div>
              ))}
            </div>
            {semanaElegida && (
              <div style={{ background: C.surfaceHigh, borderRadius: '10px', padding: '12px', marginBottom: '1rem', fontSize: '12px', color: C.textSecondary }}>
                <div style={{ fontWeight: 700, color: C.accentText, marginBottom: '6px' }}>Preview:</div>
                {semanaElegida.dias.slice(0, 3).map((d, i) => (
                  <div key={i} style={{ marginBottom: '3px' }}><strong style={{ color: C.textPrimary }}>{DIAS[d.diaIdx]}:</strong> {d.almuerzo || '—'}</div>
                ))}
                {semanaElegida.dias.length > 3 && <div style={{ color: C.textMuted }}>+ {semanaElegida.dias.length - 3} días más</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={confirmarImport} disabled={importando || !semanaElegida} style={{ flex: 1, background: C.accent, color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', opacity: importando || !semanaElegida ? 0.5 : 1 }}>
                {importando ? 'Importando...' : 'Importar'}
              </button>
              <button onClick={() => { setModalImport(false); setSemanasExcel([]) }} style={{ padding: '13px 20px', border: `1px solid ${C.border}`, borderRadius: '10px', cursor: 'pointer', background: 'transparent', color: C.textSecondary, fontSize: '15px' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal edición comida ── */}
      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ width: '40px', height: '4px', background: C.border, borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              {SLOT_ICONS[modal.slot]} {modal.slot}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.textPrimary, marginBottom: '1.25rem' }}>
              {DIAS[modal.dia]}
            </div>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Descripción</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inp} placeholder="Ej: Pechuga con arroz" />

            <label style={{ fontSize: '12px', color: C.textMuted }}>Objetivo</label>
            <select value={form.meal_goal} onChange={e => setForm({ ...form, meal_goal: e.target.value })} style={inp}>
              <option value="">— ninguno —</option>
              {['pre-entreno', 'post-entreno', 'post-partido', 'liviana', 'alta proteína'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div onClick={() => setForm({ ...form, is_vianda: !form.is_vianda })}
                style={{ width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', background: form.is_vianda ? C.accent : C.border, transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: '3px', left: form.is_vianda ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
              <span style={{ fontSize: '13px', color: C.textSecondary }}>Usa vianda</span>
            </div>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Observaciones</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inp, height: '70px', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button onClick={guardarComida} disabled={saving} style={{ flex: 1, background: C.accent, color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              {comidas[`${modal.dia}-${modal.slot}`] && (
                <button onClick={eliminarComida} style={{ padding: '13px 16px', border: `1px solid ${C.red}40`, borderRadius: '10px', cursor: 'pointer', background: 'transparent', color: C.red, fontSize: '15px' }}>Eliminar</button>
              )}
              <button onClick={() => setModal(null)} style={{ padding: '13px 16px', border: `1px solid ${C.border}`, borderRadius: '10px', cursor: 'pointer', background: 'transparent', color: C.textSecondary, fontSize: '15px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
