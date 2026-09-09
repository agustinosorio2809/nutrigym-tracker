# ROADMAP

**Activo:** ninguno. No hay roadmap pendiente de ejecución.

El Spec 3 (heatmap de actividad y mapa muscular) se completó y su roadmap quedó archivado
en `docs/superpowers/roadmaps/2026-09-08-gym-heatmap-actividad-roadmap.md`. Agrega la
pestaña "Actividad" a `Dashboard → Reportes` (tira anual de constancia, calendario mensual
por grupo muscular dominante, barras de volumen y rachas) — ver
`docs/superpowers/specs/2026-09-08-gym-heatmap-actividad-design.md` y las decisiones de
diseño en `DECISIONS.md`. La revisión final de todo el branch encontró y corrigió tres
bugs de cableado entre tareas (paginación de `gym_exercises`, intensidad del mes mal
escalada, leyenda con grupos fantasma — ver `DECISIONS.md`). Verificado en el navegador
con datos reales junto al usuario el 2026-09-08: sin pendientes.

El Spec 2 (motor de progresión automática) se completó y su roadmap quedó archivado en
`docs/superpowers/roadmaps/2026-08-26-gym-motor-progresion-roadmap.md`. Recibió un fix de
mantenimiento el 2026-09-08 (ver `DECISIONS.md`): el criterio de "sesión entrenada" pasó de
inferir por RIR a usar `gym_logs.completed`.

Ver `docs/superpowers/specs/` para specs de features y `docs/superpowers/roadmaps/` para
roadmaps ya ejecutados.
