import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const C = {
  bg: '#0F1117', surface: '#1A1D27', surfaceHigh: '#22263A',
  border: '#2A2D3E', accent: '#10B981', accentDim: '#10B98118',
  accentText: '#34D399', blue: '#3B82F6', blueDim: '#3B82F618',
  red: '#EF4444', yellow: '#F59E0B',
  textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#4B5563',
}

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
const DIAS_LABELS = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie' }

export default function Perfil({ session }) {
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    peso_kg: '',
    altura_cm: '',
    objetivo: 'recomposicion',
    dias_entreno: ['lunes', 'miercoles', 'viernes'],
    dia_partido: 'martes',
    restricciones: 'No consumo acelga, atún, zapallitos. Los huevos solo en formato omelette.',
    notas_extra: '',
  })

  useEffect(() => { cargarPerfil() }, [])

  async function cargarPerfil() {
    setLoading(true)
    const { data } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    if (data) {
      setPerfil(data)
      setForm({
        peso_kg: data.peso_kg || '',
        altura_cm: data.altura_cm || '',
        objetivo: data.objetivo || 'recomposicion',
        dias_entreno: data.dias_entreno || ['lunes', 'miercoles', 'viernes'],
        dia_partido: data.dia_partido || 'martes',
        restricciones: data.restricciones || '',
        notas_extra: data.notas_extra || '',
      })
    }
    setLoading(false)
  }

  async function guardar() {
    setSaving(true)
    const datos = { ...form, peso_kg: Number(form.peso_kg) || null, altura_cm: Number(form.altura_cm) || null, user_id: session.user.id, updated_at: new Date().toISOString() }
    if (perfil) {
      await supabase.from('user_profile').update(datos).eq('user_id', session.user.id)
    } else {
      await supabase.from('user_profile').insert(datos)
    }
    await cargarPerfil()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function toggleDia(dia) {
    const actual = form.dias_entreno
    if (actual.includes(dia)) {
      setForm({ ...form, dias_entreno: actual.filter(d => d !== dia) })
    } else {
      setForm({ ...form, dias_entreno: [...actual, dia] })
    }
  }

  const inp = {
    display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 0',
    border: `1px solid ${C.border}`, borderRadius: '8px', boxSizing: 'border-box',
    background: C.surfaceHigh, color: C.textPrimary, fontSize: '14px', outline: 'none',
  }

  if (loading) return <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>Cargando...</div>

  return (
    <div style={{ color: C.textPrimary, maxWidth: '480px' }}>
      <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '1.5rem' }}>Mi Perfil</div>

      {/* Datos físicos */}
      <Section title="Datos físicos" icon="📊">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Peso actual (kg)</label>
            <input type="number" value={form.peso_kg} onChange={e => setForm({ ...form, peso_kg: e.target.value })}
              style={inp} placeholder="65" />
          </div>
          <div>
            <label style={labelStyle}>Altura (cm)</label>
            <input type="number" value={form.altura_cm} onChange={e => setForm({ ...form, altura_cm: e.target.value })}
              style={inp} placeholder="163" />
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <label style={labelStyle}>Objetivo</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {[['recomposicion', '⚡ Recomposición'], ['definicion', '🔥 Definición'], ['volumen', '💪 Volumen']].map(([val, label]) => (
              <button key={val} onClick={() => setForm({ ...form, objetivo: val })} style={{
                padding: '7px 14px', borderRadius: '20px', border: `1px solid ${form.objetivo === val ? C.accent : C.border}`,
                background: form.objetivo === val ? C.accentDim : 'transparent',
                color: form.objetivo === val ? C.accentText : C.textSecondary,
                cursor: 'pointer', fontSize: '13px', fontWeight: form.objetivo === val ? 700 : 400,
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* Entrenamiento */}
      <Section title="Entrenamiento" icon="🏋️">
        <div>
          <label style={labelStyle}>Días de gimnasio</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {DIAS_SEMANA.map(dia => {
              const activo = form.dias_entreno.includes(dia)
              return (
                <button key={dia} onClick={() => toggleDia(dia)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: `1px solid ${activo ? C.accent : C.border}`,
                  background: activo ? C.accentDim : 'transparent',
                  color: activo ? C.accentText : C.textMuted,
                  cursor: 'pointer', fontSize: '12px', fontWeight: activo ? 700 : 400,
                  transition: 'all 0.15s',
                }}>{DIAS_LABELS[dia]}</button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: '14px' }}>
          <label style={labelStyle}>Día habitual de partido (futsal)</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {DIAS_SEMANA.map(dia => (
              <button key={dia} onClick={() => setForm({ ...form, dia_partido: dia })} style={{
                flex: 1, padding: '8px 4px', borderRadius: '8px',
                border: `1px solid ${form.dia_partido === dia ? C.yellow : C.border}`,
                background: form.dia_partido === dia ? C.yellow + '18' : 'transparent',
                color: form.dia_partido === dia ? C.yellow : C.textMuted,
                cursor: 'pointer', fontSize: '12px', fontWeight: form.dia_partido === dia ? 700 : 400,
                transition: 'all 0.15s',
              }}>{DIAS_LABELS[dia]}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* Restricciones */}
      <Section title="Alimentación" icon="🥗">
        <div>
          <label style={labelStyle}>Restricciones alimentarias</label>
          <textarea value={form.restricciones} onChange={e => setForm({ ...form, restricciones: e.target.value })}
            style={{ ...inp, height: '80px', resize: 'vertical', marginTop: '6px' }}
            placeholder="Ej: No consumo acelga, atún. Huevos solo en omelette." />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label style={labelStyle}>Notas extra para el plan</label>
          <textarea value={form.notas_extra} onChange={e => setForm({ ...form, notas_extra: e.target.value })}
            style={{ ...inp, height: '70px', resize: 'vertical', marginTop: '6px' }}
            placeholder="Ej: Prefiero cenas livianas, no me gustan las legumbres..." />
        </div>
      </Section>

      {/* Botón guardar */}
      <button onClick={guardar} disabled={saving} style={{
        width: '100%', padding: '13px', background: saved ? '#059669' : C.accent,
        color: 'white', border: 'none', borderRadius: '10px',
        cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: '15px',
        opacity: saving ? 0.7 : 1, transition: 'background 0.3s',
        marginTop: '8px',
      }}>
        {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar perfil'}
      </button>

      <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '10px', textAlign: 'center' }}>
        El generador de plan semanal con IA usará estos datos automáticamente.
      </div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: C.textPrimary }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

const C_ref = { textMuted: '#4B5563' }
const labelStyle = { fontSize: '12px', color: '#94A3B8', display: 'block' }
