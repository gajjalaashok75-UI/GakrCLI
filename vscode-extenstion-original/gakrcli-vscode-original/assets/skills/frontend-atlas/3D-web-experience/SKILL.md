---
name: 3d-web-experience
description: "Master of web-based 3D experiences. Expert in Three.js, React Three Fiber, WebGL optimization, and 3D model pipelines. Creates performant, accessible 3D interfaces that enhance user experience without sacrificing usability. Knows when 3D adds value and when it's just decoration."
keywords: 3d, threejs, three.js, webgl, react-three-fiber, r3f, spline, babylon, 3d-models, glb, gltf, webgl-optimization, 3d-web, interactive-3d, 3d-configurator, 3d-product-viewer
related_skills: 
  - threejs-shaders
  - threejs-materials
  - threejs-textures
  - remotion-best-practices
  - scroll-experience
  - interactive-portfolio
  - frontend
  - landing-page-design
  - Visualisation-Guide
---

# 3D Web Experience

**Role**: 3D Web Experience Architect

You bring the third dimension to the web. You know when 3D enhances
and when it's just showing off. You balance visual impact with
performance. You make 3D accessible to users who've never touched
a 3D app. You create moments of wonder without sacrificing usability.

## Prerequisites

Before implementing 3D experiences, consult these related skills:

- **threejs-shaders**: Custom GLSL shaders and visual effects
- **threejs-materials**: PBR materials, textures, and material optimization
- **threejs-textures**: UV mapping, environment maps, HDR lighting
- **remotion-best-practices**: 3D content in video using Three.js and Remotion
- **Visualisation-Guide**: When to use 3D vs 2D data visualization

## Capabilities

### Core Technologies
- **Three.js**: Vanilla WebGL implementation with maximum control
- **React Three Fiber (R3F)**: Declarative 3D in React applications
- **@react-three/drei**: Helper components and abstractions
- **@react-three/postprocessing**: Visual effects and post-processing
- **Spline**: No-code 3D design tool with web export
- **Babylon.js**: Game-focused 3D engine alternative

### 3D Workflows
- 3D model pipeline (Blender → GLB → Web)
- Model optimization and compression (gltf-transform, Draco)
- Texture baking and material consolidation
- LOD (Level of Detail) systems
- Progressive loading strategies

### Interactive Experiences
- 3D product configurators
- Interactive 3D scenes
- Scroll-driven 3D animations
- Camera controls and navigation
- Physics integration (Cannon.js, Rapier)

### Performance & Optimization
- WebGL performance profiling
- Draw call reduction
- Instanced rendering
- Frustum culling
- Texture atlasing and compression
- Mobile optimization strategies

### Advanced Features
- Custom GLSL shaders (see `threejs-shaders` skill)
- PBR materials and lighting (see `threejs-materials` skill)
- Environment mapping and HDR (see `threejs-textures` skill)
- Post-processing effects
- AR/VR integration (WebXR)

## Patterns

### 3D Stack Selection

Choosing the right 3D approach

**When to use**: When starting a 3D web project

```markdown
## 3D Stack Selection

### Options Comparison
| Tool | Best For | Learning Curve | Control | Performance |
|------|----------|----------------|---------|-------------|
| Spline | Quick prototypes, designers, marketing sites | Low | Medium | Good |
| React Three Fiber | React apps, complex scenes, interactive | Medium | High | Excellent |
| Three.js vanilla | Max control, non-React, games | High | Maximum | Excellent |
| Babylon.js | Games, heavy 3D, physics-heavy | High | Maximum | Excellent |
| TresJS | Vue 3 apps (Vue equivalent of R3F) | Medium | High | Excellent |

### Decision Tree
```
Need quick 3D element for marketing/portfolio?
└── Yes → Spline (export to web)
└── No → Continue

Using React?
└── Yes → React Three Fiber + drei
└── No → Continue

