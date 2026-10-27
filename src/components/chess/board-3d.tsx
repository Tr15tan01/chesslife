'use client'

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Color, PieceType } from '@/lib/chess/types'
import { squareXY, type TrackedPiece } from '@/lib/chess/pieces'
import type { BoardProps } from './board-types'

/**
 * 3D board: procedural lathe-turned pieces (no external models, textures or
 * HDRs, so the strict CSP holds), arcing move animations, captured pieces
 * that fly to a graveyard beside the board, and orbit controls. Under
 * prefers-reduced-motion everything snaps into place.
 */

const GOLD = '#c9a45c'
const FILES = 'abcdefgh'

function useReduced(): boolean {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
}

function world(square: string): THREE.Vector3 {
  const { file, rank } = squareXY(square)
  return new THREE.Vector3(file - 3.5, 0, 3.5 - rank)
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const v = (x: number, y: number) => new THREE.Vector2(x, y)
const BASE = [v(0, 0), v(0.36, 0), v(0.36, 0.06), v(0.31, 0.1), v(0.27, 0.13)]
const lathe = (pts: THREE.Vector2[]) => new THREE.LatheGeometry(pts, 28)

type Part = { geo: THREE.BufferGeometry; pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number]; trim?: boolean }

function buildParts(): Record<PieceType, Part[]> {
  const sphere = (r: number) => new THREE.SphereGeometry(r, 24, 16)
  const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z)
  const trim = new THREE.TorusGeometry(0.335, 0.016, 8, 40)
  const trimPart: Part = { geo: trim, pos: [0, 0.075, 0], rot: [Math.PI / 2, 0, 0], trim: true }
  return {
    p: [{ geo: lathe([...BASE, v(0.17, 0.2), v(0.11, 0.36), v(0.17, 0.4), v(0.17, 0.43), v(0.07, 0.46), v(0, 0.46)]) }, { geo: sphere(0.14), pos: [0, 0.56, 0] }, trimPart],
    r: [
      { geo: lathe([...BASE, v(0.23, 0.2), v(0.2, 0.52), v(0.27, 0.57), v(0.28, 0.74), v(0, 0.74)]) },
      ...[0, 1, 2, 3].map((i): Part => ({ geo: box(0.13, 0.1, 0.1), pos: [Math.cos((i * Math.PI) / 2) * 0.2, 0.79, Math.sin((i * Math.PI) / 2) * 0.2], rot: [0, (-i * Math.PI) / 2, 0] })),
      trimPart,
    ],
    n: [
      { geo: lathe([...BASE, v(0.24, 0.2), v(0.22, 0.3), v(0, 0.3)]) },
      { geo: box(0.24, 0.5, 0.34), pos: [0, 0.52, 0.02], rot: [-0.32, 0, 0] },
      { geo: box(0.2, 0.18, 0.36), pos: [0, 0.7, -0.17], rot: [0.35, 0, 0] },
      { geo: box(0.05, 0.12, 0.06), pos: [0.07, 0.86, 0.05] },
      { geo: box(0.05, 0.12, 0.06), pos: [-0.07, 0.86, 0.05] },
      { geo: box(0.04, 0.42, 0.06), pos: [0, 0.58, 0.2], rot: [-0.3, 0, 0], trim: true },
      trimPart,
    ],
    b: [
      { geo: lathe([...BASE, v(0.2, 0.22), v(0.12, 0.6), v(0.19, 0.64), v(0.19, 0.67), v(0.08, 0.7), v(0, 0.7)]) },
      { geo: sphere(0.15), pos: [0, 0.82, 0], scale: [1, 1.35, 1] },
      { geo: sphere(0.045), pos: [0, 1.04, 0], trim: true },
      trimPart,
    ],
    q: [
      { geo: lathe([...BASE, v(0.22, 0.24), v(0.13, 0.72), v(0.21, 0.78), v(0.21, 0.82), v(0.12, 0.86), v(0.2, 1.0), v(0, 0.95)]) },
      ...Array.from({ length: 8 }, (_, i): Part => ({ geo: sphere(0.038), pos: [Math.cos((i * Math.PI) / 4) * 0.19, 1.01, Math.sin((i * Math.PI) / 4) * 0.19], trim: true })),
      { geo: sphere(0.07), pos: [0, 1.04, 0] },
      trimPart,
    ],
    k: [
      { geo: lathe([...BASE, v(0.23, 0.24), v(0.14, 0.76), v(0.22, 0.82), v(0.22, 0.86), v(0.15, 0.9), v(0.19, 1.02), v(0, 1.02)]) },
      { geo: box(0.07, 0.26, 0.07), pos: [0, 1.15, 0], trim: true },
      { geo: box(0.2, 0.07, 0.07), pos: [0, 1.18, 0], trim: true },
      trimPart,
    ],
  }
}

