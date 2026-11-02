import { useEffect, useRef } from "react";

export function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let x = 0, y = 0, rx = 0, ry = 0, raf = 0;
    const move = (e: MouseEvent) => {
      x = e.clientX; y = e.clientY;
      if (dot.current) dot.current.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
      const t = e.target as HTMLElement;
      ring.current?.classList.toggle("is-hover", !!t.closest("a,button,select,input,textarea,label"));
    };
    const loop = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      if (ring.current) ring.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", move);
    loop();
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);
  return (<><div ref={ring} className="cursor-ring" /><div ref={dot} className="cursor-dot" /></>);
}
