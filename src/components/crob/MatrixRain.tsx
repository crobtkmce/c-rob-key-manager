import React, { useEffect, useRef } from "react";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Detect reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use a fixed logical size to keep it lightweight, scale for DPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalWidth = window.innerWidth;
    const logicalHeight = window.innerHeight;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    ctx.scale(dpr, dpr);

    // Matrix characters: Binary and Technical / Brand letters
    const chars = "0101010101CROBLOCKKEYACCESS<>{}[]/\\|#*+".split("");
    const fontSize = 16;
    const columns = Math.floor(logicalWidth / fontSize);

    // Render multiple strips. We'll map column indices to their specific opacity/alpha.
    const drops: number[] = new Array(columns).fill(0);
    const activeColumns = new Map<number, number>();

    // Outer edges (Higher opacity)
    activeColumns.set(Math.max(1, Math.floor(columns * 0.03)), 1.0);
    activeColumns.set(Math.max(3, Math.floor(columns * 0.08)), 1.0);
    activeColumns.set(Math.min(columns - 4, Math.floor(columns * 0.92)), 1.0);
    activeColumns.set(Math.min(columns - 2, Math.floor(columns * 0.97)), 1.0);

    // Inner columns (Lower opacity, 8-15% visually vs the 25-35% of the canvas)
    // 0.4 * 0.35 = 0.14
    activeColumns.set(Math.floor(columns * 0.15), 0.4);
    activeColumns.set(Math.floor(columns * 0.22), 0.3);
    activeColumns.set(Math.floor(columns * 0.78), 0.3);
    activeColumns.set(Math.floor(columns * 0.85), 0.4);

    // Fill drops with random starting positions for active columns
    activeColumns.forEach((_, col) => {
      drops[col] = Math.random() * -50; // Start offscreen
    });

    let animationFrameId: number;
    let lastTime = 0;
    const fps = 18; // Throttled to ~18 FPS for the matrix feel and performance
    const interval = 1000 / fps;
    let isVisible = true;
    let isTabActive = document.visibilityState === "visible";

    const render = (currentTime: number) => {
      if (!isVisible || !isTabActive) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const deltaTime = currentTime - lastTime;

      if (deltaTime > interval) {
        lastTime = currentTime - (deltaTime % interval);

        // Semi-transparent black to create fade effect.
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = "center";

        for (let i = 0; i < drops.length; i++) {
          const opacity = activeColumns.get(i);
          if (opacity === undefined) continue;

          const drop = drops[i];
          if (drop === undefined) continue;

          // Only draw if on screen
          if (drop * fontSize > 0) {
            // Apply column-specific opacity
            ctx.fillStyle = `rgba(0, 220, 255, ${opacity})`;
            const char = chars[Math.floor(Math.random() * chars.length)] || "0";
            ctx.fillText(char, i * fontSize, drop * fontSize);
          }

          // Reset drop randomly when it reaches bottom
          if (drop * fontSize > logicalHeight && Math.random() > 0.95) {
            drops[i] = 0;
          } else {
            drops[i] = drop + 1;
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Resize handler
    const handleResize = () => {
      const newDpr = Math.min(window.devicePixelRatio || 1, 2);
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      canvas.width = newWidth * newDpr;
      canvas.height = newHeight * newDpr;
      ctx.scale(newDpr, newDpr);
      // Re-apply background
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
      ctx.fillRect(0, 0, newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // Visibility handling
    const handleVisibilityChange = () => {
      isTabActive = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Intersection observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
      });
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 motion-reduce:hidden opacity-35 mix-blend-screen"
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