let PARTS: Record<PieceType, Part[]> | null = null
const parts = () => (PARTS ??= buildParts())

function useMaterials() {
  return useMemo(
    () => ({
      w: new THREE.MeshPhysicalMaterial({ color: '#efe6d2', roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      b: new THREE.MeshPhysicalMaterial({ color: '#1c1f27', roughness: 0.3, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
      trim: new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.9, roughness: 0.25 }),
    }),
    [],
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

type Mats = ReturnType<typeof useMaterials>

function graveyardSlot(piece: TrackedPiece, pieces: TrackedPiece[], orientation: Color): THREE.Vector3 {
  const fallen = pieces.filter((p) => p.color === piece.color && !p.square).sort((a, b) => (a.capturedAt ?? 0) - (b.capturedAt ?? 0))
  const i = fallen.findIndex((p) => p.id === piece.id)
  // Rows fill from the end farthest from the player's camera, which stays in frame at every distance.
  const side = piece.color === 'b' ? 1 : -1
  const far = orientation === 'w' ? 1 : -1
  const col = Math.floor(i / 8)
  const row = i % 8
  return new THREE.Vector3(side * (4.95 + col * 0.62), -0.04, far * (row - 3.5))
}

function Piece({ piece, pieces, orientation, mats, selected, interactive, onSquare, reduced }: { piece: TrackedPiece; pieces: TrackedPiece[]; orientation: Color; mats: Mats; selected: boolean; interactive: boolean; onSquare: (sq: string) => void; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const gone = !piece.square
  const target = gone ? graveyardSlot(piece, pieces, orientation) : world(piece.square!)
  const anim = useRef({ from: target.clone(), to: target.clone(), t: 1, delay: 0, lift: 0 })
  // Position is owned by the animation after mount; a stable prop object stops re-renders snapping it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => target.clone(), [])
  const { invalidate } = useThree()

  useEffect(() => {
    const a = anim.current
    const g = ref.current
    if (a.to.equals(target)) return
    a.from = g ? g.position.clone() : a.to.clone()
    a.from.y = 0
    a.to = target.clone()
    a.t = reduced ? 1 : 0
    // Captured pieces leave once the capturing piece lands.
    a.delay = gone ? 0.32 : 0
    const dist = a.from.distanceTo(a.to)
    a.lift = gone ? 0.9 : piece.type === 'n' ? 0.75 : 0.18 + dist * 0.05
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.x, target.z, gone])

  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const a = anim.current
    if (a.delay > 0) {
      a.delay -= dt
      return
    }
    if (a.t < 1) {
      a.t = Math.min(1, a.t + dt / 0.48)
      const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
      g.position.lerpVectors(a.from, a.to, e)
      g.position.y = a.to.y + Math.sin(Math.PI * e) * a.lift
    } else {
      g.position.copy(a.to)
      if (selected && !reduced) g.position.y = 0.12 + Math.sin(state.clock.elapsedTime * 4) * 0.04
    }
    const s = gone ? 0.62 : 1
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, s, 6, dt))
  })

  // Knights face their owner's left, the classic profile view.
  const facing = piece.color === 'w' ? Math.PI / 2 : -Math.PI / 2
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (interactive && piece.square) onSquare(piece.square)
  }
  return (
    <group ref={ref} position={initial} rotation={[0, facing, 0]} onClick={click}>
      {parts()[piece.type].map((p, i) => (
        <mesh key={i} geometry={p.geo} position={p.pos} rotation={p.rot} scale={p.scale} material={p.trim ? mats.trim : mats[piece.color]} castShadow receiveShadow />
      ))}
    </group>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────

function Squares({ selected, targets, lastMove, checkSquare, occupied, interactive, onSquare }: Pick<BoardProps, 'selected' | 'targets' | 'lastMove' | 'checkSquare' | 'interactive' | 'onSquare'> & { occupied: Set<string> }) {
  const squares = useMemo(() => {
    const out: string[] = []
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out.push(`${FILES[f]}${r + 1}`)
    return out
  }, [])
  return (
    <group>
      {squares.map((sq) => {
        const { file, rank } = squareXY(sq)
        const dark = (file + rank) % 2 === 0
        const p = world(sq)
        const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq)
        const color = selected === sq ? '#b8913f' : isLast ? (dark ? '#4d4630' : '#d8c27f') : dark ? '#262d3e' : '#d6cbb2'
        return (
          <group key={sq} position={[p.x, 0, p.z]}>
            <mesh
              position={[0, -0.05, 0]}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation()
                if (interactive) onSquare(sq)
              }}
              onPointerOver={() => interactive && (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
            >
              <boxGeometry args={[1, 0.1, 1]} />
              <meshStandardMaterial color={color} roughness={dark ? 0.55 : 0.7} metalness={dark ? 0.15 : 0.02} />
            </mesh>
            {targets.includes(sq) &&
              (occupied.has(sq) ? (
                <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.38, 0.47, 40]} />
                  <meshBasicMaterial color={GOLD} transparent opacity={0.9} />
                </mesh>
              ) : (
                <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.13, 32]} />
                  <meshBasicMaterial color={GOLD} transparent opacity={0.85} />
                </mesh>
              ))}
            {checkSquare === sq && (
              <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.48, 40]} />
                <meshBasicMaterial color="#d25046" transparent opacity={0.55} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

function Frame() {
  return (
    <group>
      <mesh position={[0, -0.26, 0]} receiveShadow castShadow>
        <boxGeometry args={[9.0, 0.32, 9.0]} />
        <meshStandardMaterial color="#171a22" roughness={0.45} metalness={0.3} />
      </mesh>
      {[
        [0, 4.18, 8.42, 0.06],
        [0, -4.18, 8.42, 0.06],
        [4.18, 0, 0.06, 8.42],
        [-4.18, 0, 0.06, 8.42],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x!, -0.095, z!]}>
          <boxGeometry args={[w!, 0.02, d!]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[11, 64]} />
        <meshStandardMaterial color="#10131a" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Seat the camera behind the player's pieces; narrow viewports get a wider lens so the whole board fits. */
function CameraRig({ orientation }: { orientation: Color }) {
  const { get, size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  useEffect(() => {
    const camera = get().camera
    const side = orientation === 'w' ? 1 : -1
    camera.position.set(0, 9.6, side * 9.2)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = aspect < 1.1 ? 44 : 36
      camera.updateProjectionMatrix()
    }
  }, [orientation, get, aspect])
  return null
}

export default function Board3D(props: BoardProps & { className?: string }) {
  const reduced = useReduced()
  const mats = useMaterials()
  const occupied = useMemo(() => new Set(props.pieces.filter((p) => p.square).map((p) => p.square!)), [props.pieces])
  return (
    <Canvas
      className={props.className}
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 9.6, 9.2], fov: 36 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => (document.body.style.cursor = '')}
      aria-label="3D chess board"
    >
      <CameraRig orientation={props.orientation} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 11, 5]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
      <spotLight position={[0, 9, 0]} angle={0.7} penumbra={0.9} intensity={28} color="#ffd9a0" />
      <directionalLight position={[-6, 3, -5]} intensity={0.8} color="#6f8fd8" />
      <pointLight position={[6, 2, 6]} intensity={5} color={GOLD} distance={14} />
      <Frame />
      <Squares {...props} occupied={occupied} />
      {props.pieces.map((p) => (
        <Piece key={p.id} piece={p} pieces={props.pieces} orientation={props.orientation} mats={mats} selected={props.selected === p.square && !!p.square} interactive={props.interactive} onSquare={props.onSquare} reduced={reduced} />
      ))}
      <ContactShadows position={[0, -0.59, 0]} opacity={0.45} scale={22} blur={2.4} far={2} />
      <OrbitControls enablePan={false} enableDamping minDistance={8} maxDistance={18} minPolarAngle={0.25} maxPolarAngle={1.15} target={[0, 0, props.orientation === 'w' ? 0.45 : -0.45]} />
    </Canvas>
  )
}
