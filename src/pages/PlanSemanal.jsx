import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SLOTS = ['desayuno', 'almuerzo', 'merienda', 'cena']

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

export default function PlanSemanal({ session }) {
  const [weekStart, setWeekStart] = useState(getLunes(new Date()))
  const [planId, setPlanId] = useState(null)
  const [comidas, setComidas] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { dia, slot }
  const [form, setForm] = useState({ description: '', meal_goal: '', is_vianda: false, notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargarSemana() }, [weekStart])

async function cargarSemana() {
  setLoading(true)
  const fecha = formatFecha(weekStart)

  let { data: planes } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('week_start', fecha)

  let plan = planes?.[0]

  if (!plan) {
    const { data: nuevo } = await supabase
      .from('meal_plans')
      .insert({ user_id: session.user.id, week_start: fecha })
      .select()
    plan = nuevo?.[0]
  }

  setPlanId(plan.id)

  const { data: meals } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('plan_id', plan.id)

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

  let { data: planesAnt } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('week_start', fechaAnterior)

  const planAnterior = planesAnt?.[0]
  if (!planAnterior) { alert('No hay plan en la semana anterior.'); return }

  const { data: comidasAnt } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('plan_id', planAnterior.id)

  if (!comidasAnt?.length) { alert('La semana anterior no tiene comidas cargadas.'); return }

  const nuevas = comidasAnt.map(({ id, plan_id, ...rest }) => ({ ...rest, plan_id: planId }))
  await supabase.from('planned_meals').insert(nuevas)
  await cargarSemana()
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
  <button onClick={semanaAnterior}>←</button>
  <strong>{fechaLunes} — {fechaDomingo}</strong>
  <button onClick={semanaSiguiente}>→</button>
  <button onClick={duplicarSemanaAnterior} style={{ marginLeft: '1rem', background: '#148F77', color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer' }}>
    Duplicar semana anterior
  </button>
</div>

      {loading ? <p>Cargando...</p> : (
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
      )}

      {modal && (
        <div style={overlay}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>{DIAS[modal.dia]} — {modal.slot}</h3>
            <label>Descripción</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              style={input} placeholder="Ej: Pechuga con arroz" />
            <label>Objetivo</label>
            <select value={form.meal_goal} onChange={e => setForm({ ...form, meal_goal: e.target.value })} style={input}>
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
              style={{ ...input, height: '60px', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={guardarComida} disabled={saving} style={{ background: '#1A5276', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              {comidas[`${modal.dia}-${modal.slot}`] && (
                <button onClick={eliminarComida} style={{ background: '#c0392b', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                  Eliminar
                </button>
              )}
              <button onClick={() => setModal(null)} style={{ border: '1px solid #ccc', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thDia = { padding: '0.5rem', background: '#1A5276', color: 'white', textAlign: 'center', fontWeight: 500, fontSize: '0.85rem' }
const thSlot = { padding: '0.5rem', background: '#1A5276', width: '90px' }
const tdSlot = { padding: '0.5rem', background: '#D6EAF8', fontWeight: 500, fontSize: '0.85rem', textTransform: 'capitalize', border: '1px solid #ddd' }
const tdCelda = { padding: '0.5rem', border: '1px solid #ddd', cursor: 'pointer', verticalAlign: 'top', minWidth: '110px', minHeight: '60px' }
const overlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalBox = { background: 'white', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }
const input = { display: 'block', width: '100%', padding: '0.4rem', marginTop: '0.25rem', marginBottom: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }