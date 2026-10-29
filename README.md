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
| `/mapa` | Mapa 3D de la mina (plano de `mapa_mina_estaciones.svg`), mineros con MX6 en recorrido, mapa de calor y detalle |
| `/alertas` | Tabla de alertas, filtros y reconocimiento |
| `/simulaciones` | Escenarios, control de velocidad, pausa, reinicio y línea de tiempo |
| `/personal` | Mineros, MX6, enlace inalámbrico, lecturas, muestras enviadas y exposición (TWA) |
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

## Mineros y MX6

Los 10 mineros caminan por las galerías en todos los escenarios. Cada uno lleva un MX6 que mide el gas en su punto y se enlaza a la estación más cercana. Las lecturas quedan en `/personal` y el mapa muestra el enlace de cada minero.

## Guion de demo (3 minutos)

1. **Operación normal** (tecla `1`): mineros en recorrido, sin alertas.
2. **Alerta durante el trabajo** (tecla `3`): mientras los mineros siguen caminando, una estación sube a Nivel 2. Mira el canal rápido, luego el lento, y en `/personal` el MX6 del minero que pasa por esa zona.
3. **Fuga de metano** (tecla `2`): el canal rápido se dispara primero y el oficial llega después. Aparecen alertas de Nivel 1, 2 y 3.
4. En el Nivel 3 aparece el aviso con la alerta. Ciérralo y ve a `/alertas`.
5. Cierra en `/historial`: consulta el periodo, compara con el anterior y exporta el CSV o imprime el reporte.

Atajos durante la presentación: `1`–`6` lanzan escenarios, `Espacio` pausa, `R` reinicia la mina.

## Notas

- El personal, las estaciones y el histórico son ficticios.
- Los umbrales son de ejemplo y no deben presentarse como valores legales.
- No hay acciones automáticas (corte de energía, ventiladores, evacuación). Se dejan para una versión futura.
