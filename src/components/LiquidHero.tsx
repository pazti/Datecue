import { Canvas, useFrame } from "@react-three/fiber"
import { Float, MeshTransmissionMaterial, Sparkles } from "@react-three/drei"
import { useRef } from "react"
import * as THREE from "three"

function LiquidLogo() {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!mesh.current) return
    mesh.current.rotation.x = state.clock.elapsedTime * 0.18
    mesh.current.rotation.y = state.clock.elapsedTime * 0.28
    mesh.current.scale.setScalar(
      1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.035,
    )
  })
  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.5}>
      <mesh ref={mesh} castShadow>
        <icosahedronGeometry args={[1.15, 5]} />
        <MeshTransmissionMaterial
          backside
          chromaticAberration={0.12}
          distortion={0.42}
          distortionScale={0.5}
          iridescence={0.8}
          iridescenceIOR={1.2}
          metalness={0.1}
          roughness={0.08}
          thickness={1.3}
          transmission={1}
          color="#ff947f"
        />
      </mesh>
    </Float>
  )
}

function GradientPlane() {
  const material = useRef<THREE.ShaderMaterial>(null)
  useFrame((state) => {
    if (material.current)
      material.current.uniforms.uTime.value = state.clock.elapsedTime
  })
  return (
    <mesh position={[0, 0, -2.8]} scale={[5.5, 4, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        transparent
        uniforms={{ uTime: { value: 0 } }}
        vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        fragmentShader="uniform float uTime; varying vec2 vUv; void main(){vec2 p=vUv-.5;float wave=sin(uTime*.32+p.x*5.0)*.08;float glow=exp(-length(p+vec2(wave,.08))*2.2);vec3 a=vec3(.06,.16,.2);vec3 b=vec3(.76,.28,.22);vec3 c=vec3(.16,.36,.34);vec3 col=mix(a,b,smoothstep(.15,.9,vUv.y+wave));col=mix(col,c,glow*.7);gl_FragColor=vec4(col,.92);}"
      />
    </mesh>
  )
}

export function LiquidBackdrop() {
  return (
    <div className="liquid-backdrop" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 42 }}
        dpr={[1, 1.4]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.8} />
        <pointLight color="#ffb19c" intensity={4} position={[3, 2, 3]} />
        <pointLight color="#80d8cb" intensity={3} position={[-3, -2, 2]} />
        <GradientPlane />
        <Sparkles
          count={28}
          color="#ffe7da"
          scale={7}
          size={1.5}
          speed={0.16}
        />
      </Canvas>
    </div>
  )
}

export default function LiquidHero() {
  return (
    <div
      className="liquid-hero absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 42 }}
        dpr={[1, 1.7]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.2} />
        <pointLight color="#ffb19c" intensity={7} position={[2, 2, 3]} />
        <pointLight color="#80d8cb" intensity={5} position={[-3, -1, 2]} />
        <GradientPlane />
        <LiquidLogo />
        <Sparkles count={42} color="#ffe7da" scale={5} size={2} speed={0.22} />
      </Canvas>
    </div>
  )
}

export function LiquidGlass({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`liquid-glass ${className}`}>{children}</div>
}

export function LiquidLogoMark() {
  return (
    <span className="liquid-logo-mark" aria-hidden="true">
      <span />
    </span>
  )
}
