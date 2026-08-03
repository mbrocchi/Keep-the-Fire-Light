"use client";

import { useEffect, useRef } from "react";
import { FIRE_RECT, PIT_IN_CANVAS, rectStyle } from "@/lib/anchor";
import { FireEngine, sparkHeat } from "./engine";
import { QUAD_VERT, HEAT_FRAG, FLAME_FRAG, SPARK_VERT, SPARK_FRAG } from "./glsl";

interface Props {
  /** Server intensity, 0-100. */
  intensity: number;
  /** Changing this number triggers an ember burst — bump it when someone solves. */
  flareToken?: number;
  /** Skip the growing-in animation on first paint. */
  snapOnMount?: boolean;
}

const MAX_SPARKS = 512;
const ASPECT = FIRE_RECT.w / FIRE_RECT.h; // quad width / height, in stage units

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
  const program = gl.createProgram()!;
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program failed to link: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function uniforms(gl: WebGL2RenderingContext, program: WebGLProgram, names: string[]) {
  const map: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) map[n] = gl.getUniformLocation(program, n);
  return map;
}

export default function Campfire({ intensity, flareToken = 0, snapOnMount = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FireEngine | null>(null);
  const targetRef = useRef(intensity / 100);
  const flareRef = useRef(flareToken);

  targetRef.current = Math.max(0, Math.min(1, intensity / 100));

  // Fire the ember burst on the next frame after a solve.
  useEffect(() => {
    if (flareToken !== flareRef.current) {
      flareRef.current = flareToken;
      engineRef.current?.burst();
    }
  }, [flareToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const engine = new FireEngine(snapOnMount ? targetRef.current : 0, reduced);
    engineRef.current = engine;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
    });

    const cleanup = gl
      ? startWebgl(canvas, gl, engine, targetRef, reduced)
      : startCanvas2d(canvas, engine, targetRef, reduced);

    return () => {
      cleanup();
      engineRef.current = null;
    };
    // The engine is intentionally created once; live values come through refs.
  }, [snapOnMount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute z-10"
      style={rectStyle(FIRE_RECT)}
    />
  );
}

/* ------------------------------------------------------------------------- */
/* Shared per-frame plumbing                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Publishes the fire's state as CSS custom properties on the document root, so
 * the glow layer, HUD panels, buttons and logbook cards can all be lit by the
 * same flame without any of them re-rendering in React.
 */
function publishVars(engine: FireEngine) {
  const root = document.documentElement.style;
  root.setProperty("--fire-intensity", engine.intensity.toFixed(4));
  root.setProperty("--fire-flicker", engine.flicker.toFixed(4));
  root.setProperty("--fire-glow", (engine.intensity * engine.flicker).toFixed(4));
}

/**
 * Runs `frame` on rAF, but only while the canvas is on screen and the tab is
 * visible — an off-screen campfire should cost nothing.
 */
function driveFrames(canvas: HTMLCanvasElement, frame: (dt: number) => void) {
  let raf = 0;
  let last = performance.now();
  let onScreen = true;

  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((t - last) / 1000, 0.1);
    last = t;
    frame(dt);
  };

  const start = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const sync = () => (onScreen && !document.hidden ? start() : stop());

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  });
  io.observe(canvas);
  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    stop();
    io.disconnect();
    document.removeEventListener("visibilitychange", sync);
  };
}

/** Keeps the drawing buffer matched to the element's real size. */
function trackSize(canvas: HTMLCanvasElement, onResize?: () => void) {
  const apply = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      onResize?.();
    }
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(canvas);
  return () => ro.disconnect();
}

/* ------------------------------------------------------------------------- */
/* WebGL2 renderer                                                            */
/* ------------------------------------------------------------------------- */

