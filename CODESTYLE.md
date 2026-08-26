# CODESTYLE.md — NutriGym Tracker

Reglas de convención para cualquiera (humano o agente) que escriba código en este
repo. Complementa a `CLAUDE.md` (contexto de arquitectura y stack) — este documento
es sobre **cómo se escribe** el código, no sobre qué hace la app.

---

## Regla no negociable

**Ningún bullet de un ROADMAP se marca completo sin correr su test o verificación
correspondiente.** La suite completa (`npm test`) corre antes de **cada** commit, sin
excepción — no solo los que tocan `src/services/`. Un commit de UI también puede
romper un servicio: si importa mal, renombra algo o cambia la forma de un dato, el
test lo agarra y la revisión visual no.

Si un cambio no tiene forma de testearse automáticamente (componentes React, flujos
de Supabase), el bullet debe traer su propia verificación manual explícita — pasos
concretos con el resultado esperado, no "probar que funcione".

Ver `vibecoding-estructurado.md` (vault personal) para el flujo completo del que
sale esta regla.

---

## Idioma

- **Nombres de función y variable: español.** `cargarSesion`, `guardarEjercicio`,
  `formEj`, `sesionHoy`. Es la convención ya establecida en todo `src/pages/`.
- **Texto de interfaz (labels, placeholders, mensajes de error/alert): español.**
  Es una app para un usuario hispanohablante.
- **Nombres de tabla y columna de Supabase: inglés**, en snake_case — siguen la
  convención SQL estándar del proyecto (`gym_logs`, `meal_plans`, `weight_kg`).
- **Comentarios y mensajes de commit: español.**
- **Nombres de componente React: PascalCase en español o inglés según lo que
  describan** (`TabButton`, `PrimarySmallButton` son términos de UI genéricos en
  inglés; si el componente es específico del dominio, va en español).

---

## Comentarios

Por defecto, **no se escriben comentarios**. El código ya observado en el repo
(`Gimnasio.jsx`, `Dashboard.jsx`, `geminiPlan.js`) casi no tiene ninguno — los
nombres de función explican el qué.

Se escribe un comentario **solo** cuando explica un **por qué** que no es obvio
leyendo el código: una restricción oculta, un workaround, un gotcha de la
plataforma. Ejemplos reales ya en el repo:

```js
// Hallmark · genre: modern-minimal · design-system: design.md · designed-as-app
// Tokens de diseño compartidos — ver design.md en la raíz del repo.
// Antes vivían duplicados (con pequeñas inconsistencias) en cada pantalla.
export const C = { ... }
```

```sql
-- NOTA: auth.uid() devuelve null cuando se ejecuta SQL directamente en el editor
-- de Supabase (corre como service_role, sin sesión de usuario).
```

Nunca se escribe un comentario que describa **qué** hace el código (eso ya lo dice
el nombre de la función) ni que referencie la tarea o el commit que lo originó.

---

## Formato y estructura

- **Estilos 100% inline vía `style={{}}`.** Sin Tailwind, sin CSS modules, sin
  styled-components. Los tokens de color/espaciado viven en `src/theme.js`
  (`C`, `SPACE`, `ESTADO_COLORS`) — nunca hardcodear un hex fuera de ahí.
- **Interactividad (hover/focus/active) vía `useInteractiveStyle`**
  (`src/hooks/useInteractiveStyle.js`), nunca CSS `:hover` — el proyecto no tiene
  hojas de estilo.
- **Íconos:** SVG a mano en `src/components/icons.jsx`, mismo lenguaje visual
  (`viewBox="0 0 24 24"`, `strokeWidth: 2`, `strokeLinecap/Linejoin: round`).
  Nunca emoji como ícono funcional.
- **Breakpoint mobile:** `window.innerWidth < 640`, vía el hook local `useIsMobile()`
  que cada página define (no está centralizado — seguir el patrón existente).
