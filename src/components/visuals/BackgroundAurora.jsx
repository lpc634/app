// frontend/src/components/visuals/BackgroundAurora.jsx
import React from "react";
import "./../../styles/login.css";

export default function BackgroundAurora({ showParticles = true }) {
  return (
    <div className="v3-aurora-root" aria-hidden="true">
      <div className="v3-aurora-layer" />
      <div className="v3-aurora-blob v3-aurora-blob-a" />
      <div className="v3-aurora-blob v3-aurora-blob-b" />
      <div className="v3-aurora-blob v3-aurora-blob-c" />
      <div className="v3-grain" />
      {showParticles && <Sparkles count={42} />}
    </div>
  );
}

// Inline Sparkles component to avoid circular imports
function Sparkles({ count = 42 }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let raf = 0;
    let particles = [];
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particles.length === 0) {
        particles = Array.from({ length: count }).map(() => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 2,
          a: 0.08 + Math.random() * 0.12,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2
        }));
      }
    };

    const inView = () =>
      canvas.getBoundingClientRect().bottom > 0 &&
      canvas.getBoundingClientRect().top < window.innerHeight;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!inView()) return;

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, `rgba(255,122,26,${p.a})`);
        g.addColorStop(1, "rgba(255,122,26,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      particles = [];
    };
  }, [count]);

  return <canvas className="v3-sparkles" ref={ref} />;
}
