"use client";

import { useEffect, useRef } from "react";
import { SKY_RECT, rectStyle } from "@/lib/anchor";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  length: number;
  thickness: number;
  brightness: number;
}

const MIN_GAP = 4.5;
const MAX_GAP = 14;

/**
 * Meteors across the painted sky. Deliberately sparse and quiet — the reward is
 * catching one, so a constant stream would cheapen it. Occasionally two travel
 * together, which is the kind of thing you'd point at from a campsite.
 */
export default function ShootingStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const stars: Star[] = [];
    let nextIn = 1.5 + Math.random() * 4;

    const spawn = () => {
      // Travel down-and-across, entering from the top or an upper side.
      const leftToRight = Math.random() < 0.62;
      const speed = 0.34 + Math.random() * 0.5;
      const angle = (Math.random() * 14 + 14) * (Math.PI / 180);
      stars.push({
        x: leftToRight ? -0.08 - Math.random() * 0.1 : 1.08 + Math.random() * 0.1,
        y: Math.random() * 0.55,
        vx: Math.cos(angle) * speed * (leftToRight ? 1 : -1),
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.9 + Math.random() * 0.9,
        length: 0.07 + Math.random() * 0.14,
        thickness: 0.9 + Math.random() * 1.5,
        brightness: 0.55 + Math.random() * 0.45,
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;

      nextIn -= dt;
      if (nextIn <= 0) {
        spawn();
        if (Math.random() < 0.18) spawn(); // the occasional pair
        nextIn = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (let n = stars.length - 1; n >= 0; n--) {
        const s = stars[n];
        s.age += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.age >= s.life || s.x < -0.3 || s.x > 1.3 || s.y > 1.2) {
          stars.splice(n, 1);
          continue;
        }

        // Fade in fast, fade out slowly.
        const p = s.age / s.life;
        const alpha = s.brightness * Math.min(1, p * 7) * (1 - p * p);

        const hx = s.x * w;
        const hy = s.y * h;
        const dir = Math.hypot(s.vx, s.vy) || 1;
        const tx = hx - (s.vx / dir) * s.length * w;
        const ty = hy - (s.vy / dir) * s.length * w;

        const tail = ctx.createLinearGradient(hx, hy, tx, ty);
        tail.addColorStop(0, `rgba(255, 252, 236, ${alpha})`);
        tail.addColorStop(0.25, `rgba(214, 232, 255, ${alpha * 0.55})`);
        tail.addColorStop(1, "rgba(160, 200, 255, 0)");

        ctx.strokeStyle = tail;
        ctx.lineWidth = s.thickness * (canvas.width / Math.max(1, canvas.clientWidth));
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        const head = ctx.createRadialGradient(hx, hy, 0, hx, hy, s.thickness * 4);
        head.addColorStop(0, `rgba(255, 255, 246, ${alpha})`);
        head.addColorStop(1, "rgba(200, 226, 255, 0)");
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(hx, hy, s.thickness * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const sync = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute z-[15]"
      style={rectStyle(SKY_RECT)}
    />
  );
}
