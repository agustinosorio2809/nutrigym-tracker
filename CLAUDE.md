# NutriGym Tracker — CLAUDE.md

Contexto de proyecto para Claude Code. Leer antes de tocar cualquier archivo.

---

## Comandos esenciales

```bash
npm run dev          # Dev server en localhost:5173
npm run build        # Build de produccion (genera dist/)
npm test             # Suite de tests (Vitest) — correr antes de cada commit
npx cap sync android # Sincroniza dist/ al proyecto Android (Capacitor)
npx cap open android # Abre Android Studio (build manual del APK)
```

Deploy: `git push origin main` dispara automaticamente Vercel (web) y GitHub Actions (APK debug).

---

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend / DB | Supabase (PostgreSQL + RLS + Auth) |
| Deploy web | Vercel |
| Mobile | Capacitor 8 (Android APK) |
| IA | Google Gemini 2.5 Flash Lite (via `v1beta`) |
| Graficos | Recharts |
| Excel | ExcelJS (`exceljs`) |
| Notificaciones | `@capacitor/local-notifications` |

---

## Estructura de archivos clave

```
api/
  gemini.js                # Vercel serverless proxy — reenvía peticiones a Gemini con GEMINI_API_KEY
src/
  App.jsx                  # Navbar, auth, routing, programacion de notificaciones
  supabase.js              # Cliente Supabase (singleton)
  pages/
    Dashboard.jsx          # Vista "Hoy" + reportes + graficos
    PlanSemanal.jsx        # Grilla semanal Lun-Dom, importacion Excel, generador IA
    Viandas.jsx            # Inventario de viandas con ajuste de porciones
    Gimnasio.jsx           # Sesiones de gym + historial
    Perfil.jsx             # Datos fisicos, dias de entrenamiento, config notificaciones
  theme.js                 # Tokens de color y espaciado (C, SPACE, ESTADO_COLORS)
  components/
    gym.jsx                # Componentes de presentación de la pantalla de Gimnasio
    actividad.jsx          # Componentes de presentación del reporte de Actividad (heatmap)
    icons.jsx              # Set unico de iconos SVG dibujados a mano
  hooks/
    useInteractiveStyle.js # Hover/focus/active sin CSS (el proyecto es 100% inline)
  services/
    geminiPlan.js          # Llama a /api/gemini (proxy) para generar plan semanal
    notifications.js       # Programacion de notificaciones locales (Capacitor)
    progresion.js          # Motor de progresión: sugerencia de peso, estancamiento, deload
    oneRepMax.js           # Epley 1RM, mejor serie, PR, e identidad de ejercicios por nombre
    musculos.js            # Mapa ejercicio -> grupo muscular (GRUPOS, MAPA, grupoDe)
    actividad.js           # Agregación de actividad: volumen por dia/grupo, intensidad, rachas
supabase/
  migrations/              # Migraciones SQL del schema (incluyendo RLS policies)
.github/
  workflows/
    build-apk.yml          # CI: Node 22 + Java 21 -> assembleDebug -> artifact
```

---

## Base de datos (Supabase)

RLS activado en todas las tablas. Cada usuario ve solo sus propios datos.

### Tablas

| Tabla | Descripcion | Columnas clave |
|---|---|---|
| `meal_plans` | Plan semanal | `id`, `user_id`, `week_start` (lunes de la semana) |
| `planned_meals` | Comidas planificadas | `id`, `plan_id`, `day_of_week` (0=Lun..6=Dom), `slot` (desayuno/almuerzo/merienda/cena), `description`, `meal_goal`, `is_vianda`, `notes` |
| `meal_logs` | Registro diario | `id`, `planned_meal_id`, `status`, `actual_meal`, `exception_type`, `notes` |
| `viandas` | Inventario de viandas | `id`, `user_id`, `name`, `protein_source`, `category`, `portions`, `notes` |
| `gym_logs` | Sesiones de gimnasio | `id`, `user_id`, `date`, `routine_type`, `notes`, `completed` |
| `gym_exercises` | Ejercicios por sesion | `id`, `log_id`, `exercise_name`, `notes` |
| `gym_sets` | Series por ejercicio | `id`, `exercise_id`, `set_number`, `weight_kg`, `reps`, `rir` |
| `routine_templates` | Plantillas de rutinas | `id`, `user_id`, `routine_type`, `exercise_name`, `default_sets`, `default_reps`, `default_weight_kg`, `sort_order` |
| `user_profile` | Perfil del usuario | `user_id`, `peso_kg`, `altura_cm`, `objetivo`, `dias_entreno`, `dia_partido`, `restricciones`, `notas_extra`, `notif_*` |

### Valores validos en `viandas.category`

Solo estos tres, exactos:
- `'Equilibrado'`
- `'Bajo En Grasa'`
- `'Alto Proteico'`

### Identidad de ejercicios: no hay catalogo

`gym_exercises.exercise_name` es texto libre — no existe una tabla de ejercicios ni un
`exercise_id`. Dos ejercicios son el mismo si su nombre **normalizado** coincide
(`normalizarNombre()` en `oneRepMax.js`: trim, minusculas, espacios colapsados).

