import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

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

export default function Dashboard({ session }) {
  const [comidas, setComidas] = useState([])
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ status: '', actual_meal: '', exception_type: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const hoy = new Date()
  const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
  const lunes = getLunes(hoy)
  const fechaHoy = formatFecha(hoy)

  useEffect(() => { cargarHoy() }, [])

  async function cargarHoy() {
    setLoading(true)
    const fechaLunes = formatFecha(lunes)

    let { data: planes } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('week_start', fechaLunes)

    const plan = planes?.[0]
    if (!plan) { setLoading(false); return }

    const { data: meals } = await supabase
      .from('planned_meals')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('day_of_week', diaSemana)
      .order('slot')

    const ordered = SLOTS.map(s => meals?.find(m => m.slot === s)).filter(Boolean)
    setComidas(ordered)

    if (meals?.length) {
      const ids = meals.map(m => m.id)
      const { data: logsData } = await supabase
        .from('meal_logs')
        .select('*')
        .in('planned_meal_id', ids)

      const mapa = {}
      logsData?.forEach(l => { mapa[l.planned_meal_id] = l })
      setLogs(mapa)
    }

    setLoading(false)
  }

  function abrirModal(comida) {
    const log = logs[comida.id]
    setForm({
      status: log?.status || '',
      actual_meal: log?.actual_meal || '',
      exception_type: log?.exception_type || '',
      notes: log?.notes || ''
    })
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

  const cumplidas = Object.values(logs).filter(l => l.status === 'cumplida' || l.status === 'con_cambios').length
  const total = comidas.length
  const adherencia = total > 0 ? Math.round((cumplidas / total) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Hoy — {hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {total > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: adherencia >= 75 ? '#148F77' : adherencia >= 50 ? '#D4AC0D' : '#C0392B' }}>
              {adherencia}%
            </div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>{cumplidas}/{total} comidas</div>
          </div>
        )}
      </div>

      {loading ? <p>Cargando...</p> : comidas.length === 0 ? (
        <p style={{ color: '#888' }}>No hay comidas planificadas para hoy. Cargalas en <a href="/plan">Plan semanal</a>.</p>
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
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'capitalize' }}>{comida.slot}</div>
                  <div style={{ fontWeight: 500 }}>{comida.description}</div>
                  {comida.meal_goal && <div style={{ fontSize: '0.8rem', color: '#666' }}>{comida.meal_goal}</div>}
                  {comida.is_vianda && <div style={{ fontSize: '0.75rem', color: '#148F77' }}>vianda</div>}
                  {log?.actual_meal && <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.25rem' }}>→ {log.actual_meal}</div>}
                  {log?.exception_type && <div style={{ fontSize: '0.75rem', color: '#D4AC0D' }}>⚡ {log.exception_type}</div>}
                </div>
                <div style={{ color: estado ? ESTADO_COLORS[estado] : '#ccc', fontWeight: 500, fontSize: '0.85rem', textAlign: 'right' }}>
                  {estado ? ESTADO_LABELS[estado] : 'Sin registrar'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ marginTop: 0 }}>{modal.slot} — {modal.description}</h3>
            <label>Estado</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}>
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
                style={{ display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}>
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