Using Vue 3?
└── Yes → TresJS
└── No → Continue

Need max performance/control or building a game?
└── Yes → Three.js vanilla or Babylon.js
└── No → Spline or R3F
```

### Spline (Fastest Start)
Perfect for designers and quick prototypes. Export directly to web.

```jsx
import Spline from '@splinetool/react-spline';

export default function Scene() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Spline 
        scene="https://prod.spline.design/xxx/scene.splinecode"
        onLoad={(spline) => {
          // Access Spline API
          console.log('Scene loaded');
        }}
      />
    </div>
  );
}
```

**Pros**: No code required, visual editor, fast iteration
**Cons**: Less control, larger file sizes, limited customization

### React Three Fiber (Recommended for React)
Declarative Three.js in React. Best balance of power and developer experience.

```jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei';

function Model() {
  const { scene } = useGLTF('/model.glb');
  return <primitive object={scene} />;
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      
      {/* Environment */}
      <Environment preset="sunset" />
      
      {/* Model */}
      <Model />
      
      {/* Shadows */}
      <ContactShadows position={[0, -1, 0]} opacity={0.5} scale={10} blur={2} />
      
      {/* Controls */}
      <OrbitControls enablePan={false} enableZoom={false} />
    </Canvas>
  );
}
```

**Pros**: React integration, huge ecosystem (drei), excellent DX
**Cons**: React overhead, learning curve for Three.js concepts

### Three.js Vanilla (Maximum Control)
Direct Three.js for non-React projects or when you need absolute control.

```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Load model
const loader = new GLTFLoader();
loader.load('/model.glb', (gltf) => {
  scene.add(gltf.scene);
});

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.z = 5;

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

**Pros**: Maximum control, no framework overhead, best performance
**Cons**: More boilerplate, manual state management, steeper learning curve
```

### 3D Model Pipeline

Getting models web-ready

**When to use**: When preparing 3D assets for web deployment

```markdown
## 3D Model Pipeline

### Format Selection
| Format | Use Case | Size | Browser Support |
|--------|----------|------|-----------------|
| GLB/GLTF | Standard web 3D (recommended) | Smallest | Excellent |
| FBX | From 3D software (convert to GLB) | Large | Poor (needs loader) |
| OBJ | Simple meshes, legacy | Medium | Good |
| USDZ | Apple AR (iOS Safari) | Medium | iOS only |
| STL | 3D printing (not for web display) | Medium | Poor |

### Optimization Pipeline
```
1. Model in Blender/Maya/Cinema4D
   ↓
2. Reduce poly count (< 100K triangles for web, < 50K for mobile)
   ↓
3. Bake textures (combine multiple materials into texture atlases)
   ↓
4. Export as GLB (binary GLTF)
   ↓
5. Compress with gltf-transform (Draco + texture compression)
   ↓
6. Test file size (< 5MB ideal, < 2MB for mobile)
   ↓
7. Test on target devices (especially mobile)
```

### Blender Export Settings
```
File → Export → glTF 2.0 (.glb/.gltf)

✅ Include:
- Selected Objects (or visible objects)
- Apply Modifiers
- UVs
- Normals
- Materials: Export

✅ Transform:
- +Y Up (Three.js default)

✅ Geometry:
- Apply Modifiers: Yes
- UVs: Yes
- Normals: Yes
- Tangents: Yes (if using normal maps)
- Vertex Colors: Yes (if used)

✅ Compression:
- Draco mesh compression (if using gltf-transform later)

❌ Exclude:
- Cameras (add in code)
- Lights (add in code)
- Animations (unless needed)
```

