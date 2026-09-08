# Design — NutriGym Tracker

Sistema de diseño único para la app. Cada pantalla redisñada lee este archivo antes de
tocar código. No se regenera por pantalla — se extiende o enmienda cuando el sistema
necesita crecer.

**Nota de implementación**: el proyecto usa estilos 100% inline en React (regla del
CLAUDE.md del repo — sin Tailwind, sin CSS modules, sin archivos `.css` nuevos). Por eso
los tokens de este documento no se exportan como `tokens.css` / Tailwind `@theme` / DTCG —
viven como un objeto JS compartido (`src/theme.js`), importado por cada pantalla en vez de
declarado tres veces por archivo como pasaba antes del rediseño.

## Genre
modern-minimal (school Stripe / Linear / ElevenLabs) — es una app de utilidad personal,
no una landing de marketing. No aplica el catálogo de 21 "macrostructures" de Hallmark
(están pensadas para páginas de una sola sección con hero/features/pricing); en su lugar
aplican las disciplinas universales de Hallmark (color, tipografía, iconografía, estados,
anti-patrones) sobre la estructura de app existente (bottom-nav mobile + top-nav desktop +
5 rutas), que **no se modifica**.

## Estructura de la app (preservada, no se toca)
- Rutas: `/` (Dashboard), `/plan` (PlanSemanal), `/viandas`, `/gimnasio`, `/perfil`.
- Bottom-nav en mobile (< 640px), nav superior en desktop. Ambos correctos para el patrón,
  no son "AI nav" — el nav superior desktop sí se redisña (ver § Nav).
- Todos los flujos de datos (Supabase, RLS, servicios) quedan intactos.

## Paleta (preservada — ya era deliberada, se formaliza como tokens)
Valores hex originales convertidos a OKLCH aproximado, documentados para referencia:

| Token | Hex actual | OKLCH aprox. | Uso |
|---|---|---|---|
| `bg` | `#0F1117` | oklch(14% 0.02 265) | fondo de app |
| `surface` | `#1A1D27` | oklch(20% 0.02 265) | cards, nav |
| `surfaceHigh` | `#22263A` | oklch(24% 0.03 265) | inputs, hover de superficie |
| `border` | `#2A2D3E` | oklch(28% 0.03 265) | bordes hairline |
| `accent` | `#10B981` | oklch(70% 0.15 165) | acento único de marca |
| `accentText` | `#34D399` | oklch(76% 0.16 165) | texto sobre acento/dim |
| `textPrimary` | `#F1F5F9` | oklch(96% 0.01 250) | texto principal |
| `textSecondary` | `#94A3B8` | oklch(68% 0.02 250) | texto secundario |
| `textMuted` | `#4B5563` | oklch(45% 0.02 250) | texto terciario/deshabilitado |
| `red` | `#EF4444` | oklch(63% 0.21 25) | error/destructivo |
| `yellow` | `#F59E0B` | oklch(76% 0.16 70) | advertencia/pendiente |
| `blue` | `#3B82F6` | oklch(62% 0.19 260) | acción secundaria (import) |

**Sin segundo acento morado.** El "Generar con IA" en PlanSemanal usaba `#7C3AED`
("VibeCode purple", tell documentado) — pasa a usar una variación de `accent` (mismo verde,
mayor peso tipográfico + un ícono distintivo) en vez de un color de marca nuevo.

## Color categórico (grupos musculares)

La paleta de § Paleta es de **marca y estado**: un solo acento, más rojo/amarillo/azul con
significado fijo. El heatmap de actividad necesita distinguir nueve categorías que no son
estados, así que se agrega una escala categórica separada, en `src/theme.js` como
`GRUPO_COLORS`.

Reglas:

- **Ningún grupo usa el rojo ni el amarillo.** Están tomados por error y pendiente; un
  grupo muscular pintado de rojo se lee como un problema.
- **Luminosidad pareja** entre los nueve, para que ninguno domine la grilla por brillo.
- **`Cardio` y `Sin clasificar` van en neutros fríos**: no son grupos musculares y no
  deberían competir visualmente con los que sí.
- **El color nunca es el único portador de información.** Nueve tonos en celdas chicas no
  son distinguibles con certeza para nadie, y menos con daltonismo. Toda celda coloreada
  lleva su número de día, la leyenda está siempre visible, y el detalle del día se lee
  escrito en el panel.

La tira anual **no** usa esta paleta: es monocroma sobre el verde de marca (`INTENSIDAD`,
5 niveles), porque responde una pregunta distinta — constancia, no composición.

## Tipografía
Se mantiene el system-font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
— no se importa una fuente nueva. Razón: la app corre offline-first en el APK de Capacitor;
depender de Google Fonts agrega una falla de red evitable, y el stack del sistema ya es una
elección deliberada (no cae en el default Inter/Geist que marca Hallmark).

La jerarquía se refuerza con **peso y tracking**, no con una segunda familia:
- Display / stats grandes: peso 800, `letter-spacing: -0.02em`.
- Headings de sección: peso 700.
- Body: peso 400-600 según énfasis.
- Labels/eyebrows: peso 600, uppercase, `letter-spacing: 0.06em` — se usan con moderación
  (no en cada sub-sección, solo donde ya aportaban jerarquía real).
- Números tabulares (kg, %, porciones, reps): `font-variant-numeric: tabular-nums`.

