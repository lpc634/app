import { useEffect, useRef, useState } from "react";

export function useScrollProgress(scroller?: HTMLElement | null) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const isDoc =
      !scroller ||
      scroller === (document.scrollingElement as any) ||
      scroller === document.documentElement ||
      scroller === (document.body as any);

    const compute = () => {
      const scrollTop = isDoc ? (window.scrollY || 0) : (scroller?.scrollTop || 0);
      const total = isDoc
        ? Math.max(0, (document.documentElement.scrollHeight || 0) - window.innerHeight)
        : Math.max(0, (scroller?.scrollHeight || 0) - (scroller?.clientHeight || 0));
      const denom = total > 0 ? total : 1;
      const p = Math.max(0, Math.min(1, scrollTop / denom));
      setProgress(p);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        compute();
      });
    };

    const target: any = isDoc ? window : scroller!;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    compute();

    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scroller]);

  return progress; // 0..1
}