### GLTF Compression with gltf-transform
```bash
# Install gltf-transform CLI
npm install -g @gltf-transform/cli

# Basic compression
gltf-transform optimize input.glb output.glb

# Advanced compression (recommended)
gltf-transform optimize input.glb output.glb \
  --compress draco \
  --texture-compress webp \
  --resize 2048 \
  --simplify \
  --weld \
  --dedup

# Flags explained:
# --compress draco: Compress geometry (50-90% size reduction)
# --texture-compress webp: Convert textures to WebP
# --resize 2048: Limit texture size to 2048px
# --simplify: Reduce polygon count while preserving shape
# --weld: Merge duplicate vertices
# --dedup: Remove duplicate materials/textures
```

### Loading in React Three Fiber
```jsx
import { useGLTF, useProgress, Html } from '@react-three/drei';
import { Suspense } from 'react';

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: '24px' }}>
        {progress.toFixed(0)}% loaded
      </div>
    </Html>
  );
}

function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

// Preload model (starts loading before component mounts)
useGLTF.preload('/model.glb');

export default function Scene() {
  return (
    <Canvas>
      <Suspense fallback={<Loader />}>
        <Model url="/model.glb" />
      </Suspense>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.3} />
    </Canvas>
  );
}
```

### Progressive Loading Strategy
```jsx
import { useGLTF } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';

function Model() {
  const [quality, setQuality] = useState('low');
  
  // Load low-res first, then high-res
  useEffect(() => {
    const timer = setTimeout(() => setQuality('high'), 1000);
    return () => clearTimeout(timer);
  }, []);
  
  const { scene } = useGLTF(
    quality === 'low' ? '/model-low.glb' : '/model-high.glb'
  );
  
  return <primitive object={scene} />;
}
```

### Model Optimization Checklist
- [ ] Poly count < 100K triangles (< 50K for mobile)
- [ ] Textures ≤ 2048px (1024px for mobile)
- [ ] Materials consolidated (< 5 materials ideal)
- [ ] Draco compression applied
- [ ] File size < 5MB (< 2MB for mobile)
- [ ] Tested on target devices
- [ ] Loading state implemented
- [ ] Fallback for failed loads
```

### Scroll-Driven 3D

3D that responds to scroll position

**When to use**: When integrating 3D with scroll-based storytelling

```markdown
## Scroll-Driven 3D

### R3F + ScrollControls (Recommended)
```jsx
import { ScrollControls, useScroll, Scroll } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

function RotatingModel() {
  const scroll = useScroll();
  const meshRef = useRef();

  useFrame(() => {
    // scroll.offset: 0 to 1 (scroll progress)
    // scroll.range(start, distance): returns 0-1 for a specific range
    
    // Rotate based on scroll position
    meshRef.current.rotation.y = scroll.offset * Math.PI * 2;
    
    // Scale based on scroll range (page 0 to 1)
    const scale = 1 + scroll.range(0, 1) * 0.5;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4a9eff" />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      {/* 3D content */}
      <RotatingModel />
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.3} />
      
      {/* HTML content that scrolls */}
      <Scroll html>
        <div style={{ height: '300vh' }}>
          <h1 style={{ marginTop: '100vh' }}>Scroll to see 3D magic</h1>
        </div>
      </Scroll>
    </>
  );
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <ScrollControls pages={3} damping={0.1}>
        <Scene />
      </ScrollControls>
    </Canvas>
  );
}
```

### Advanced Scroll Animations
```jsx
import { useScroll } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

function CameraPath() {
  const scroll = useScroll();
  const cameraRef = useRef();

  useFrame(({ camera }) => {
    // Define camera path keyframes
    const positions = [
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(3, 2, 4),
      new THREE.Vector3(-2, 1, 6),
      new THREE.Vector3(0, 0, 5),
    ];
    
    // Interpolate between positions based on scroll
    const progress = scroll.offset * (positions.length - 1);
    const index = Math.floor(progress);
    const nextIndex = Math.min(index + 1, positions.length - 1);
    const t = progress - index;
    
    camera.position.lerpVectors(
      positions[index],
      positions[nextIndex],
      t
    );
    
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Model() {
  const scroll = useScroll();
  const groupRef = useRef();

  useFrame(() => {
    // Different animations for different scroll sections
    const section1 = scroll.range(0, 1/3); // First third
    const section2 = scroll.range(1/3, 1/3); // Second third
    const section3 = scroll.range(2/3, 1/3); // Last third
    
    // Section 1: Rotate
    groupRef.current.rotation.y = section1 * Math.PI * 2;
    
    // Section 2: Move up
    groupRef.current.position.y = section2 * 3;
    
    // Section 3: Scale down
    const scale = 1 - section3 * 0.5;
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#4a9eff" />
      </mesh>
    </group>
  );
}
```

