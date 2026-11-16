"use client";

import { useEffect, useRef } from "react";
import type * as ThreeNS from "three";

export type Metal = "gold" | "silver" | "bronze" | "iron";

/** Physically based metal looks: base colour (sRGB) and polish. */
/** Tuned to the page palette: gold leads, silver and bronze sit back, iron stays matte and quiet. */
const METALS: Record<Metal, { color: string; roughness: number; clearcoat: number; glint: string; env: number }> = {
  gold: { color: "#f0c96a", roughness: 0.16, clearcoat: 0.6, glint: "#fff3cc", env: 1.2 },
  silver: { color: "#e6e9ed", roughness: 0.22, clearcoat: 0.4, glint: "#ffffff", env: 1.05 },
  bronze: { color: "#d99a6b", roughness: 0.26, clearcoat: 0.3, glint: "#ffe2c4", env: 1.05 },
  iron: { color: "#9aa0a7", roughness: 0.48, clearcoat: 0, glint: "#e6eaee", env: 0.8 },
};

/** Signals that the podium has risen; trophies grow in after it. Set by the hero entrance. */
export const PODIUM_READY_ATTR = "podium";

/**
 * Builds a photo-studio environment: a dark room with bright softboxes, so polished metal
 * picks up crisp product-shot reflections instead of a flat grey haze.
 */
function studio(THREE: typeof ThreeNS) {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  // A mid-grey room (not black) so mirror-like silver reads as silver rather than black chrome.
  const room = new THREE.SphereGeometry(30, 32, 16);
  const roomMat = new THREE.MeshBasicMaterial({ color: 0x67645e, side: THREE.BackSide });
  scene.add(new THREE.Mesh(room, roomMat));
  disposables.push(room, roomMat);

  const plane = new THREE.PlaneGeometry(1, 1);
  disposables.push(plane);
  const softbox = (w: number, h: number, intensity: number, pos: [number, number, number], tint = 0xffffff) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide });
    const m = new THREE.Mesh(plane, mat);
    m.scale.set(w, h, 1);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
    disposables.push(mat);
  };
  softbox(16, 7, 4.5, [0, 11, 3]); // overhead key
  softbox(3, 16, 6, [-9, 1, 4]); // left strip: long vertical highlight
  softbox(3, 16, 4.5, [9, 1, 4]); // right strip
  softbox(14, 2.4, 3.5, [0, 2, -10]); // rim from behind
  softbox(10, 8, 2.2, [0, 2, 12], 0xfff4e6); // warm front fill
  softbox(20, 6, 1.4, [0, -9, 3], 0xf4efe6); // cream bounce from the podium below
  return { scene, dispose: () => disposables.forEach((d) => d.dispose()) };
}

/**
 * One WebGL canvas over the podium. Each trophy stands on the element marked
 * `data-trophy-anchor="<index>"` inside `container`. Three.js is loaded lazily so it never blocks first paint.
 */
