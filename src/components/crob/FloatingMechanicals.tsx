import React from "react";
import { Settings, Cpu, CircuitBoard, Crosshair, Aperture } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingMechanicals() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0 motion-reduce:hidden"
      aria-hidden="true"
    >
      {/* 
        Mechanical SVGs placed around the outer edges.
        Increased size, 25-40% opacity, utilizing the existing palette colors.
      */}

      {/* Top right - Large Gear */}
      <div
        className="absolute top-[12%] right-[5%] text-primary opacity-[0.35] animate-slow-spin-mech"
        style={{ animationDuration: "35s" }}
      >
        <Settings size={120} strokeWidth={0.5} />
      </div>

      {/* Bottom left - Circuit Board */}
      <div
        className="absolute bottom-[20%] left-[3%] text-accent opacity-[0.35] animate-float-rot-2"
        style={{ animationDelay: "1s" }}
      >
        <CircuitBoard size={90} strokeWidth={0.75} />
      </div>

      {/* Top left - HUD / Aperture */}
      <div
        className="absolute top-[25%] left-[6%] text-cyan-400 opacity-[0.30] animate-float-pulse"
        style={{ animationDelay: "3s" }}
      >
        <Aperture size={100} strokeWidth={0.5} />
      </div>

      {/* Bottom right - CPU */}
      <div
        className="absolute bottom-[10%] right-[10%] text-primary opacity-[0.30] animate-float-rot-1"
        style={{ animationDelay: "2s" }}
      >
        <Cpu size={80} strokeWidth={1} />
      </div>

      {/* Mid right - Crosshair */}
      <div
        className="absolute top-[50%] right-[2%] text-accent opacity-[0.25] animate-slow-spin-mech"
        style={{ animationDuration: "25s", animationDirection: "reverse" }}
      >
        <Crosshair size={70} strokeWidth={0.5} />
      </div>
    </div>
  );
}
