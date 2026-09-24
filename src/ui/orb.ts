import { drawSpectralTrace } from "./spectral-trace";

interface Transition {
  from: DOMRect;
  target: HTMLCanvasElement;
  began: number;
  levels: Float32Array;
}

// The resting orb is decorative. Only the live audio renderer supplies the
// measured spectrum after the transition; idle motion never enters that data.
export function createOrb(canvas: HTMLCanvasElement): {
  unroll(from: DOMRect, target: HTMLCanvasElement): void;
  stop(): void;
} {
  const context = canvas.getContext("2d");
  if (!context) return { unroll() {}, stop() {} };
  const parent = canvas.parentElement!;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const levels = new Float32Array(240);
  let transition: Transition | undefined;
  let animationFrame = 0;
  let stopped = false;

  const finish = (): void => {
    stopped = true;
    cancelAnimationFrame(animationFrame);
    observer.disconnect();
    reducedMotion.removeEventListener("change", motionChanged);
    if (transition) {
      transition.target.style.removeProperty("opacity");
      parent.append(canvas);
      canvas.removeAttribute("style");
    }
  };

  const draw = (now: number): void => {
    if (stopped) return;
    let morph = 0;
    if (transition) {
      const progress = Math.min(1, (now - transition.began) / 1100);
      if (progress === 1) {
        finish();
        return;
      }
      morph = progress * progress * (3 - 2 * progress);
      const target = transition.target.getBoundingClientRect();
      const from = transition.from;
      const lerp = (a: number, b: number): number => a + (b - a) * morph;
      Object.assign(canvas.style, {
        left: `${lerp(from.left, target.left)}px`,
        top: `${lerp(from.top, target.top)}px`,
        width: `${lerp(from.width, target.width)}px`,
        height: `${lerp(from.height, target.height)}px`,
      });
      const reveal = Math.max(0, (progress - 0.7) / 0.3);
      transition.target.style.opacity = String(reveal);
      canvas.style.opacity = String(1 - reveal);
      for (let i = 0; i < levels.length; i++) {
        levels[i] = transition.levels[i]! * (1 - morph);
      }
    } else {
      const time = reducedMotion.matches ? 1200 : now;
      for (let i = 0; i < levels.length; i++) {
        const angle = (i / (levels.length - 1)) * Math.PI * 2;
        let value =
          0.3 +
          Math.sin(angle * 3 + time / 1500) * 0.045 +
          Math.sin(angle * 5 - time / 2300) * 0.03 +
          Math.sin(angle * 8 + time / 900) * 0.018;
        for (let peak = 0; peak < 4; peak++) {
          const centre =
            (0.5 + 0.5 * Math.sin(time / (1700 + peak * 640) + peak * 1.9)) *
            (levels.length - 1);
          const distance = Math.abs(i - centre);
          value += Math.max(0, 1 - distance / 2.5) * 0.27;
        }
        levels[i] = value;
      }
      levels[levels.length - 1] = levels[0]!;
    }
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    drawSpectralTrace(context, levels, width, height, morph);
    if (!reducedMotion.matches || transition) {
      animationFrame = requestAnimationFrame(draw);
    }
  };

  const motionChanged = (): void => {
    cancelAnimationFrame(animationFrame);
    if (transition && reducedMotion.matches) finish();
    else draw(performance.now());
  };
  const observer = new ResizeObserver(() => {
    if (reducedMotion.matches && !transition) draw(performance.now());
  });
  observer.observe(canvas);
  reducedMotion.addEventListener("change", motionChanged);
  draw(performance.now());

  return {
    unroll(from, target) {
      if (stopped || transition) return;
      if (reducedMotion.matches) {
        finish();
        return;
      }
      transition = {
        from,
        target,
        began: performance.now(),
        levels: levels.slice(),
      };
      target.style.opacity = "0";
      Object.assign(canvas.style, {
        position: "fixed",
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        zIndex: "5",
        pointerEvents: "none",
      });
      document.body.append(canvas);
    },
    stop: finish,
  };
}
