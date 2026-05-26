// src/services/geminiPlan.js
// Servicio para generar el plan semanal con Gemini

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function generarPlanSemanal({ perfil, viandas, diaPartido, fechaSemana }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Falta la API Key de Gemini en el archivo .env')

  const stockViandas = viandas.length > 0
    ? viandas.map(v => `• ${v.name}${v.protein_source ? ` (${v.protein_source})` : ''}${v.category ? ` [${v.category}]` : ''} — ${v.portions} porción${v.portions !== 1 ? 'es' : ''}`).join('\n')
    : 'Sin viandas disponibles esta semana.'

  const diasEntreno = perfil?.dias_entreno || ['lunes', 'miercoles', 'viernes']
  const objetivo = perfil?.objetivo || 'recomposicion'
  const pesoKg = perfil?.peso_kg || 65
  const alturaKm = perfil?.altura_cm || 163
  const restricciones = perfil?.restricciones || 'No consumo acelga, atún, zapallitos. Los huevos solo en formato omelette.'
  const notasExtra = perfil?.notas_extra || ''

  const objetivoTexto = {
    recomposicion: 'perder grasa (especialmente abdominal) y ganar o mantener masa muscular',
    definicion: 'perder grasa preservando masa muscular',
    volumen: 'ganar masa muscular con superávit calórico moderado',
  }[objetivo] || 'recomposición corporal'

  const prompt = `Actúa como un Nutricionista Deportivo experto en recomposición corporal.
Pensá paso a paso antes de generar el plan.

OBJETIVO
Mi objetivo es ${objetivoTexto}, manteniendo buen rendimiento para futsal.
Buscar un déficit calórico leve que permita perder grasa sin comprometer rendimiento ni masa muscular.
Priorizar proteína para la recuperación muscular.

CONTEXTO FÍSICO
Soy hombre, contextura compacta y fuerte.
Altura: ${alturaKm} cm
Peso actual: ${pesoKg} kg
Perfil mesomorfo, con buena base muscular pero grasa localizada en abdomen.

Nivel de actividad:
• Entreno gimnasio los días: ${diasEntreno.join(', ')}
• Juego futsal semanalmente — el partido de esta semana es el ${diaPartido}
• Promedio diario de pasos: 12.000 – 15.000
• Siempre entreno antes del almuerzo

HORARIOS DE COMIDA

Desayuno (08:30 – 10:30)
Debe ser liviano y funcional para el entrenamiento posterior.
No suelo desayunar mucho. Ideal: yogur, frutas o algo similar.

Almuerzo (13:00 – 15:00)
Siempre debe usarse una vianda del stock disponible.
En cada almuerzo agregar una base de ensalada verde (rúcula, lechuga o similar) para aportar fibra, mejorar saciedad y ayudar al control glucémico del plato.

Merienda (17:00 – 18:30)
Debe ser proteica y liviana.

Cena (21:00 – 22:30)
Puede ser una vianda del stock o una opción resolutiva rápida, liviana y nutritiva.
Las cenas deben ser altas en proteína y moderadas en carbohidratos.

ALIMENTOS DISPONIBLES PARA CENAS RÁPIDAS
Siempre se puede usar: huevos (solo en formato omelette), jamón, queso, rúcula, tomate, pescado (no atún), carne, cerdo, pollo, milanesas.

RESTRICCIONES ALIMENTARIAS
${restricciones}
${notasExtra ? `NOTAS ADICIONALES: ${notasExtra}` : ''}

REGLAS PARA PLANIFICAR
• Planificar solo de lunes a viernes
• Priorizar proteína en el almuerzo (post entrenamiento)
• Usar siempre una vianda del stock en el almuerzo
• Evitar repetir la misma vianda en días consecutivos si hay otras opciones
• Asignar viandas más pesadas (pastas, papas, platos muy calóricos) a días de mayor carga de entrenamiento
• Las porciones deben ser realistas para recomposición corporal
• El día de partido (${diaPartido}) priorizar nutrición e hidratación

REGLAS SEGÚN DÍA DE PARTIDO
${generarReglasPartido(diaPartido)}

STOCK DE VIANDAS DISPONIBLE
${stockViandas}

FORMATO DE RESPUESTA — MUY IMPORTANTE
Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin explicaciones.
El JSON debe tener exactamente esta estructura:

{
  "plan": [
    {
      "dia": 0,
      "desayuno": "descripción del desayuno",
      "almuerzo": "nombre exacto de la vianda del stock + ensalada verde",
      "merienda": "descripción de la merienda",
      "cena": "descripción de la cena"
    }
  ]
}

Donde "dia" es el índice del día de la semana: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes.
El array debe tener exactamente 5 elementos (lunes a viernes).
No incluyas ningún texto fuera del JSON.`

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.error?.message || 'Error al llamar a Gemini')
  }

  const data = await response.json()
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!texto) throw new Error('Gemini no devolvió respuesta')

  // Limpiar posibles markdown fences
  const limpio = texto.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(limpio)
    if (!parsed.plan || !Array.isArray(parsed.plan)) throw new Error('Formato de respuesta inválido')
    return parsed.plan
  } catch {
    throw new Error('No se pudo parsear la respuesta de Gemini. Intentá de nuevo.')
  }
}

function generarReglasPartido(diaPartido) {
  const reglas = {
    martes: `Si jugás martes:
• Lunes → gimnasio normal
• Martes → partido (sin intermitente)
• Miércoles → full body modulado
• Jueves → cardio ligero`,
    miercoles: `Si jugás miércoles:
• Martes → intermitente
• Miércoles → partido
• Jueves → recuperación activa`,
    jueves: `Si jugás jueves:
• Martes → intermitente
• Miércoles → full body normal
• Jueves → partido
• Viernes → upper sin HIIT si cansado`,
    lunes: `Si jugás lunes:
• Lunes → partido
• Martes → recuperación activa
• Resto → rutina normal`,
    viernes: `Si jugás viernes:
• Viernes → partido (sin HIIT)
• Sábado → recuperación activa`,
  }
  return reglas[diaPartido] || `Día de partido: ${diaPartido}. Priorizar nutrición e hidratación ese día.`
}
