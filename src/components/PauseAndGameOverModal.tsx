import React, { useState } from 'react';
import {
  Award,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import {
  GameSettings,
  GraphicsPreset,
  HighScoreEntry,
  HUDSnapshot,
} from '../types/game';
import { SaveManager } from '../systems/SaveManager';

interface PauseAndGameOverModalProps {
  hud: HUDSnapshot;
  settings: GameSettings;
  onUpdateSettings: (s: GameSettings) => void;
  onResume: () => void;
  onInstantRestart: () => void;
  onRecoverContinue: () => void;
  onSaveSlot: (slotId: string, label: string) => void;
  onLoadSlot: (slotId: string) => void;
}

export const PauseAndGameOverModal: React.FC<PauseAndGameOverModalProps> = ({
  hud,
  settings,
  onUpdateSettings,
  onResume,
  onInstantRestart,
  onRecoverContinue,
  onSaveSlot,
  onLoadSlot,
}) => {
  const [tab, setTab] = useState<'main' | 'saves' | 'settings' | 'scores'>('main');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const scores: HighScoreEntry[] = SaveManager.loadHighScores();

  if (hud.gamePhase === 'wasted' || hud.gamePhase === 'busted') {
    const isBusted = hud.gamePhase === 'busted';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 backdrop-blur-md p-4 pointer-events-auto">
        <div className="w-full max-w-lg rounded-2xl bg-slate-900 border-2 border-rose-500/60 p-6 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 mb-3">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1
            className={`font-display text-6xl font-extrabold tracking-widest ${
              isBusted ? 'text-sky-400' : 'text-rose-500'
            }`}
          >
            {isBusted ? 'BUSTED' : 'WASTED'}
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            {isBusted
              ? 'Apprehended by Port Pacifica Police Department officers.'
              : 'Critical trauma sustained—evacuated to Pacifica General Hospital.'}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs">
            <div>
              <div className="text-slate-400">Run Score</div>
              <div className="font-mono-hud text-base font-bold text-amber-300">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Net Worth</div>
              <div className="font-mono-hud text-base font-bold text-emerald-400">
                ${(hud.cash + hud.bank).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Missions</div>
              <div className="font-mono-hud text-base font-bold text-sky-300">
                {hud.completedMissionIds.length}
              </div>
            </div>
          </div>

          {/* Top 3 High Scores */}
          <div className="mt-4 text-left">
            <div className="text-[11px] font-mono-hud uppercase text-slate-400 mb-1.5">
              Local High-Score Table
            </div>
            <div className="space-y-1">
              {scores.slice(0, 3).map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg bg-slate-950/75 px-3 py-1.5 text-xs"
                >
                  <span className="text-slate-200 font-medium">
                    #{idx + 1} {s.playerName}
                  </span>
                  <span className="font-mono-hud font-bold text-amber-300">
                    {s.score.toLocaleString()} PTS
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onRecoverContinue}
              className="flex-1 py-3 rounded-xl bg-sky-400 text-slate-950 font-display text-lg font-bold hover:bg-sky-300 cursor-pointer"
            >
              {isBusted ? 'RELEASE FROM PRECINCT' : 'DISCHARGE AT HOSPITAL'}
            </button>
            <button
              onClick={onInstantRestart}
              className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-display text-lg font-bold hover:bg-slate-700 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> INSTANT RESTART
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 backdrop-blur-md p-4 pointer-events-auto">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl max-h-[88vh] overflow-y-auto hud-scroll">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-mono-hud text-sky-400">GAME PAUSED</div>
            <h2 className="font-display text-3xl font-bold text-white">PACIFICA HORIZON</h2>
          </div>
          <div className="text-right text-xs font-mono-hud">
            <div className="text-amber-300 font-bold">{hud.score.toLocaleString()} PTS</div>
            <div className="text-emerald-400">${(hud.cash + hud.bank).toLocaleString()}</div>
          </div>
        </div>

        {/* Navigation Pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: 'main', label: 'Session', icon: Play },
            { id: 'saves', label: 'Save / Load', icon: Save },
            { id: 'settings', label: 'Settings', icon: Sliders },
            { id: 'scores', label: 'High Scores', icon: Award },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.id}
                onClick={() => setTab(b.id as typeof tab)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  tab === b.id
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-950 text-slate-300 border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {b.label}
              </button>
            );
          })}
        </div>

        {savedNotice && (
          <div className="mt-3 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-semibold px-3 py-2">
            {savedNotice}
          </div>
        )}

        {tab === 'main' && (
          <div className="mt-5 space-y-3">
            <button
              onClick={onResume}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-display text-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-950" /> RESUME GAME
            </button>

            <button
              onClick={() => {
                onSaveSlot('slot1', 'Quick Save Slot #1');
                setSavedNotice('Progress saved to Slot #1!');
              }}
              className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-display text-lg font-bold hover:border-sky-400 cursor-pointer"
            >
              QUICK SAVE PROGRESS
            </button>

            <button
              onClick={onInstantRestart}
              className="w-full py-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 font-display text-lg font-bold hover:bg-rose-500/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> INSTANT RESTART SESSION
            </button>
          </div>
        )}

        {tab === 'saves' && (
          <div className="mt-4 space-y-2.5 text-xs">
            {['slot1', 'slot2', 'slot3'].map((slotId, idx) => {
              const existing = SaveManager.loadSlot(slotId);
              const label = `Save Slot #${idx + 1}`;
              return (
                <div
                  key={slotId}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white text-sm">{label}</div>
                    <div className="text-slate-400 mt-0.5">
                      {existing
                        ? `${existing.savedAt} • $${(existing.cash + existing.bank).toLocaleString()} • ${existing.score} PTS`
                        : 'Empty Slot'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onSaveSlot(slotId, label);
                        setSavedNotice(`Saved ${label}!`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-400 text-slate-950 font-bold cursor-pointer"
                    >
                      Save
                    </button>
                    {existing && (
                      <button
                        onClick={() => onLoadSlot(slotId)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold cursor-pointer"
                      >
                        Load
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'settings' && (
          <div className="mt-4 space-y-4 text-xs">
            <div>
              <div className="uppercase text-slate-400 font-bold mb-1.5">Graphics Preset</div>
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => onUpdateSettings({ ...settings, graphics: g })}
                    className={`py-2 rounded-lg uppercase font-bold border cursor-pointer ${
                      settings.graphics === g
                        ? 'bg-sky-400 text-slate-950 border-sky-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Master Volume</span>
                <span>{Math.round(settings.masterVolume * 100)}%</span>
              </div>
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
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Sound Effects Volume</span>
                <span>{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
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
              <div className="uppercase text-slate-400 font-bold mb-1.5">Touch Controls Overlay</div>
              <div className="grid grid-cols-3 gap-2">
                {(['auto', 'always', 'off'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onUpdateSettings({ ...settings, showTouchControls: m })}
                    className={`py-2 rounded-lg uppercase font-bold border cursor-pointer ${
                      settings.showTouchControls === m
                        ? 'bg-sky-400 text-slate-950 border-sky-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'scores' && (
          <div className="mt-4 space-y-2 text-xs">
            {scores.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5"
              >
                <div>
                  <span className="font-bold text-amber-300 mr-2">#{idx + 1}</span>
                  <span className="font-semibold text-white">{entry.playerName}</span>
                </div>
                <span className="font-mono-hud font-bold text-sky-300">
                  {entry.score.toLocaleString()} PTS
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
