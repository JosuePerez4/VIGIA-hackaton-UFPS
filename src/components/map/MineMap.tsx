'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, Line, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LEVEL_META, type GasThreshold, type Level } from '@/config/thresholds';
import { EDGES, ENTRY_ID, NODE_BY_ID, ZONES } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

/** Mapa SVG (390 × 660). Cuadrícula de 60 px en X y 70 px en Y → una unidad por celda. */
const toScene = (x: number, y: number): [number, number, number] => [(x - 190) / 60, 0, (y - 330) / 70];

const LEVEL_COLORS = ['#34d399', '#facc15', '#fb923c', '#f43f5e'];
const HEAT_STOPS = ['#34d399', '#facc15', '#fb923c', '#f43f5e'].map((c) => new THREE.Color(c));

/**
 * Etiqueta dibujada en una textura dentro de la escena. Evita <Html> de drei, que monta raíces
 * de React dentro del canvas y rompe al desmontar la ruta.
 */
function TextLabel({ position, text, size = 40 }: { position: [number, number, number]; text: string; size?: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(10, 14, 19, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e8eef4';
      ctx.font = `600 ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    }
    return new THREE.CanvasTexture(canvas);
  }, [text, size]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[0.8, 0.25]} />
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

export function MineMap() {
  const stations = useVigia((s) => s.stations);
  const workers = useVigia((s) => s.workers);
  const selectedStationId = useVigia((s) => s.selectedStationId);
  const selectedWorkerId = useVigia((s) => s.selectedWorkerId);
  const heatGas = useVigia((s) => s.heatGas);
  const thresholds = useVigia((s) => s.thresholds);
  const selectStation = useVigia((s) => s.selectStation);
  const selectWorker = useVigia((s) => s.selectWorker);
  const reduceMotion = usePrefersReducedMotion();

  const entry = toScene(NODE_BY_ID[ENTRY_ID].x, NODE_BY_ID[ENTRY_ID].y);

  return (
    <div className="relative h-[34rem] w-full overflow-hidden rounded-md border border-line bg-canvas md:h-[44rem]">
      <Canvas camera={{ position: [0, 9.2, 6.6], fov: 38 }} dpr={[1, 2]}>
        <color attach="background" args={['#0a0e13']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 12, 6]} intensity={0.8} />

        <Zones />
        <Galleries />

        {/* Entrada: dispositivo de procesamiento */}
        <mesh position={[entry[0], 0.2, entry[2]]}>
          <boxGeometry args={[0.32, 0.4, 0.32]} />
          <meshStandardMaterial color="#e8eef4" />
        </mesh>
        <TextLabel position={[entry[0], 0.55, entry[2]]} text={ENTRY_ID} />

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
          const color = LEVEL_COLORS[st.level];
          const selected = st.id === selectedStationId;
          const [x, , z] = toScene(st.x, st.y);
          return (
            <group key={st.id}>
              <mesh
                position={[x, 0.15, z]}
                onClick={(event) => {
                  event.stopPropagation();
                  selectStation(st.id);
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
              >
                <sphereGeometry args={[0.16, 24, 24]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={st.level > 0 ? 0.9 : 0.2} />
              </mesh>
              {st.level > 0 ? <Pulse position={[x, 0.03, z]} color={color} active={!reduceMotion} /> : null}
              {selected ? (
                <mesh position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.32, 0.36, 40]} />
                  <meshBasicMaterial color="#e8eef4" />
                </mesh>
              ) : null}
              <TextLabel position={[x, 0.42, z]} text={st.id} />
            </group>
          );
        })}

        {workers.map((w) => {
          const [wx, , wz] = toScene(w.x, w.y);
          const linked = stations.find((s) => s.id === w.linkedStationId);
          const [lx, , lz] = linked ? toScene(linked.x, linked.y) : [wx, 0, wz];
          const selected = w.id === selectedWorkerId;
          const color = w.level >= 2 ? LEVEL_COLORS[w.level] : '#e8eef4';
          return (
            <group key={w.id}>
              <Line points={[[wx, 0.3, wz], [lx, 0.2, lz]]} color="#8a9aab" lineWidth={1} transparent opacity={0.6} />
              <mesh
                position={[wx, 0.3, wz]}
                onClick={(event) => {
                  event.stopPropagation();
                  selectWorker(w.id);
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
                scale={selected ? 1.6 : 1}
              >
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
              </mesh>
            </group>
          );
        })}

        <OrbitControls
          target={[0, 0, 0.5]}
          enableDamping={!reduceMotion}
          minDistance={4}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-sm border border-line bg-canvas/85 p-2 text-xs text-ink-muted">
        {([0, 1, 2, 3] as Level[]).map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: LEVEL_COLORS[level] }} aria-hidden="true" />
            {LEVEL_META[level].mineLabel}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink" aria-hidden="true" />
          Minero con MX6
        </span>
      </div>
      <p className="pointer-events-none absolute left-3 top-3 rounded-sm bg-canvas/85 px-2 py-1 text-xs text-ink-muted">
        Nivel −200 m
      </p>
      <p className="pointer-events-none absolute right-3 top-3 rounded-sm bg-canvas/85 px-2 py-1 text-xs text-ink-muted">
        Arrastra para rotar · rueda para acercar · clic en estación o minero
      </p>
      <span className="sr-only">
        {`Mapa de la mina con ${stations.length} estaciones y ${workers.length} mineros con MX6. Use el listado lateral para seleccionar.`}
      </span>
    </div>
  );
}