### GSAP + Three.js (Non-React)
```javascript
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

// Assuming you have scene, camera, mesh set up

// Rotate mesh on scroll
gsap.to(mesh.rotation, {
  y: Math.PI * 2,
  scrollTrigger: {
    trigger: '.section-1',
    start: 'top top',
    end: 'bottom top',
    scrub: true, // Smooth scrubbing
  },
});

// Move camera on scroll
gsap.to(camera.position, {
  z: 10,
  y: 5,
  scrollTrigger: {
    trigger: '.section-2',
    start: 'top center',
    end: 'bottom center',
    scrub: 1, // 1 second lag
  },
});

// Change material color on scroll
gsap.to(mesh.material.color, {
  r: 1,
  g: 0,
  b: 0,
  scrollTrigger: {
    trigger: '.section-3',
    start: 'top bottom',
    end: 'center center',
    scrub: true,
  },
});
```

### Locomotive Scroll + Three.js
```javascript
import LocomotiveScroll from 'locomotive-scroll';
import * as THREE from 'three';

const scroll = new LocomotiveScroll({
  el: document.querySelector('[data-scroll-container]'),
  smooth: true,
});

scroll.on('scroll', (args) => {
  // args.scroll.y is current scroll position
  const scrollProgress = args.scroll.y / args.limit.y;
  
  // Update 3D scene based on scroll
  mesh.rotation.y = scrollProgress * Math.PI * 2;
  camera.position.z = 5 + scrollProgress * 5;
});
```

### Common Scroll Effects
- **Camera movement through scene**: Fly-through animations
- **Model rotation on scroll**: Product showcase
- **Reveal/hide elements**: Progressive disclosure
- **Color/material changes**: Mood transitions
- **Exploded view animations**: Technical diagrams
- **Parallax layers**: Depth perception
- **Morph targets**: Shape transformations
```

### Performance Optimization

Making 3D fast and smooth

**When to use**: When 3D performance is poor or on mobile devices

```markdown
## Performance Optimization

### Performance Profiling
```jsx
import { Perf } from 'r3f-perf';

export default function Scene() {
  return (
    <Canvas>
      {/* Shows FPS, draw calls, triangles, etc. */}
      <Perf position="top-left" />
      
      {/* Your scene */}
    </Canvas>
  );
}
```

### Reduce Draw Calls with Instancing
```jsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function InstancedBoxes({ count = 1000 }) {
  const meshRef = useRef();
  
  // Generate random positions
  const positions = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        position: [
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
        ],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ],
      });
    }
    return temp;
  }, [count]);
  
  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <boxGeometry />
      <meshStandardMaterial />
      {positions.map((props, i) => (
        <Instance key={i} {...props} />
      ))}
    </instancedMesh>
  );
}

function Instance({ position, rotation }) {
  const ref = useRef();
  
  useEffect(() => {
    if (ref.current) {
      ref.current.position.set(...position);
      ref.current.rotation.set(...rotation);
      ref.current.updateMatrix();
    }
  }, [position, rotation]);
  
  return <group ref={ref} />;
}
```

### LOD (Level of Detail)
```jsx
import { Lod } from '@react-three/drei';

function OptimizedModel() {
  return (
    <Lod distances={[0, 10, 20]}>
      {/* High detail (close) */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial />
      </mesh>
      
      {/* Medium detail */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial />
      </mesh>
      
      {/* Low detail (far) */}
      <mesh>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </Lod>
  );
}
```

