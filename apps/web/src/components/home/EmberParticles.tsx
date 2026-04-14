'use client';

import { useEffect, useRef } from 'react';

/**
 * Canvas particle field — floating embers for the cinematic hero.
 * Cheap: ~60 particles, single `requestAnimationFrame` loop, no external libs.
 * Respects `prefers-reduced-motion`.
 */
export function EmberParticles({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    let width = 0;
    let height = 0;

    interface P {
      x: number; y: number; r: number;
      vx: number; vy: number;
      life: number; maxLife: number;
      hue: number;
    }

    const particles: P[] = [];
    const COUNT = 60;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(): P {
      return {
        x: Math.random() * width,
        y: height + Math.random() * 40,
        r: 0.8 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(0.25 + Math.random() * 0.55),
        life: 0,
        maxLife: 180 + Math.random() * 240,
        hue: 14 + Math.random() * 18,       // 14-32deg = ember red→amber
      };
    }

    resize();
    for (let i = 0; i < COUNT; i++) {
      particles.push({ ...spawn(), y: Math.random() * height, life: Math.random() * 180 });
    }

    let rafId = 0;
    let running = true;

    function tick() {
      if (!ctx) return;
      if (!running) return; // paused — don't re-request
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        // Drift
        p.vx += (Math.random() - 0.5) * 0.01;

        const t = p.life / p.maxLife;
        const alpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.5) / 0.5);

        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grad.addColorStop(0, `hsla(${p.hue}, 100%, 60%, ${Math.max(0, alpha) * 0.8})`);
        grad.addColorStop(1, `hsla(${p.hue}, 100%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife || p.y < -10) {
          particles[i] = spawn();
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!running) {
        running = true;
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
    />
  );
}
