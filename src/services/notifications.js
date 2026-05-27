// src/services/notifications.js
// Servicio para programar notificaciones locales con Capacitor

import { LocalNotifications } from '@capacitor/local-notifications'

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

// Verifica si estamos en un entorno Capacitor nativo (Android/iOS)
function esNativo() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
}

export async function pedirPermiso() {
  if (!esNativo()) return false
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted'
}

export async function programarNotificaciones(perfil) {
  if (!esNativo()) return

  // Pedir permiso si no lo tenemos
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') {
    const { display: nuevo } = await LocalNotifications.requestPermissions()
    if (nuevo !== 'granted') return
  }

  // Cancelar todas las notificaciones anteriores
  await LocalNotifications.cancel({ notifications: Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })) })

  const notificaciones = []
  let id = 1

  const diasEntreno = perfil?.dias_entreno || ['lunes', 'miercoles', 'viernes']

  // Programar para los próximos 7 días
  for (let offsetDia = 0; offsetDia < 7; offsetDia++) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + offsetDia)
    fecha.setSeconds(0)
    fecha.setMilliseconds(0)

    const diaSemana = DIAS_SEMANA[fecha.getDay()]
    const esLaborable = !['sabado', 'domingo'].includes(diaSemana)

    // Notificación almuerzo (lunes a viernes)
    if (esLaborable && perfil?.notif_almuerzo_activa !== false) {
      const [hora, minuto] = (perfil?.notif_almuerzo_hora || '13:30').split(':').map(Number)
      const fechaAlmuerzo = new Date(fecha)
      fechaAlmuerzo.setHours(hora, minuto, 0, 0)
      if (fechaAlmuerzo > new Date()) {
        notificaciones.push({
          id: id++,
          title: '🍽️ ¿Registraste el almuerzo?',
          body: 'Tocá para registrar tu comida del mediodía.',
          schedule: { at: fechaAlmuerzo, allowWhileIdle: true },
          sound: null,
          smallIcon: 'ic_launcher',
          iconColor: '#10B981',
        })
      }
    }

    // Notificación cena (lunes a viernes)
    if (esLaborable && perfil?.notif_cena_activa !== false) {
      const [hora, minuto] = (perfil?.notif_cena_hora || '21:30').split(':').map(Number)
      const fechaCena = new Date(fecha)
      fechaCena.setHours(hora, minuto, 0, 0)
      if (fechaCena > new Date()) {
        notificaciones.push({
          id: id++,
          title: '🌙 ¿Registraste la cena?',
          body: 'Cerrá el día registrando tu cena.',
          schedule: { at: fechaCena, allowWhileIdle: true },
          sound: null,
          smallIcon: 'ic_launcher',
          iconColor: '#10B981',
        })
      }
    }

    // Notificación gym (solo días de entreno)
    if (diasEntreno.includes(diaSemana) && perfil?.notif_gym_activa !== false) {
      const [hora, minuto] = (perfil?.notif_gym_hora || '11:30').split(':').map(Number)
      const fechaGym = new Date(fecha)
      fechaGym.setHours(hora, minuto, 0, 0)
      if (fechaGym > new Date()) {
        notificaciones.push({
          id: id++,
          title: '💪 ¿Cargaste tu sesión de gym?',
          body: 'Registrá los ejercicios de hoy.',
          schedule: { at: fechaGym, allowWhileIdle: true },
          sound: null,
          smallIcon: 'ic_launcher',
          iconColor: '#10B981',
        })
      }
    }
  }

  if (notificaciones.length > 0) {
    await LocalNotifications.schedule({ notifications: notificaciones })
  }
}

export async function cancelarTodasLasNotificaciones() {
  if (!esNativo()) return
  await LocalNotifications.cancel({
    notifications: Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }))
  })
}
