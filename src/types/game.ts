export type CharacterId = 'dante' | 'elena' | 'marcus' | 'bc2' | 'bc4' | 'boy';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export type CameraMode = 'third-far' | 'third-close' | 'first-person' | 'cinematic';

export type WeatherType = 'clear' | 'partly-cloudy' | 'rain' | 'thunderstorm' | 'fog';

export type VehicleCategory =
  | 'supercar'
  | 'sports'
  | 'sedan'
  | 'suv'
  | 'pickup'
  | 'motorcycle'
  | 'bicycle'
  | 'bus'
  | 'truck'
  | 'emergency'
  | 'helicopter'
  | 'boat';

export interface CharacterCustomization {
  hairStyle: 'short-fade' | 'slick-back' | 'ponytail' | 'textured-crop' | 'buzz';
  hairColor: string;
  skinTone: string;
  jacketStyle: 'leather-racer' | 'tailored-blazer' | 'tactical-vest' | 'hoodie' | 'casual-tee';
  jacketColor: string;
  shirtColor: string;
  trouserStyle: 'slim-denim' | 'cargo-tactical' | 'tailored-slacks' | 'track-pants';
  trouserColor: string;
  shoeColor: string;
  accessory: 'none' | 'aviators' | 'cyber-visor' | 'gold-chain' | 'cap';
  outfitPresetName?: string;
}

export interface PlayableCharacterProfile {
  id: CharacterId;
  name: string;
  role: string;
  bio: string;
  specialty: string;
  speedBonus: number;
  drivingBonus: number;
  staminaBonus: number;
  defaultPos: [number, number, number];
  customization: CharacterCustomization;
  /** Optional 3D model + animations. Without it the procedural body is used. */
  model?: { url: string };
}

export interface VehicleSpec {
  modelId: string;
  name: string;
  manufacturer: string;
  category: VehicleCategory;
  price: number;
  maxSpeed: number; // world units / s
  acceleration: number;
  braking: number;
  handling: number;
  mass: number;
  seats: number;
  fuelCapacity: number;
  defaultColor: string;
  description: string;
  dimensions: [number, number, number]; // width, height, length
}

export interface OwnedVehicle {
  instanceId: string;
  modelId: string;
  color: string;
  engineLevel: number; // 1..3
  armorLevel: number; // 1..3
  fuel: number;
  health: number; // 0..100
  plate: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'consumable' | 'equipment' | 'key' | 'collectible' | 'mission';
  description: string;
  quantity: number;
  price: number;
  healAmount?: number;
  staminaAmount?: number;
  fuelAmount?: number;
  droppable?: boolean;
}

export interface PropertyDefinition {
  id: string;
  name: string;
  district: string;
  price: number;
  dailyIncome: number;
  description: string;
  position: [number, number, number];
  garageCapacity: number;
  interiorTheme: 'penthouse' | 'villa' | 'ocean-loft';
}

export interface BuildingFloor {
  level: number; // 0 = ground, 1 = 2F, 2 = 3F, 3 = Rooftop
  label: string;
  elevationY: number;
  purpose: string;
}

export interface EnterableBuilding {
  id: string;
  name: string;
  type:
    | 'skyscraper'
    | 'dealership'
    | 'boutique'
    | 'supermarket'
    | 'garage'
    | 'hospital'
    | 'police'
    | 'villa'
    | 'apartment'
    | 'hotel';
  district: string;
  position: [number, number, number]; // center X, ground Y, center Z
  size: [number, number, number]; // width, totalHeight, depth
  doorSide: 'south' | 'north' | 'east' | 'west';
  wallColor: string;
  accentColor: string;
  floors: BuildingFloor[];
  hasElevator: boolean;
  hasRooftopAccess: boolean;
  propertyId?: string;
}

export interface InteractivePrompt {
  id: string;
  title: string;
  subtitle: string;
  actionKey: string;
  actionType:
    | 'enter-vehicle'
    | 'open-door'
    | 'use-elevator'
    | 'open-shop'
    | 'open-dealership'
    | 'open-wardrobe'
    | 'open-garage'
    | 'use-atm'
    | 'buy-property'
    | 'sleep-bed'
    | 'sit-chair'
    | 'watch-tv'
    | 'collect-item'
    | 'heal-hospital'
    | 'pay-fine'
    | 'refuel-pump'
    | 'start-mission'
    | 'talk-npc';
  targetId?: string;
  cost?: number;
}

