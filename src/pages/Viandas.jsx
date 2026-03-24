import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Viandas({ session }) {
  const [viandas, setViandas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', protein_source: '', category: '', portions: 1, notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargarViandas() }, [])

  async function cargarViandas() {
    setLoading(true)
    const { data } = await supabase
      .from('viandas')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name')
    setViandas(data || [])
    setLoading(false)
  }

  function abrirNueva() {
    setForm({ name: '', protein_source: '', category: '', portions: 1, notes: '' })
    setModal('nueva')
  }

  function abrirEditar(v) {
    setForm({ name: v.name, protein_source: v.protein_source || '', category: v.category || '', portions: v.portions, notes: v.notes || '' })
    setModal(v)
  }

  async function guardar() {
    setSaving(true)
    if (modal === 'nueva') {
      await supabase.from('viandas').insert({ ...form, user_id: session.user.id, portions: Number(form.portions) })
    } else {
      await supabase.from('viandas').update({ ...form, portions: Number(form.portions) }).eq('id', modal.id)
    }
    await cargarViandas()
    setSaving(false)
    setModal(null)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta vianda?')) return
    await supabase.from('viandas').delete().eq('id', id)
    await cargarViandas()
  }

  async function ajustarPorciones(id, delta) {
    const v = viandas.find(x => x.id === id)
    const nuevas = Math.max(0, v.portions + delta)
    await supabase.from('viandas').update({ portions: nuevas }).eq('id', id)
    await cargarViandas()
  }

  const inp = { display: 'block', width: '100%', padding: '0.4rem', margin: '0.25rem 0 0.75rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Viandas</h2>
        <button onClick={abrirNueva} style={{ background: '#1A5276', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
          + Nueva vianda
        </button>
      </div>

      {loading ? <p>Cargando...</p> : viandas.length === 0 ? (
        <p style={{ color: '#888' }}>No tenés viandas cargadas todavía.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {viandas.map(v => (
            <div key={v.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', background: v.portions === 0 ? '#fafafa' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{v.name}</div>
                  {v.protein_source && <div style={{ fontSize: '0.8rem', color: '#555' }}>{v.protein_source}</div>}
                  {v.category && <div style={{ fontSize: '0.75rem', color: '#888' }}>{v.category}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: v.portions === 0 ? '#C0392B' : '#148F77' }}>{v.portions}</div>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>porciones</div>
                </div>
              </div>
              {v.notes && <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>{v.notes}</div>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
                <button onClick={() => ajustarPorciones(v.id, -1)} disabled={v.portions === 0}
                  style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>−</button>
                <button onClick={() => ajustarPorciones(v.id, 1)}
                  style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                <button onClick={() => abrirEditar(v)}
                  style={{ fontSize: '0.8rem', border: '1px solid #ccc', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
                <button onClick={() => eliminar(v.id)}
                  style={{ fontSize: '0.8rem', border: '1px solid #C0392B', color: '#C0392B', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ marginTop: 0 }}>{modal === 'nueva' ? 'Nueva vianda' : 'Editar vianda'}</h3>
            <label>Nombre</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder="Ej: Pollo con arroz integral" />
            <label>Proteína principal</label>
            <select value={form.protein_source} onChange={e => setForm({ ...form, protein_source: e.target.value })} style={inp}>
              <option value="">— seleccioná —</option>
              <option value="pechuga">Pechuga</option>
              <option value="filet">Filet</option>
              <option value="carne vacuna">Carne vacuna</option>
              <option value="cerdo">Cerdo</option>
              <option value="otro">Otro</option>
            </select>
            <label>Categoría</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>
              <option value="">— seleccioná —</option>
              <option value="alto proteico">Alto proteico</option>
              <option value="bajo en grasa">Bajo en grasa</option>
              <option value="equilibrado">Equilibrado</option>
              <option value="otro">Otro</option>
            </select>
            <label>Porciones disponibles</label>
            <input type="number" min="0" value={form.portions} onChange={e => setForm({ ...form, portions: e.target.value })} style={inp} />
            <label>Notas</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inp, height: '60px', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={guardar} disabled={saving || !form.name}
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