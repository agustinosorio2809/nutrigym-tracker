import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { programarNotificaciones } from '../services/notifications'
import { C } from '../theme'
import { IconChart, IconGym, IconSalad, IconBell, IconCheck, IconSunrise, IconMoon } from '../components/icons'
import { useInteractiveStyle, focusRing } from '../hooks/useInteractiveStyle'

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
    notif_almuerzo_activa: true,
    notif_almuerzo_hora: '13:30',
    notif_cena_activa: true,
    notif_cena_hora: '21:30',
    notif_gym_activa: true,
    notif_gym_hora: '11:30',
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
        notif_almuerzo_activa: data.notif_almuerzo_activa ?? true,
        notif_almuerzo_hora: data.notif_almuerzo_hora || '13:30',
        notif_cena_activa: data.notif_cena_activa ?? true,
        notif_cena_hora: data.notif_cena_hora || '21:30',
        notif_gym_activa: data.notif_gym_activa ?? true,
        notif_gym_hora: data.notif_gym_hora || '11:30',
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
    await programarNotificaciones({ ...form, user_id: session.user.id })
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

  if (loading) return <div style={{ color: C.textMuted, textAlign: 'center', padding: '2rem' }}>Cargando…</div>

  const OBJETIVOS = [['recomposicion', 'Recomposición'], ['definicion', 'Definición'], ['volumen', 'Volumen']]
  const NOTIFS = [
    { key: 'almuerzo', label: 'Recordatorio almuerzo', Icon: IconSunrise, activaKey: 'notif_almuerzo_activa', horaKey: 'notif_almuerzo_hora' },
    { key: 'cena', label: 'Recordatorio cena', Icon: IconMoon, activaKey: 'notif_cena_activa', horaKey: 'notif_cena_hora' },
    { key: 'gym', label: 'Recordatorio gym', Icon: IconGym, activaKey: 'notif_gym_activa', horaKey: 'notif_gym_hora' },
  ]

  return (
    <div style={{ color: C.textPrimary, maxWidth: '480px' }}>
      <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '1.5rem' }}>Mi Perfil</div>

      <Section title="Datos físicos" Icon={IconChart}>
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
            {OBJETIVOS.map(([val, label]) => (
              <PillToggle key={val} active={form.objetivo === val} onClick={() => setForm({ ...form, objetivo: val })}>{label}</PillToggle>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Entrenamiento" Icon={IconGym}>
        <div>
          <label style={labelStyle}>Días de gimnasio</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {DIAS_SEMANA.map(dia => (
              <DiaToggle key={dia} active={form.dias_entreno.includes(dia)} onClick={() => toggleDia(dia)}>{DIAS_LABELS[dia]}</DiaToggle>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '14px' }}>
          <label style={labelStyle}>Día habitual de partido (futsal)</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {[...DIAS_SEMANA, 'ninguno'].map(dia => (
              <PartidoToggle key={dia} active={form.dia_partido === dia} isNone={dia === 'ninguno'} onClick={() => setForm({ ...form, dia_partido: dia })}>
                {dia === 'ninguno' ? 'Ninguno' : DIAS_LABELS[dia]}
              </PartidoToggle>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Alimentación" Icon={IconSalad}>
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
            placeholder="Ej: Prefiero cenas livianas, no me gustan las legumbres…" />
        </div>
      </Section>

      <Section title="Notificaciones" Icon={IconBell}>
        {NOTIFS.map(({ key, label, Icon, activaKey, horaKey }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div onClick={() => setForm({ ...form, [activaKey]: !form[activaKey] })}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer',
                  background: form[activaKey] ? C.accent : C.border, transition: 'background-color 0.2s', flexShrink: 0,
                }}>
                <div style={{
                  position: 'absolute', top: '3px', left: form[activaKey] ? '23px' : '3px',
                  width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: form[activaKey] ? C.textPrimary : C.textMuted }}>
                <Icon size={13} color={form[activaKey] ? C.textSecondary : C.textMuted} />{label}
              </span>
            </div>
            <input type="time" value={form[horaKey]} onChange={e => setForm({ ...form, [horaKey]: e.target.value })}
              disabled={!form[activaKey]} style={{
                padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: '8px',
                background: C.surfaceHigh, color: form[activaKey] ? C.textPrimary : C.textMuted,
                fontSize: '14px', outline: 'none', opacity: form[activaKey] ? 1 : 0.4,
              }} />
          </div>
        ))}
        <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>
          Las notificaciones se programan al guardar. Solo funcionan en la app del teléfono.
        </div>
      </Section>

      <GuardarButton onClick={guardar} disabled={saving} saved={saved} saving={saving} />

      <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '10px', textAlign: 'center' }}>
        El generador de plan semanal con IA usará estos datos automáticamente.
      </div>
    </div>
  )
}

function Section({ title, Icon, children }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <Icon size={16} color={C.accent} />
        <span style={{ fontWeight: 700, fontSize: '14px', color: C.textPrimary }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function PillToggle({ active, onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    {
      padding: '7px 14px', borderRadius: '20px', border: `1px solid ${active ? C.accent : C.border}`,
      background: active ? C.accentDim : 'transparent',
      color: active ? C.accentText : C.textSecondary,
      cursor: 'pointer', fontSize: '13px', fontWeight: active ? 700 : 400,
    },
    { hover: active ? null : { borderColor: C.textMuted, color: C.textPrimary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

function DiaToggle({ active, onClick, children }) {
  const { style, handlers } = useInteractiveStyle(
    {
      flex: 1, padding: '8px 4px', borderRadius: '8px', border: `1px solid ${active ? C.accent : C.border}`,
      background: active ? C.accentDim : 'transparent',
      color: active ? C.accentText : C.textMuted,
      cursor: 'pointer', fontSize: '12px', fontWeight: active ? 700 : 400,
    },
    { hover: active ? null : { borderColor: C.textMuted, color: C.textSecondary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

function PartidoToggle({ active, isNone, onClick, children }) {
  const color = isNone ? C.textSecondary : C.yellow
  const { style, handlers } = useInteractiveStyle(
    {
      flex: 1, padding: '8px 4px', borderRadius: '8px',
      border: `1px solid ${active ? (isNone ? C.border : C.yellow) : C.border}`,
      background: active ? (isNone ? C.surfaceHigh : C.yellow + '18') : 'transparent',
      color: active ? color : C.textMuted,
      cursor: 'pointer', fontSize: '11px', fontWeight: active ? 700 : 400,
    },
    { hover: active ? null : { borderColor: C.textMuted, color: C.textSecondary }, focus: focusRing }
  )
  return <button onClick={onClick} style={style} {...handlers}>{children}</button>
}

function GuardarButton({ onClick, disabled, saving, saved }) {
  const { style, handlers } = useInteractiveStyle(
    {
      width: '100%', padding: '13px', background: saved ? '#059669' : C.accent,
      color: 'white', border: 'none', borderRadius: '10px',
      cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: '15px',
      opacity: saving ? 0.7 : 1, marginTop: '8px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    },
    { hover: saving ? null : { filter: 'brightness(1.08)' }, focus: focusRing }
  )
  return (
    <button onClick={onClick} disabled={disabled} style={style} {...handlers}>
      {saved && <IconCheck size={15} color="white" />}
      {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar perfil'}
    </button>
  )
}

const labelStyle = { fontSize: '12px', color: '#94A3B8', display: 'block' }
