# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user: Next.js (App Router) + TypeScript + Tailwind CSS, three.js via @react-three/fiber and @react-three/drei for the 3D map, Recharts for charts, Zustand for global state. No backend: all data is simulated in the browser. The brief originally named React + Vite; the user changed it to Next.js.

## Users

- Primary: personal de Seguridad y Salud en el Trabajo (SST) and supervisors of an underground mine in Colombia, monitoring gas levels and responding to alerts during a shift.
- Secondary: the mine's operations staff, who review history and reports afterwards.
- Assumed (not confirmed by the user): the audience reads Spanish and will watch the prototype projected in a hackathon presentation.

## Product Purpose

VIGIA is an environmental monitoring and early warning platform for underground mining. Fixed stations every 40 m and personal MX6 iBrid sensors feed a processing device at the mine entrance, which raises tiered alerts. This repository is a hackathon prototype: it demonstrates the behavior with simulated data only.

Success: during a 3-minute live demo, a viewer sees a gas event unfold and watches the panel, 3D map, alerts and personnel react together, escalating to Level 3.

## Positioning

The prototype shows two detection channels side by side: a fast channel that catches the rate of change (dC/dt, alert in under 2 s) and a slow channel (30–45 s moving average) that is the official record. A generic gas dashboard shows a single line; VIGIA shows why an alert fired and which channel fired it.

## Operating Context

- Used on a laptop in a control room and projected on a screen during demos.
- Scenes: a control room with low ambient light. Data-dense and read at a distance.
- Operators act on alerts: acknowledge, follow the evacuation route, and check personnel exposure.

## Capabilities and Constraints

- Prototype only. No real hardware, no backend, no persistence beyond the browser session.
- Simulated: 3–4 galleries, 15–20 stations every 40 m, 8–12 miners, one entry station with the processing device.
- Gases: CH4, CO, O2, H2S, CO2, NO2, plus temperature and air velocity.
- Alert levels: 1 local, 2 platform and SST notification, 3 power cut, fans to maximum, evacuation.
- All thresholds are example values in `src/config/thresholds.ts`, marked with a TODO to replace them with the values from Decreto 1886 de 2015 / Decreto 944 de 2022. Do not present them as legal values.
- Undecided: the exact legal thresholds; the hardware/protocol details beyond the brief.

## Brand Commitments

- Name: VIGIA (always uppercase in the top bar logo).
- Language: all user-facing UI copy in Spanish.
- Visual direction given by the user: industrial dark theme with color used only for state (green, yellow, orange, red). A dashboard reference was provided (Dribbble "AI Farm Monitoring Dashboard"); it could not be read by the tooling used here, so the direction below is taken from the written brief.

## Evidence on Hand

- No real mine data, logos, or legal assets. Any numbers shown are synthetic and must be labeled as such where a visitor could mistake them for real data.
- No testimonials, customers, benchmarks, or pricing may be invented.

## Product Principles

1. Show the mechanism, not a mood: the two channels and the escalation logic must be visible.
2. One source of truth: every tab reads the same simulation store, so a scenario updates the whole product at once.
3. Numbers must be legible from across a room: large tabular figures, status by color, never by color alone.
4. Thresholds are configuration, not law: they live in one file and are labeled as examples until replaced.

## Accessibility & Inclusion

- Status is never conveyed by color alone (always pair color with a text label or icon).
- Keyboard-operable controls, visible focus rings, and reduced-motion support for the 3D scene and pulses.
