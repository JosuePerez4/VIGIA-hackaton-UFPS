'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, Line, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LEVEL_META, type GasThreshold, type Level } from '@/config/thresholds';
import { BASE_ID, CABLES, EDGES, ENTRY_ID, NODE_BY_ID, ZONES } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

/** Mapa SVG (390 × 660). Cuadrícula de 60 px en X y 70 px en Y → una unidad por celda. */
const toScene = (x: number, y: number): [number, number, number] => [(x - 190) / 60, 0, (y - 330) / 70];

/** Color por tipo de nodo. El estado (nivel) se muestra aparte, en el aro de cada estación. */
export const TYPE_COLORS = {
  station: '#60a5fa',
  mx6: '#2dd4bf',
  receiver: '#f1f5f9',
  base: '#c084fc',
  cable: '#cbd5e1',
} as const;

const LEVEL_COLORS = ['#34d399', '#facc15', '#fb923c', '#f43f5e'];
const HEAT_STOPS = ['#34d399', '#facc15', '#fb923c', '#f43f5e'].map((c) => new THREE.Color(c));

const PX_PER_UNIT = 320;
const LABEL_HEIGHT_PX = 80;

/**
 * Etiqueta dibujada en una textura dentro de la escena. Evita <Html> de drei, que monta raíces
 * de React dentro del canvas y rompe al desmontar la ruta.
 */
function TextLabel({ position, text, size = 40 }: { position: [number, number, number]; text: string; size?: number }) {
  const { texture, width } = useMemo(() => {
    const measure = document.createElement('canvas').getContext('2d');
    const font = `600 ${size}px system-ui, sans-serif`;
    let pixels = 160;
    if (measure) {
      measure.font = font;
      pixels = Math.ceil(measure.measureText(text).width) + 32;
    }
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = LABEL_HEIGHT_PX;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(10, 14, 19, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e8eef4';
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    }
    return { texture: new THREE.CanvasTexture(canvas), width: pixels / PX_PER_UNIT };
  }, [text, size]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[width, LABEL_HEIGHT_PX / PX_PER_UNIT]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduce;
}

function heatColor(t: number) {
  const clamped = Math.min(Math.max(t, 0), 1) * (HEAT_STOPS.length - 1);
  const index = Math.floor(clamped);
  const next = Math.min(index + 1, HEAT_STOPS.length - 1);
  return HEAT_STOPS[index].clone().lerp(HEAT_STOPS[next], clamped - index);
}

/** Cercanía al Nivel 3 (0 = sin riesgo, 1 = Nivel 3), según el sentido de peligro del gas. */
function heatIntensity(value: number, threshold: GasThreshold) {
  const { level1, level3, direction } = threshold;
  return direction === 'above' ? value / level3 : (level1 - value) / (level1 - level3);
}

function Galleries() {
  return (
    <>
      {EDGES.map(([a, b]) => {
        const A = toScene(NODE_BY_ID[a].x, NODE_BY_ID[a].y);
        const B = toScene(NODE_BY_ID[b].x, NODE_BY_ID[b].y);
        return <Line key={`${a}-${b}`} points={[[A[0], 0.02, A[2]], [B[0], 0.02, B[2]]]} color="#2e3d4d" lineWidth={7} />;
      })}
    </>
  );
}

/** Cables de fibra siguiendo las galerías hasta el receptor; el de superficie va punteado. */
function Cables() {
  return (
    <>
      {CABLES.map(([a, b]) => {
        const A = toScene(NODE_BY_ID[a].x, NODE_BY_ID[a].y);
        const B = toScene(NODE_BY_ID[b].x, NODE_BY_ID[b].y);
        const surface = a === BASE_ID || b === BASE_ID;
        return (
          <Line
            key={`cable-${a}-${b}`}
            points={[[A[0], 0.07, A[2]], [B[0], 0.07, B[2]]]}
            color={TYPE_COLORS.cable}
            lineWidth={surface ? 1.8 : 1.2}
            transparent
            opacity={surface ? 0.9 : 0.5}
            dashed={surface}
            dashSize={0.12}
            gapSize={0.08}
          />
        );
      })}
    </>
  );
}

function Zones() {
  return (
    <>
      {ZONES.map((zone) => {
        const cx = zone.x + zone.w / 2;
        const cy = zone.y + zone.h / 2;
        const [sx, , sz] = toScene(cx, cy);
        // Etiqueta en la franja superior de la zona para no tapar las estaciones que contiene.
        const [labelX, , labelZ] = toScene(cx, zone.y + 6);
        return (
          <group key={zone.name}>
            <mesh position={[sx, 0.005, sz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[zone.w / 60, zone.h / 70]} />
              <meshBasicMaterial color={zone.color} transparent opacity={0.35} depthWrite={false} />
            </mesh>
            <TextLabel position={[labelX, 0.45, labelZ]} text={zone.name} size={44} />
          </group>
        );
      })}
    </>
  );
}

function Pulse({ position, color, active }: { position: [number, number, number]; color: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !active) return;
    const scale = 1 + 0.5 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4));
    ref.current.scale.set(scale, scale, scale);
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.2, 0.25, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </mesh>
  );
}