## Iconografía
Un solo sistema: se extienden los SVG inline dibujados a mano que ya existían en el nav de
`App.jsx` (stroke-based, `strokeWidth 2`, `24x24` viewBox) a **todo** ícono funcional de la
app — comidas, gym, perfil, acciones de PlanSemanal/Viandas/Gimnasio. Viven en un archivo
nuevo `src/components/icons.jsx`, importado donde haga falta.

**Se eliminan todos los emoji como ícono funcional** (🌅☀️🍎🌙🏋️📋⚡✨⬆⬇🗑📦🍱🍗🐟🥩🐷📊🥗🔔💪).
Excepción: el emoji de marca 💪 en el logo de login se reemplaza por un ícono SVG propio
(mancuerna simple, mismo lenguaje que el resto).

## Espaciado
Escala de 4pt existente (`4px, 8px, 12px, 16px, 24px, 32px...`) ya usada de forma consistente
— se documenta como escala nombrada en `theme.js`, no cambia.

## Contenedores — se rompe "una card para todo"
Tres tratamientos según el tipo de contenido (antes: un solo `border-radius: 12px + border`
para todo, el hallazgo crítico #1 del audit):

1. **Fila de lista** (hairline divider, sin card ni radius) — comidas del día, ejercicios,
   historial de sesiones, resumen de viandas en reportes. `border-bottom: 1px solid border`,
   padding vertical, sin fondo propio.
2. **Stat tipográfico** (sin card) — adherencia %, máximo kg, porciones totales. Número grande
   + label chico + una regla (`border-top` fina) en vez de wrapping en un contenedor bordeado.
3. **Card con borde** — reservada para entidades editables/accionables: vianda individual,
   sesión de gym de hoy, secciones de Perfil, empty states, modales. `border-radius: 10px`,
   `border: 1px solid`, sin sombra (ya era así, se mantiene).

## Estados — hover / focus / active
El proyecto es 100% inline, así que no hay pseudo-clases CSS disponibles. Se resuelve con
un hook chico (`useInteractiveStyle` en `src/hooks/useInteractiveStyle.js`) que trackea
hover/focus/active por elemento vía `onMouseEnter/Leave`, `onFocus/Blur`, `onMouseDown/Up`
y alterna un objeto de estilo inline — sin CSS externo, sin clases. Todo elemento clickeable
(botones, filas, tabs) lo usa. El anillo de foco es instantáneo (sin transición) a ≥3:1
contraste, por accesibilidad de teclado — hallazgo crítico #2 del audit (cero estados de foco
en toda la app).

## Motion
- Transiciones existentes (`transition: 'all 0.15s'`) pasan a nombrar propiedades explícitas
  (`background-color, border-color, color 0.15s ease-out`) — nunca `all`.
- Sin animaciones de entrada/scroll (la app no las tenía, se mantiene así — correcto).
- Toggle switches (ya existentes) mantienen su transición de 0.2s en `left`/`background`.

## Microinteractions
- Guardado silencioso donde ya era así (el check ✓ + cambio de color en botón de Perfil está
  bien, se mantiene — no es un toast intrusivo).
- Acciones destructivas (eliminar vianda/ejercicio/comida) mantienen `confirm()` nativo por
  ahora — no se reemplaza por Undo async en este rediseño (es cambio de lógica, no visual;
  fuera de alcance).

## CTA voice
- Primaria: fill sólido `accent`, texto blanco, `border-radius: 10px`, peso 700.
- Secundaria: transparente + borde `border`, texto `textSecondary`.
- Destructiva: fondo `red` al 15% + borde `red` al 40%, texto `red`.
- Nunca dos CTAs primarias compitiendo en la misma fila (ya se respeta).

## Nav
- **Bottom-nav mobile**: se mantiene igual — es un tab-bar nativo correcto, no un tell.
- **Nav desktop** (`App.jsx` `DesktopNav`): hoy es el patrón "AI nav" crítico (wordmark
  izq + links inline + botón "Salir" der + sticky + hairline). Se redisña a un **side-rail
  angosto** (íconos + label, fijo a la izquierda, contenido corre a la derecha) — más
  distintivo, coherente con que es una app de uso diario (patrón tipo Linear/Notion), y
  reutiliza los mismos íconos SVG del bottom-nav mobile en vez de solo texto.
- **Login (`AuthScreen`)**: hoy es "Full-viewport centred hero" crítico. Se mantiene centrado
  verticalmente (es una pantalla de auth, centrar es razonable ahí) pero se rompe la simetría
  total: el bloque de formulario se alinea a un lado con un panel lateral de marca en desktop
  (`> 640px`), y en mobile se mantiene centrado con menos padding decorativo.

## Qué NO cambia
- Rutas, componentes, lógica de datos, Supabase, RLS, servicios de notificaciones/IA.
- La paleta base (verde + dark), la escala de espaciado, el patrón de bottom-sheet modal
  (se mantiene, es válido para mobile — se diferencia peso visual entre confirmación
  destructiva y formulario, no la estructura).
- Categorías de `viandas.category`, `week_start` = lunes, ninguna regla del CLAUDE.md.

## Qué pantalla usa qué
Las 5 pantallas + `App.jsx` comparten el 100% del sistema — no hay "familias" distintas
(a diferencia de una app con páginas de marketing vs. app, acá todo es "app pages").
