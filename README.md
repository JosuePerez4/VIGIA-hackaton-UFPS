# VIGIA---hackaton-UFPS

Prototipo de monitoreo ambiental y alerta temprana (VIGIA).

Prototipo web de una plataforma de monitoreo ambiental y alerta temprana para minería subterránea.
**Todos los datos son simulados.** No hay backend ni hardware real: el motor corre en el navegador.

## Ejecutar

```bash
npm install
npm run dev
```

Abre <http://localhost:3000> (redirige a `/panel`).

Para la presentación en producción local:

```bash
npm run build
npm run start
```

## Secciones

| Ruta | Qué muestra |
| --- | --- |
| `/panel` | Estado general, gases en vivo, gráfica con canal rápido y lento, eventos recientes |
| `/mapa` | Mapa 3D de galerías y estaciones, mapa de calor por gas, detalle y evacuación |
| `/alertas` | Tabla de alertas, filtros, reconocimiento y estado de las acciones automáticas |
| `/simulaciones` | Escenarios, control de velocidad, pausa, reinicio y línea de tiempo |
| `/personal` | Mineros, MX6, ubicación, exposición (TWA) y ruta de evacuación |
| `/historial` | Consulta por gas, estación y rango; comparación de periodos; CSV; reporte imprimible |
| `/sistema` | Estado de estaciones, batería, latencia, calibración y dispositivo de entrada |
| `/configuracion` | Umbrales por gas y nivel, editables en vivo |

## Arquitectura

- `src/sim/engine.ts`: **único motor de simulación**. Genera lecturas cada segundo, calcula el promedio móvil (canal lento, 40 s), la tasa de cambio dC/dt (canal rápido, 2 s), los niveles, las alertas y la evacuación.
- `src/sim/scenarios.ts`: escenarios y su efecto sobre cada gas.
- `src/sim/mine.ts`: geometría de la mina (galerías, estaciones cada 40 m, mineros).
- `src/sim/history.ts`: histórico sintético determinista para la vista de historial.
- `src/config/thresholds.ts`: umbrales por gas y nivel. **Valores de ejemplo**, marcados con TODO para reemplazar con el Decreto 1886 de 2015 y el Decreto 944 de 2022. No son valores legales.
- `src/store/vigia-store.ts`: estado global (Zustand). Todas las pestañas leen de aquí.

## Guion de demo (3 minutos)

1. **Operación normal** (tecla `1`): el panel, el mapa y el personal están en verde. Sin alertas.
2. **Fuga de metano** (tecla `2`): el canal rápido se dispara en pocos segundos, mientras el canal lento (oficial) sube más despacio. Aparecen alertas de Nivel 1 y 2 en la estación y sus vecinas.
3. Mientras sube el gas, abre `/mapa`: la estación cambia de color y se propaga el gas. Activa el mapa de calor de metano.
4. Al llegar al **Nivel 3** aparece el aviso a pantalla completa: corte eléctrico, ventiladores al máximo y evacuación. En `/personal` verás la ruta de evacuación.
5. Cierra el aviso y ve a `/historial`: consulta el periodo, compara con el anterior y exporta el CSV o imprime el reporte.

Atajos durante la presentación: `1`–`5` lanzan escenarios, `Espacio` pausa, `R` reinicia la mina.

## Notas

- El personal, las estaciones y el histórico son ficticios.
- Los umbrales son de ejemplo y no deben presentarse como valores legales.