function startWebgl(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  engine: FireEngine,
  target: { current: number },
  reduced: boolean
) {
  let heatProgram: WebGLProgram;
  let flameProgram: WebGLProgram;
  let sparkProgram: WebGLProgram;
  try {
    heatProgram = link(gl, QUAD_VERT, HEAT_FRAG);
    flameProgram = link(gl, QUAD_VERT, FLAME_FRAG);
    sparkProgram = link(gl, SPARK_VERT, SPARK_FRAG);
  } catch (err) {
    console.warn("[campfire] WebGL setup failed, falling back to 2D", err);
    return startCanvas2d(canvas, engine, target, reduced);
  }

  const heatU = uniforms(gl, heatProgram, [
    "uBg", "uRectOrigin", "uRectSize", "uPit", "uHalfWidth", "uTime", "uIntensity", "uAspect",
  ]);
  const flameU = uniforms(gl, flameProgram, [
    "uPit", "uHalfWidth", "uTime", "uIntensity", "uFlicker", "uAspect",
  ]);
  const sparkU = uniforms(gl, sparkProgram, ["uDpr"]);

  // Full-quad geometry, shared by both fullscreen passes.
  const quadVao = gl.createVertexArray()!;
  const quadBuf = gl.createBuffer()!;
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Sparks: one interleaved dynamic buffer, refilled every frame.
  const sparkVao = gl.createVertexArray()!;
  const sparkBuf = gl.createBuffer()!;
  const sparkData = new Float32Array(MAX_SPARKS * 4); // x, y, size, heat
  gl.bindVertexArray(sparkVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuf);
  gl.bufferData(gl.ARRAY_BUFFER, sparkData.byteLength, gl.DYNAMIC_DRAW);
  const stride = 4 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 12);
  gl.bindVertexArray(null);

  // The background, so the heat pass can genuinely refract the painting.
  const texture = gl.createTexture()!;
  let textureReady = false;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]));

  const image = new Image();
  image.decoding = "async";
  image.src = "/art/background.png";
  image
    .decode()
    .then(() => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      // Mipmapping matches the browser's own downscale closely enough that the
      // undisplaced edge of the heat plume is invisible against the CSS layer.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textureReady = true;
    })
    .catch(() => {
      // No texture means no refraction; flames and sparks carry on regardless.
    });

  const stopSize = trackSize(canvas, () => gl.viewport(0, 0, canvas.width, canvas.height));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  let contextLost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const stopFrames = driveFrames(canvas, (dt) => {
    if (contextLost) return;
    engine.setTarget(target.current);
    engine.step(dt);
    publishVars(engine);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const i = engine.intensity;

    // 1. Heat haze — alpha blended over the painting.
    if (textureReady && i > 0.04) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(heatProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(heatU.uBg, 0);
      gl.uniform2f(heatU.uRectOrigin, FIRE_RECT.x, FIRE_RECT.y);
      gl.uniform2f(heatU.uRectSize, FIRE_RECT.w, FIRE_RECT.h);
      gl.uniform2f(heatU.uPit, PIT_IN_CANVAS.x, PIT_IN_CANVAS.y);
      gl.uniform1f(heatU.uHalfWidth, PIT_IN_CANVAS.halfWidth);
      gl.uniform1f(heatU.uTime, engine.time);
      gl.uniform1f(heatU.uIntensity, i);
      gl.uniform1f(heatU.uAspect, ASPECT);
      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // 2. Flames and ember bed — additive, so they light the scene.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(flameProgram);
    gl.uniform2f(flameU.uPit, PIT_IN_CANVAS.x, PIT_IN_CANVAS.y);
    gl.uniform1f(flameU.uHalfWidth, PIT_IN_CANVAS.halfWidth);
    gl.uniform1f(flameU.uTime, engine.time);
    gl.uniform1f(flameU.uIntensity, i);
    gl.uniform1f(flameU.uFlicker, engine.flicker);
    gl.uniform1f(flameU.uAspect, ASPECT);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 3. Sparks.
    const count = Math.min(engine.sparks.length, MAX_SPARKS);
    if (count > 0) {
      for (let n = 0; n < count; n++) {
        const s = engine.sparks[n];
        const o = n * 4;
        sparkData[o] = s.x * 2 - 1;
        sparkData[o + 1] = s.y * 2 - 1;
        sparkData[o + 2] = s.size;
        sparkData[o + 3] = sparkHeat(s);
      }
      gl.useProgram(sparkProgram);
      gl.uniform1f(sparkU.uDpr, canvas.width / Math.max(1, canvas.clientWidth));
      gl.bindVertexArray(sparkVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sparkData, 0, count * 4);
      gl.drawArrays(gl.POINTS, 0, count);
    }

    gl.bindVertexArray(null);
  });

  return () => {
    stopFrames();
    stopSize();
    canvas.removeEventListener("webglcontextlost", onLost);
    gl.deleteProgram(heatProgram);
    gl.deleteProgram(flameProgram);
    gl.deleteProgram(sparkProgram);
    gl.deleteBuffer(quadBuf);
    gl.deleteBuffer(sparkBuf);
    gl.deleteVertexArray(quadVao);
    gl.deleteVertexArray(sparkVao);
    gl.deleteTexture(texture);
  };
}

