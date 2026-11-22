import React from 'react';
import { MapPin, Navigation, Trash2, X } from 'lucide-react';
import { HUDSnapshot } from '../types/game';
import { DISTRICTS, ENTERABLE_BUILDINGS, MISSIONS, ROAD_COORDS } from '../world/WorldData';

interface WorldMapModalProps {
  hud: HUDSnapshot;
  onSetWaypoint: (pos: [number, number] | null) => void;
  onStartMission: (missionId: string) => void;
  onClose: () => void;
}

const MAP_MIN = -620;
const MAP_MAX = 620;
const MAP_SPAN = MAP_MAX - MAP_MIN;

function toSvgPct(val: number): number {
  return ((val - MAP_MIN) / MAP_SPAN) * 100;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  hud,
  onSetWaypoint,
  onStartMission,
  onClose,
}) => {
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fz = (e.clientY - rect.top) / rect.height;
    const wx = Math.round(MAP_MIN + fx * MAP_SPAN);
    const wz = Math.round(MAP_MIN + fz * MAP_SPAN);
    onSetWaypoint([wx, wz]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-3 sm:p-6 pointer-events-auto">
      <div className="w-full max-w-6xl h-[88vh] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col lg:flex-row overflow-hidden">
        {/* Interactive Vector World Map */}
        <div className="relative flex-1 bg-[#0b1628] overflow-hidden">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            onClick={handleMapClick}
            className="w-full h-full cursor-crosshair"
          >
            {/* Mountains North */}
            <rect x={0} y={0} width={100} height={toSvgPct(-385)} fill="#1a2e19" />
            {/* Beach & Ocean South */}
            <rect x={0} y={toSvgPct(390)} width={100} height={5} fill="#c2a878" />
            <rect x={0} y={toSvgPct(445)} width={100} height={100 - toSvgPct(445)} fill="#075985" />
            {/* Emerald River */}
            <rect
              x={toSvgPct(296)}
              y={toSvgPct(-385)}
              width={toSvgPct(324) - toSvgPct(296)}
              height={toSvgPct(445) - toSvgPct(-385)}
              fill="#0284c7"
            />
            {/* Airfield Apron */}
            <rect
              x={toSvgPct(415)}
              y={toSvgPct(-230)}
              width={toSvgPct(555) - toSvgPct(415)}
              height={toSvgPct(190) - toSvgPct(-230)}
              fill="#1e293b"
              stroke="#475569"
              strokeWidth={0.25}
            />

            {/* Road Network */}
            {ROAD_COORDS.map((rc) => (
              <React.Fragment key={rc}>
                <line
                  x1={toSvgPct(rc)}
                  y1={toSvgPct(-360)}
                  x2={toSvgPct(rc)}
                  y2={toSvgPct(360)}
                  stroke="#475569"
                  strokeWidth={0.9}
                />
                <line
                  x1={toSvgPct(-360)}
                  y1={toSvgPct(rc)}
                  x2={toSvgPct(360)}
                  y2={toSvgPct(rc)}
                  stroke="#475569"
                  strokeWidth={0.9}
                />
              </React.Fragment>
            ))}

            {/* District Labels */}
            {DISTRICTS.map((d) => (
              <text
                key={d.id}
                x={toSvgPct((d.minX + d.maxX) / 2)}
                y={toSvgPct((d.minZ + d.maxZ) / 2)}
                fill="rgba(148, 163, 184, 0.52)"
                fontSize={2.1}
                fontWeight="bold"
                textAnchor="middle"
              >
                {d.name.toUpperCase()}
              </text>
            ))}

            {/* GPS Route Line */}
            {hud.gpsTarget && (
              <>
                <polyline
                  points={`${toSvgPct(hud.playerPos[0])},${toSvgPct(hud.playerPos[2])} ${toSvgPct(
                    hud.gpsTarget[0]
                  )},${toSvgPct(hud.playerPos[2])} ${toSvgPct(hud.gpsTarget[0])},${toSvgPct(
                    hud.gpsTarget[1]
                  )}`}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth={0.7}
                  strokeDasharray="1.2,0.8"
                />
                <circle
                  cx={toSvgPct(hud.gpsTarget[0])}
                  cy={toSvgPct(hud.gpsTarget[1])}
                  r={1.3}
                  fill="#c084fc"
                  stroke="#ffffff"
                  strokeWidth={0.3}
                />
              </>
            )}

            {/* Enterable Buildings & Shops */}
            {ENTERABLE_BUILDINGS.map((b) => (
              <g key={b.id}>
                <rect
                  x={toSvgPct(b.position[0]) - 0.9}
                  y={toSvgPct(b.position[2]) - 0.9}
                  width={1.8}
                  height={1.8}
                  fill={b.propertyId ? '#34d399' : '#38bdf8'}
                  stroke="#0f172a"
                  strokeWidth={0.25}
                />
              </g>
            ))}

            {/* Gas Stations */}
            {[
              [152, 48],
              [-278, -155],
            ].map(([gx, gz], idx) => (
              <circle
                key={idx}
                cx={toSvgPct(gx)}
                cy={toSvgPct(gz)}
                r={0.85}
                fill="#fb923c"
                stroke="#0f172a"
                strokeWidth={0.2}
              />
            ))}

            {/* Missions */}
            {MISSIONS.map((m) => (
              <circle
                key={m.id}
                cx={toSvgPct(m.startPos[0])}
                cy={toSvgPct(m.startPos[2])}
                r={1.15}
                fill="#facc15"
                stroke="#09090b"
                strokeWidth={0.3}
              />
            ))}

            {/* Player Live Position */}
            <circle
              cx={toSvgPct(hud.playerPos[0])}
              cy={toSvgPct(hud.playerPos[2])}
              r={1.45}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={0.5}
            />
          </svg>

          <div className="absolute top-3 left-3 rounded-xl bg-slate-950/85 border border-slate-700 px-3.5 py-2 text-xs text-slate-200 pointer-events-none">
            <div className="font-display text-base font-bold text-sky-400">
              PORT PACIFICA SATELLITE GPS
            </div>
            <div className="text-[11px] text-slate-400">
              Click anywhere on map to set custom GPS navigation route
            </div>
          </div>
        </div>

        {/* Right Sidebar: Quick Destinations, Buildings & Missions */}
        <div className="w-full lg:w-88 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col justify-between overflow-y-auto hud-scroll">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-sky-400" />
                <span className="font-display text-lg font-bold text-white">GPS DIRECTORY</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {hud.gpsTarget && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-purple-500/15 border border-purple-400/40 px-3 py-2 text-xs">
                <span className="text-purple-200 font-medium">
                  Waypoint Active ({hud.gpsDistance}m)
                </span>
                <button
                  onClick={() => onSetWaypoint(null)}
                  className="flex items-center gap-1 text-rose-300 hover:text-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            )}

            <div className="mt-4">
              <div className="text-[11px] font-mono-hud uppercase tracking-wider text-amber-300 mb-2">
                Story & Side Missions
              </div>
              <div className="space-y-1.5">
                {MISSIONS.map((m) => {
                  const done = hud.completedMissionIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-white truncate">
                          {m.title} {done && <span className="text-emerald-400">✓</span>}
                        </div>
                        <div className="text-[10px] text-slate-400">${m.cashReward.toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            onSetWaypoint([m.startPos[0], m.startPos[2]]);
                            onClose();
                          }}
                          className="px-2 py-1 rounded bg-slate-800 text-sky-300 hover:bg-slate-700 text-[11px] cursor-pointer"
                        >
                          GPS
                        </button>
                        <button
                          onClick={() => {
                            onStartMission(m.id);
                            onClose();
                          }}
                          className="px-2 py-1 rounded bg-amber-400 text-slate-950 font-bold text-[11px] hover:bg-amber-300 cursor-pointer"
                        >
                          Start
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-mono-hud uppercase tracking-wider text-sky-300 mb-2">
                Enterable Landmarks & Services
              </div>
              <div className="space-y-1.5">
                {ENTERABLE_BUILDINGS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onSetWaypoint([b.position[0], b.position[2]]);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-800 hover:border-sky-400/60 px-3 py-2 text-left text-xs cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">{b.name}</div>
                      <div className="text-[10px] text-slate-400">{b.district}</div>
                    </div>
                    <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
