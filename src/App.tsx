import { useEffect, useRef, useState } from 'react';
import { CharacterId, GameSettings, HUDSnapshot } from './types/game';
import { OpenWorldEngine, UIModalTrigger } from './engine/OpenWorldEngine';
import { SaveManager } from './systems/SaveManager';
import { StartScreen } from './components/StartScreen';
import { HUD } from './components/HUD';
import { WorldMapModal } from './components/WorldMapModal';
import { SmartphoneUI } from './components/SmartphoneUI';
import { ShopAndInteriorModal } from './components/ShopAndInteriorModal';
import { TouchControls } from './components/TouchControls';
import { PauseAndGameOverModal } from './components/PauseAndGameOverModal';

const INITIAL_HUD: HUDSnapshot = {
  gamePhase: 'start',
  activeCharacter: 'dante',
  districtName: 'Downtown Financial Core',
  streetStatus: 'Skyscrapers, Luxury Showrooms & Corporate Plazas',
  health: 100,
  maxHealth: 100,
  armor: 50,
  stamina: 100,
  cash: 6500,
  bank: 15000,
  score: 0,
  comboMultiplier: 1,
  comboTimer: 0,
  wantedLevel: 0,
  policeSearching: false,
  wantedCooldownPct: 0,
  timeOfDay: 10.5,
  weather: 'clear',
  cameraMode: 'third-far',
  fps: 60,
  playerPos: [-18, 0, 36],
  playerHeading: Math.PI,
  currentFloorLabel: null,
  insideBuildingName: null,
  isSitting: false,
  isPhoneOut: false,
  inVehicle: {
    active: false,
    name: '',
    category: 'sedan',
    speedMph: 0,
    gear: 'N',
    rpm: 0,
    fuel: 100,
    health: 100,
    headlights: false,
    radioStation: '98.4 Neon Pulse',
  },
  prompt: null,
  activeMission: null,
  dialogue: null,
  gpsTarget: [-24, 14],
  gpsDistance: 22,
  collectiblesFound: 0,
  totalCollectibles: 12,
  completedMissionIds: [],
  ownedPropertyIds: [],
  ownedVehicles: [],
  inventory: [],
  scorePopups: [],
  minimapEntities: [],
};

