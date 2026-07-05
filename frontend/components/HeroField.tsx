"use client";

// HeroField — the premium background. A GPU-driven flowing particle current:
// thousands of luminous points drift left→right toward "the horizon" and wrap,
// with brand-blue dominant and sparse green/amber sparks. All displacement runs
// in the vertex shader (zero per-frame CPU), so it stays smooth. Subtle mouse
// parallax; respects prefers-reduced-motion. Replaces the noise field / graph.

import { useEffect, useRef } from "react";
import * as THREE from "three";

const NAVY = 0x090d16;

export default function HeroField() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 9);

    // Bail gracefully if WebGL is unavailable (disabled browser, context limit)
    // — the page keeps its solid navy background instead of crashing.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return;
    }
    const pix = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pix);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(NAVY, 1);
    container.appendChild(renderer.domElement);

    // Fewer particles on small / low-power screens.
    const COUNT = window.innerWidth < 768 ? 2200 : 4600;

    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);

    const blue = new THREE.Color(0x4d8eff);
    const green = new THREE.Color(0x4edea3);
    const amber = new THREE.Color(0xffb95f);
    const dim = new THREE.Color(0x1b2c52);
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 48;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 2] = -10 + Math.random() * 13;
      seeds[i] = Math.random();

      const r = Math.random();
      if (r < 0.6) c.copy(blue).lerp(dim, Math.random() * 0.5);
      else if (r < 0.82) c.copy(dim);
      else if (r < 0.93) c.copy(green);
      else c.copy(amber);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_time: { value: 0 },
        u_pix: { value: pix },
      },
      vertexShader: `
        attribute float aSeed;
        attribute vec3 aColor;
        uniform float u_time;
        uniform float u_pix;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vec3 p = position;
          float sp = 0.25 + aSeed * 0.55;
          float x = mod(p.x + u_time * sp + 24.0, 48.0) - 24.0;
          float y = p.y + sin(u_time * 0.2 + aSeed * 6.2831 + p.x * 0.25) * 0.9;
          float z = p.z + cos(u_time * 0.15 + aSeed * 6.2831 + p.x * 0.2) * 0.9;
          vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
          float size = 1.1 + aSeed * 2.6;
          gl_PointSize = size * u_pix * (13.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
          vAlpha = clamp(0.25 + aSeed * 0.75, 0.2, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a * vAlpha);
        }
      `,
    });

    const points = new THREE.Points(geo, material);
    scene.add(points);

    // Mouse parallax.
    const par = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMouse = (e: MouseEvent) => {
      par.tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
      par.ty = -(e.clientY / window.innerHeight - 0.5) * 0.35;
    };
    window.addEventListener("pointermove", onMouse);

    const render = () => renderer.render(scene, camera);

    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) * 0.001;
      material.uniforms.u_time.value = t;
      par.x += (par.tx - par.x) * 0.04;
      par.y += (par.ty - par.y) * 0.04;
      points.rotation.y = par.x * 0.25;
      points.rotation.x = par.y * 0.25;
      camera.position.x = par.x * 1.2;
      camera.position.y = par.y * 1.0;
      camera.lookAt(0, 0, 0);
      render();
      frameId = requestAnimationFrame(animate);
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (reduce) render();
    };
    window.addEventListener("resize", onResize);

    if (reduce) {
      material.uniforms.u_time.value = 8;
      render();
    } else {
      animate();
    }

    return () => {
      window.removeEventListener("pointermove", onMouse);
      window.removeEventListener("resize", onResize);
      if (frameId) cancelAnimationFrame(frameId);
      geo.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 -z-[1] h-full w-full"
    />
  );
}
