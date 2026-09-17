import { cn } from "@/lib/utils";
import { MatrixRain } from "./MatrixRain";
import { FloatingMechanicals } from "./FloatingMechanicals";

interface CrobBackgroundProps {
  className?: string;
  variant?: "hero" | "page" | "auth";
  showParticles?: boolean;
}

export function CrobBackground({
  className,
  variant = "page",
  showParticles = true,
}: CrobBackgroundProps) {
  const gridClass =
    variant === "hero" ? "grid-lines-hero" : variant === "auth" ? "grid-lines-dense" : "grid-lines";

  return (
    <div
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      {/* Technical grid overlay */}
      <div className={cn("absolute inset-0", gridClass)} />
      {/* Radial glow effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-[10%] h-[60%] w-[40%] rounded-full bg-primary/[0.08] blur-[100px]" />
        <div className="absolute top-[5%] right-[5%] h-[50%] w-[35%] rounded-full bg-accent/[0.06] blur-[100px]" />
        {variant === "hero" && (
          <div className="absolute bottom-0 left-[30%] h-[40%] w-[40%] rounded-full bg-primary/[0.04] blur-[120px]" />
        )}
      </div>
      {/* Floating particles */}
      {showParticles && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className={cn("absolute rounded-full", p.animationClass)}
              style={{
                width: p.size,
                height: p.size,
                left: p.x,
                top: p.y,
                backgroundColor: p.color,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>
      )}
      {/* Shooting Stars */}
      {showParticles && (variant === "hero" || variant === "auth") && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none motion-reduce:hidden">
          <div
            className="absolute top-[10%] left-[20%] h-[1px] w-[150px] opacity-0 animate-shooting-star bg-gradient-to-r from-transparent via-primary/50 to-white"
            style={{ animationDelay: "1.5s", animationDuration: "9s" }}
          />
          <div
            className="absolute top-[40%] left-[70%] h-[1px] w-[200px] opacity-0 animate-shooting-star bg-gradient-to-r from-transparent via-accent/50 to-white"
            style={{ animationDelay: "3s", animationDuration: "11s" }}
          />
          <div
            className="absolute top-[5%] left-[80%] h-[1px] w-[100px] opacity-0 animate-shooting-star bg-gradient-to-r from-transparent via-primary/40 to-white"
            style={{ animationDelay: "6s", animationDuration: "13s" }}
          />
          <div
            className="absolute top-[60%] left-[10%] h-[1px] w-[250px] opacity-0 animate-shooting-star bg-gradient-to-r from-transparent via-accent/40 to-white"
            style={{ animationDelay: "4.5s", animationDuration: "14s" }}
          />
          {/* Additional instances for increased frequency */}
          <div
            className="absolute top-[25%] left-[40%] h-[1px] w-[170px] opacity-0 animate-shooting-star bg-gradient-to-r from-transparent via-primary/45 to-white"
            style={{ animationDelay: "7.5s", animationDuration: "10s" }}
          />
          <div
            className="absolute top-[80%] left-[50%] h-[1px] w-[140px] opacity-0 animate-shooting-star bg-gradient-to-r from-transparent via-accent/45 to-white"
            style={{ animationDelay: "9s", animationDuration: "12s" }}
          />
        </div>
      )}

      {/* Matrix Rain */}
      {showParticles && (variant === "hero" || variant === "auth") && <MatrixRain />}
      {/* Floating Mechanicals */}
      {showParticles && (variant === "hero" || variant === "auth") && <FloatingMechanicals />}
      {/* Faint code-like decorative elements */}
      {variant === "hero" && (
        <>
          <div className="absolute top-[15%] left-[5%] text-[10px] font-mono text-primary/[0.06] leading-relaxed select-none hidden md:block">
            {"{"} init: true {"}"}
            <br />
            status: active
            <br />
            locker.ready()
          </div>
          <div className="absolute bottom-[20%] right-[8%] text-[10px] font-mono text-accent/[0.06] leading-relaxed select-none hidden md:block">
            otp.generate()
            <br />
            session.start()
            <br />
            key.unlock()
          </div>
        </>
      )}
    </div>
  );
}

// Pre-computed particle positions for consistent rendering
const particles = [
  {
    id: 1,
    x: "8%",
    y: "12%",
    size: "3px",
    color: "oklch(0.62 0.19 258)",
    opacity: 0.3,
    delay: "0s",
    duration: "12s",
    animationClass: "animate-particle-drift-1",
  },
  {
    id: 2,
    x: "92%",
    y: "8%",
    size: "4px",
    color: "oklch(0.75 0.14 205)",
    opacity: 0.4,
    delay: "1s",
    duration: "15s",
    animationClass: "animate-particle-drift-2",
  },
  {
    id: 3,
    x: "45%",
    y: "75%",
    size: "2px",
    color: "oklch(0.62 0.19 258)",
    opacity: 0.25,
    delay: "2s",
    duration: "10s",
    animationClass: "animate-particle-drift-3",
  },
  {
    id: 4,
    x: "15%",
    y: "60%",
    size: "3px",
    color: "oklch(0.55 0.2 290)",
    opacity: 0.2,
    delay: "0.5s",
    duration: "14s",
    animationClass: "animate-particle-drift-2",
  },
  {
    id: 5,
    x: "78%",
    y: "45%",
    size: "2px",
    color: "oklch(0.75 0.14 205)",
    opacity: 0.35,
    delay: "3s",
    duration: "11s",
    animationClass: "animate-particle-drift-1",
  },
  {
    id: 6,
    x: "35%",
    y: "20%",
    size: "2px",
    color: "oklch(0.62 0.19 258)",
    opacity: 0.2,
    delay: "1.5s",
    duration: "13s",
    animationClass: "animate-particle-drift-3",
  },
  {
    id: 7,
    x: "62%",
    y: "85%",
    size: "3px",
    color: "oklch(0.55 0.2 290)",
    opacity: 0.3,
    delay: "4s",
    duration: "16s",
    animationClass: "animate-particle-drift-2",
  },
  {
    id: 8,
    x: "88%",
    y: "55%",
    size: "2px",
    color: "oklch(0.62 0.19 258)",
    opacity: 0.15,
    delay: "2.5s",
    duration: "9s",
    animationClass: "animate-particle-drift-1",
  },
  {
    id: 9,
    x: "22%",
    y: "40%",
    size: "4px",
    color: "oklch(0.75 0.14 205)",
    opacity: 0.25,
    delay: "0.8s",
    duration: "12s",
    animationClass: "animate-particle-drift-3",
  },
  {
    id: 10,
    x: "55%",
    y: "15%",
    size: "2px",
    color: "oklch(0.55 0.2 290)",
    opacity: 0.2,
    delay: "3.5s",
    duration: "14s",
    animationClass: "animate-particle-drift-1",
  },
  {
    id: 11,
    x: "70%",
    y: "70%",
    size: "3px",
    color: "oklch(0.62 0.19 258)",
    opacity: 0.3,
    delay: "1.2s",
    duration: "15s",
    animationClass: "animate-particle-drift-2",
  },
  {
    id: 12,
    x: "5%",
    y: "90%",
    size: "2px",
    color: "oklch(0.75 0.14 205)",
    opacity: 0.2,
    delay: "2.8s",
    duration: "11s",
    animationClass: "animate-particle-drift-3",
  },
];
