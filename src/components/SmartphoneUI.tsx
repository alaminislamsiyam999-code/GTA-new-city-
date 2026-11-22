import React, { useState } from 'react';
import {
  Backpack,
  Briefcase,
  Car,
  CloudSun,
  Landmark,
  Save,
  Wifi,
  X,
} from 'lucide-react';
import { HUDSnapshot, NetSessionSnapshot, WeatherType } from '../types/game';
import { MISSIONS, VEHICLE_SPECS } from '../world/WorldData';
import { SaveManager } from '../systems/SaveManager';

interface SmartphoneUIProps {
  hud: HUDSnapshot;
  onClose: () => void;
  onStartMission: (id: string) => void;
  onSummonVehicle: (instanceId: string) => void;
  onBankTransfer: (amount: number, dir: 'deposit' | 'withdraw') => void;
  onUseItem: (itemId: string) => void;
  onDropItem: (itemId: string) => void;
  onSaveSlot: (slotId: string, label: string) => void;
  onLoadSlot: (slotId: string) => void;
  onSetWeather: (w: WeatherType) => void;
  getNetSnapshot: () => NetSessionSnapshot;
}

export const SmartphoneUI: React.FC<SmartphoneUIProps> = ({
  hud,
  onClose,
  onStartMission,
  onSummonVehicle,
  onBankTransfer,
  onUseItem,
  onDropItem,
  onSaveSlot,
  onLoadSlot,
  onSetWeather,
  getNetSnapshot,
}) => {
  const [app, setApp] = useState<'home' | 'missions' | 'valet' | 'bank' | 'bag' | 'saves' | 'weather' | 'net'>('home');
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 sm:w-84 h-[470px] rounded-[2rem] bg-slate-950 border-4 border-slate-700 shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      {/* Top Status Notch */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-[11px] font-mono-hud text-slate-300">
        <span>HorizonOS 5G</span>
        <button
          onClick={onClose}
          className="p-1 rounded-full bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {toast && (
        <div className="bg-emerald-500 text-slate-950 text-xs font-bold text-center py-1.5 px-2">
          {toast}
        </div>
      )}

      {/* App Content Body */}
      <div className="flex-1 p-3.5 overflow-y-auto hud-scroll">
        {app === 'home' && (
          <div>
            <div className="mb-3 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-600/20 border border-sky-400/30 p-3">
              <div className="text-[11px] text-sky-300 font-mono-hud">PORT PACIFICA ID</div>
              <div className="font-display text-xl font-bold text-white capitalize">
                {hud.activeCharacter}
              </div>
              <div className="text-xs text-emerald-300 font-mono-hud mt-0.5">
                Cash ${hud.cash.toLocaleString()} • Bank ${hud.bank.toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'missions', label: 'Missions', icon: Briefcase, color: 'bg-amber-500/20 text-amber-300 border-amber-400/40' },
                { id: 'valet', label: 'Valet', icon: Car, color: 'bg-sky-500/20 text-sky-300 border-sky-400/40' },
                { id: 'bank', label: 'MazePay', icon: Landmark, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
                { id: 'bag', label: 'Inventory', icon: Backpack, color: 'bg-pink-500/20 text-pink-300 border-pink-400/40' },
                { id: 'saves', label: 'SaveApp', icon: Save, color: 'bg-purple-500/20 text-purple-300 border-purple-400/40' },
                { id: 'weather', label: 'SkyCast', icon: CloudSun, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' },
                { id: 'net', label: 'NetSync', icon: Wifi, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setApp(item.id as typeof app)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 hover:brightness-125 transition-all cursor-pointer ${item.color}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-[11px] font-semibold text-white">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {app !== 'home' && (
          <button
            onClick={() => setApp('home')}
            className="mb-3 text-xs text-sky-400 hover:underline font-semibold cursor-pointer"
          >
            ← Back to Home Screen
          </button>
        )}

        {app === 'missions' && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-amber-300 uppercase">Story & Side Contracts</div>
            {MISSIONS.map((m) => {
              const cleared = hud.completedMissionIds.includes(m.id);
              return (
                <div key={m.id} className="rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{m.title}</span>
                    <span className="text-emerald-400">${m.cashReward.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{m.description}</p>
                  <button
                    onClick={() => {
                      onStartMission(m.id);
                      onClose();
                    }}
                    className="mt-2 w-full py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 cursor-pointer"
                  >
                    {cleared ? 'Replay Contract' : 'Launch Contract'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {app === 'valet' && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-sky-300 uppercase">Personal Owned Fleet</div>
            {hud.ownedVehicles.map((ov) => {
              const spec = VEHICLE_SPECS[ov.modelId];
              return (
                <div
                  key={ov.instanceId}
                  className="rounded-xl bg-slate-900 border border-slate-800 p-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: ov.color }}
                      />
                      {spec?.name || ov.modelId}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Plate {ov.plate} • Stage {ov.engineLevel} Engine
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSummonVehicle(ov.instanceId);
                      flash('Vehicle delivered!');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Deliver
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {app === 'bank' && (
          <div className="space-y-3 text-xs">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
              <div className="text-slate-400">Wallet Cash</div>
              <div className="text-lg font-mono-hud font-bold text-emerald-400">
                ${hud.cash.toLocaleString()}
              </div>
              <div className="text-slate-400 mt-2">PacificTrust Checking</div>
              <div className="text-lg font-mono-hud font-bold text-sky-300">
                ${hud.bank.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onBankTransfer(1000, 'deposit');
                  flash('Deposited $1,000');
                }}
                className="py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold cursor-pointer"
              >
                Deposit $1K
              </button>
              <button
                onClick={() => {
                  onBankTransfer(hud.cash, 'deposit');
                  flash('Deposited All Cash');
                }}
                className="py-2 rounded-lg bg-emerald-400 text-slate-950 font-bold cursor-pointer"
              >
                Deposit All
              </button>
              <button
                onClick={() => {
                  onBankTransfer(1000, 'withdraw');
                  flash('Withdrew $1,000');
                }}
                className="py-2 rounded-lg bg-sky-500 text-slate-950 font-bold cursor-pointer"
              >
                Withdraw $1K
              </button>
              <button
                onClick={() => {
                  onBankTransfer(5000, 'withdraw');
                  flash('Withdrew $5,000');
                }}
                className="py-2 rounded-lg bg-sky-400 text-slate-950 font-bold cursor-pointer"
              >
                Withdraw $5K
              </button>
            </div>
          </div>
        )}

        {app === 'bag' && (
          <div className="space-y-2 text-xs">
            <div className="font-bold text-pink-300 uppercase">Carried Inventory</div>
            {hud.inventory.length === 0 && (
              <div className="text-slate-400 py-4 text-center">
                Backpack empty. Visit FreshMart & Sunset Bistro to stock up!
              </div>
            )}
            {hud.inventory.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-900 border border-slate-800 p-2.5">
                <div className="flex justify-between font-bold text-white">
                  <span>{item.name}</span>
                  <span className="text-sky-300">x{item.quantity}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{item.description}</div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => {
                      onUseItem(item.id);
                      flash(`Used ${item.name}`);
                    }}
                    className="flex-1 py-1 rounded bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Use
                  </button>
                  {item.droppable && (
                    <button
                      onClick={() => {
                        onDropItem(item.id);
                        flash(`Dropped ${item.name}`);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      Drop
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {app === 'saves' && (
          <div className="space-y-2 text-xs">
            <div className="font-bold text-purple-300 uppercase">Cloud & Local Save Slots</div>
            {['slot1', 'slot2', 'slot3'].map((id, idx) => {
              const existing = SaveManager.loadSlot(id);
              const label = `Save Slot #${idx + 1}`;
              return (
                <div key={id} className="rounded-xl bg-slate-900 border border-slate-800 p-2.5">
                  <div className="font-bold text-white">{label}</div>
                  <div className="text-[10px] text-slate-400">
                    {existing ? `${existing.savedAt} • $${existing.cash.toLocaleString()}` : 'Empty'}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => {
                        onSaveSlot(id, label);
                        flash(`Saved ${label}!`);
                      }}
                      className="flex-1 py-1 rounded bg-purple-400 text-slate-950 font-bold cursor-pointer"
                    >
                      Save
                    </button>
                    {existing && (
                      <button
                        onClick={() => {
                          onLoadSlot(id);
                          flash(`Loaded ${label}!`);
                        }}
                        className="flex-1 py-1 rounded bg-slate-800 text-white font-semibold cursor-pointer"
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

        {app === 'weather' && (
          <div className="space-y-2 text-xs">
            <div className="font-bold text-cyan-300 uppercase">Atmospheric Simulation</div>
            {(['clear', 'partly-cloudy', 'rain', 'thunderstorm', 'fog'] as WeatherType[]).map((w) => (
              <button
                key={w}
                onClick={() => {
                  onSetWeather(w);
                  flash(`Weather: ${w}`);
                }}
                className={`w-full py-2 px-3 rounded-xl border text-left font-semibold capitalize cursor-pointer ${
                  hud.weather === w
                    ? 'bg-cyan-500/25 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {w.replace('-', ' ')}
              </button>
            ))}
          </div>
        )}

        {app === 'net' && (
          <div className="space-y-2 text-xs">
            <div className="font-bold text-indigo-300 uppercase">
              Multiplayer Sync State Ready
            </div>
            <pre className="rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-[10px] font-mono-hud text-emerald-300 overflow-x-auto">
              {JSON.stringify(getNetSnapshot(), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
