import React, { useState } from 'react';
import {
  Building2,
  Car,
  Check,
  DollarSign,
  Paintbrush,
  ShoppingBag,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  CharacterCustomization,
  CharacterId,
  HUDSnapshot,
} from '../types/game';
import { UIModalTrigger } from '../engine/OpenWorldEngine';
import {
  OUTFIT_PRESETS,
  PLAYABLE_CHARACTERS,
  PROPERTIES,
  SHOP_CATALOG,
  VEHICLE_SPECS,
} from '../world/WorldData';

interface ShopAndInteriorModalProps {
  modal: Exclude<UIModalTrigger, null>;
  hud: HUDSnapshot;
  currentCustom: CharacterCustomization;
  onClose: () => void;
  onSwitchCharacter: (c: CharacterId) => void;
  onUpdateCustomization: (patch: Partial<CharacterCustomization>, cost?: number) => boolean;
  onBuyVehicle: (modelId: string, color: string) => boolean;
  onSummonVehicle: (instanceId: string) => void;
  onGarageService: (opts: {
    color?: string;
    repair?: boolean;
    refuel?: boolean;
    upgradeEngine?: boolean;
    cost: number;
  }) => boolean;
  onBuyShopItem: (itemId: string) => boolean;
  onBankTransfer: (amount: number, dir: 'deposit' | 'withdraw') => boolean;
  onBuyProperty: (propertyId: string) => boolean;
  onSelectElevatorFloor: (elevatorId: string, floorLevel: number) => void;
}

const COLOR_SWATCHES = [
  '#ef4444',
  '#f97316',
  '#facc15',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f8fafc',
  '#1e293b',
  '#09090b',
];

