import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SLOTS = ['desayuno', 'almuerzo', 'merienda', 'cena']
const SLOTS_EXCEL = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']

function getLunes(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatFecha(date) {
  return date.toISOString().split('T')[0]
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

// Parsea el Excel y devuelve un array de semanas con sus comidas
function parsearExcel(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const semanas = []
  let i = 0

  while (i < rows.length) {
    const celda = String(rows[i][0] || '').trim()

    // Detectar fila de semana (empieza con "SEMANA")
    if (celda.toUpperCase().startsWith('SEMANA')) {
      const labelSemana = celda
      i++ // saltar a la fila de headers (Día, Entreno, Desayuno...)

      // Buscar la fila de headers
      while (i < rows.length && !String(rows[i][0] || '').toLowerCase().includes('día')) i++
      if (i >= rows.length) break

      const headers = rows[i].map(h => String(h).trim())
      const idxDia = 0
      const idxDesayuno = headers.findIndex(h => h.toLowerCase().includes('desayuno'))
      const idxAlmuerzo = headers.findIndex(h => h.toLowerCase().includes('almuerzo'))
      const idxMerienda = headers.findIndex(h => h.toLowerCase().includes('merienda'))
      const idxCena = headers.findIndex(h => h.toLowerCase().includes('cena'))

      i++ // primera fila de datos

      const diasSemana = []
      while (i < rows.length) {
        const fila = rows[i]
        const diaRaw = String(fila[idxDia] || '').trim()
        if (!diaRaw || diaRaw.toUpperCase().startsWith('SEMANA')) break

        // Detectar qué día es basándonos en el texto (ignorando emojis)
        const diaLower = diaRaw.toLowerCase()
        let diaIdx = -1
        if (diaLower.includes('lunes')) diaIdx = 0
        else if (diaLower.includes('martes')) diaIdx = 1
        else if (diaLower.includes('miér') || diaLower.includes('mier')) diaIdx = 2
        else if (diaLower.includes('jueves')) diaIdx = 3
        else if (diaLower.includes('viernes')) diaIdx = 4
        else if (diaLower.includes('sábado') || diaLower.includes('sabado')) diaIdx = 5
        else if (diaLower.includes('domingo')) diaIdx = 6

        if (diaIdx >= 0) {
          diasSemana.push({
            diaIdx,
            desayuno: String(fila[idxDesayuno] || '').trim(),
            almuerzo: String(fila[idxAlmuerzo] || '').trim(),
            merienda: String(fila[idxMerienda] || '').trim(),
            cena: String(fila[idxCena] || '').trim(),
          })
        }
        i++
      }

      if (diasSemana.length > 0) {
        semanas.push({ label: labelSemana, dias: diasSemana })
      }
    } else {
      i++
    }
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
    ['Lunes', '', '', '', '', ''],
    ['Martes', '', '', '', '', ''],
    ['Miércoles', '', '', '', '', ''],
    ['Jueves', '', '', '', '', ''],
    ['Viernes', '', '', '', '', ''],
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
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => {
    const hoy = new Date().getDay()
    return hoy === 0 ? 6 : hoy - 1
  })
  const isMobile = useIsMobile()

  // ── Import Excel ──
  const [semanasExcel, setSemanasExcel] = useState([]) // semanas detectadas
  const [semanaElegida, setSemanaElegida] = useState(null)
  const [importando, setImportando] = useState(false)
  const [modalImport, setModalImport] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { cargarSemana() }, [weekStart])

  async function cargarSemana() {
    setLoading(true)
    const fecha = formatFecha(weekStart)
    let { data: planes } = await supabase.from('meal_plans').select('*').eq('week_start', fecha)
    let plan = planes?.[0]
    if (!plan) {
      const { data: nuevo } = await supabase.from('meal_plans')
        .insert({ user_id: session.user.id, week_start: fecha }).select()
      plan = nuevo?.[0]
    }
    setPlanId(plan.id)
    const { data: meals } = await supabase.from('planned_meals').select('*').eq('plan_id', plan.id)
    const mapa = {}
    meals?.forEach(m => { mapa[`${m.day_of_week}-${m.slot}`] = m })
    setComidas(mapa)
    setLoading(false)
  }

  function semanaAnterior() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  function semanaSiguiente() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  async function duplicarSemanaAnterior() {
    if (!confirm('¿Duplicar todas las comidas de la semana anterior?')) return
    const fechaAnterior = formatFecha(new Date(weekStart.getTime() - 7 * 86400000))
    let { data: planesAnt } = await supabase.from('meal_plans').select('*').eq('week_start', fechaAnterior)
    const planAnterior = planesAnt?.[0]
    if (!planAnterior) { alert('No hay plan en la semana anterior.'); return }
    const { data: comidasAnt } = await supabase.from('planned_meals').select('*').eq('plan_id', planAnterior.id)
    if (!comidasAnt?.length) { alert('La semana anterior no tiene comidas cargadas.'); return }
    const nuevas = comidasAnt.map(({ id, plan_id, ...rest }) => ({ ...rest, plan_id: planId }))
    await supabase.from('planned_meals').insert(nuevas)
    await cargarSemana()
  }

  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array', codepage: 65001 })
      const semanas = parsearExcel(wb)
      if (!semanas.length) {
        alert('No se encontraron semanas en el archivo. Verificá el formato.')
        return
      }
      setSemanasExcel(semanas)
      setSemanaElegida(semanas[semanas.length - 1]) // última semana por defecto
      setModalImport(true)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = '' // reset input
  }

  async function confirmarImport() {
    if (!semanaElegida) return
    if (!confirm(`¿Importar "${semanaElegida.label}" a la semana actual? Esto reemplazará las comidas existentes.`)) return

    setImportando(true)

    // Borrar comidas existentes
    const existentes = Object.values(comidas)
    if (existentes.length > 0) {
      await supabase.from('planned_meals').delete().in('id', existentes.map(c => c.id))
    }

    // Insertar nuevas
    const nuevas = []
    semanaElegida.dias.forEach(dia => {
      const slotMap = { desayuno: dia.desayuno, almuerzo: dia.almuerzo, merienda: dia.merienda, cena: dia.cena }
      SLOTS.forEach(slot => {
        const desc = slotMap[slot]
        if (desc) {
          nuevas.push({ plan_id: planId, day_of_week: dia.diaIdx, slot, description: desc })
        }
      })
    })

    if (nuevas.length > 0) {
      await supabase.from('planned_meals').insert(nuevas)
    }

    await cargarSemana()
    setImportando(false)
    setModalImport(false)
    setSemanasExcel([])
  }

  function abrirModal(dia, slot) {
    const key = `${dia}-${slot}`
    const comida = comidas[key]
    setForm({
      description: comida?.description || '',
      meal_goal: comida?.meal_goal || '',
      is_vianda: comida?.is_vianda || false,
      notes: comida?.notes || ''
    })
    setModal({ dia, slot })
  }

  async function guardarComida() {
    setSaving(true)
    const key = `${modal.dia}-${modal.slot}`
    const existente = comidas[key]
    if (existente) {
      await supabase.from('planned_meals').update(form).eq('id', existente.id)
    } else {
      await supabase.from('planned_meals').insert({
        ...form, plan_id: planId, day_of_week: modal.dia, slot: modal.slot
      })
    }
    await cargarSemana()
    setSaving(false)
    setModal(null)
  }

  async function eliminarComida() {
    const key = `${modal.dia}-${modal.slot}`
    const existente = comidas[key]
    if (existente) await supabase.from('planned_meals').delete().eq('id', existente.id)
    await cargarSemana()
    setModal(null)
  }

  const fechaLunes = weekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  const fechaDomingo = new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })

  const headerSemana = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <button onClick={semanaAnterior} style={btnNav}>←</button>
      <strong style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}>{fechaLunes} — {fechaDomingo}</strong>
      <button onClick={semanaSiguiente} style={btnNav}>→</button>
      <button onClick={duplicarSemanaAnterior} style={btnDuplicar}>
        Duplicar semana anterior
      </button>
      {/* Botones import/template */}
      <button onClick={() => fileRef.current.click()} style={btnImport}>
        ⬆ Importar Excel
      </button>
      <button onClick={descargarTemplate} style={btnTemplate}>
        ⬇ Template
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileChange} />
    </div>
  )

  const vistaMobile = (
    <div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: '0.4rem', marginBottom: '1rem', paddingBottom: '0.25rem' }}>
        {DIAS.map((dia, i) => (
          <button key={i} onClick={() => setDiaSeleccionado(i)} style={{
            flexShrink: 0, padding: '0.4rem 0.75rem', borderRadius: '20px', border: 'none',
            cursor: 'pointer', fontSize: '0.8rem',
            fontWeight: diaSeleccionado === i ? 600 : 400,
            background: diaSeleccionado === i ? '#1A5276' : '#E8F4FD',
            color: diaSeleccionado === i ? 'white' : '#1A5276', transition: 'all 0.15s'
          }}>
            {dia.slice(0, 3)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {SLOTS.map(slot => {
          const comida = comidas[`${diaSeleccionado}-${slot}`]
          return (
            <div key={slot} onClick={() => abrirModal(diaSeleccionado, slot)} style={{
              border: '1px solid #ddd', borderRadius: '8px', padding: '0.75rem 1rem',
              cursor: 'pointer', background: comida ? 'white' : '#fafafa',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'capitalize', marginBottom: '0.2rem' }}>{slot}</div>
                {comida ? (
                  <>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{comida.description}</div>
                    {comida.meal_goal && <div style={{ fontSize: '0.75rem', color: '#666' }}>{comida.meal_goal}</div>}
                    {comida.is_vianda && <div style={{ fontSize: '0.7rem', color: '#148F77' }}>vianda</div>}
                  </>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>+ agregar</div>
                )}
              </div>
              <span style={{ color: '#ccc', fontSize: '1.2rem' }}>›</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  const vistaDesktop = (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '700px' }}>
        <thead>
          <tr>
            <th style={thSlot}></th>
            {DIAS.map(d => <th key={d} style={thDia}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map(slot => (
            <tr key={slot}>
              <td style={tdSlot}>{slot}</td>
              {DIAS.map((_, i) => {
                const comida = comidas[`${i}-${slot}`]
                return (
                  <td key={i} style={tdCelda} onClick={() => abrirModal(i, slot)}>
                    {comida ? (
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{comida.description}</div>
                        {comida.meal_goal && <div style={{ fontSize: '0.75rem', color: '#666' }}>{comida.meal_goal}</div>}
                        {comida.is_vianda && <div style={{ fontSize: '0.7rem', color: '#148F77' }}>vianda</div>}
                      </div>
                    ) : (
                      <span style={{ color: '#ccc', fontSize: '0.8rem' }}>+ agregar</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      {headerSemana}
      {loading ? <p>Cargando...</p> : (isMobile ? vistaMobile : vistaDesktop)}

      {/* ── Modal selección de semana del Excel ── */}
      {modalImport && (
        <div style={overlay}>
          <div style={{ ...modalBox, maxWidth: '480px' }}>
            <h3 style={{ marginTop: 0 }}>Importar desde Excel</h3>
            <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '1rem' }}>
              Se encontraron <strong>{semanasExcel.length}</strong> semana{semanasExcel.length !== 1 ? 's' : ''} en el archivo. Elegí cuál importar a <strong>{fechaLunes} — {fechaDomingo}</strong>:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem', maxHeight: '280px', overflowY: 'auto' }}>
              {semanasExcel.map((s, i) => (
                <div key={i} onClick={() => setSemanaElegida(s)} style={{
                  padding: '0.65rem 1rem', borderRadius: '6px', cursor: 'pointer',
                  border: `2px solid ${semanaElegida === s ? '#1A5276' : '#ddd'}`,
                  background: semanaElegida === s ? '#E8F4FD' : 'white',
                  fontSize: '0.9rem', fontWeight: semanaElegida === s ? 600 : 400
                }}>
                  {s.label}
                  <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '0.5rem' }}>
                    ({s.dias.length} días)
                  </span>
                </div>
              ))}
            </div>

            {/* Preview de la semana elegida */}
            {semanaElegida && (
              <div style={{ background: '#f9f9f9', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#444' }}>
                <strong style={{ display: 'block', marginBottom: '0.4rem', color: '#1A5276' }}>Preview:</strong>
                {semanaElegida.dias.slice(0, 3).map((d, i) => (
                  <div key={i} style={{ marginBottom: '0.25rem' }}>
                    <strong>{DIAS[d.diaIdx]}:</strong> {d.almuerzo || '—'}
                  </div>
                ))}
                {semanaElegida.dias.length > 3 && <div style={{ color: '#888' }}>+ {semanaElegida.dias.length - 3} días más</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={confirmarImport} disabled={importando || !semanaElegida} style={btnGuardar}>
                {importando ? 'Importando...' : 'Importar'}
              </button>
              <button onClick={() => { setModalImport(false); setSemanasExcel([]) }} style={btnCancelar}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal edición comida ── */}
      {modal && (
        <div style={overlay}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>{DIAS[modal.dia]} — {modal.slot}</h3>
            <label>Descripción</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              style={inp} placeholder="Ej: Pechuga con arroz" />
            <label>Objetivo</label>
            <select value={form.meal_goal} onChange={e => setForm({ ...form, meal_goal: e.target.value })} style={inp}>
              <option value="">— ninguno —</option>
              <option value="pre-entreno">Pre-entreno</option>
              <option value="post-entreno">Post-entreno</option>
              <option value="post-partido">Post-partido</option>
              <option value="liviana">Liviana</option>
              <option value="alta proteína">Alta proteína</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
              <input type="checkbox" checked={form.is_vianda} onChange={e => setForm({ ...form, is_vianda: e.target.checked })} />
              Usa vianda
            </label>
            <label>Observaciones</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              style={{ ...inp, height: '60px', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button onClick={guardarComida} disabled={saving} style={btnGuardar}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              {comidas[`${modal.dia}-${modal.slot}`] && (
                <button onClick={eliminarComida} style={btnEliminar}>Eliminar</button>
              )}
              <button onClick={() => setModal(null)} style={btnCancelar}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnNav = { padding: '0.3rem 0.7rem', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer', background: 'white' }
const btnDuplicar = { background: '#148F77', color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer' }
const btnImport = { background: '#1A5276', color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer' }
const btnTemplate = { background: 'white', color: '#1A5276', border: '1px solid #1A5276', padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer' }
const btnGuardar = { background: '#1A5276', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }
const btnEliminar = { background: '#c0392b', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }
const btnCancelar = { border: '1px solid #ccc', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', background: 'white' }
const thDia = { padding: '0.5rem', background: '#1A5276', color: 'white', textAlign: 'center', fontWeight: 500, fontSize: '0.85rem' }
const thSlot = { padding: '0.5rem', background: '#1A5276', width: '90px' }
const tdSlot = { padding: '0.5rem', background: '#D6EAF8', fontWeight: 500, fontSize: '0.85rem', textTransform: 'capitalize', border: '1px solid #ddd' }
const tdCelda = { padding: '0.5rem', border: '1px solid #ddd', cursor: 'pointer', verticalAlign: 'top', minWidth: '110px', minHeight: '60px' }
const overlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalBox = { background: 'white', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '420px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }
const inp = { display: 'block', width: '100%', padding: '0.4rem', marginTop: '0.25rem', marginBottom: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }