import React, { useEffect, useRef } from 'react';
import {
  Camera,
  CloudLightning,
  CloudRain,
  Compass,
  Fuel,
  Map as MapIcon,
  Pause,
  Radio,
  Shield,
  Smartphone,
  Star,
  Sun,
  User,
} from 'lucide-react';
import { CharacterId, HUDSnapshot } from '../types/game';
import { PLAYABLE_CHARACTERS, ROAD_COORDS } from '../world/WorldData';

interface HUDProps {
  hud: HUDSnapshot;
  minimapRotate: boolean;
  onOpenMap: () => void;
  onTogglePhone: () => void;
  onOpenWardrobe: () => void;
  onCycleCamera: () => void;
  onPause: () => void;
  onTriggerInteract: () => void;
  onSwitchCharacter: (c: CharacterId) => void;
  onNextRadio: () => void;
}

function formatGameClock(hoursFloat: number): string {
  const totalMins = Math.floor(hoursFloat * 60) % (24 * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  minimapRotate,
  onOpenMap,
  onTogglePhone,
  onOpenWardrobe,
  onCycleCamera,
  onPause,
  onTriggerInteract,
  onSwitchCharacter,
  onNextRadio,
}) => {
  const radarRef = useRef<HTMLCanvasElement | null>(null);

  // Render crisp 60fps Radar Minimap + GPS Line
  useEffect(() => {
    const canvas = radarRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.26; // world meters -> radar pixels

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#09111f';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    if (minimapRotate) {
      ctx.rotate(hud.playerHeading - Math.PI);
    }

    const [px, , pz] = hud.playerPos;

    // Ocean South & River East
    ctx.fillStyle = '#075985';
    ctx.fillRect((-900 - px) * scale, (445 - pz) * scale, 1800 * scale, 500 * scale);
    ctx.fillRect((296 - px) * scale, (-500 - pz) * scale, 28 * scale, 950 * scale);

    // Roads
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    for (const rc of ROAD_COORDS) {
      ctx.beginPath();
      ctx.moveTo((rc - px) * scale, (-380 - pz) * scale);
      ctx.lineTo((rc - px) * scale, (380 - pz) * scale);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo((-380 - px) * scale, (rc - pz) * scale);
      ctx.lineTo((380 - px) * scale, (rc - pz) * scale);
      ctx.stroke();
    }

    // GPS Navigation Route Line (Manhattan L-path along nearest road + direct finish)
    const navDest = hud.activeMission
      ? [hud.activeMission.targetPos[0], hud.activeMission.targetPos[2]]
      : hud.gpsTarget;
    if (navDest) {
      ctx.strokeStyle = hud.activeMission ? '#facc15' : '#a855f7';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo((navDest[0] - px) * scale, 0);
      ctx.lineTo((navDest[0] - px) * scale, (navDest[1] - pz) * scale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target Bullseye
      ctx.fillStyle = hud.activeMission ? '#facc15' : '#c084fc';
      ctx.beginPath();
      ctx.arc((navDest[0] - px) * scale, (navDest[1] - pz) * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Entities (Police, Missions, Shops, Vehicles)
    for (const ent of hud.minimapEntities) {
      const ex = (ent.x - px) * scale;
      const ez = (ent.z - pz) * scale;
      if (Math.abs(ex) > cx + 10 || Math.abs(ez) > cy + 10) continue;

      if (ent.type === 'police') {
        ctx.fillStyle = Math.floor(Date.now() / 220) % 2 === 0 ? '#ef4444' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(ex, ez, 4.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.type === 'mission') {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(ex - 3.5, ez - 3.5, 7, 7);
      } else if (ent.type === 'property') {
        ctx.fillStyle = '#34d399';
        ctx.fillRect(ex - 2.5, ez - 2.5, 5, 5);
      } else if (ent.type === 'shop') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(ex - 2, ez - 2, 4, 4);
      } else if (ent.type === 'event') {
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(ex, ez, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Player Center Arrow
    ctx.save();
    ctx.translate(cx, cy);
    if (!minimapRotate) {
      ctx.rotate(-hud.playerHeading + Math.PI);
    }
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3.2);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [hud, minimapRotate]);

  if (hud.gamePhase === 'cutscene') {
    return (
      <div className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-auto">
        <div className="h-16 sm:h-20 bg-black/95 border-b border-slate-800 flex items-center justify-between px-6">
          <span className="font-mono-hud text-xs uppercase tracking-widest text-amber-400">
            CINEMATIC SEQUENCE • {hud.activeMission?.title}
          </span>
          <button
            onClick={onTriggerInteract}
            className="px-3 py-1 rounded bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            Skip [SPACE / E]
          </button>
        </div>

        <div className="h-24 sm:h-28 bg-black/95 border-t border-slate-800 flex flex-col items-center justify-center px-6 text-center">
          {hud.dialogue && (
            <>
              <div className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">
                {hud.dialogue.speaker}
              </div>
              <div className="text-base sm:text-lg text-white max-w-3xl font-medium">
                “{hud.dialogue.text}”
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Quick Utility Buttons + Active Mission Tracker */}
        <div className="space-y-2.5 max-w-sm pointer-events-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={onPause}
              title="Pause Menu [ESC]"
              className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400 backdrop-blur-md cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 text-sky-400" /> Menu
            </button>
            <button
              onClick={onOpenMap}
              title="World Map & GPS [M]"
              className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400 backdrop-blur-md cursor-pointer"
            >
              <MapIcon className="w-3.5 h-3.5 text-amber-400" /> Map
            </button>
            <button
              onClick={onTogglePhone}
              title="HorizonOS Smartphone [P]"
              className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400 backdrop-blur-md cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Phone
            </button>
            <button
              onClick={onOpenWardrobe}
              title="Character Customization"
              className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400 backdrop-blur-md cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-pink-400" /> Style
            </button>
            <button
              onClick={onCycleCamera}
              title="Switch Camera View [V]"
              className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400 backdrop-blur-md cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />{' '}
              {hud.cameraMode === 'first-person' ? '1st' : hud.cameraMode === 'third-close' ? 'Close' : '3rd'}
            </button>
          </div>

          {/* Fast Protagonist Switcher Pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {(['dante', 'elena', 'marcus'] as CharacterId[]).map((cid, idx) => {
              const active = hud.activeCharacter === cid;
              return (
                <button
                  key={cid}
                  onClick={() => onSwitchCharacter(cid)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                    active
                      ? 'bg-sky-500/25 border-sky-400 text-white'
                      : 'bg-slate-950/65 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  [{idx + 1}] {PLAYABLE_CHARACTERS[cid].name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Active Mission Card */}
          {hud.activeMission ? (
            <div className="rounded-xl bg-slate-950/85 border-l-4 border-l-amber-400 border border-slate-800 p-3 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between text-[11px] font-mono-hud uppercase text-amber-300">
                <span>{hud.activeMission.title}</span>
                <span>
                  STEP {hud.activeMission.stepIndex}/{hud.activeMission.totalSteps}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-medium text-white mt-1">
                {hud.activeMission.instruction}
              </div>
              <div className="mt-1.5 text-[11px] font-mono-hud text-sky-300">
                GPS Distance: {hud.activeMission.distance}m
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 px-3 py-2 backdrop-blur-md text-xs text-slate-300">
              <span className="text-amber-300 font-semibold">Free Roam:</span> Enter the glowing{' '}
              <span className="text-amber-300">Gold Beacon</span> ahead or open{' '}
              <span className="text-emerald-300">Phone [P]</span> for Missions!
            </div>
          )}
        </div>

        {/* Top-Right: Wanted Stars, Cash/Bank, Score & Time/Weather */}
        <div className="flex flex-col items-end gap-1.5">
          {/* Wanted Level Stars */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-1.5 backdrop-blur-md">
            {[1, 2, 3, 4, 5].map((starIdx) => {
              const lit = starIdx <= hud.wantedLevel;
              return (
                <Star
                  key={starIdx}
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${
                    lit
                      ? hud.policeSearching
                        ? 'text-sky-400 fill-sky-400 animate-pulse'
                        : 'text-amber-400 fill-amber-400 wanted-flash'
                      : 'text-slate-700'
                  }`}
                />
              );
            })}
            {hud.wantedLevel > 0 && (
              <span className="ml-1.5 text-[11px] font-mono-hud font-bold text-rose-400">
                {hud.policeSearching ? `EVADING ${hud.wantedCooldownPct}%` : 'PURSUIT'}
              </span>
            )}
          </div>

          {/* Cash + Bank */}
          <div className="rounded-xl bg-slate-950/85 border border-slate-800 px-3.5 py-2 backdrop-blur-md text-right">
            <div className="font-mono-hud text-lg sm:text-xl font-bold text-emerald-400 leading-tight">
              ${hud.cash.toLocaleString()}
            </div>
            <div className="font-mono-hud text-[11px] text-slate-400">
              BANK ${hud.bank.toLocaleString()}
            </div>
          </div>

          {/* Score + Combo Multiplier */}
          <div className="flex items-center gap-2 rounded-xl bg-slate-950/85 border border-slate-800 px-3.5 py-1.5 backdrop-blur-md">
            {hud.comboMultiplier > 1 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono-hud text-xs font-extrabold">
                {hud.comboMultiplier.toFixed(2)}x
              </span>
            )}
            <span className="font-mono-hud text-sm font-bold text-sky-300">
              {hud.score.toLocaleString()} PTS
            </span>
          </div>

          {/* World Clock, Weather, Shards & FPS */}
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-950/75 border border-slate-800/80 px-2.5 py-1 text-[11px] font-mono-hud text-slate-300 backdrop-blur-md">
            <span className="flex items-center gap-1">
              {hud.weather === 'thunderstorm' ? (
                <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
              ) : hud.weather === 'rain' ? (
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-300" />
              )}
              {formatGameClock(hud.timeOfDay)}
            </span>
            <span>•</span>
            <span className="text-amber-300">
              Shards {hud.collectiblesFound}/{hud.totalCollectibles}
            </span>
            <span className="hidden sm:inline text-emerald-400">• {hud.fps} FPS</span>
          </div>

          {/* Animated Score Popups */}
          <div className="mt-1 flex flex-col items-end gap-1 pointer-events-none">
            {hud.scorePopups.slice(-3).map((p) => (
              <div
                key={p.id}
                className="score-toast rounded-lg bg-slate-950/90 border border-slate-700 px-2.5 py-1 text-xs font-bold shadow-lg"
                style={{ color: p.color }}
              >
                +{p.points} {p.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER DIALOGUE & INTERACTION PROMPT */}
      <div className="my-auto flex flex-col items-center justify-end pointer-events-none gap-3 pb-4">
        {hud.dialogue && (
          <div className="max-w-xl rounded-xl bg-slate-950/90 border border-slate-700/90 px-4 py-2.5 text-center backdrop-blur-md shadow-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 mr-2">
              {hud.dialogue.speaker}:
            </span>
            <span className="text-xs sm:text-sm text-slate-100">{hud.dialogue.text}</span>
          </div>
        )}

        {(hud.prompt || hud.isSitting) && (
          <button
            onClick={onTriggerInteract}
            className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-950/90 border-2 border-sky-400/80 px-4 py-2.5 shadow-xl shadow-sky-500/20 hover:bg-slate-900 active:scale-95 transition-all cursor-pointer"
          >
            <span className="h-7 w-7 rounded-lg bg-sky-400 text-slate-950 font-mono-hud font-extrabold flex items-center justify-center text-sm">
              E
            </span>
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white">
                {hud.isSitting ? 'Stand Up' : hud.prompt?.title}
              </div>
              <div className="text-[11px] text-sky-300">
                {hud.isSitting ? 'Press [E] or Tap to Stand' : hud.prompt?.subtitle}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* BOTTOM BAR: Radar + Vitals (Left) & Vehicle Telemetry (Right) */}
      <div className="flex items-end justify-between gap-3">
        {/* Bottom-Left Radar Minimap + Health / Armor / Stamina */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div
            onClick={onOpenMap}
            title="Click to open Full World Map"
            className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-2 border-slate-700/90 shadow-2xl cursor-pointer group"
          >
            <canvas ref={radarRef} width={176} height={176} className="w-full h-full block" />
            <div className="absolute top-1.5 left-2 flex items-center gap-1 text-[10px] font-mono-hud text-slate-300 bg-slate-950/70 px-1.5 py-0.5 rounded">
              <Compass className="w-3 h-3 text-sky-400" />
              {hud.gpsTarget ? `${hud.gpsDistance}m` : 'GPS'}
            </div>
          </div>

          {/* Health, Armor, Stamina Bars */}
          <div className="w-36 sm:w-44 grid grid-cols-3 gap-1 bg-slate-950/85 p-1.5 rounded-xl border border-slate-800">
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden" title={`Health ${hud.health}%`}>
              <div
                className={`h-full transition-all ${hud.health < 30 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`}
                style={{ width: `${hud.health}%` }}
              />
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden" title={`Armor ${hud.armor}%`}>
              <div className="h-full bg-sky-400 transition-all" style={{ width: `${hud.armor}%` }} />
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden" title={`Stamina ${hud.stamina}%`}>
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${hud.stamina}%` }} />
            </div>
          </div>

          {/* District / Indoor Floor Indicator */}
          <div className="rounded-lg bg-slate-950/80 border border-slate-800/90 px-2.5 py-1 backdrop-blur-md max-w-[230px]">
            <div className="text-xs font-bold text-white truncate">
              {hud.insideBuildingName || hud.districtName}
            </div>
            <div className="text-[10px] text-sky-300 truncate">
              {hud.currentFloorLabel || hud.streetStatus}
            </div>
          </div>
        </div>

        {/* Bottom-Right Vehicle Digital Telemetry Cluster */}
        {hud.inVehicle.active && (
          <div className="pointer-events-auto rounded-2xl bg-slate-950/88 border border-slate-700/90 p-3.5 backdrop-blur-md shadow-2xl min-w-[195px] sm:min-w-[235px]">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="font-semibold text-sky-300 truncate max-w-[140px]">
                {hud.inVehicle.name}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono-hud text-amber-300 font-bold">
                GEAR {hud.inVehicle.gear}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-mono-hud text-3xl sm:text-4xl font-extrabold text-white">
                  {hud.inVehicle.speedMph}
                </span>
                <span className="ml-1 text-xs font-mono-hud text-slate-400">MPH</span>
              </div>

              <div className="flex flex-col items-end gap-1 text-[11px]">
                <span className="flex items-center gap-1 text-amber-300">
                  <Fuel className="w-3.5 h-3.5" /> {hud.inVehicle.fuel}%
                </span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <Shield className="w-3.5 h-3.5" /> {hud.inVehicle.health}%
                </span>
              </div>
            </div>

            {/* RPM Bar */}
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500 transition-all duration-75"
                style={{ width: `${Math.round(hud.inVehicle.rpm * 100)}%` }}
              />
            </div>

            {/* Radio Switcher */}
            <button
              onClick={onNextRadio}
              className="mt-2.5 w-full flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-400 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                {hud.inVehicle.radioStation}
              </span>
              <span className="text-[10px] text-slate-500">[R]</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