export function Trophies({ container, metals }: { container: React.RefObject<HTMLElement | null>; metals: Metal[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = container.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.NeutralToneMapping; // keeps gold gold (ACES shifts its hue)
      renderer.toneMappingExposure = 1.3;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = studio(THREE);
      const envTexture = pmrem.fromScene(env.scene, 0.015).texture;
      env.dispose();
      scene.environment = envTexture;

      // A small key for the clear-coat sparkle; the metal itself is lit by the environment.
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(3, 6, 5);
      scene.add(key);

      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      camera.position.set(0, 0, 20);

      /* ---------- cup: smooth lathe profile (foot, knotted stem, flared bowl, rolled lip) ---------- */
      const outline = new THREE.SplineCurve(
        [
          [0.001, 0], [0.34, 0], [0.37, 0.03], [0.34, 0.08], [0.22, 0.13], [0.12, 0.2], [0.08, 0.3], [0.07, 0.4],
          [0.12, 0.45], [0.07, 0.5], [0.065, 0.62], [0.13, 0.7], [0.28, 0.83], [0.4, 1.02], [0.47, 1.27], [0.5, 1.52],
          [0.53, 1.7], [0.56, 1.75], [0.55, 1.79], [0.51, 1.77], [0.47, 1.6], [0.43, 1.36], [0.34, 1.1], [0.18, 0.93], [0.001, 0.88],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
      );
      const cupGeo = new THREE.LatheGeometry(outline.getPoints(160), 96);
      cupGeo.computeVertexNormals();

      // Elegant S-curved handles, swept as tubes.
      const handleCurve = (side: 1 | -1) =>
        new THREE.CubicBezierCurve3(
          new THREE.Vector3(0.49 * side, 1.56, 0),
          new THREE.Vector3(0.95 * side, 1.66, 0),
          new THREE.Vector3(0.88 * side, 1.02, 0),
          new THREE.Vector3(0.36 * side, 1.02, 0),
        );
      const handleGeos = [new THREE.TubeGeometry(handleCurve(1), 64, 0.036, 16), new THREE.TubeGeometry(handleCurve(-1), 64, 0.036, 16)];

      const glintTexture = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d")!;
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.2, "rgba(255,255,255,0.5)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        g.fillStyle = "rgba(255,255,255,0.85)";
        g.fillRect(31.5, 6, 1, 52);
        g.fillRect(6, 31.5, 52, 1);
        return new THREE.CanvasTexture(c);
      })();

      const materials: ThreeNS.Material[] = [];
      const trophies = metals.map((metal, i) => {
        const spec = METALS[metal];
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(spec.color),
          metalness: 1,
          roughness: spec.roughness,
          clearcoat: spec.clearcoat,
          clearcoatRoughness: 0.04,
          envMapIntensity: spec.env,
          side: THREE.DoubleSide,
        });
        materials.push(mat);
        const group = new THREE.Group();
        group.add(new THREE.Mesh(cupGeo, mat), ...handleGeos.map((g) => new THREE.Mesh(g, mat)));

        const glintMat = new THREE.SpriteMaterial({ map: glintTexture, color: spec.glint, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
        materials.push(glintMat);
        const glint = new THREE.Sprite(glintMat);
        glint.scale.setScalar(0.42);
        group.add(glint);

        group.rotation.y = i * 1.4;
        group.visible = false;
        scene.add(group);
        return { group, glint, glintMat, phase: i * 1.1, appear: reduceMotion ? 1 : 0 };
      });

      /* ---------- layout: stand each cup on its anchor ---------- */
      const layout = () => {
        const rect = host.getBoundingClientRect();
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / h;
        trophies.forEach((t, i) => {
          const anchor = host.querySelector<HTMLElement>(`[data-trophy-anchor="${i}"]`);
          if (!anchor) return;
          const a = anchor.getBoundingClientRect();
          const cx = a.left + a.width / 2 - rect.left;
          // Float the cup a little above the block.
          const gap = a.height * 0.14;
          const bottom = a.bottom - rect.top - gap;
          // The cup is ~1.8 units tall; fit it to the space left (height-bound, never wider than the block).
          const unit = (Math.min(a.height - gap, a.width * 0.95) * worldPerPx) / 1.8;
          t.group.userData = { unit, baseY: (h / 2 - bottom) * worldPerPx, x: (cx - w / 2) * worldPerPx };
        });
      };
      layout();
      // With reduced motion there's no loop, so re-render after each resize.
      const resizeObserver = new ResizeObserver(() => {
        layout();
        if (reduceMotion) render();
      });

      /* ---------- loop ---------- */
      const timer = new THREE.Timer();
      timer.connect(document);
      const html = document.documentElement;
      const render = () => {
        timer.update();
        const dt = Math.min(timer.getDelta(), 0.05);
        const t = timer.getElapsed();
        const ready = reduceMotion || html.dataset[PODIUM_READY_ATTR] === "ready";
        trophies.forEach((tr, i) => {
          tr.appear = THREE.MathUtils.damp(tr.appear, ready ? 1 : 0, 3, dt);
          const s = tr.appear;
          const { unit = 1, baseY = 0, x = 0 } = tr.group.userData as { unit?: number; baseY?: number; x?: number };
          tr.group.visible = s > 0.005;
          tr.group.scale.setScalar(unit * (0.5 + 0.5 * s));
          // Rise into place, spin steadily, float a touch.
          tr.group.position.set(x, baseY - (1 - s) * unit * 0.6 + Math.sin(t * 1.5 + tr.phase) * 0.035 * unit * s, 0);
          tr.group.rotation.y += reduceMotion ? 0 : dt * (0.75 - i * 0.06);
          // A glint travels around the rim now and then.
          const angle = t * 1.2 + tr.phase;
          tr.glint.position.set(Math.cos(angle) * 0.55, 1.77, Math.sin(angle) * 0.55);
          // Only the top three glint; the iron cup stays matte.
          tr.glintMat.opacity = reduceMotion || metals[i] === "iron" ? 0 : s * Math.max(0, Math.sin(t * 1.9 + tr.phase * 2)) ** 6;
        });
        renderer.render(scene, camera);
      };

      let onScreen = true;
      const intersection = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        renderer.setAnimationLoop(onScreen && !reduceMotion ? render : null);
      });
      intersection.observe(host);
      resizeObserver.observe(host);
      if (reduceMotion) {
        timer.update();
        render();
      } else {
        renderer.setAnimationLoop(render);
      }

      cleanup = () => {
        renderer.setAnimationLoop(null);
        resizeObserver.disconnect();
        intersection.disconnect();
        timer.dispose();
        cupGeo.dispose();
        handleGeos.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        glintTexture.dispose();
        envTexture.dispose();
        pmrem.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [container, metals]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />;
}
