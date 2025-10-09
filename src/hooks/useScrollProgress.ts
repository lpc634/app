import { useEffect, useMemo, useRef, useState } from "react";

type OptEl = HTMLElement | null | undefined;

function getTotals(target: "doc" | "el", el?: HTMLElement | null) {
  if (target === "doc") {
    const total = Math.max(0, (document.documentElement.scrollHeight || 0) - window.innerHeight);
    const top = window.scrollY || 0;
    return { total, top };
  } else {
    const total = Math.max(0, (el?.scrollHeight || 0) - (el?.clientHeight || 0));
    const top = el?.scrollTop || 0;
    return { total, top };
  }
}

export function useScrollProgress(scroller?: OptEl, opts?: { forceElement?: boolean }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const elRef = useRef<HTMLElement | null>(null);
  elRef.current = (scroller ?? null) as HTMLElement | null;

  const compute = useMemo(
    () => () => {
      const el = elRef.current;
      const elTotals = getTotals("el", el);
      const docTotals = getTotals("doc");
      const useEl = !!el && (opts?.forceElement ? true : elTotals.total > 0);
      const { top, total } = useEl ? elTotals : docTotals;
      const denom = total > 0 ? total : 1;
      const next = Math.max(0, Math.min(1, top / denom));
      setP(next);
    },
    []
  );

  useEffect(() => {
    const onScroll = () => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        compute();
      });
    };

    const el = elRef.current;
    const forceEl = !!opts?.forceElement && !!el;

    // Bind based on strategy: if forceElement and element exists, bind only to element; else bind to both
    if (forceEl) {
      el?.addEventListener?.("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      el?.addEventListener?.("scroll", onScroll, { passive: true });
    }

    // Observe DOM mutations to keep totals fresh as content changes
    const mo = new MutationObserver(onScroll);
    const observeTarget = el || document.body;
    try {
      mo.observe(observeTarget, { childList: true, subtree: true });
    } catch {
      // ignore if observation fails
    }

    // Initial compute
    compute();

    return () => {
      if (forceEl) {
        window.removeEventListener("resize", onScroll);
        el?.removeEventListener?.("scroll", onScroll);
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        el?.removeEventListener?.("scroll", onScroll);
      }
      mo.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [compute, scroller, opts?.forceElement]);

  return p; // 0..1
}


