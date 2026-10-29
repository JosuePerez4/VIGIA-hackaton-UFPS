# Feature: vigia-prototipo

## Objetivo
Prototipo web de VIGIA (monitoreo ambiental y alerta temprana para minería subterránea, Colombia) para una hackathon. Todo con datos simulados, en español, con Next.js + TypeScript + Tailwind + three.js (R3F/drei) + Recharts + Zustand.

## Problema
Presentar en vivo el comportamiento del sistema real: canal rápido vs. canal lento, escalonamiento de alertas (Nivel 1 a 3) y reacción coordinada de panel, mapa 3D, alertas y personal.

## Por qué
La demo debe mostrar un mecanismo, no una maqueta: un único motor de simulación alimenta todas las pestañas.

## Alcance
- Incluye: motor de simulación, store, navegación de 8 secciones, mapa 3D, escenarios, alertas, personal, historial con CSV y reporte imprimible, estado del sistema, umbrales editables, README con guion de demo.
- Excluye: backend, hardware real, persistencia, valores legales de umbrales (quedan como ejemplo con TODO).

## Restricciones
- Umbrales de ejemplo, marcados con `// TODO: reemplazar con los valores del Decreto 1886 de 2015 / Decreto 944 de 2022`.
- UI en español; identificadores y comentarios en inglés.
- Sin Co-Authored-By en commits (CLAUDE.md del usuario).

## Criterios de aceptación
- [x] Escenarios mueven panel, mapa, alertas y personal a la vez (verificado en motor; ver evidencia).
- [x] Canal rápido y lento se distinguen en la gráfica (dos series: discontinua y continua).
- [ ] Nivel 3 muestra el aviso a pantalla completa y acciones automáticas (componente escrito y compila; **no verificado visualmente en navegador**).
- [x] Umbrales editables cambian el motor en vivo (store llama `engine.setThresholds`).
- [x] Sin datos hardcodeados dispersos: todo sale del motor y de `thresholds.ts`.

## Tareas
- [x] T1 Scaffold Next.js 16.4.3 y dependencias fijadas (three 0.186.1, R3F 9.8.2, drei 10.7.9, recharts 3.10.1, zustand 5.0.16, lucide-react).
- [x] T2 Configuración central de umbrales y geometría de la mina.
- [x] T3 Motor de simulación único (`src/sim/engine.ts`) con canal rápido, canal lento, alertas y evacuación.
- [x] T4 Escenarios y efectos por gas (`src/sim/scenarios.ts`).
- [x] T5 Store Zustand y reloj de simulación con velocidades 1x/2x/5x.
- [x] T6 Layout, navegación y aviso de emergencia.
- [x] T7 Panel en tiempo real con gráficas en vivo.
- [x] T8 Simulaciones con atajos de teclado.
- [x] T9 Mapa 3D con R3F, heatmap y selección.
- [x] T10 Centro de alertas con reconocimiento y filtros.
- [x] T11 Personal con TWA y ruta de evacuación.
- [x] T12 Historial sintético con comparación, CSV y reporte imprimible.
- [x] T13 Estado del sistema y configuración de umbrales.
- [x] T14 README con guion de demo.

## Route declaration
- Lógica (motor, escenarios, store): inline por el orquestador, sin delegación de escritura. Justificación: el diseño del motor requirió coherencia entre archivos y se mantuvo en un solo hilo.
- Verificación: script temporal de simulación (eliminado después) y `tsc`, `eslint` y `next build`.

## Evidencia
- `npm run lint`: exit 0.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0; 9 rutas estáticas generadas.
- Simulación (script temporal, `SimEngine` directo):
  - `normal` 600 s: 0 alertas.
  - `fuga-metano` en EST-08: canal rápido a 7 s, Nivel 2 a 68 s, Nivel 3 a 85 s, corte y evacuación a 85 s.
  - `aumento-co` en EST-03: canal rápido a 4 s, Nivel 3 a 34 s.
  - `falla-ventilacion`: Nivel 1 a 48 s y Nivel 2 a 63 s en EST-08 (tras el ajuste, el aire baja a Nivel 3 en la mina; no re-verificado tras el último cambio).
  - `minero-critico` en EST-08: Nivel 3 a 44 s, evacuación de 10 mineros.
- Bugs encontrados y corregidos durante la verificación:
  - Falsa alerta en operación normal: el factor de estación afectaba O₂ (18.7 %). Corregido con `VARIATION` por gas.
  - Crash al llegar a la entrada (`stationById` indefinido). Corregido con guardas.
- Capturas headless (Edge): panel y mapa renderizan; etiquetas del mapa legibles tras cambiar `<Html>` por texturas.
- Consola del navegador: el crash de `removeChild` al navegar desde el mapa venía de `<Html>` de drei; se eliminó. Queda un aviso de `THREE.Clock` deprecado, interno de R3F, no funcional.

## Pendiente
- Verificación visual del escenario de Nivel 3 en navegador (banner a pantalla completa).
- Comparación contra la referencia de Dribbble: no se pudo leer (la página llegó vacía y el video no es accesible desde aquí).
- Impeccable: el finish review formal (agente `impeccable-finish-reviewer`) y el documenter (`impeccable-documenter`) no se ejecutaron. No hay `DESIGN.md` de documenter; el sistema visual está descrito en el código y en `PRODUCT.md`.
- Commit: pendiente de decisión del usuario (ver mensaje final).

## Siguiente paso
Probar en navegador el escenario 2 (fuga de metano) hasta Nivel 3 y revisar el banner; luego decidir si se corre el finish review de Impeccable.