export interface MissionStep {
  id: string;
  instruction: string;
  targetPos: [number, number, number];
  radius: number;
  type: 'goto' | 'drive' | 'collect' | 'deliver' | 'evade-police' | 'rooftop' | 'interact';
  requiredVehicleCategory?: VehicleCategory;
  dialogueSpeaker?: string;
  dialogueLine?: string;
  spawnWanted?: number;
}

export interface MissionDefinition {
  id: string;
  title: string;
  giver: string;
  category: 'main' | 'character' | 'side' | 'event';
  recommendedCharacter?: CharacterId;
  description: string;
  startPos: [number, number, number];
  cashReward: number;
  scoreReward: number;
  cutsceneIntro: { speaker: string; text: string }[];
  steps: MissionStep[];
}

export interface ScorePopup {
  id: number;
  label: string;
  points: number;
  multiplier: number;
  color: string;
}

export interface HighScoreEntry {
  id: string;
  playerName: string;
  character: CharacterId;
  score: number;
  cashEarned: number;
  missionsCompleted: number;
  date: string;
}

export interface GameSettings {
  graphics: GraphicsPreset;
  cameraSensitivity: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  showTouchControls: 'auto' | 'always' | 'off';
  invertY: boolean;
  minimapRotate: boolean;
}

export interface HUDSnapshot {
  gamePhase: 'start' | 'playing' | 'paused' | 'wasted' | 'busted' | 'cutscene';
  activeCharacter: CharacterId;
  districtName: string;
  streetStatus: string;
  health: number;
  maxHealth: number;
  armor: number;
  stamina: number;
  cash: number;
  bank: number;
  score: number;
  comboMultiplier: number;
  comboTimer: number;
  wantedLevel: number; // 0..5
  policeSearching: boolean;
  wantedCooldownPct: number;
  timeOfDay: number; // 0..24 hours
  weather: WeatherType;
  cameraMode: CameraMode;
  fps: number;
  playerPos: [number, number, number];
  playerHeading: number;
  currentFloorLabel: string | null;
  insideBuildingName: string | null;
  isSitting: boolean;
  isPhoneOut: boolean;
  inVehicle: {
    active: boolean;
    name: string;
    category: VehicleCategory;
    speedMph: number;
    gear: string;
    rpm: number; // 0..1
    fuel: number; // 0..100
    health: number; // 0..100
    headlights: boolean;
    radioStation: string;
  };
  prompt: InteractivePrompt | null;
  activeMission: {
    id: string;
    title: string;
    stepIndex: number;
    totalSteps: number;
    instruction: string;
    targetPos: [number, number, number];
    distance: number;
  } | null;
  dialogue: {
    speaker: string;
    text: string;
  } | null;
  gpsTarget: [number, number] | null;
  gpsDistance: number;
  collectiblesFound: number;
  totalCollectibles: number;
  completedMissionIds: string[];
  ownedPropertyIds: string[];
  ownedVehicles: OwnedVehicle[];
  inventory: InventoryItem[];
  scorePopups: ScorePopup[];
  minimapEntities: {
    x: number;
    z: number;
    type: 'police' | 'vehicle' | 'mission' | 'shop' | 'property' | 'collectible' | 'event';
    label?: string;
  }[];
}

export interface SaveSlotData {
  slotId: string;
  label: string;
  savedAt: string;
  activeCharacter: CharacterId;
  characterCustomizations: Record<CharacterId, CharacterCustomization>;
  playerPos: [number, number, number];
  cash: number;
  bank: number;
  score: number;
  health: number;
  armor: number;
  timeOfDay: number;
  weather: WeatherType;
  completedMissionIds: string[];
  collectedShardIds: string[];
  ownedPropertyIds: string[];
  ownedVehicles: OwnedVehicle[];
  inventory: InventoryItem[];
}

/**
 * Multiplayer-ready synchronization contract so future WebSocket/WebRTC transport
 * layers can replicate authoritative world & player state cleanly.
 */
export interface NetPlayerSnapshot {
  peerId: string;
  profileName: string;
  characterId: CharacterId;
  position: [number, number, number];
  rotationY: number;
  animState: string;
  vehicleInstanceId: string | null;
  wantedLevel: number;
  timestamp: number;
}

export interface NetSessionSnapshot {
  sessionId: string;
  hostTick: number;
  timeOfDay: number;
  weather: WeatherType;
  players: NetPlayerSnapshot[];
}