export const ShopAndInteriorModal: React.FC<ShopAndInteriorModalProps> = ({
  modal,
  hud,
  currentCustom,
  onClose,
  onSwitchCharacter,
  onUpdateCustomization,
  onBuyVehicle,
  onSummonVehicle,
  onGarageService,
  onBuyShopItem,
  onBankTransfer,
  onBuyProperty,
  onSelectElevatorFloor,
}) => {
  const [selectedPaint, setSelectedPaint] = useState('#ef4444');
  const [feedback, setFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 pointer-events-auto">
      <div className="w-full max-w-3xl max-h-[88vh] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              {modal.type === 'wardrobe' && 'WARDROBE & CHARACTER CUSTOMIZATION'}
              {modal.type === 'dealership' && 'APEX LUXURY AUTO DEALERSHIP'}
              {modal.type === 'garage' && 'PORT CUSTOMS & PERSONAL GARAGE'}
              {modal.type === 'shop' && 'FRESHMART & SUNSET BISTRO'}
              {modal.type === 'atm' && 'PACIFICTRUST ATM TERMINAL'}
              {modal.type === 'property' && 'PACIFICA REAL ESTATE DEED'}
              {modal.type === 'elevator' && `${modal.elevator.buildingName.toUpperCase()} ELEVATOR`}
            </h2>
            <div className="text-xs font-mono-hud text-emerald-400">
              Wallet ${hud.cash.toLocaleString()} • Bank ${hud.bank.toLocaleString()}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div className="bg-sky-500 text-slate-950 text-xs font-bold text-center py-1.5 px-4">
            {feedback}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto hud-scroll space-y-5">
          {/* ELEVATOR FLOOR SELECTOR */}
          {modal.type === 'elevator' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-300">
                Select a floor below to ride the physical glass elevator shaft:
              </p>
              {modal.elevator.floors.map((fl) => (
                <button
                  key={fl.level}
                  onClick={() => {
                    onSelectElevatorFloor(modal.elevator.id, fl.level);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-400 p-4 text-left transition-all cursor-pointer"
                >
                  <div>
                    <div className="font-display text-lg font-bold text-white">{fl.label}</div>
                    <div className="text-xs text-slate-400">Elevation +{fl.y.toFixed(1)}m</div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-mono-hud text-xs font-bold">
                    RIDE LIFT
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* WARDROBE & BOUTIQUE */}
          {modal.type === 'wardrobe' && (
            <div className="space-y-5 text-xs">
              <div>
                <div className="font-bold uppercase text-slate-400 mb-2">Active Protagonist</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['dante', 'elena', 'marcus'] as CharacterId[]).map((cid) => (
                    <button
                      key={cid}
                      onClick={() => onSwitchCharacter(cid)}
                      className={`p-3 rounded-xl border text-left cursor-pointer ${
                        hud.activeCharacter === cid
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm">{PLAYABLE_CHARACTERS[cid].name}</div>
                      <div className="text-[10px] text-sky-300">{PLAYABLE_CHARACTERS[cid].role}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold uppercase text-slate-400 mb-2">Designer Outfit Presets</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OUTFIT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        const ok = onUpdateCustomization(
                          { ...preset.custom, outfitPresetName: preset.name },
                          preset.price
                        );
                        notify(ok ? `Equipped ${preset.name}!` : 'Insufficient Cash!');
                      }}
                      className="flex items-center justify-between rounded-xl bg-slate-950 border border-slate-800 hover:border-pink-400 p-3 cursor-pointer"
                    >
                      <span className="font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-400" /> {preset.name}
                      </span>
                      <span className="font-mono-hud text-emerald-400">
                        {preset.price === 0 ? 'OWNED' : `$${preset.price}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="font-bold uppercase text-slate-400 mb-1.5">Hairstyle</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['short-fade', 'slick-back', 'ponytail', 'textured-crop', 'buzz'] as const).map((h) => (
                      <button
                        key={h}
                        onClick={() => onUpdateCustomization({ hairStyle: h })}
                        className={`px-2.5 py-1.5 rounded-lg border capitalize cursor-pointer ${
                          currentCustom.hairStyle === h
                            ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {h.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-bold uppercase text-slate-400 mb-1.5">Accessories & Eyewear</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['none', 'aviators', 'cyber-visor', 'gold-chain', 'cap'] as const).map((acc) => (
                      <button
                        key={acc}
                        onClick={() => onUpdateCustomization({ accessory: acc })}
                        className={`px-2.5 py-1.5 rounded-lg border capitalize cursor-pointer ${
                          currentCustom.accessory === acc
                            ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {acc.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-bold uppercase text-slate-400 mb-1.5">Jacket / Top Style</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      ['leather-racer', 'tailored-blazer', 'tactical-vest', 'hoodie', 'casual-tee'] as const
                    ).map((j) => (
                      <button
                        key={j}
                        onClick={() => onUpdateCustomization({ jacketStyle: j })}
                        className={`px-2.5 py-1.5 rounded-lg border capitalize cursor-pointer ${
                          currentCustom.jacketStyle === j
                            ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {j.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-bold uppercase text-slate-400 mb-1.5">Jacket Color</div>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_SWATCHES.map((col) => (
                      <button
                        key={col}
                        onClick={() => onUpdateCustomization({ jacketColor: col })}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                          currentCustom.jacketColor === col ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DEALERSHIP VEHICLE CATALOG */}
          {modal.type === 'dealership' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 mr-2 flex items-center gap-1.5">
                  <Paintbrush className="w-4 h-4 text-sky-400" /> Factory Delivery Paint:
                </span>
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedPaint(c)}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      selectedPaint === c ? 'border-white scale-110' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(VEHICLE_SPECS).map((spec) => (
                  <div
                    key={spec.modelId}
                    className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono-hud uppercase px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                          {spec.category}
                        </span>
                        <span className="font-mono-hud text-sm font-bold text-emerald-400">
                          ${spec.price.toLocaleString()}
                        </span>
                      </div>
                      <div className="font-display text-xl font-bold text-white mt-1">
                        {spec.manufacturer} {spec.name}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{spec.description}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="text-[11px] text-slate-300 font-mono-hud">
                        Top {Math.round(spec.maxSpeed * 2.35)} MPH • {spec.seats} Seats
                      </div>
                      <button
                        onClick={() => {
                          const ok = onBuyVehicle(spec.modelId, selectedPaint);
                          notify(
                            ok
                              ? `Purchased ${spec.name}! Delivered outside.`
                              : 'Insufficient Cash + Bank funds!'
                          );
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-sky-400 text-slate-950 font-bold text-xs hover:bg-sky-300 cursor-pointer"
                      >
                        Purchase
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GARAGE & CUSTOMS WORKSHOP */}
          {modal.type === 'garage' && (
            <div className="space-y-5 text-xs">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
                <div className="font-display text-lg font-bold text-amber-300 flex items-center gap-2">
                  <Wrench className="w-5 h-5" /> Customs Service Bay (Applies to Current / Nearest Vehicle)
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 mr-1">Custom Respray ($200):</span>
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        const ok = onGarageService({ color: c, cost: 200 });
                        notify(ok ? 'Vehicle resprayed!' : 'Bring a vehicle close & have $200!');
                      }}
                      className="w-6 h-6 rounded-full border border-white/30 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <button
                    onClick={() => {
                      const ok = onGarageService({ repair: true, refuel: true, cost: 120 });
                      notify(ok ? 'Full Repair & Refuel Complete!' : 'Need vehicle nearby & $120!');
                    }}
                    className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                  >
                    Full Repair & Fuel ($120)
                  </button>
                  <button
                    onClick={() => {
                      const ok = onGarageService({ upgradeEngine: true, cost: 1500 });
                      notify(ok ? 'Stage +1 ECU & Turbo Installed!' : 'Need vehicle nearby & $1,500!');
                    }}
                    className="py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Upgrade Engine ($1,500)
                  </button>
                  <button
                    onClick={() => {
                      const ok = onGarageService({ refuel: true, cost: 45 });
                      notify(ok ? 'Octane Tank Filled!' : 'Need vehicle nearby & $45!');
                    }}
                    className="py-2.5 rounded-xl bg-sky-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Top Up Fuel ($45)
                  </button>
                </div>
              </div>

              <div>
                <div className="font-bold uppercase text-slate-400 mb-2">Stored Personal Vehicles</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {hud.ownedVehicles.map((ov) => {
                    const spec = VEHICLE_SPECS[ov.modelId];
                    return (
                      <div
                        key={ov.instanceId}
                        className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <Car className="w-4 h-4 text-sky-400" />
                            {spec?.name || ov.modelId}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Plate {ov.plate} • Engine Stage {ov.engineLevel}/3
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onSummonVehicle(ov.instanceId);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sky-400 text-slate-950 font-bold cursor-pointer"
                        >
                          Spawn Outside
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SUPERMARKET & BISTRO */}
          {modal.type === 'shop' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {SHOP_CATALOG.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-emerald-400" /> {item.name}
                      </span>
                      <span className="font-mono-hud font-bold text-emerald-400">${item.price}</span>
                    </div>
                    <p className="text-slate-400 mt-1">{item.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      const ok = onBuyShopItem(item.id);
                      notify(ok ? `Purchased ${item.name}!` : 'Not enough cash in wallet!');
                    }}
                    className="mt-3 w-full py-2 rounded-lg bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300 cursor-pointer"
                  >
                    Buy Item (${item.price})
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ATM */}
          {modal.type === 'atm' && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
                  <div className="text-xs text-slate-400">Cash on Hand</div>
                  <div className="text-2xl font-mono-hud font-bold text-emerald-400 mt-1">
                    ${hud.cash.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
                  <div className="text-xs text-slate-400">PacificTrust Account</div>
                  <div className="text-2xl font-mono-hud font-bold text-sky-300 mt-1">
                    ${hud.bank.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[500, 2500].map((amt) => (
                  <button
                    key={'dep_' + amt}
                    onClick={() => {
                      onBankTransfer(amt, 'deposit');
                      notify(`Deposited $${amt.toLocaleString()}`);
                    }}
                    className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                  >
                    Deposit ${amt}
                  </button>
                ))}
                {[500, 2500].map((amt) => (
                  <button
                    key={'wit_' + amt}
                    onClick={() => {
                      onBankTransfer(amt, 'withdraw');
                      notify(`Withdrew $${amt.toLocaleString()}`);
                    }}
                    className="py-2.5 rounded-xl bg-sky-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Withdraw ${amt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* REAL ESTATE PROPERTY DEED */}
          {modal.type === 'property' && (() => {
            const prop = PROPERTIES.find((p) => p.id === modal.propertyId);
            if (!prop) return null;
            const owned = hud.ownedPropertyIds.includes(prop.id);
            return (
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono-hud uppercase text-amber-300">{prop.district}</div>
                    <h3 className="font-display text-2xl font-bold text-white mt-0.5 flex items-center gap-2">
                      <Building2 className="w-6 h-6 text-amber-400" /> {prop.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-hud text-xl font-bold text-emerald-400">
                      ${prop.price.toLocaleString()}
                    </div>
                    <div className="text-xs text-sky-300">+${prop.dailyIncome}/day rent</div>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">{prop.description}</p>

                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    Garage Capacity: {prop.garageCapacity} Vehicles
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    Walk-In Bed, Wardrobe & Smart TV
                  </span>
                </div>

                {owned ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm pt-2">
                    <Check className="w-5 h-5" /> You own the deed to this property! Walk inside anytime to rest or change outfits.
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const ok = onBuyProperty(prop.id);
                      notify(ok ? `Purchased ${prop.name}!` : 'Insufficient Cash + Bank balance!');
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-display text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <DollarSign className="w-5 h-5" /> PURCHASE PROPERTY DEED (${prop.price.toLocaleString()})
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
