import { useState } from 'react'

// La app es 100% estilos inline (sin CSS externo, ver design.md), así que no hay
// pseudo-clases :hover/:focus-visible/:active disponibles. Este hook las simula con
// estado de React + event handlers, y devuelve un style final ya mergeado.
//
// Uso:
//   const { style, handlers } = useInteractiveStyle(baseStyle, { hover, focus, active })
//   <button style={style} {...handlers}>...</button>
export function useInteractiveStyle(base, { hover, focus, active } = {}) {
  const [isHover, setHover] = useState(false)
  const [isFocus, setFocus] = useState(false)
  const [isActive, setActive] = useState(false)

  const style = {
    ...base,
    ...(isHover && hover ? hover : null),
    ...(isFocus && focus ? focus : null),
    ...(isActive && active ? active : null),
  }

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => { setHover(false); setActive(false) },
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
  }

  return { style, handlers }
}

// Anillo de foco estándar de la app — instantáneo (sin transición), ≥3:1 contraste.
export const focusRing = { boxShadow: '0 0 0 2px #0F1117, 0 0 0 4px #34D399' }
