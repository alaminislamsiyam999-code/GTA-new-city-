import React, { useRef, useState } from 'react';
import { HUDSnapshot } from '../types/game';
import { OpenWorldEngine } from '../engine/OpenWorldEngine';

interface TouchControlsProps {
  engine: OpenWorldEngine;
  hud: HUDSnapshot;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ engine, hud }) => {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const stickCenterRef = useRef<{ x: number; y: number; touchId: number } | null>(null);
  const lookTouchRef = useRef<{ x: number; y: number; touchId: number } | null>(null);

  const maxRadius = 46;

  const handleStickStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      touchId: t.identifier,
    };
  };

  const handleStickMove = (e: React.TouchEvent) => {
    const sc = stickCenterRef.current;
    if (!sc) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === sc.touchId) {
        const dx = t.clientX - sc.x;
        const dy = t.clientY - sc.y;
        const dist = Math.min(maxRadius, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        const kx = Math.cos(angle) * dist;
        const ky = Math.sin(angle) * dist;
        setKnob({ x: kx, y: ky });
        engine.touchMove = {
          x: kx / maxRadius,
          y: -ky / maxRadius,
        };
      }
    }
  };

  const handleStickEnd = () => {
    stickCenterRef.current = null;
    setKnob({ x: 0, y: 0 });
    engine.touchMove = { x: 0, y: 0 };
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    lookTouchRef.current = { x: t.clientX, y: t.clientY, touchId: t.identifier };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    const lt = lookTouchRef.current;
    if (!lt) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lt.touchId) {
        const dx = t.clientX - lt.x;
        const dy = t.clientY - lt.y;
        lt.x = t.clientX;
        lt.y = t.clientY;
        engine.rotateCameraByDelta(dx * 1.8, dy * 1.8);
      }
    }
  };

  const handleLookEnd = () => {
    lookTouchRef.current = null;
  };

  const isHeli = hud.inVehicle.active && hud.inVehicle.category === 'helicopter';

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      {/* Right-Side Touch Camera Drag Area */}
      <div
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        className="absolute right-0 top-16 bottom-44 w-1/2 pointer-events-auto"
      />

      {/* Left Virtual Analog Thumbstick */}
      <div
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
        onTouchCancel={handleStickEnd}
        className="absolute left-5 bottom-32 w-28 h-28 rounded-full bg-slate-950/55 border-2 border-slate-500/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
      >
        <div
          className="w-12 h-12 rounded-full bg-sky-400/85 shadow-lg shadow-sky-500/40"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      {/* Right Context-Aware Action Cluster */}
      <div className="absolute right-4 bottom-32 flex flex-col items-end gap-2 pointer-events-auto">
        {hud.inVehicle.active ? (
          <>
            <div className="flex gap-2">
              {isHeli && (
                <>
                  <button
                    onTouchStart={() => (engine.touchAscend = true)}
                    onTouchEnd={() => (engine.touchAscend = false)}
                    className="px-3.5 py-2.5 rounded-xl bg-sky-500/80 text-slate-950 font-bold text-xs"
                  >
                    UP
                  </button>
                  <button
                    onTouchStart={() => (engine.touchDescend = true)}
                    onTouchEnd={() => (engine.touchDescend = false)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 text-white font-bold text-xs border border-slate-600"
                  >
                    DOWN
                  </button>
                </>
              )}
              <button
                onClick={() => engine.triggerPrimaryInteraction()}
                className="px-3.5 py-2.5 rounded-xl bg-rose-500/85 text-white font-bold text-xs"
              >
                EXIT
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onTouchStart={() => (engine.touchSprint = true)}
                onTouchEnd={() => (engine.touchSprint = false)}
                className="px-4 py-3 rounded-xl bg-cyan-400/85 text-slate-950 font-extrabold text-xs"
              >
                NITRO
              </button>
              <button
                onTouchStart={() => (engine.touchHandbrake = true)}
                onTouchEnd={() => (engine.touchHandbrake = false)}
                className="px-4 py-3 rounded-xl bg-amber-400/85 text-slate-950 font-extrabold text-xs"
              >
                DRIFT
              </button>
              <button
                onTouchStart={() => (engine.touchBrake = true)}
                onTouchEnd={() => (engine.touchBrake = false)}
                className="px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-600 text-white font-bold text-xs"
              >
                BRAKE
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => engine.triggerPrimaryInteraction()}
                className="px-4 py-2.5 rounded-xl bg-sky-400/90 text-slate-950 font-extrabold text-xs shadow-lg"
              >
                INTERACT [E]
              </button>
              <button
                onClick={() => engine.triggerMeleeOrHorn()}
                className="px-3.5 py-2.5 rounded-xl bg-rose-500/85 text-white font-bold text-xs"
              >
                STRIKE
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onTouchStart={() => (engine.touchSprint = true)}
                onTouchEnd={() => (engine.touchSprint = false)}
                className="px-4 py-3 rounded-xl bg-amber-400/85 text-slate-950 font-extrabold text-xs"
              >
                SPRINT
              </button>
              <button
                onClick={() => engine.triggerJumpOrHandbrake()}
                className="px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-600 text-white font-bold text-xs"
              >
                JUMP
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
