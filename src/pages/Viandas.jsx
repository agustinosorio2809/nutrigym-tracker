import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const C = {
  bg: '#0F1117', surface: '#1A1D27', surfaceHigh: '#22263A',
  border: '#2A2D3E', accent: '#10B981', accentDim: '#10B98118',
  accentText: '#34D399', red: '#EF4444', redDim: '#EF444418',
  textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#4B5563',
}

const PROTEINA_ICONS = { pechuga: '🍗', filet: '🐟', 'carne vacuna': '🥩', cerdo: '🐷', otro: '🍽️' }

export default function Viandas({ session }) {
  const [viandas, setViandas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', protein_source: '', category: '', portions: 1, notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargarViandas() }, [])

  async function cargarViandas() {
    setLoading(true)
    const { data } = await supabase.from('viandas').select('*').eq('user_id', session.user.id).order('name')
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
    await cargarViandas(); setSaving(false); setModal(null)
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

  const inp = {
    display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 14px',
    border: `1px solid ${C.border}`, borderRadius: '8px', boxSizing: 'border-box',
    background: C.surfaceHigh, color: C.textPrimary, fontSize: '14px', outline: 'none',
  }

  const totalPorciones = viandas.reduce((sum, v) => sum + (v.portions || 0), 0)

  return (
    <div style={{ color: C.textPrimary }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Viandas</div>
          {viandas.length > 0 && (
            <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
              {viandas.length} tipos · {totalPorciones} porciones disponibles
            </div>
          )}
        </div>
        <button onClick={abrirNueva} style={{
          background: C.accent, color: 'white', border: 'none',
          padding: '9px 16px', borderRadius: '10px', cursor: 'pointer',
          fontWeight: 700, fontSize: '14px',
        }}>+ Nueva</button>
      </div>

      {loading ? (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>Cargando...</div>
      ) : viandas.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📦</div>
          <div style={{ color: C.textSecondary, fontSize: '14px' }}>No tenés viandas cargadas todavía.</div>
          <button onClick={abrirNueva} style={{ marginTop: '1rem', background: C.accent, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>
            Agregar primera vianda
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {viandas.map(v => {
            const agotada = v.portions === 0
            const icon = PROTEINA_ICONS[v.protein_source] || '🍱'
            return (
              <div key={v.id} style={{
                background: C.surface,
                border: `1px solid ${agotada ? C.border : C.accent + '30'}`,
                borderRadius: '14px', padding: '16px',
                opacity: agotada ? 0.65 : 1,
                transition: 'opacity 0.15s',
              }}>
                {/* Header card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '18px' }}>{icon}</span>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                    </div>
                    {v.protein_source && <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'capitalize' }}>{v.protein_source}</div>}
                    {v.category && (
                      <span style={{ fontSize: '10px', background: C.accentDim, color: C.accentText, padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px', textTransform: 'capitalize' }}>
                        {v.category}
                      </span>
                    )}
                  </div>
                  {/* Porciones */}
                  <div style={{ textAlign: 'center', minWidth: '52px', marginLeft: '12px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1, color: agotada ? C.red : C.accentText }}>{v.portions}</div>
                    <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '2px' }}>porciones</div>
                  </div>
                </div>

                {v.notes && <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '12px', fontStyle: 'italic', borderTop: `1px solid ${C.border}`, paddingTop: '8px' }}>{v.notes}</div>}

                {/* Controles */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={() => ajustarPorciones(v.id, -1)} disabled={v.portions === 0}
                    style={{ width: '34px', height: '34px', border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '16px', background: C.surfaceHigh, color: C.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: v.portions === 0 ? 0.4 : 1 }}>−</button>
                  <button onClick={() => ajustarPorciones(v.id, 1)}
                    style={{ width: '34px', height: '34px', border: `1px solid ${C.accent}40`, borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '16px', background: C.accentDim, color: C.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => abrirEditar(v)}
                    style={{ fontSize: '12px', border: `1px solid ${C.border}`, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', color: C.textSecondary }}>Editar</button>
                  <button onClick={() => eliminar(v.id)}
                    style={{ fontSize: '12px', border: `1px solid ${C.red}40`, color: C.red, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ width: '40px', height: '4px', background: C.border, borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.textPrimary, marginBottom: '1.25rem' }}>
              {modal === 'nueva' ? 'Nueva vianda' : 'Editar vianda'}
            </div>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Nombre</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder="Ej: Pollo con arroz integral" />

            <label style={{ fontSize: '12px', color: C.textMuted }}>Proteína principal</label>
            <select value={form.protein_source} onChange={e => setForm({ ...form, protein_source: e.target.value })} style={inp}>
              <option value="">— seleccioná —</option>
              {['pechuga', 'filet', 'carne vacuna', 'cerdo', 'otro'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Categoría</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>
              <option value="">— seleccioná —</option>
              {['alto proteico', 'bajo en grasa', 'equilibrado', 'otro'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <label style={{ fontSize: '12px', color: C.textMuted }}>Porciones disponibles</label>
            <input type="number" min="0" value={form.portions} onChange={e => setForm({ ...form, portions: e.target.value })} style={inp} />

            <label style={{ fontSize: '12px', color: C.textMuted }}>Notas</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inp, height: '70px', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={guardar} disabled={saving || !form.name} style={{
                flex: 1, background: C.accent, color: 'white', border: 'none',
                padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px',
                opacity: saving || !form.name ? 0.5 : 1,
              }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModal(null)} style={{
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
