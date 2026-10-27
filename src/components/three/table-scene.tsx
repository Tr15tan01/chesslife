'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Float, RoundedBox } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { tableStore } from './table-store'

/**
 * Hero scene: a graphite negotiation table seen at a three-quarter angle,
 * two stacks of offer tokens that slide toward each other as a deal gets
 * closer, floating term sheets, and one glass "decision" form.
 * Geometry is deliberately low-poly; no external textures or HDRs are loaded.
 */

const IVORY = '#e9e1cf'
const GOLD = '#c9a45c'

function useReduced(): boolean {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
}

function Table() {
  return (
    <group position={[0, -0.6, 0]}>
      <mesh receiveShadow castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[3.1, 3.1, 0.22, 96]} />
        <meshStandardMaterial color="#1c1f27" roughness={0.42} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.72, 96]} />
        <meshStandardMaterial color="#1b2440" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.72, 2.78, 96]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.117, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.025, 4.6]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, -0.9, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.6, 1.6, 32]} />
        <meshStandardMaterial color="#14171e" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  )
}

function ChipStack({ side, count, color }: { side: -1 | 1; count: number; color: string }) {
  const group = useRef<THREE.Group>(null)
  const reduced = useReduced()
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const { gap } = tableStore.get()
    const targetX = side * (0.38 + gap * 1.55)
    g.position.x = reduced ? targetX : THREE.MathUtils.damp(g.position.x, targetX, 3.2, dt)
  })
  return (
    <group ref={group} position={[side * 1.7, -0.47, side * 0.25]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[Math.sin(i * 1.7) * 0.02, i * 0.072, Math.cos(i * 1.3) * 0.02]} castShadow>
          <cylinderGeometry args={[0.26, 0.26, 0.06, 40]} />
          <meshStandardMaterial color={color} metalness={color === GOLD ? 0.85 : 0.1} roughness={color === GOLD ? 0.3 : 0.45} />
        </mesh>
      ))}
    </group>
  )
}

function TermSheet({ position, rotation, speed = 1 }: { position: [number, number, number]; rotation: [number, number, number]; speed?: number }) {
  const reduced = useReduced()
  const lines = useMemo(() => [0.32, 0.18, 0.04, -0.1, -0.24], [])
  const content = (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[1.05, 1.4, 0.012]} radius={0.02} smoothness={2} castShadow>
        <meshStandardMaterial color={IVORY} roughness={0.9} />
      </RoundedBox>
      {lines.map((y, i) => (
        <mesh key={i} position={[-0.06 + (i === 0 ? -0.12 : 0), y + 0.18, 0.008]}>
          <planeGeometry args={[i === 0 ? 0.5 : 0.78, i === 0 ? 0.05 : 0.022]} />
          <meshBasicMaterial color={i === 0 ? '#3a3020' : '#9a8f78'} />
        </mesh>
      ))}
      <mesh position={[0.28, -0.5, 0.008]}>
        <planeGeometry args={[0.32, 0.012]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
    </group>
  )
  if (reduced) return content
  return (
    <Float speed={1.2 * speed} rotationIntensity={0.25} floatIntensity={0.6}>
      {content}
    </Float>
  )
}

function DecisionForm() {
  const ref = useRef<THREE.Mesh>(null)
  const reduced = useReduced()
  useFrame((_, dt) => {
    if (!ref.current || reduced) return
    ref.current.rotation.y += dt * 0.25
    ref.current.rotation.x += dt * 0.08
  })
  return (
    <mesh ref={ref} position={[1.95, 1.35, -1.1]} castShadow>
      <octahedronGeometry args={[0.42, 0]} />
      <meshPhysicalMaterial color="#d8c08a" roughness={0.12} metalness={0.15} transmission={0.75} thickness={0.6} ior={1.4} clearcoat={1} />
    </mesh>
  )
}

function Rig() {
  const reduced = useReduced()
  const base = useMemo(() => new THREE.Vector3(0.6, 4.1, 8.4), [])
  useFrame((state, dt) => {
    if (reduced) return
    const cam = state.camera
    cam.position.x = THREE.MathUtils.damp(cam.position.x, base.x + state.pointer.x * 0.6, 2, dt)
    cam.position.y = THREE.MathUtils.damp(cam.position.y, base.y + state.pointer.y * 0.3, 2, dt)
    cam.lookAt(0, -0.2, 0)
  })
  return null
}

function Lights() {
  const warm = useRef<THREE.SpotLight>(null)
  useFrame(() => {
    const m = tableStore.get().mood
    if (!warm.current) return
    const target = m === 'warm' ? 2.6 : m === 'cool' ? 1.2 : 1.9
    warm.current.intensity += (target * 18 - warm.current.intensity) * 0.05
  })
  return (
    <>
      <ambientLight intensity={0.28} />
      <spotLight ref={warm} position={[0.5, 6, 1.5]} angle={0.62} penumbra={0.85} intensity={34} color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 2.5, -3]} intensity={1.1} color="#6f8fd8" />
      <pointLight position={[3, 1, 3]} intensity={6} color={GOLD} distance={8} />
    </>
  )
}

export default function TableScene({ className }: { className?: string }) {
  const reduced = useReduced()
  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 1.75]}
      frameloop={reduced ? 'demand' : 'always'}
      camera={{ position: [0.6, 4.1, 8.4], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden
    >
      <Rig />
      <Lights />
      <Table />
      <ChipStack side={-1} count={6} color={IVORY} />
      <ChipStack side={1} count={8} color={GOLD} />
      <TermSheet position={[-2.15, 1.05, -0.9]} rotation={[-0.35, 0.45, 0.12]} />
      <TermSheet position={[-0.6, 1.75, -2.1]} rotation={[-0.2, -0.2, -0.08]} speed={0.8} />
      <DecisionForm />
      <ContactShadows position={[0, -2.15, 0]} opacity={0.5} scale={12} blur={2.6} far={3} />
    </Canvas>
  )
}
