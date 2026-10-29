'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, Line, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LEVEL_META, type GasThreshold, type Level } from '@/config/thresholds';
import { ADJACENCY, ENTRY_ID, NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

/** 1 unidad de escena = 40 m, la separación entre estaciones. */
const S = 1 / 40;
const LEVEL_COLORS = ['#34d399', '#facc15', '#fb923c', '#f43f5e'];
const HEAT_STOPS = ['#34d399', '#facc15', '#fb923c', '#f43f5e'].map((c) => new THREE.Color(c));

/**
 * Etiqueta dibujada en una textura dentro de la escena. Evita <Html> de drei, que monta raíces
 * de React dentro del canvas y rompe al desmontar la ruta.
 */
function TextLabel({ position, text }: { position: [number, number, number]; text: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(10, 14, 19, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e8eef4';
      ctx.font = '600 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    }
    return new THREE.CanvasTexture(canvas);
  }, [text]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[0.84, 0.225]} />
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
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: [string, string][] = [];
    for (const [a, neighbors] of Object.entries(ADJACENCY)) {
      for (const b of neighbors) {
        const key = [a, b].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          out.push([a, b]);
        }
      }
    }
    return out;
  }, []);

  return (
    <>
      {edges.map(([a, b]) => {
        const A = NODE_BY_ID[a];
        const B = NODE_BY_ID[b];
        return (
          <Line
            key={`${a}-${b}`}
            points={[
              [A.x * S, 0.02, A.z * S],
              [B.x * S, 0.02, B.z * S],
            ]}
            color="#2e3d4d"
            lineWidth={7}
          />
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

  const activeWorkers = workers.filter((w) => !w.exited);

  return (
    <div className="relative h-[34rem] w-full overflow-hidden rounded-md border border-line bg-canvas md:h-[42rem]">
      <Canvas camera={{ position: [4.5, 9.5, 11], fov: 38 }} dpr={[1, 2]}>
        <color attach="background" args={['#0a0e13']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 12, 6]} intensity={0.8} />
        <gridHelper args={[30, 30, '#1a2530', '#1a2530']} position={[4.5, -0.02, 0.5]} />

        <Galleries />

        {/* Entrada: dispositivo de procesamiento */}
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.32, 0.4, 0.32]} />
          <meshStandardMaterial color="#e8eef4" />
        </mesh>
        <TextLabel position={[0, 0.55, 0]} text={ENTRY_ID} />

        {heatGas
          ? stations.map((st) => {
              const reading = st.readings[heatGas];
              const t = heatIntensity(reading.avg, thresholds[heatGas]);
              const color = heatColor(t);
              return (
                <mesh key={`heat-${st.id}`} position={[st.x * S, 0.25, st.z * S]}>
                  <sphereGeometry args={[0.25 + 0.7 * Math.min(Math.max(t, 0), 1), 24, 24]} />
                  <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
                </mesh>
              );
            })
          : null}

        {stations.map((st) => {
          const color = LEVEL_COLORS[st.level];
          const selected = st.id === selectedStationId;
          return (
            <group key={st.id}>
              <mesh
                position={[st.x * S, 0.15, st.z * S]}
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
              {st.level > 0 ? (
                <Pulse position={[st.x * S, 0.03, st.z * S]} color={color} active={!reduceMotion} />
              ) : null}
              {selected ? (
                <mesh position={[st.x * S, 0.03, st.z * S]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.32, 0.36, 40]} />
                  <meshBasicMaterial color="#e8eef4" />
                </mesh>
              ) : null}
              <TextLabel position={[st.x * S, 0.42, st.z * S]} text={st.id} />
            </group>
          );
        })}

        {activeWorkers
          .filter((w) => w.evacuating && w.route.length > 1)
          .map((w) => (
            <Line
              key={`route-${w.id}`}
              points={w.route.map((id) => [NODE_BY_ID[id].x * S, 0.12, NODE_BY_ID[id].z * S] as [number, number, number])}
              color="#f43f5e"
              lineWidth={2.5}
              dashed
              dashSize={0.18}
              gapSize={0.12}
            />
          ))}

        {activeWorkers.map((w) => {
          const selected = w.id === selectedWorkerId;
          const color = w.evacuating ? '#f43f5e' : '#e8eef4';
          return (
            <mesh
              key={w.id}
              position={[w.x * S, 0.3, w.z * S]}
              onClick={(event) => {
                event.stopPropagation();
                selectWorker(w.id);
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
              scale={selected ? 1.6 : 1}
            >
              <sphereGeometry args={[0.07, 16, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
          );
        })}

        <OrbitControls
          target={[4.2, 0, 0.2]}
          enableDamping={!reduceMotion}
          minDistance={4}
          maxDistance={22}
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
          Minero
        </span>
      </div>
      <p className="pointer-events-none absolute right-3 top-3 rounded-sm bg-canvas/85 px-2 py-1 text-xs text-ink-muted">
        Arrastra para rotar · rueda para acercar · clic en estación o minero
      </p>
      <span className="sr-only">
        {`Mapa 3D con ${stations.length} estaciones y ${activeWorkers.length} mineros. Use el listado lateral para seleccionar.`}
      </span>
    </div>
  );
}