**Toda vista que agrupe, cuente o compare ejercicios tiene que normalizar.** Comparar el
nombre crudo — `new Set(...)`, `.eq('exercise_name', x)` — parte el historial en una
entrada por grafia, y el sintoma es silencioso: no falla nada, simplemente faltan
sesiones. Le paso al reporte de cargas del Dashboard, que uso el nombre crudo mientras
`Gimnasio.jsx` ya normalizaba para los PR (ver `DECISIONS.md`, 2026-09-08).

La normalizacion no resuelve sinonimos ("Press de banca" vs "Press banca"): eso se
limpia con un `UPDATE` puntual sobre los datos, no con codigo.

### `gym_logs.completed` es la definicion de "sesion entrenada"

No inferir si una sesion se entreno a partir de si sus series tienen RIR cargado. El
usuario suele completar todas las repeticiones previstas sin anotar el RIR, asi que
"ninguna serie con RIR" no significa "no se entreno" — significa exactamente eso, nada
mas. El dato correcto es `completed`, que el usuario marca a mano con el toggle "Sesion
completada" de `Gimnasio.jsx`.

El motor de progresion (`progresion.js`) uso el criterio de RIR hasta el 2026-09-08, y
descartaba sesiones reales de 24-33 series por no tener RIR. Se corrigio a `completed`
(ver `DECISIONS.md`). Cualquier vista nueva que agregue o cuente sesiones de gimnasio
— el heatmap de actividad del Spec 3 incluido — tiene que filtrar por `completed = true`,
no por la presencia de RIR.

### GOTCHA CRITICO: `auth.uid()` en el SQL Editor

`auth.uid()` devuelve `null` cuando se ejecuta SQL directamente en el editor de Supabase (corre como `service_role`, sin sesion de usuario). Para inserts o updates directos desde el editor, hardcodear el UUID literal del usuario. No usar `auth.uid()` en SQL manual.

---

## Variables de entorno

```env
# .env (local) — expuestas al cliente via Vite
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=

# Vercel (produccion) — solo servidor, NO en .env ni en el bundle
GEMINI_API_KEY=
```

`VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` van en `.env` local y en Vercel Environment Variables (prefijo `VITE_` obligatorio para que Vite las exponga al cliente).

`GEMINI_API_KEY` va **solo** en Vercel Environment Variables, sin prefijo `VITE_`. El cliente nunca la ve: las llamadas a Gemini pasan por `api/gemini.js` (Vercel serverless function).

### Las variables `VITE_` van en TRES lugares, no en dos

La app se compila por separado en tres entornos y cada uno necesita su propia copia. Olvidar el tercero no rompe ningun build — el bundle sale con `undefined` y falla recien en runtime.

| Entorno | Que compila | Donde se configuran |
|---|---|---|
| Local | `npm run dev` / `npm run build` | archivo `.env` (gitignoreado) |
| Vercel | la app web | Vercel Environment Variables |
| GitHub Actions | el APK Android | Repository secrets (`secrets.*` en `build-apk.yml`) |

Precedente: el commit `f228f6e` (2026-06-15) saco estas claves del codigo hardcodeado y las cargo en `.env` y en Vercel, pero no en GitHub Actions. Durante 42 commits todo APK salio en blanco (`createClient` lanza `supabaseUrl is required` al importarse, antes de que React monte) mientras la web seguia andando. Ante cualquier cambio de configuracion del cliente, verificar los tres.

---

## Convencion de estilos (IMPORTANTE)

- Estilos 100% inline en React. Sin Tailwind. Sin CSS modules. Sin clases externas.
- Breakpoint mobile: `window.innerWidth < 640px`
- Colores del sistema:
  - Fondo: `#0F1117`
  - Acento verde: `#10B981`
  - Rojo/error: `#EF4444`

No introducir clases CSS, Tailwind ni styled-components. Todo va en el objeto `style={{}}`.

---

## Integracion con Gemini

- Modelo: `gemini-2.5-flash-lite` via endpoint `v1beta`
- Proxy server-side: `api/gemini.js` (Vercel function) — recibe POST del cliente y reenvía a Google con `GEMINI_API_KEY`. La API key nunca llega al browser.
- Logica de llamada en: `src/services/geminiPlan.js` → llama a `/api/gemini`
- La app envia un prompt con perfil del usuario + stock de viandas (porciones > 0)
- Respuesta esperada en JSON:

```json
{
  "plan": [
    { "dia": 0, "desayuno": "...", "almuerzo": "...", "merienda": "...", "cena": "..." }
  ]
}
```

Donde `dia` es 0=Lunes ... 4=Viernes (solo dias de semana).

---

## Reglas para modificaciones

1. No cambiar el sistema de estilos inline. Si necesitas agregar estilos, seguir el patron existente.
2. No agregar dependencias de UI (no MUI, no Chakra, no Tailwind). El proyecto tiene zero dependencias de componentes UI externos.
3. Al tocar tablas de Supabase, verificar que las politicas RLS existentes cubran el caso. No desactivar RLS.
4. El campo `week_start` en `meal_plans` siempre es el lunes de la semana (calcular con `startOfWeek` o equivalente).
5. Para el APK: cualquier cambio en `src/` requiere `npm run build` + `npx cap sync android` antes de compilar el APK.