### Frustum Culling (Automatic)
Three.js automatically culls objects outside the camera view. Ensure objects have proper bounding boxes:

```javascript
// Force bounding box calculation
mesh.geometry.computeBoundingBox();
mesh.geometry.computeBoundingSphere();
```

### Texture Optimization
```jsx
import { useTexture } from '@react-three/drei';

function OptimizedMaterial() {
  // Load compressed textures
  const texture = useTexture('/texture.webp');
  
  // Set texture properties for performance
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 1; // Lower = faster
  
  return <meshStandardMaterial map={texture} />;
}
```

### Mobile Optimization
```jsx
import { useDetectGPU } from '@react-three/drei';

function AdaptiveScene() {
  const gpu = useDetectGPU();
  
  // Adjust quality based on device
  const quality = gpu.tier >= 2 ? 'high' : 'low';
  
  return (
    <Canvas
      dpr={quality === 'high' ? [1, 2] : [1, 1]} // Pixel ratio
      gl={{
        antialias: quality === 'high',
        powerPreference: 'high-performance',
      }}
    >
      {quality === 'high' ? (
        <HighQualityScene />
      ) : (
        <LowQualityScene />
      )}
    </Canvas>
  );
}
```

### Performance Checklist
- [ ] Draw calls < 100 (check with Perf)
- [ ] Triangles < 100K visible at once
- [ ] Textures compressed (WebP/KTX2)
- [ ] Instancing for repeated objects
- [ ] LOD for distant objects
- [ ] Frustum culling enabled
- [ ] Shadows only where needed
- [ ] Post-processing minimal
- [ ] 60 FPS on target devices
- [ ] Battery drain acceptable on mobile
```

## Anti-Patterns

### ❌ 3D For 3D's Sake

**Why bad**: 
- Slows down the site (3-5 second load time increase)
- Confuses users who expect standard navigation
- Battery drain on mobile (30-50% faster drain)
- Doesn't help conversion (often hurts it)
- Accessibility nightmare for screen readers

**Instead**: 
- 3D should serve a clear purpose
- Product visualization = good use case
- Interactive configurator = good use case
- Random floating shapes = probably not
- Ask: "Would a high-quality image or video work better?"
- Measure impact on conversion before committing

**Good 3D use cases**:
- Product configurators (furniture, cars, jewelry)
- Technical visualizations (architecture, engineering)
- Interactive storytelling (scroll-driven narratives)
- Data visualization (when 3D adds clarity)
- Games and entertainment

### ❌ Desktop-Only 3D

**Why bad**: 
- 60-80% of traffic is mobile
- Kills battery (WebGL is power-hungry)
- Crashes on low-end devices (< 2GB RAM)
- Frustrated users = high bounce rate
- Poor Core Web Vitals scores

**Instead**: 
- Test on real mobile devices (not just DevTools)
- Reduce quality on mobile (lower poly, smaller textures)
- Provide static fallback image for low-end devices
- Consider disabling 3D on devices with GPU tier < 1
- Use adaptive quality based on device capabilities
- Monitor FPS and adjust quality dynamically

**Mobile optimization strategy**:
```jsx
import { useDetectGPU } from '@react-three/drei';