/* ------------------------------------------------------------------------- */
/* 2D fallback — no refraction, but the same fire                             */
/* ------------------------------------------------------------------------- */

function startCanvas2d(
  canvas: HTMLCanvasElement,
  engine: FireEngine,
  target: { current: number },
  reduced: boolean
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const stopSize = trackSize(canvas);
  const layers = reduced ? 3 : 6;

  const stopFrames = driveFrames(canvas, (dt) => {
    engine.setTarget(target.current);
    engine.step(dt);
    publishVars(engine);

    const w = canvas.width;
    const h = canvas.height;
    const px = PIT_IN_CANVAS.x * w;
    const py = (1 - PIT_IN_CANVAS.y) * h; // canvas y grows downward
    const halfW = PIT_IN_CANVAS.halfWidth * w;
    const i = engine.intensity;
    const flameH = (0.16 + 0.46 * i) * h * engine.flicker;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Ember bed.
    const bed = ctx.createRadialGradient(px, py, 0, px, py, halfW * 1.7);
    bed.addColorStop(0, `rgba(255,${Math.round(140 + 90 * i)},60,${0.55 + 0.4 * i})`);
    bed.addColorStop(0.5, `rgba(226,98,43,${0.3 + 0.3 * i})`);
    bed.addColorStop(1, "rgba(120,20,0,0)");
    ctx.fillStyle = bed;
    ctx.beginPath();
    ctx.ellipse(px, py, halfW * 1.7, halfW * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stacked teardrops of decreasing size stand in for the shader's tongues.
    for (let n = 0; n < layers; n++) {
      const f = n / layers;
      const t = engine.time * (1.1 + n * 0.37) + n * 2.1;
      const sway = Math.sin(t) * halfW * 0.55 * (0.3 + f);
      const lh = flameH * (1 - f * 0.62) * (0.85 + 0.3 * Math.sin(t * 1.7));
      const lw = halfW * (1.15 - f * 0.62) * (0.9 + 0.2 * Math.sin(t * 2.3));
      const cy = py - lh * 0.42;

      const g = ctx.createRadialGradient(px + sway, cy, 0, px + sway, cy, Math.max(lw, lh) * 0.7);
      const hot = Math.min(1, 0.35 + f * 0.7 + i * 0.35);
      g.addColorStop(0, `rgba(255,${Math.round(215 + 40 * hot)},${Math.round(150 + 80 * hot)},${0.5 * (0.4 + i * 0.6)})`);
      g.addColorStop(0.35, `rgba(255,${Math.round(150 + 40 * i)},50,${0.34 * (0.4 + i * 0.6)})`);
      g.addColorStop(1, "rgba(200,50,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px + sway, cy, lw, lh * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sparks.
    const dpr = w / Math.max(1, canvas.clientWidth);
    for (const s of engine.sparks) {
      const heat = sparkHeat(s);
      const r = s.size * dpr * 0.9;
      const x = s.x * w;
      const y = (1 - s.y) * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, `rgba(255,${Math.round(180 + 70 * heat)},${Math.round(80 + 120 * heat)},${0.9 * heat})`);
      g.addColorStop(1, "rgba(200,40,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
  });

  return () => {
    stopFrames();
    stopSize();
  };
}
