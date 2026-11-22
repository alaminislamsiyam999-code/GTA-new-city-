import React, { useState } from 'react';
import {
  Award,
  Car,
  Compass,
  FolderOpen,
  Play,
  Sliders,
  Sparkles,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import {
  CharacterId,
  GameSettings,
  GraphicsPreset,
  HighScoreEntry,
  SaveSlotData,
} from '../types/game';
import { PLAYABLE_CHARACTERS } from '../world/WorldData';
import { SaveManager } from '../systems/SaveManager';

interface StartScreenProps {
  selectedCharacter: CharacterId;
  onSelectCharacter: (c: CharacterId) => void;
  onStartNewGame: (c: CharacterId) => void;
  onLoadSaveSlot: (slotId: string) => void;
  settings: GameSettings;
  onUpdateSettings: (s: GameSettings) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  selectedCharacter,
  onSelectCharacter,
  onStartNewGame,
  onLoadSaveSlot,
  settings,
  onUpdateSettings,
}) => {
  const [subModal, setSubModal] = useState<'none' | 'saves' | 'scores' | 'settings'>('none');
  const [slots, setSlots] = useState<(SaveSlotData | null)[]>(() => SaveManager.listSlots());
  const [highScores] = useState<HighScoreEntry[]>(() => SaveManager.loadHighScores());

  const refreshSlots = () => {
    setSlots(SaveManager.listSlots());
    setSubModal('saves');
  };

  const hasSave = slots.some((s) => s !== null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-transparent p-5 sm:p-10 pointer-events-auto hud-scroll overflow-y-auto">
      {/* Top Studio Badge & Live World Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Compass className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="text-xs font-mono-hud uppercase tracking-widest text-sky-400">
              HORIZON INTERACTIVE STUDIOS
            </div>
            <div className="text-xs text-slate-300">Port Pacifica & Sierra Vista County • Live 3D Engine</div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-700/70 px-3.5 py-1.5 text-xs text-slate-300 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>8 Districts • Multi-Floor Interiors • 12 Vehicle Classes</span>
        </div>
      </div>

      {/* Main Left Hero Column */}
      <div className="my-auto max-w-2xl py-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-300 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          COMPLETE OPEN-WORLD ACTION SIMULATION
        </div>

        <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] leading-none">
          PACIFICA <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300">HORIZON</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-200/90 max-w-xl leading-relaxed">
          Explore Downtown skyscrapers with working glass elevators, drive supercars, bikes, helicopters & jetboats, customize your protagonist, buy luxury safehouses, complete story heists, or evade a 5-Star PPD pursuit.
        </p>

        {/* Protagonist Selection Strip */}
        <div className="mt-6">
          <div className="text-xs font-mono-hud uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            Select Protagonist (Switchable Anytime In-Game [1-6])
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(Object.keys(PLAYABLE_CHARACTERS) as CharacterId[]).map((cid) => {
              const prof = PLAYABLE_CHARACTERS[cid];
              const active = selectedCharacter === cid;
              return (
                <button
                  key={cid}
                  onClick={() => onSelectCharacter(cid)}
                  className={`text-left rounded-xl p-3 border transition-all backdrop-blur-md ${
                    active
                      ? 'bg-sky-500/20 border-sky-400 shadow-lg shadow-sky-500/20'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-bold text-white">{prof.name}</span>
                    <span
                      className="h-3 w-3 rounded-full border border-white/40"
                      style={{ backgroundColor: prof.customization.jacketColor }}
                    />
                  </div>
                  <div className="text-[11px] text-sky-300 font-medium">{prof.role}</div>
                  <div className="mt-1.5 text-[11px] text-amber-300/90">{prof.specialty}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onStartNewGame(selectedCharacter)}
            className="group flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 px-7 py-3.5 font-display text-xl font-bold text-slate-950 shadow-xl shadow-sky-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            ENTER PORT PACIFICA
          </button>

          <button
            onClick={refreshSlots}
            className={`flex items-center gap-2 rounded-xl px-5 py-3.5 font-display text-lg font-bold border backdrop-blur-md transition-all cursor-pointer ${
              hasSave
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/30'
                : 'bg-slate-900/75 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <FolderOpen className="w-5 h-5" />
            CONTINUE / SAVES
          </button>

          <button
            onClick={() => setSubModal('scores')}
            className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3.5 font-display text-lg font-bold text-amber-300 hover:border-amber-400/60 transition-all cursor-pointer"
          >
            <Award className="w-5 h-5" />
            HIGH SCORES
          </button>

          <button
            onClick={() => setSubModal('settings')}
            className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3.5 font-display text-lg font-bold text-slate-200 hover:border-sky-400/60 transition-all cursor-pointer"
          >
            <Sliders className="w-5 h-5" />
            SETTINGS & CONTROLS
          </button>
        </div>
      </div>

      {/* Quick Controls Strip Footer */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-300/90 bg-slate-950/75 border border-slate-800/80 rounded-xl px-4 py-2.5 backdrop-blur-md max-w-4xl">
        <span className="flex items-center gap-1.5 font-semibold text-sky-300">
          <Car className="w-4 h-4" /> Instant Controls:
        </span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white">WASD</kbd> Move / Drive</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white">SHIFT</kbd> Sprint / Nitro</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white">E</kbd> Enter Vehicle / Door / Shop / Lift</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white">SPACE</kbd> Jump / Drift / Ascend Heli</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white">M</kbd> World Map & GPS</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white">P</kbd> HorizonPhone</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white">V</kbd> 1st/3rd Camera</span>
      </div>

      {/* Sub-Modals (Save Slots, High Scores, Settings) */}
      {subModal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl max-h-[88vh] overflow-y-auto hud-scroll">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="font-display text-2xl font-bold text-white">
                {subModal === 'saves' && 'SAVE SLOTS & PROGRESSION'}
                {subModal === 'scores' && 'PORT PACIFICA HALL OF FAME'}
                {subModal === 'settings' && 'GRAPHICS, AUDIO & CONTROLS'}
              </h2>
              <button
                onClick={() => setSubModal('none')}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {subModal === 'saves' && (
              <div className="mt-4 space-y-3">
                {['autosave', 'slot1', 'slot2', 'slot3'].map((slotId, i) => {
                  const data = slots[i];
                  const title = slotId === 'autosave' ? 'Automatic Save Slot' : `Manual Slot #${i}`;
                  return (
                    <div
                      key={slotId}
                      className="flex items-center justify-between rounded-xl bg-slate-950/70 border border-slate-800 p-4"
                    >
                      <div>
                        <div className="font-semibold text-white">{title}</div>
                        {data ? (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {PLAYABLE_CHARACTERS[data.activeCharacter].name} • $
                            {(data.cash + data.bank).toLocaleString()} • {data.score.toLocaleString()} PTS •{' '}
                            {data.savedAt}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 mt-0.5">Empty Slot</div>
                        )}
                      </div>
                      {data && (
                        <button
                          onClick={() => onLoadSaveSlot(slotId)}
                          className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 cursor-pointer"
                        >
                          LOAD GAME
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {subModal === 'scores' && (
              <div className="mt-4 space-y-2">
                {highScores.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl bg-slate-950/75 border border-slate-800 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white text-sm">{entry.playerName}</div>
                        <div className="text-[11px] text-slate-400">
                          {entry.missionsCompleted} Missions • Net Worth ${entry.cashEarned.toLocaleString()} • {entry.date}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono-hud text-base font-bold text-amber-300">
                      {entry.score.toLocaleString()} PTS
                    </div>
                  </div>
                ))}
              </div>
            )}

            {subModal === 'settings' && (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Graphics Quality Preset
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => onUpdateSettings({ ...settings, graphics: p })}
                        className={`py-2 rounded-lg font-bold uppercase text-xs border cursor-pointer ${
                          settings.graphics === p
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex justify-between text-xs text-slate-300 mb-1">
                    <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Master Volume</span>
                    <span>{Math.round(settings.masterVolume * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.masterVolume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, masterVolume: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-400"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Sound Effects Volume</span>
                    <span>{Math.round(settings.sfxVolume * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.sfxVolume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, sfxVolume: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-400"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Radio Music Volume</span>
                    <span>{Math.round(settings.musicVolume * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.musicVolume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, musicVolume: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-400"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Camera Look Sensitivity</span>
                    <span>{settings.cameraSensitivity.toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min={0.4}
                    max={2.2}
                    step={0.1}
                    value={settings.cameraSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, cameraSensitivity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                    On-Screen Mobile Touch Controls
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['auto', 'always', 'off'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onUpdateSettings({ ...settings, showTouchControls: mode })}
                        className={`py-2 rounded-lg font-bold uppercase text-xs border cursor-pointer ${
                          settings.showTouchControls === mode
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
