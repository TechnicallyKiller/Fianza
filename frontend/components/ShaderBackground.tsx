"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Animated navy noise field with subtle electric-blue highlights.
 * Ported verbatim from the shader in screens/dashboard.html so the marketing
 * site shares the dashboards' signature backdrop. Sits behind all content.
 */
export default function ShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Skip the GPU work entirely for users who prefer reduced motion.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // Bail gracefully if WebGL is unavailable rather than crashing the page.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
      },
      vertexShader: `
        varying vec2 v_texCoord;
        void main() {
          v_texCoord = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float u_time;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 uv = v_texCoord;
          vec2 p = uv * 3.0;

          float n = noise(p + u_time * 0.1);
          n += 0.5 * noise(p * 2.1 + u_time * 0.15);
          n += 0.25 * noise(p * 4.2 + u_time * 0.2);

          vec3 color1 = vec3(0.039, 0.055, 0.09);
          vec3 color2 = vec3(0.071, 0.094, 0.149);
          vec3 accent = vec3(0.231, 0.509, 0.965);

          vec3 finalColor = mix(color1, color2, n * 0.5);
          finalColor += accent * pow(n, 4.0) * 0.15;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId = 0;
    const animate = (time: number) => {
      material.uniforms.u_time.value = time * 0.001;
      renderer.render(scene, camera);
      if (!reduce) frameId = requestAnimationFrame(animate);
    };
    // Always render at least one frame so the field is present; only loop when
    // motion is allowed.
    animate(0);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.u_resolution.value.set(
        window.innerWidth,
        window.innerHeight,
      );
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (frameId) cancelAnimationFrame(frameId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 h-full w-full"
    />
  );
}