- **Componentes de botón/pill/badge pequeños:** se definen al final del archivo de
  la página que los usa. Cuando esa página pasa de ~500 líneas, se mueven a
  `src/components/<pagina>.jsx` (ver `src/components/gym.jsx`, extraído de
  `Gimnasio.jsx`) — el archivo por página, no un `components/ui.jsx` genérico:
  los componentes que cambian juntos viven juntos. Solo se comparten entre páginas
  los que se reutilizan en 3+.
- **Servicios (`src/services/`):** funciones puras o llamadas a APIs externas, sin
  JSX, sin `useState`. **Un archivo por responsabilidad**, aunque estén relacionados:
  `oneRepMax.js` es aritmética de 1RM y `progresion.js` son reglas de entrenamiento,
  y se mantienen separados porque cambian por motivos distintos. La dependencia va en
  una sola dirección (`progresion.js` importa de `oneRepMax.js`, nunca al revés).
- **Sin dependencias de UI externas.** No MUI, no Chakra, no Radix, no Tailwind.
- Nombres de archivo de página en PascalCase (`Dashboard.jsx`), servicios y hooks
  en camelCase (`geminiPlan.js`, `useInteractiveStyle.js`).

---

## Testing

- **Vitest** para lógica pura en `src/services/*.test.js`, junto al archivo que
  testean (no en un directorio `__tests__/` separado).
- **No se testean componentes React ni flujos de Supabase.** Requerirían mocks
  pesados y la lógica de UI está acoplada a estilos inline — el costo de
  mantenimiento no se justifica frente a testear la lógica pura, que es donde un
  bug pasa desapercibido y muestra un número o estado equivocado sin fallar.
- Cada test describe un caso de negocio concreto (`"no es PR la primera vez que se
  hace el ejercicio"`), no una línea de código.
- Los tests son de **comportamiento observable**, no de implementación: se testea la
  API exportada del servicio, nunca sus funciones internas. Si un test se rompe al
  refactorizar sin cambiar el comportamiento, estaba mal escrito.
- **Cada regla de negocio con un valor de corte trae su test de borde.** El tope de
  15 reps, el umbral de RIR 2, las 3 sesiones de estancamiento: se testea el valor
  justo adentro y el justo afuera, porque ahí es donde se equivoca el off-by-one.
- `npm test && npm run lint` antes de cada commit, siempre.
- **`npm run lint` arranca en rojo** (22 errores y 7 warnings preexistentes, sin
  relación con ninguna feature en curso). Hasta que se limpien, el criterio es **no
  sumar errores nuevos**, no "lint en verde": comparar el conteo antes y después del
  cambio. Un import que quedó sin usar tras un refactor es el caso más común y se
  arregla en el momento.

---

## Producción / commits

- **Conventional commits** vía CLI: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
  `chore:`.
- Un commit por unidad verificable (cada paso de "commit" del ROADMAP es un commit
  real, no un commit gigante al final de la tarea).
- **Sin código muerto ni features a medio terminar.** Si una tarea del ROADMAP no
  se completa, no se commitea — se deja el checkbox sin marcar.
- **Migraciones SQL:** nunca `auth.uid()` en scripts corridos manualmente desde el
  editor de Supabase (corre como `service_role`, devuelve `null`). Cualquier
  operación destructiva sobre la base va precedida de un backup — no hay ambiente
  de desarrollo separado, la única base es la de producción.
- **Ambigüedades resueltas sin preguntar** durante la ejecución de un ROADMAP se
  registran en `DECISIONS.md`, con el porqué.

---

## Qué NO hacer

- No introducir Tailwind, CSS modules, ni ninguna librería de componentes UI.
- No desactivar RLS en ninguna tabla, ni para debug.
- No usar `auth.uid()` en SQL manual.
- No agregar abstracciones o configuración para casos hipotéticos que el ROADMAP
  actual no pide (YAGNI).
- No dejar un bullet marcado como completo sin haber corrido su test o
  verificación.