function AdaptiveScene() {
  const gpu = useDetectGPU();
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  
  if (gpu.tier === 0 || (isMobile && gpu.tier === 1)) {
    // Show static image fallback
    return <StaticFallback />;
  }
  
  return (
    <Canvas dpr={isMobile ? 1 : [1, 2]}>
      {isMobile ? <LowQualityScene /> : <HighQualityScene />}
    </Canvas>
  );
}
```

### ❌ No Loading State

**Why bad**: 
- Users think the site is broken
- High bounce rate (users leave before 3D loads)
- 3D models take 2-10 seconds to load
- Bad first impression
- No feedback = anxiety

**Instead**: 
- Loading progress indicator (percentage)
- Skeleton/placeholder that matches final layout
- Load 3D after page is interactive (progressive enhancement)
- Optimize model size (< 2MB for mobile)
- Preload critical models
- Show low-res version first, then swap to high-res

**Good loading pattern**:
```jsx
import { useProgress, Html } from '@react-three/drei';
import { Suspense } from 'react';

function Loader() {
  const { progress, active } = useProgress();
  
  return (
    <Html center>
      <div className="loader">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
        <p>{progress.toFixed(0)}% loaded</p>
      </div>
    </Html>
  );
}

export default function Scene() {
  return (
    <Canvas>
      <Suspense fallback={<Loader />}>
        <Model />
      </Suspense>
    </Canvas>
  );
}
```

### ❌ Ignoring Accessibility

**Why bad**:
- Screen readers can't navigate 3D scenes
- Keyboard navigation often broken
- No alternative for users who can't see 3D
- Legal compliance issues (ADA, WCAG)
- Excludes users with disabilities

**Instead**:
- Provide text descriptions of 3D content
- Ensure keyboard navigation works
- Add ARIA labels to interactive elements
- Provide 2D fallback for critical information
- Test with screen readers
- Add reduced motion support

**Accessible 3D pattern**:
```jsx
export default function AccessibleScene() {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  
  return (
    <>
      {/* Screen reader description */}
      <div className="sr-only" aria-live="polite">
        Interactive 3D product viewer. Use arrow keys to rotate.
        Press Enter to view details.
      </div>
      
      {prefersReducedMotion ? (
        <StaticImage alt="Product view" />
      ) : (
        <Canvas>
          <Scene />
        </Canvas>
      )}
    </>
  );
}
```

### ❌ Unoptimized Models

**Why bad**:
- 10MB+ models kill mobile data plans
- Long load times = high bounce rate
- Poor performance even on good devices
- Wasted bandwidth and server costs

**Instead**:
- Compress with Draco (50-90% size reduction)
- Optimize textures (WebP, max 2048px)
- Reduce poly count (< 100K triangles)
- Use LOD for distant objects
- Test file size before deploying
- Target < 2MB for mobile, < 5MB for desktop

### ❌ Too Many Draw Calls

**Why bad**:
- Each draw call has CPU overhead
- > 100 draw calls = performance issues
- Stuttering and low FPS
- Battery drain

**Instead**:
- Use instancing for repeated objects
- Merge geometries where possible
- Reduce number of materials
- Use texture atlases
- Profile with r3f-perf

## Related Skills

### Core 3D Skills
- **threejs-shaders**: Custom GLSL shaders and visual effects
- **threejs-materials**: PBR materials, textures, material optimization
- **threejs-textures**: UV mapping, environment maps, HDR lighting

### Integration Skills
- **remotion-best-practices**: 3D content in video using Three.js and Remotion
- **scroll-experience**: Scroll-driven animations and interactions
- **interactive-portfolio**: Portfolio sites with 3D elements
- **frontend**: General frontend development patterns
- **landing-page-design**: Landing pages with 3D hero sections

### Data & Visualization
- **Visualisation-Guide**: When to use 3D vs 2D data visualization

## When to Use

This skill is applicable when:
- Building interactive 3D product configurators
- Creating scroll-driven 3D storytelling experiences
- Implementing 3D data visualizations
- Adding 3D elements to marketing sites
- Building WebGL-based games or experiences
- Optimizing existing 3D web projects
- Integrating AI-generated 3D models
- Creating immersive portfolio pieces

**Not applicable when**:
- A static image would work just as well
- Target audience is primarily mobile with poor connectivity
- Accessibility is the top priority
- Performance budget is very tight
- Content is primarily text-based