/** Onda de señal inalámbrica: un aro que se expande y se desvanece. Sutil a propósito. */
function SignalRing({ position, active, offset }: { position: [number, number, number]; active: boolean; offset: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!mesh.current || !material.current) return;
    const phase = active ? (clock.elapsedTime * 0.5 + offset) % 1 : 0.5;
    const scale = 0.12 + phase * 0.5;
    mesh.current.scale.set(scale, scale, scale);
    material.current.opacity = active ? 0.3 * (1 - phase) : 0.12;
  });
  return (
    <mesh ref={mesh} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.92, 1, 48]} />
      <meshBasicMaterial ref={material} color={TYPE_COLORS.mx6} transparent depthWrite={false} />
    </mesh>
  );
}

export function MineMap() {
  const stations = useVigia((s) => s.stations);
  const workers = useVigia((s) => s.workers);
  const selectedStationId = useVigia((s) => s.selectedStationId);
  const selectedWorkerId = useVigia((s) => s.selectedWorkerId);
  const heatGas = useVigia((s) => s.heatGas);
  const layers = useVigia((s) => s.layers);
  const thresholds = useVigia((s) => s.thresholds);
  const selectStation = useVigia((s) => s.selectStation);
  const selectWorker = useVigia((s) => s.selectWorker);
  const reduceMotion = usePrefersReducedMotion();

  const receiver = toScene(NODE_BY_ID[ENTRY_ID].x, NODE_BY_ID[ENTRY_ID].y);
  const base = toScene(NODE_BY_ID[BASE_ID].x, NODE_BY_ID[BASE_ID].y);

  return (
    <div className="relative h-[34rem] w-full overflow-hidden rounded-md border border-line bg-canvas md:h-[44rem]">
      <Canvas camera={{ position: [0, 11, 8], fov: 38 }} dpr={[1, 2]}>
        <color attach="background" args={['#0a0e13']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 12, 6]} intensity={0.8} />

        <Zones />
        <Galleries />
        {layers.cables ? <Cables /> : null}

        {/* Receptor y procesador de información, en la entrada de la mina */}
        <mesh position={[receiver[0], 0.2, receiver[2]]}>
          <boxGeometry args={[0.36, 0.28, 0.36]} />
          <meshStandardMaterial color={TYPE_COLORS.receiver} emissive={TYPE_COLORS.receiver} emissiveIntensity={0.25} />
        </mesh>
        <TextLabel position={[receiver[0], 0.6, receiver[2]]} text={`${ENTRY_ID} · Receptor y procesador`} />

        {/* Base del ingeniero, en superficie */}
        <mesh position={[base[0], 0.16, base[2]]}>
          <boxGeometry args={[0.42, 0.3, 0.42]} />
          <meshStandardMaterial color={TYPE_COLORS.base} emissive={TYPE_COLORS.base} emissiveIntensity={0.3} />
        </mesh>
        <TextLabel position={[base[0], 0.6, base[2]]} text="BASE-01 · Ingeniero de turno" />

        {heatGas
          ? stations.map((st) => {
              const reading = st.readings[heatGas];
              const t = heatIntensity(reading.avg, thresholds[heatGas]);
              const [x, , z] = toScene(st.x, st.y);
              return (
                <mesh key={`heat-${st.id}`} position={[x, 0.25, z]}>
                  <sphereGeometry args={[0.25 + 0.7 * Math.min(Math.max(t, 0), 1), 24, 24]} />
                  <meshBasicMaterial color={heatColor(t)} transparent opacity={0.18} depthWrite={false} />
                </mesh>
              );
            })
          : null}

        {stations.map((st) => {
          const levelColor = LEVEL_COLORS[st.level];
          const selected = st.id === selectedStationId;
          const [x, , z] = toScene(st.x, st.y);
          return (
            <group key={st.id}>
              <mesh
                position={[x, 0.14, z]}
                onClick={(event) => {
                  event.stopPropagation();
                  selectStation(st.id);
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
              >
                <sphereGeometry args={[0.13, 24, 24]} />
                <meshStandardMaterial color={TYPE_COLORS.station} emissive={TYPE_COLORS.station} emissiveIntensity={0.3} />
              </mesh>
              <mesh position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.2, 0.235, 40]} />
                <meshBasicMaterial color={levelColor} />
              </mesh>
              {st.level > 0 ? <Pulse position={[x, 0.03, z]} color={levelColor} active={!reduceMotion} /> : null}
              {selected ? (
                <mesh position={[x, 0.035, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.29, 0.32, 40]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              ) : null}
              <TextLabel position={[x, 0.42, z]} text={st.id} size={44} />
            </group>
          );
        })}

        {workers.map((w, index) => {
          const [wx, , wz] = toScene(w.x, w.y);
          const linked = stations.find((s) => s.id === w.linkedStationId);
          const [lx, , lz] = linked ? toScene(linked.x, linked.y) : [wx, 0, wz];
          const selected = w.id === selectedWorkerId;
          return (
            <group key={w.id}>
              {layers.wireless ? (
                <>
                  <Line
                    points={[[wx, 0.3, wz], [lx, 0.2, lz]]}
                    color={TYPE_COLORS.mx6}
                    lineWidth={1}
                    transparent
                    opacity={0.35}
                    dashed
                    dashSize={0.06}
                    gapSize={0.1}
                  />
                  <SignalRing position={[wx, 0.04, wz]} active={!reduceMotion} offset={index / workers.length} />
                </>
              ) : null}
              {w.level >= 2 ? <Pulse position={[wx, 0.04, wz]} color={LEVEL_COLORS[w.level]} active={!reduceMotion} /> : null}
              <mesh
                position={[wx, 0.36, wz]}
                onClick={(event) => {
                  event.stopPropagation();
                  selectWorker(w.id);
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
                scale={selected ? 1.5 : 1}
              >
                <octahedronGeometry args={[0.13]} />
                <meshStandardMaterial color={TYPE_COLORS.mx6} emissive={TYPE_COLORS.mx6} emissiveIntensity={0.4} />
              </mesh>
            </group>
          );
        })}

        <OrbitControls
          target={[0, 0, -0.2]}
          enableDamping={!reduceMotion}
          minDistance={4}
          maxDistance={22}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col gap-2 rounded-sm border border-line bg-canvas/85 p-2 text-xs text-ink-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Legend color={TYPE_COLORS.station} label="Estación" />
          <Legend color={TYPE_COLORS.mx6} label="MX6 (minero)" />
          <Legend color={TYPE_COLORS.receiver} label="Receptor y procesador" />
          <Legend color={TYPE_COLORS.base} label="Base del ingeniero" />
          <Legend color={TYPE_COLORS.cable} label="Cable de fibra" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
          <span className="text-ink-muted">Aro de estación:</span>
          {([0, 1, 2, 3] as Level[]).map((level) => (
            <Legend key={level} color={LEVEL_COLORS[level]} label={LEVEL_META[level].mineLabel} />
          ))}
        </div>
      </div>
      <p className="pointer-events-none absolute left-3 top-3 rounded-sm bg-canvas/85 px-2 py-1 text-xs text-ink-muted">
        Superficie arriba · Nivel −200 m
      </p>
      <p className="pointer-events-none absolute right-3 top-3 rounded-sm bg-canvas/85 px-2 py-1 text-xs text-ink-muted">
        Arrastra para rotar · rueda para acercar · clic en estación o minero
      </p>
      <span className="sr-only">
        {`Mapa de la mina con ${stations.length} estaciones, ${workers.length} mineros con MX6, receptor en la entrada y base del ingeniero en superficie.`}
      </span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