export function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OpenWorldEngine | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() => SaveManager.loadSettings());
  const [hud, setHud] = useState<HUDSnapshot>(INITIAL_HUD);
  const [selectedChar, setSelectedChar] = useState<CharacterId>('dante');

  const [mapOpen, setMapOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<UIModalTrigger>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(touchCapable);
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;
    const engine = new OpenWorldEngine(
      viewportRef.current,
      settings,
      (snapshot) => setHud(snapshot),
      (modalReq) => setActiveModal(modalReq)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global UI Hotkeys [M] for World Map and [P] for Smartphone
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (hud.gamePhase !== 'playing') return;

      if (e.code === 'KeyM') {
        setMapOpen((prev) => !prev);
      } else if (e.code === 'KeyP') {
        setPhoneOpen((prev) => {
          const next = !prev;
          engineRef.current?.togglePhone();
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hud.gamePhase]);

  const handleUpdateSettings = (next: GameSettings) => {
    setSettings(next);
    engineRef.current?.applySettings(next);
  };

  const showTouch =
    hud.gamePhase === 'playing' &&
    !mapOpen &&
    !activeModal &&
    (settings.showTouchControls === 'always' ||
      (settings.showTouchControls === 'auto' && isTouchDevice));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Live 60fps Three.js Open World Viewport */}
      <div ref={viewportRef} className="absolute inset-0 w-full h-full" />

      {/* START / SPLASH SCREEN */}
      {hud.gamePhase === 'start' && (
        <StartScreen
          selectedCharacter={selectedChar}
          onSelectCharacter={(c) => {
            setSelectedChar(c);
            engineRef.current?.switchCharacter(c, true);
          }}
          onStartNewGame={(c) => engineRef.current?.startNewGame(c)}
          onLoadSaveSlot={(slotId) => engineRef.current?.loadFromSlot(slotId)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* ACTIVE GAMEPLAY & CUTSCENE HUD */}
      {(hud.gamePhase === 'playing' || hud.gamePhase === 'cutscene') && (
        <HUD
          hud={hud}
          minimapRotate={settings.minimapRotate}
          onOpenMap={() => setMapOpen(true)}
          onTogglePhone={() => {
            setPhoneOpen((p) => !p);
            engineRef.current?.togglePhone();
          }}
          onOpenWardrobe={() => setActiveModal({ type: 'wardrobe' })}
          onCycleCamera={() => engineRef.current?.toggleCameraMode()}
          onPause={() => engineRef.current?.pauseGame()}
          onTriggerInteract={() => engineRef.current?.triggerPrimaryInteraction()}
          onSwitchCharacter={(c) => engineRef.current?.switchCharacter(c)}
          onNextRadio={() => {
            engineRef.current?.sound.nextRadioStation();
            engineRef.current?.emitHud();
          }}
        />
      )}

      {/* MOBILE / TABLET MULTI-TOUCH CONTROLS */}
      {showTouch && engineRef.current && (
        <TouchControls engine={engineRef.current} hud={hud} />
      )}

      {/* FULL INTERACTIVE WORLD MAP & GPS */}
      {mapOpen && (
        <WorldMapModal
          hud={hud}
          onSetWaypoint={(pos) => engineRef.current?.setGpsWaypoint(pos)}
          onStartMission={(id) => engineRef.current?.startMissionById(id)}
          onClose={() => setMapOpen(false)}
        />
      )}

      {/* IN-GAME HORIZON-OS SMARTPHONE */}
      {phoneOpen && hud.gamePhase === 'playing' && engineRef.current && (
        <SmartphoneUI
          hud={hud}
          onClose={() => {
            setPhoneOpen(false);
            engineRef.current?.togglePhone();
          }}
          onStartMission={(id) => engineRef.current?.startMissionById(id)}
          onSummonVehicle={(instId) => engineRef.current?.summonOwnedVehicle(instId)}
          onBankTransfer={(amt, dir) => engineRef.current?.bankTransfer(amt, dir)}
          onUseItem={(id) => engineRef.current?.useInventoryItem(id)}
          onDropItem={(id) => engineRef.current?.dropInventoryItem(id)}
          onSaveSlot={(id, label) => engineRef.current?.saveToSlot(id, label)}
          onLoadSlot={(id) => engineRef.current?.loadFromSlot(id)}
          onSetWeather={(w) => engineRef.current?.setWeatherManual(w)}
          getNetSnapshot={() => engineRef.current!.getMultiplayerSyncSnapshot()}
        />
      )}

      {/* SHOPS, DEALERSHIP, GARAGE, WARDROBE, ATM, PROPERTY DEED & ELEVATOR PANEL */}
      {activeModal && engineRef.current && (
        <ShopAndInteriorModal
          modal={activeModal}
          hud={hud}
          currentCustom={engineRef.current.getActiveCustomization()}
          onClose={() => setActiveModal(null)}
          onSwitchCharacter={(c) => engineRef.current?.switchCharacter(c)}
          onUpdateCustomization={(patch, cost) =>
            engineRef.current!.updateCustomization(patch, cost)
          }
          onBuyVehicle={(modelId, color) => engineRef.current!.purchaseVehicle(modelId, color)}
          onSummonVehicle={(instId) => engineRef.current!.summonOwnedVehicle(instId)}
          onGarageService={(opts) => engineRef.current!.customizeActiveOrOwnedVehicle(opts)}
          onBuyShopItem={(itemId) => engineRef.current!.buyShopItem(itemId)}
          onBankTransfer={(amt, dir) => engineRef.current!.bankTransfer(amt, dir)}
          onBuyProperty={(propId) => engineRef.current!.buyProperty(propId)}
          onSelectElevatorFloor={(elevId, floorLvl) =>
            engineRef.current!.rideElevatorToFloor(elevId, floorLvl)
          }
        />
      )}

      {/* PAUSE MENU & WASTED / BUSTED SCREENS */}
      {(hud.gamePhase === 'paused' ||
        hud.gamePhase === 'wasted' ||
        hud.gamePhase === 'busted') && (
        <PauseAndGameOverModal
          hud={hud}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResume={() => engineRef.current?.resumeGame()}
          onInstantRestart={() => engineRef.current?.instantRestart()}
          onRecoverContinue={() => engineRef.current?.recoverAfterWastedOrBusted()}
          onSaveSlot={(id, label) => engineRef.current?.saveToSlot(id, label)}
          onLoadSlot={(id) => engineRef.current?.loadFromSlot(id)}
        />
      )}
    </div>
  );
}

export default App;
