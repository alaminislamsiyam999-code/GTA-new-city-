import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CameraMode,
  CharacterCustomization,
  CharacterId,
  GameSettings,
  HUDSnapshot,
  InteractivePrompt,
  InventoryItem,
  MissionDefinition,
  NetSessionSnapshot,
  OwnedVehicle,
  SaveSlotData,
  ScorePopup,
  VehicleSpec,
  WeatherType,
} from '../types/game';
import { SoundEngine } from '../audio/SoundEngine';
import { buildProceduralTextures } from '../world/ProceduralTextures';
import {
  ENTERABLE_BUILDINGS,
  MISSIONS,
  PLAYABLE_CHARACTERS,
  PROPERTIES,
  ROAD_COORDS,
  SHOP_CATALOG,
  VEHICLE_SPECS,
  WORLD_COLLECTIBLES,
  getDistrictAt,
  getTerrainElevation,
} from '../world/WorldData';
import { buildHumanoidRig, buildVehicleRig, HumanoidRig, VehicleRig } from './ModelBuilders';
import { AnimName, CharacterAnimator, PLAYER_ANIMATIONS } from './CharacterAnimator';
import { BuiltWorld, constructOpenWorld, ElevatorController } from './WorldBuilder';
import { SaveManager } from '../systems/SaveManager';

interface WorldVehicleInstance {
  id: string;
  spec: VehicleSpec;
  rig: VehicleRig;
  position: THREE.Vector3;
  heading: number;
  speed: number;
  verticalVel: number;
  steerAngle: number;
  fuel: number;
  health: number;
  engineLevel: number;
  headlightsOn: boolean;
  doorOpenProgress: number;
  isTraffic: boolean;
  isPoliceUnit: boolean;
  trafficAxis?: 'x' | 'z';
  trafficDir?: 1 | -1;
  ownedInstanceId?: string;
  nearMissCooldown: number;
}

interface WorldNPCInstance {
  id: string;
  rig: HumanoidRig;
  position: THREE.Vector3;
  heading: number;
  speed: number;
  behavior: 'walk' | 'chat' | 'phone' | 'sit' | 'flee';
  timer: number;
  walkPhase: number;
  homeAxis: 'x' | 'z';
  fleeTimer: number;
}

interface ParticleItem {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scaleRate: number;
}

export type UIModalTrigger =
  | { type: 'wardrobe' }
  | { type: 'dealership' }
  | { type: 'garage' }
  | { type: 'shop' }
  | { type: 'atm' }
  | { type: 'property'; propertyId: string }
  | { type: 'elevator'; elevator: ElevatorController }
  | null;

export class OpenWorldEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  public sound: SoundEngine;
  private world: BuiltWorld;

  private rafId: number | null = null;
  private lastTime = performance.now();
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;

  // Core Game State
  private gamePhase: HUDSnapshot['gamePhase'] = 'start';
  private settings: GameSettings;
  private activeCharacter: CharacterId = 'dante';
  private characterCustomizations: Record<CharacterId, CharacterCustomization>;

  // Player Physics & Rig
  private playerRig: HumanoidRig;
  private playerPos = new THREE.Vector3(-18, 0.06, 36);
  private playerVel = new THREE.Vector3();
  private playerHeading = Math.PI; // facing North toward Downtown & parked cars
  private isGrounded = true;
  private isCrouching = false;
  private isSitting = false;
  private isProne = false;
  private animChar: CharacterAnimator | null = null;
  private modelLoadToken = 0;
  private isPhoneOut = false;
  private walkAnimPhase = 0;
  private footstepTimer = 0;
  private meleeTimer = 0;
  private currentFloorLabel: string | null = null;
  private insideBuildingName: string | null = null;

  // Stats & Economy
  private health = 100;
  private maxHealth = 100;
  private armor = 50;
  private stamina = 100;
  private cash = 6500;
  private bank = 15000;
  private score = 0;
  private comboMultiplier = 1;
  private comboTimer = 0;
  private driftScoreAccum = 0;
  private incomeTickTimer = 0;

  // Progression & Persistence
  private completedMissionIds: string[] = [];
  private collectedShardIds: string[] = [];
  private ownedPropertyIds: string[] = [];
  private ownedVehicles: OwnedVehicle[] = [
    {
      instanceId: 'owned_starter_apex',
      modelId: 'apex_rs',
      color: '#06b6d4',
      engineLevel: 1,
      armorLevel: 1,
      fuel: 90,
      health: 100,
      plate: 'PAC-001',
    },
  ];
  private inventory: InventoryItem[] = [
    { ...SHOP_CATALOG[0], quantity: 2 },
    { ...SHOP_CATALOG[2], quantity: 1 },
  ];

  // Camera
  private cameraMode: CameraMode = 'third-far';
  private camYaw = Math.PI;
  private camPitch = 0.24;
  private camDist = 6.8;
  private pointerLocked = false;
  private shakeIntensity = 0;
  private startMenuOrbitAngle = 0;

  // Vehicles, Traffic, NPCs & Police
  private vehicles: WorldVehicleInstance[] = [];
  private activeVehicle: WorldVehicleInstance | null = null;
  private npcs: WorldNPCInstance[] = [];
  private policeChopperGroup: THREE.Group;
  private policeChopperRotor: THREE.Group;
  private wantedLevel = 0;
  private policeSearching = false;
  private wantedSightLostTimer = 0;
  private arrestTimer = 0;
  private policeSpawnTimer = 0;

  // Environment, Time & Weather
  private timeOfDay = 10.5; // 10:30 AM crisp sunny start
  private weather: WeatherType = 'clear';
  private weatherTimer = 95;
  private trafficSignalTimer = 0;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rainLines: THREE.LineSegments;
  private lightningFlash = 0;

  // Particles & Score Popups
  private particles: ParticleItem[] = [];
  private scorePopups: ScorePopup[] = [];
  private nextPopupId = 1;

  // Missions, Cutscenes & GPS
  private missionMarkerMeshes: Map<string, THREE.Mesh> = new Map();
  private objectiveBeacon: THREE.Mesh;
  private activeMissionDef: MissionDefinition | null = null;
  private activeMissionStepIdx = 0;
  private cutsceneQueue: { speaker: string; text: string }[] = [];
  private cutsceneTimer = 0;
  private dialogueBanner: { speaker: string; text: string; timer: number } | null = null;
  private gpsTarget: [number, number] | null = [-24, 14]; // points to first mission right away!

  // Random World Event
  private worldEventPos = new THREE.Vector3(120, 0.8, -145);
  private worldEventActive = true;
  private worldEventMesh: THREE.Mesh;

  // Controls State (Keyboard + Mouse + Touch)
  private keys: Set<string> = new Set();
  public touchMove = { x: 0, y: 0 };
  public touchSprint = false;
  public touchBrake = false;
  public touchHandbrake = false;
  public touchAscend = false;
  public touchDescend = false;

  // Callbacks to React UI
  private onHudUpdate: (hud: HUDSnapshot) => void;
  private onModalRequest: (modal: UIModalTrigger) => void;
  private hudEmitTimer = 0;
  private currentPrompt: InteractivePrompt | null = null;
  private currentPromptAction: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    settings: GameSettings,
    onHudUpdate: (hud: HUDSnapshot) => void,
    onModalRequest: (modal: UIModalTrigger) => void
  ) {
    this.container = container;
    this.settings = settings;
    this.onHudUpdate = onHudUpdate;
    this.onModalRequest = onModalRequest;

    this.characterCustomizations = {
      dante: { ...PLAYABLE_CHARACTERS.dante.customization },
      elena: { ...PLAYABLE_CHARACTERS.elena.customization },
      marcus: { ...PLAYABLE_CHARACTERS.marcus.customization },
      bc2: { ...PLAYABLE_CHARACTERS.bc2.customization },
      bc4: { ...PLAYABLE_CHARACTERS.bc4.customization },
      boy: { ...PLAYABLE_CHARACTERS.boy.customization },
    };

    this.sound = new SoundEngine();
    this.sound.setVolumes(settings.masterVolume, settings.musicVolume, settings.sfxVolume);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: settings.graphics !== 'low', powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#60a5fa');
    this.scene.fog = new THREE.FogExp2('#93c5fd', 0.0014);

    // Soft studio-style environment reflections so metal, chrome and glass look realistic
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.2,
      1400
    );

    // Lighting
    this.hemiLight = new THREE.HemisphereLight('#bae6fd', '#334155', 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fffbeb', 1.65);
    this.sunLight.position.set(140, 220, 110);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 550;
    const shadowBound = 165;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 2;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Build Open World & Interiors
    const textures = buildProceduralTextures();
    this.world = constructOpenWorld(this.scene, textures);

    // Build Player Character
    this.playerRig = buildHumanoidRig(this.characterCustomizations[this.activeCharacter]);
    this.playerRig.root.position.copy(this.playerPos);
    this.scene.add(this.playerRig.root);
    void this.loadPlayerModel(this.activeCharacter);

    // Rain Particle Lines
    this.rainLines = this.createRainSystem();
    this.scene.add(this.rainLines);

    // Police SkyEye Search Chopper (visible at 3+ Wanted Stars)
    const { group: chopperGrp, rotor: chopperRot } = this.createPoliceChopper();
    this.policeChopperGroup = chopperGrp;
    this.policeChopperRotor = chopperRot;
    this.policeChopperGroup.visible = false;
    this.scene.add(this.policeChopperGroup);

    // Mission Start Beacons & Active Objective Beacon
    this.createMissionBeacons();
    this.objectiveBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 18, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#facc15',
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.objectiveBeacon.visible = false;
    this.scene.add(this.objectiveBeacon);

    // Random World Event Crate (Armored Supply Drop)
    this.worldEventMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.2, 1.5),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.75,
        metalness: 0.7,
        roughness: 0.2,
      })
    );
    this.worldEventMesh.position.copy(this.worldEventPos);
    this.scene.add(this.worldEventMesh);

    // Populate Hero Vehicles, AI Traffic & Intelligent NPCs
    this.spawnInitialVehicles();
    this.spawnTrafficVehicles();
    this.spawnCityNPCs();

    this.applySettings(settings);
    this.bindEvents();
    this.startLoop();
  }

  private createRainSystem(): THREE.LineSegments {
    const count = 900;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * 90;
      const ry = Math.random() * 45;
      const rz = (Math.random() - 0.5) * 90;
      positions[i * 6 + 0] = rx;
      positions[i * 6 + 1] = ry;
      positions[i * 6 + 2] = rz;
      positions[i * 6 + 3] = rx - 0.3;
      positions[i * 6 + 4] = ry - 1.7;
      positions[i * 6 + 5] = rz - 0.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.48 });
    const lines = new THREE.LineSegments(geo, mat);
    lines.visible = false;
    return lines;
  }

  private createPoliceChopper(): { group: THREE.Group; rotor: THREE.Group } {
    const group = new THREE.Group();
    const spec = VEHICLE_SPECS.skyhawk_heli;
    const rig = buildVehicleRig(spec, '#0f172a');
    group.add(rig.root);

    // Volumetric Searchlight Cone pointing down
    const coneGeo = new THREE.ConeGeometry(8.5, 36, 18, 1, true);
    coneGeo.translate(0, -18, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: '#fef9c3',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const spotlightCone = new THREE.Mesh(coneGeo, coneMat);
    spotlightCone.position.set(0, 0.5, 1.2);
    group.add(spotlightCone);

    return { group, rotor: rig.mainRotor! };
  }

  private createMissionBeacons(): void {
    for (const m of MISSIONS) {
      const color = m.category === 'main' ? '#facc15' : '#38bdf8';
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 3.2, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.position.set(m.startPos[0], m.startPos[1] + 1.6, m.startPos[2]);
      this.scene.add(ring);
      this.missionMarkerMeshes.set(m.id, ring);
    }
  }

  private spawnVehicleAt(
    modelId: string,
    x: number,
    y: number,
    z: number,
    heading: number,
    opts?: { color?: string; isTraffic?: boolean; isPolice?: boolean; ownedInstanceId?: string; engineLevel?: number }
  ): WorldVehicleInstance {
    const spec = VEHICLE_SPECS[modelId] || VEHICLE_SPECS.meridian_s;
    const rig = buildVehicleRig(spec, opts?.color);
    rig.root.position.set(x, y, z);
    rig.root.rotation.y = heading;
    this.scene.add(rig.root);

    const inst: WorldVehicleInstance = {
      id: 'veh_' + Math.random().toString(36).slice(2, 9),
      spec,
      rig,
      position: new THREE.Vector3(x, y, z),
      heading,
      speed: 0,
      verticalVel: 0,
      steerAngle: 0,
      fuel: spec.fuelCapacity,
      health: 100,
      engineLevel: opts?.engineLevel || 1,
      headlightsOn: false,
      doorOpenProgress: 0,
      isTraffic: !!opts?.isTraffic,
      isPoliceUnit: !!opts?.isPolice,
      ownedInstanceId: opts?.ownedInstanceId,
      nearMissCooldown: 0,
    };
    this.vehicles.push(inst);
    return inst;
  }

  private spawnInitialVehicles(): void {
    // Immediate fun right beside player spawn in Downtown Financial Plaza!
    this.spawnVehicleAt('valkyrie_gt', -8, 0.02, 28, Math.PI, { color: '#ef4444' });
    this.spawnVehicleAt('kestrel_900', -15, 0.02, 26, Math.PI, { color: '#10b981' });
    this.spawnVehicleAt('metro_bike', -23, 0.02, 30, Math.PI * 0.85, { color: '#38bdf8' });
    this.spawnVehicleAt('apex_rs', 26, 0.02, -25, -Math.PI * 0.5, {
      color: '#06b6d4',
      ownedInstanceId: 'owned_starter_apex',
    });

    // Horizon Tower 4F Rooftop Helicopter!
    this.spawnVehicleAt('skyhawk_heli', -63, 18.08, -58, 0, { color: '#0284c7' });

    // Pacifica International Airfield Helicopter & Supercar
    this.spawnVehicleAt('skyhawk_heli', 445, 0.05, -45, Math.PI * 0.5, { color: '#f59e0b' });
    this.spawnVehicleAt('valkyrie_gt', 465, 0.05, -15, 0, { color: '#eab308' });

    // Sunset Marina Pier Speedboats in Pacifica Bay!
    this.spawnVehicleAt('mako_boat', 16, -0.75, 485, 0, { color: '#f8fafc' });
    this.spawnVehicleAt('mako_boat', -18, -0.75, 488, 0, { color: '#38bdf8' });

    // District signature vehicles (Palm Hills SUV, Harbor Truck, Precinct Cruiser, Beach Pickup)
    this.spawnVehicleAt('titan_suv', -156, 0.02, -55, 0, { color: '#1e293b' });
    this.spawnVehicleAt('atlas_hauler', -210, 0.02, 165, Math.PI * 0.5, { color: '#ea580c' });
    this.spawnVehicleAt('ppd_interceptor', 180, 0.02, -28, -Math.PI * 0.5);
    this.spawnVehicleAt('canyon_4x4', 32, 0.02, 376, -Math.PI * 0.5, { color: '#f59e0b' });
  }

  private spawnTrafficVehicles(): void {
    const models = ['meridian_s', 'apex_rs', 'titan_suv', 'canyon_4x4', 'metro_bus', 'atlas_hauler'];
    const palette = ['#e2e8f0', '#3b82f6', '#dc2626', '#f59e0b', '#10b981', '#334155', '#f8fafc'];

    let idx = 0;
    for (const coord of [-240, -120, 0, 120, 240]) {
      // North-South lane traffic
      for (const dir of [1, -1] as const) {
        const laneX = coord + (dir === 1 ? -4.8 : 4.8);
        const z = -220 + ((idx * 97) % 440);
        const m = models[idx % models.length];
        const v = this.spawnVehicleAt(m, laneX, 0.02, z, dir === 1 ? 0 : Math.PI, {
          color: palette[idx % palette.length],
          isTraffic: true,
        });
        v.trafficAxis = 'z';
        v.trafficDir = dir;
        v.speed = 13;
        idx++;
      }
      // East-West lane traffic
      for (const dir of [1, -1] as const) {
        const laneZ = coord + (dir === 1 ? 4.8 : -4.8);
        const x = -220 + ((idx * 83) % 440);
        const m = models[idx % models.length];
        const v = this.spawnVehicleAt(m, x, 0.02, laneZ, dir === 1 ? Math.PI / 2 : -Math.PI / 2, {
          color: palette[idx % palette.length],
          isTraffic: true,
        });
        v.trafficAxis = 'x';
        v.trafficDir = dir;
        v.speed = 13;
        idx++;
      }
    }
  }

  private spawnCityNPCs(): void {
    const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
    const tops = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c', '#0f172a', '#e2e8f0'];
    const pants = ['#1e293b', '#334155', '#09090b', '#475569'];
    const hairs: CharacterCustomization['hairStyle'][] = ['short-fade', 'slick-back', 'ponytail', 'textured-crop', 'buzz'];

    for (let i = 0; i < 36; i++) {
      const custom: CharacterCustomization = {
        hairStyle: hairs[i % hairs.length],
        hairColor: i % 3 === 0 ? '#1c1917' : i % 3 === 1 ? '#78350f' : '#eab308',
        skinTone: skins[i % skins.length],
        jacketStyle: i % 2 === 0 ? 'casual-tee' : 'hoodie',
        jacketColor: tops[i % tops.length],
        shirtColor: tops[(i + 2) % tops.length],
        trouserStyle: 'slim-denim',
        trouserColor: pants[i % pants.length],
        shoeColor: '#f8fafc',
        accessory: i % 5 === 0 ? 'aviators' : 'none',
      };
      const isPoliceOfficer = i === 0 || i === 12;
      const rig = buildHumanoidRig(custom, isPoliceOfficer);

      const roadCoord = ROAD_COORDS[1 + (i % 5)];
      const sideOffset = i % 2 === 0 ? 13.8 : -13.8;
      const along = -260 + ((i * 67) % 520);
      const axis = i % 2 === 0 ? 'z' : 'x';
      const px = axis === 'z' ? roadCoord + sideOffset : along;
      const pz = axis === 'z' ? along : roadCoord + sideOffset;

      rig.root.position.set(px, 0.04, pz);
      this.scene.add(rig.root);

      const behavior: WorldNPCInstance['behavior'] =
        i % 9 === 0 ? 'phone' : i % 7 === 0 ? 'chat' : 'walk';

      this.npcs.push({
        id: 'npc_' + i,
        rig,
        position: new THREE.Vector3(px, 0.04, pz),
        heading: i % 2 === 0 ? 0 : Math.PI * 0.5,
        speed: 1.55 + (i % 5) * 0.18,
        behavior,
        timer: 4 + (i % 8),
        walkPhase: i * 0.7,
        homeAxis: axis,
        fleeTimer: 0,
      });
    }
  }

  public applySettings(newSettings: GameSettings): void {
    this.settings = { ...newSettings };
    SaveManager.saveSettings(this.settings);
    this.sound.setVolumes(
      this.settings.masterVolume,
      this.settings.musicVolume,
      this.settings.sfxVolume
    );

    const preset = this.settings.graphics;
    const dpr =
      preset === 'low'
        ? 1
        : preset === 'medium'
        ? Math.min(1.35, window.devicePixelRatio || 1)
        : Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);

    this.renderer.shadowMap.enabled = preset !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sunLight.shadow.radius = preset === 'ultra' ? 4 : preset === 'high' ? 3 : 1;
    this.scene.environmentIntensity = preset === 'low' ? 0.2 : preset === 'medium' ? 0.4 : 0.55;

    const shadowRes = preset === 'ultra' ? 2048 : preset === 'high' ? 1024 : 512;
    if (this.sunLight.shadow.mapSize.width !== shadowRes) {
      this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null;
      }
    }

    this.camera.far = preset === 'low' ? 650 : preset === 'medium' ? 950 : 1450;
    this.camera.updateProjectionMatrix();
  }

  public startNewGame(character?: CharacterId): void {
    this.sound.unlock();
    if (character) {
      this.switchCharacter(character, true);
    }
    this.health = 100;
    this.armor = 50;
    this.stamina = 100;
    this.wantedLevel = 0;
    this.policeSearching = false;
    this.gamePhase = 'playing';
    this.showDialogue(
      'Port Pacifica Welcome',
      'Press [E] by the Valkyrie GT or Sportbike ahead to drive, walk into Horizon Tower to ride the 4F Elevator, or step into the Gold Mission Beacon!'
    );
    this.emitHud();
  }

  public resumeGame(): void {
    this.sound.unlock();
    if (this.gamePhase === 'paused') {
      this.gamePhase = 'playing';
      this.emitHud();
    }
  }

  public pauseGame(): void {
    if (this.gamePhase === 'playing') {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.gamePhase = 'paused';
      this.emitHud();
    }
  }

  public instantRestart(): void {
    this.sound.unlock();
    if (this.activeVehicle) {
      this.exitVehicle();
    }
    const profile = PLAYABLE_CHARACTERS[this.activeCharacter];
    this.playerPos.set(profile.defaultPos[0], 0.06, profile.defaultPos[2]);
    this.playerVel.set(0, 0, 0);
    this.health = 100;
    this.armor = 50;
    this.stamina = 100;
    this.score = 0;
    this.comboMultiplier = 1;
    this.wantedLevel = 0;
    this.policeSearching = false;
    this.clearPoliceUnits();
    this.gamePhase = 'playing';
    this.emitHud();
  }

  public recoverAfterWastedOrBusted(): void {
    this.sound.unlock();
    if (this.activeVehicle) {
      this.exitVehicle();
    }
    const isBusted = this.gamePhase === 'busted';
    const fee = Math.min(this.cash, isBusted ? 350 : 150);
    this.cash = Math.max(0, this.cash - fee);
    this.health = 100;
    this.stamina = 100;
    this.wantedLevel = 0;
    this.policeSearching = false;
    this.clearPoliceUnits();

    // Respawn outside Pacifica General Hospital or PPD Central Precinct!
    if (isBusted) {
      this.playerPos.set(180, 0.06, -32);
      this.showDialogue('PPD Dispatch', `Released on bail (-$${fee}). Keep it clean on the boulevards.`);
    } else {
      this.playerPos.set(180, 0.06, 155);
      this.showDialogue('Pacifica Medical', `Discharged at full health (-$${fee} medical co-pay).`);
    }
    this.gamePhase = 'playing';
    this.emitHud();
  }

  public switchCharacter(charId: CharacterId, teleportToDefault = false): void {
    this.activeCharacter = charId;
    this.setAnimCharacter(null);
    this.rebuildPlayerAppearance();
    void this.loadPlayerModel(charId);
    if (teleportToDefault && !this.activeVehicle) {
      const def = PLAYABLE_CHARACTERS[charId].defaultPos;
      this.playerPos.set(def[0], 0.06, def[2]);
    }
    this.sound.playUiClick(780);
    this.emitHud();
  }

  public updateCustomization(patch: Partial<CharacterCustomization>, cost = 0): boolean {
    if (cost > 0 && this.cash < cost) return false;
    if (cost > 0) {
      this.cash -= cost;
      this.sound.playCashSound();
    }
    this.characterCustomizations[this.activeCharacter] = {
      ...this.characterCustomizations[this.activeCharacter],
      ...patch,
    };
    this.rebuildPlayerAppearance();
    this.autoSave();
    this.emitHud();
    return true;
  }

  public getActiveCustomization(): CharacterCustomization {
    return this.characterCustomizations[this.activeCharacter];
  }

  private rebuildPlayerAppearance(): void {
    const wasVisible = this.playerRig.root.visible;
    this.scene.remove(this.playerRig.root);
    this.playerRig = buildHumanoidRig(this.characterCustomizations[this.activeCharacter]);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerHeading;
    this.playerRig.root.visible = wasVisible;
    this.scene.add(this.playerRig.root);
    this.attachAnimCharacter();
  }

  // --- 3D CHARACTER MODEL & ANIMATIONS ---

  private async loadPlayerModel(charId: CharacterId): Promise<void> {
    const model = PLAYABLE_CHARACTERS[charId].model;
    const token = ++this.modelLoadToken;
    if (!model) {
      this.setAnimCharacter(null);
      return;
    }
    try {
      const next = await CharacterAnimator.load(model.url, PLAYER_ANIMATIONS);
      if (token !== this.modelLoadToken) {
        next.dispose();
        return;
      }
      this.setAnimCharacter(next);
    } catch (err) {
      console.warn('[Player] Model failed to load, using default body', err);
      if (token === this.modelLoadToken) this.setAnimCharacter(null);
    }
  }

  private setAnimCharacter(next: CharacterAnimator | null): void {
    this.animChar?.dispose();
    this.animChar = next;
    this.attachAnimCharacter();
  }

  /** Shows the 3D model and hides the procedural body under the same rig root. */
  private attachAnimCharacter(): void {
    const rig = this.playerRig.root;
    rig.children.forEach((child) => {
      if (child !== this.animChar?.root) child.visible = !this.animChar;
    });
    if (this.animChar) {
      rig.add(this.animChar.root);
      this.animChar.root.visible = true;
    }
  }

  private updateAnimCharacter(dt: number, horizSpeed: number): void {
    const anim = this.animChar;
    if (!anim) return;
    let clip: AnimName;
    if (this.isProne) clip = 'prone';
    else if (this.isSitting) clip = 'sit';
    else if (!this.isGrounded) clip = 'jump';
    else if (horizSpeed > 5.5) clip = 'run';
    else if (horizSpeed > 0.4) clip = 'walk';
    else clip = 'idle';
    anim.play(clip, { loop: clip !== 'jump' && clip !== 'sit' });
    anim.update(dt);
  }

  private toggleProne(): void {
    if (this.gamePhase !== 'playing' || !this.animChar) return;
    if (this.activeVehicle || this.isSitting || !this.isGrounded) return;
    this.isProne = !this.isProne;
  }

  // --- ECONOMY, SHOPS, DEALERSHIP, GARAGE & PROPERTIES ---

  public buyShopItem(itemId: string): boolean {
    const item = SHOP_CATALOG.find((i) => i.id === itemId);
    if (!item || this.cash < item.price) return false;
    this.cash -= item.price;
    this.sound.playCashSound();

    if (item.id === 'item_armor_vest') {
      this.armor = 100;
    } else {
      const existing = this.inventory.find((inv) => inv.id === item.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        this.inventory.push({ ...item, quantity: 1 });
      }
    }
    this.addScore('Shop Purchase', 50, '#34d399');
    this.autoSave();
    this.emitHud();
    return true;
  }

  public useInventoryItem(itemId: string): void {
    const idx = this.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const item = this.inventory[idx];

    if (item.healAmount) {
      this.health = Math.min(this.maxHealth, this.health + item.healAmount);
    }
    if (item.staminaAmount) {
      this.stamina = Math.min(100, this.stamina + item.staminaAmount);
    }
    if (item.fuelAmount) {
      const targetVeh = this.activeVehicle || this.findNearestVehicle(8);
      if (targetVeh) {
        targetVeh.fuel = Math.min(targetVeh.spec.fuelCapacity, targetVeh.fuel + item.fuelAmount);
      }
    }

    item.quantity -= 1;
    if (item.quantity <= 0) {
      this.inventory.splice(idx, 1);
    }
    this.sound.playUiClick(880);
    this.emitHud();
  }

  public dropInventoryItem(itemId: string): void {
    const idx = this.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const item = this.inventory[idx];
    if (!item.droppable) return;

    item.quantity -= 1;
    if (item.quantity <= 0) this.inventory.splice(idx, 1);

    // Spawn physical pickup box in front of player!
    const dropPos = this.playerPos
      .clone()
      .add(new THREE.Vector3(Math.sin(this.playerHeading) * 1.6, 0.35, Math.cos(this.playerHeading) * 1.6));
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.5 })
    );
    mesh.position.copy(dropPos);
    this.scene.add(mesh);

    const dropNodeId = 'dropped_' + Date.now();
    this.world.interactables.push({
      id: dropNodeId,
      position: dropPos,
      radius: 2.4,
      mesh,
      collected: false,
      prompt: {
        id: 'prompt_' + dropNodeId,
        title: item.name,
        subtitle: 'Pick Up Item',
        actionKey: 'E',
        actionType: 'collect-item',
        targetId: dropNodeId,
      },
    });
    this.emitHud();
  }

  public purchaseVehicle(modelId: string, color: string): boolean {
    const spec = VEHICLE_SPECS[modelId];
    if (!spec) return false;
    const totalAvailable = this.cash + this.bank;
    if (totalAvailable < spec.price) return false;

    if (this.cash >= spec.price) {
      this.cash -= spec.price;
    } else {
      const rem = spec.price - this.cash;
      this.cash = 0;
      this.bank -= rem;
    }

    const instanceId = 'owned_' + Date.now().toString(36);
    const newOwned: OwnedVehicle = {
      instanceId,
      modelId,
      color,
      engineLevel: 1,
      armorLevel: 1,
      fuel: spec.fuelCapacity,
      health: 100,
      plate: 'HRZ-' + Math.floor(100 + Math.random() * 899),
    };
    this.ownedVehicles.push(newOwned);
    this.sound.playCashSound();
    this.addScore(`Purchased ${spec.name}!`, 1200, '#facc15');
    this.summonOwnedVehicle(instanceId);
    this.autoSave();
    this.emitHud();
    return true;
  }

  public summonOwnedVehicle(instanceId: string): void {
    const owned = this.ownedVehicles.find((v) => v.instanceId === instanceId);
    if (!owned) return;
    const spec = VEHICLE_SPECS[owned.modelId];
    if (!spec) return;

    // Remove previous world instance if already spawned
    const existingIdx = this.vehicles.findIndex((v) => v.ownedInstanceId === instanceId);
    if (existingIdx !== -1 && this.vehicles[existingIdx] !== this.activeVehicle) {
      this.scene.remove(this.vehicles[existingIdx].rig.root);
      this.vehicles.splice(existingIdx, 1);
    }

    let sx = this.playerPos.x + Math.sin(this.playerHeading) * 6.5;
    let sz = this.playerPos.z + Math.cos(this.playerHeading) * 6.5;
    let sy = Math.max(0.05, getTerrainElevation(sx, sz));
    if (spec.category === 'boat') {
      sx = 16;
      sz = 485;
      sy = -0.75;
      this.gpsTarget = [sx, sz];
      this.showDialogue('Marina Valet', `${spec.name} moored at Sunset Marina Pier! GPS updated.`);
    } else {
      this.showDialogue('Horizon Garage Valet', `Your ${spec.name} (${owned.plate}) has been delivered nearby.`);
    }

    this.spawnVehicleAt(owned.modelId, sx, sy, sz, this.playerHeading, {
      color: owned.color,
      ownedInstanceId: owned.instanceId,
      engineLevel: owned.engineLevel,
    });
    this.sound.playHorn(false);
    this.emitHud();
  }

  public customizeActiveOrOwnedVehicle(opts: {
    color?: string;
    repair?: boolean;
    refuel?: boolean;
    upgradeEngine?: boolean;
    cost: number;
  }): boolean {
    if (this.cash < opts.cost) return false;
    const target = this.activeVehicle || this.findNearestVehicle(12);
    if (!target) return false;

    this.cash -= opts.cost;
    this.sound.playCashSound();

    if (opts.color) {
      target.rig.paintMaterial.color.set(opts.color);
      if (target.ownedInstanceId) {
        const rec = this.ownedVehicles.find((o) => o.instanceId === target.ownedInstanceId);
        if (rec) rec.color = opts.color;
      }
    }
    if (opts.repair) {
      target.health = 100;
      target.rig.bodyGroup.scale.set(1, 1, 1);
    }
    if (opts.refuel) {
      target.fuel = target.spec.fuelCapacity;
    }
    if (opts.upgradeEngine) {
      target.engineLevel = Math.min(3, target.engineLevel + 1);
      if (target.ownedInstanceId) {
        const rec = this.ownedVehicles.find((o) => o.instanceId === target.ownedInstanceId);
        if (rec) rec.engineLevel = target.engineLevel;
      }
    }
    this.addScore('Customs Upgrade', 350, '#f59e0b');
    this.autoSave();
    this.emitHud();
    return true;
  }

  public bankTransfer(amount: number, direction: 'deposit' | 'withdraw'): boolean {
    if (direction === 'deposit') {
      const amt = Math.min(this.cash, amount);
      if (amt <= 0) return false;
      this.cash -= amt;
      this.bank += amt;
    } else {
      const amt = Math.min(this.bank, amount);
      if (amt <= 0) return false;
      this.bank -= amt;
      this.cash += amt;
    }
    this.sound.playCashSound();
    this.emitHud();
    return true;
  }

  public buyProperty(propertyId: string): boolean {
    if (this.ownedPropertyIds.includes(propertyId)) return false;
    const prop = PROPERTIES.find((p) => p.id === propertyId);
    if (!prop) return false;

    const total = this.cash + this.bank;
    if (total < prop.price) return false;

    if (this.cash >= prop.price) {
      this.cash -= prop.price;
    } else {
      const rem = prop.price - this.cash;
      this.cash = 0;
      this.bank -= rem;
    }
    this.ownedPropertyIds.push(propertyId);
    this.sound.playMissionFanfare();
    this.addScore(`Property Acquired: ${prop.name}`, 2500, '#eab308');
    this.showDialogue('Pacifica Realty', `Congratulations! You now own ${prop.name} (+$${prop.dailyIncome}/day passive income).`);
    this.autoSave();
    this.emitHud();
    return true;
  }

  public rideElevatorToFloor(elevatorId: string, floorLevel: number): void {
    const elev = this.world.elevators.find((e) => e.id === elevatorId);
    if (!elev) return;
    const fl = elev.floors.find((f) => f.level === floorLevel);
    if (!fl) return;

    // Position player smoothly onto the glass elevator platform so they physically ride it!
    this.playerPos.x = elev.centerX;
    this.playerPos.z = elev.centerZ;
    this.playerPos.y = elev.currentY + 0.18;
    elev.targetY = fl.y;
    this.sound.playElevatorDing();
    this.showDialogue(elev.buildingName, `Riding glass elevator to ${fl.label}...`);
    this.emitHud();
  }

  public setGpsWaypoint(pos: [number, number] | null): void {
    this.gpsTarget = pos;
    this.sound.playUiClick(700);
    this.emitHud();
  }

  public setWeatherManual(w: WeatherType): void {
    this.weather = w;
    this.weatherTimer = 120;
    if (w === 'thunderstorm') this.sound.playThunder();
    this.emitHud();
  }

  public toggleCameraMode(): void {
    const order: CameraMode[] = ['third-far', 'third-close', 'first-person'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    this.sound.playUiClick(680);
    this.emitHud();
  }

  public togglePhone(): void {
    this.isPhoneOut = !this.isPhoneOut;
    this.playerRig.phoneMesh.visible = this.isPhoneOut;
    this.sound.playUiClick(this.isPhoneOut ? 840 : 540);
    this.emitHud();
  }

  // --- MISSIONS & STORY CAMPAIGN ---

  public startMissionById(missionId: string): void {
    const m = MISSIONS.find((x) => x.id === missionId);
    if (!m) return;
    this.activeMissionDef = m;
    this.activeMissionStepIdx = 0;
    this.cutsceneQueue = [...m.cutsceneIntro];
    this.cutsceneTimer = 3.6;
    this.gamePhase = 'cutscene';
    this.gpsTarget = [m.steps[0].targetPos[0], m.steps[0].targetPos[2]];
    this.sound.playUiClick(920);
    this.emitHud();
  }

  private advanceMissionStep(): void {
    if (!this.activeMissionDef) return;
    const currentStep = this.activeMissionDef.steps[this.activeMissionStepIdx];
    if (currentStep.spawnWanted && this.wantedLevel < currentStep.spawnWanted) {
      this.raiseWantedLevel(currentStep.spawnWanted);
    }

    this.activeMissionStepIdx++;
    if (this.activeMissionStepIdx >= this.activeMissionDef.steps.length) {
      // Mission Complete!
      const m = this.activeMissionDef;
      this.cash += m.cashReward;
      this.addScore(`MISSION PASSED: ${m.title}`, m.scoreReward, '#facc15');
      if (!this.completedMissionIds.includes(m.id)) {
        this.completedMissionIds.push(m.id);
      }
      this.sound.playMissionFanfare();
      this.showDialogue('MISSION COMPLETE', `${m.title} cleared! Earned +$${m.cashReward.toLocaleString()} & +${m.scoreReward} PTS.`);
      this.activeMissionDef = null;
      this.objectiveBeacon.visible = false;

      // Point GPS to next uncompleted mission automatically
      const nextM = MISSIONS.find((cand) => !this.completedMissionIds.includes(cand.id));
      this.gpsTarget = nextM ? [nextM.startPos[0], nextM.startPos[2]] : null;
      this.autoSave();
    } else {
      const nextStep = this.activeMissionDef.steps[this.activeMissionStepIdx];
      this.gpsTarget = [nextStep.targetPos[0], nextStep.targetPos[2]];
      this.sound.playElevatorDing();
      if (nextStep.dialogueSpeaker && nextStep.dialogueLine) {
        this.showDialogue(nextStep.dialogueSpeaker, nextStep.dialogueLine);
      }
      this.addScore('Checkpoint Reached', 400, '#38bdf8');
    }
    this.emitHud();
  }

  // --- SAVE / LOAD & MULTIPLAYER SYNC SNAPSHOT ---

  public buildSaveData(slotId: string, label: string): SaveSlotData {
    return {
      slotId,
      label,
      savedAt: new Date().toLocaleString(),
      activeCharacter: this.activeCharacter,
      characterCustomizations: JSON.parse(JSON.stringify(this.characterCustomizations)),
      playerPos: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
      cash: this.cash,
      bank: this.bank,
      score: this.score,
      health: this.health,
      armor: this.armor,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      completedMissionIds: [...this.completedMissionIds],
      collectedShardIds: [...this.collectedShardIds],
      ownedPropertyIds: [...this.ownedPropertyIds],
      ownedVehicles: JSON.parse(JSON.stringify(this.ownedVehicles)),
      inventory: JSON.parse(JSON.stringify(this.inventory)),
    };
  }

  public saveToSlot(slotId: string, label: string): void {
    SaveManager.saveSlot(slotId, this.buildSaveData(slotId, label));
    this.sound.playUiClick(900);
  }

  public autoSave(): void {
    SaveManager.saveSlot('autosave', this.buildSaveData('autosave', 'Auto-Save'));
  }

  public loadFromSlot(slotId: string): boolean {
    const data = SaveManager.loadSlot(slotId);
    if (!data) return false;
    this.sound.unlock();
    if (this.activeVehicle) this.exitVehicle();

    this.activeCharacter = data.activeCharacter;
    this.characterCustomizations = data.characterCustomizations;
    this.rebuildPlayerAppearance();

    this.playerPos.set(data.playerPos[0], data.playerPos[1] + 0.1, data.playerPos[2]);
    this.cash = data.cash;
    this.bank = data.bank;
    this.score = data.score;
    this.health = data.health;
    this.armor = data.armor;
    this.timeOfDay = data.timeOfDay;
    this.weather = data.weather;
    this.completedMissionIds = [...data.completedMissionIds];
    this.collectedShardIds = [...data.collectedShardIds];
    this.ownedPropertyIds = [...data.ownedPropertyIds];
    this.ownedVehicles = [...data.ownedVehicles];
    this.inventory = [...data.inventory];

    // Sync world collectible meshes
    for (const node of this.world.interactables) {
      if (this.collectedShardIds.includes(node.id)) {
        node.collected = true;
        if (node.mesh) node.mesh.visible = false;
      }
    }

    this.wantedLevel = 0;
    this.gamePhase = 'playing';
    this.showDialogue('Horizon Save System', `Loaded ${data.label} (${data.savedAt}).`);
    this.emitHud();
    return true;
  }

  public getMultiplayerSyncSnapshot(): NetSessionSnapshot {
    return {
      sessionId: 'pacifica-local-authority-01',
      hostTick: Math.floor(performance.now() / 16),
      timeOfDay: Number(this.timeOfDay.toFixed(2)),
      weather: this.weather,
      players: [
        {
          peerId: 'local_player_01',
          profileName: PLAYABLE_CHARACTERS[this.activeCharacter].name,
          characterId: this.activeCharacter,
          position: [
            Number(this.playerPos.x.toFixed(2)),
            Number(this.playerPos.y.toFixed(2)),
            Number(this.playerPos.z.toFixed(2)),
          ],
          rotationY: Number(this.playerHeading.toFixed(2)),
          animState: this.activeVehicle ? 'driving' : this.isSitting ? 'sitting' : 'locomotion',
          vehicleInstanceId: this.activeVehicle ? this.activeVehicle.id : null,
          wantedLevel: this.wantedLevel,
          timestamp: Date.now(),
        },
      ],
    };
  }

  // --- INPUT & INTERACTION EXECUTION ---

  public triggerPrimaryInteraction(): void {
    this.sound.unlock();
    if (this.gamePhase === 'cutscene') {
      this.skipCutscene();
      return;
    }
    if (this.gamePhase !== 'playing') return;

    if (this.activeVehicle) {
      this.exitVehicle();
      return;
    }
    if (this.isSitting) {
      this.isSitting = false;
      this.emitHud();
      return;
    }
    if (this.currentPromptAction) {
      this.currentPromptAction();
    }
  }

  public triggerMeleeOrHorn(): void {
    this.sound.unlock();
    if (this.gamePhase !== 'playing') return;
    if (this.activeVehicle) {
      this.sound.playHorn(this.activeVehicle.spec.category === 'emergency');
      return;
    }
    if (this.meleeTimer <= 0) {
      this.meleeTimer = 0.42;
      this.sound.playMelee(false);
      this.performMeleeCheck();
    }
  }

  public triggerJumpOrHandbrake(): void {
    this.sound.unlock();
    if (this.gamePhase !== 'playing') return;
    if (!this.activeVehicle && this.isGrounded) {
      this.isSitting = false;
      this.playerVel.y = 7.8;
      this.isGrounded = false;
    }
  }

  private performMeleeCheck(): void {
    const hitPoint = this.playerPos
      .clone()
      .add(new THREE.Vector3(Math.sin(this.playerHeading) * 1.4, 0.9, Math.cos(this.playerHeading) * 1.4));

    let hitSomething = false;
    for (const npc of this.npcs) {
      if (npc.position.distanceTo(hitPoint) < 1.8) {
        hitSomething = true;
        npc.behavior = 'flee';
        npc.fleeTimer = 14;
        npc.heading = Math.atan2(npc.position.x - this.playerPos.x, npc.position.z - this.playerPos.z);
        this.spawnBurstParticles(hitPoint, '#facc15', 8);
        this.shakeIntensity = 0.25;
        this.sound.playMelee(true);
        // Alert nearby NPCs & witness report
        this.alertNearbyNPCs(this.playerPos, 28);
        this.raiseWantedLevel(Math.max(1, this.wantedLevel));
        break;
      }
    }

    for (const veh of this.vehicles) {
      if (veh.position.distanceTo(hitPoint) < 2.8) {
        hitSomething = true;
        veh.health = Math.max(10, veh.health - 8);
        this.spawnBurstParticles(hitPoint, '#fb923c', 10);
        this.shakeIntensity = 0.22;
        this.sound.playCollision(0.4);
        break;
      }
    }
    if (hitSomething) this.emitHud();
  }

  private alertNearbyNPCs(origin: THREE.Vector3, radius: number): void {
    for (const npc of this.npcs) {
      if (npc.position.distanceTo(origin) < radius) {
        npc.behavior = 'flee';
        npc.fleeTimer = 12;
        npc.heading = Math.atan2(npc.position.x - origin.x, npc.position.z - origin.z);
      }
    }
  }

  private enterVehicle(veh: WorldVehicleInstance): void {
    if (veh.isTraffic) {
      // Hijacking an active traffic car alerts witnesses!
      veh.isTraffic = false;
      this.alertNearbyNPCs(veh.position, 26);
      if (Math.random() > 0.35) {
        this.raiseWantedLevel(Math.max(1, this.wantedLevel));
        this.showDialogue('PPD Dispatch', '10-31 Grand Theft Auto reported in ' + getDistrictAt(veh.position.x, veh.position.z).name + '!');
      }
    }
    this.activeVehicle = veh;
    this.isSitting = false;
    this.isPhoneOut = false;
    veh.doorOpenProgress = 1.0;
    veh.headlightsOn = this.isNightTime();
    this.playerRig.root.visible = veh.spec.category === 'motorcycle' || veh.spec.category === 'bicycle';
    this.sound.playDoor(true);
    this.camYaw = veh.heading + Math.PI;
    this.emitHud();
  }

  private exitVehicle(): void {
    if (!this.activeVehicle) return;
    const veh = this.activeVehicle;
    veh.doorOpenProgress = 1.0;
    this.sound.playDoor(false);

    const sideOffset = veh.spec.dimensions[0] * 0.5 + 1.15;
    const exitX = veh.position.x - Math.cos(veh.heading) * sideOffset;
    const exitZ = veh.position.z + Math.sin(veh.heading) * sideOffset;
    this.playerPos.set(exitX, Math.max(0.06, veh.position.y + 0.15), exitZ);
    this.playerHeading = veh.heading;
    this.playerVel.set(0, 0, 0);
    this.playerRig.root.visible = true;
    this.activeVehicle = null;
    this.emitHud();
  }

  private findNearestVehicle(maxDist: number): WorldVehicleInstance | null {
    let best: WorldVehicleInstance | null = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      const d = v.position.distanceTo(this.playerPos);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // --- WANTED & POLICE AI ---

  public raiseWantedLevel(minLevel: number): void {
    const target = Math.min(5, Math.max(this.wantedLevel, minLevel));
    this.wantedLevel = target;
    this.policeSearching = false;
    this.wantedSightLostTimer = 0;
  }

  private clearPoliceUnits(): void {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      if (this.vehicles[i].isPoliceUnit && this.vehicles[i] !== this.activeVehicle) {
        this.scene.remove(this.vehicles[i].rig.root);
        this.vehicles.splice(i, 1);
      }
    }
    this.policeChopperGroup.visible = false;
  }

  private updatePoliceSimulation(dt: number): void {
    if (this.wantedLevel <= 0) {
      this.policeChopperGroup.visible = false;
      this.arrestTimer = 0;
      return;
    }

    const activePursuitPos = this.activeVehicle ? this.activeVehicle.position : this.playerPos;
    const desiredUnits = Math.min(4, this.wantedLevel);
    const activeUnits = this.vehicles.filter((v) => v.isPoliceUnit && v !== this.activeVehicle);

    this.policeSpawnTimer -= dt;
    if (activeUnits.length < desiredUnits && this.policeSpawnTimer <= 0) {
      this.policeSpawnTimer = 4.5;
      const angle = Math.random() * Math.PI * 2;
      const dist = 68 + Math.random() * 25;
      const sx = activePursuitPos.x + Math.sin(angle) * dist;
      const sz = activePursuitPos.z + Math.cos(angle) * dist;
      if (sz < 395) {
        const unit = this.spawnVehicleAt(
          'ppd_interceptor',
          sx,
          0.04,
          sz,
          Math.atan2(activePursuitPos.x - sx, activePursuitPos.z - sz),
          { isPolice: true }
        );
        unit.speed = 24;
      }
    }

    let anyHasLineOfSight = false;
    const flash = Math.sin(performance.now() * 0.018) > 0;

    for (const cop of activeUnits) {
      const dx = activePursuitPos.x - cop.position.x;
      const dz = activePursuitPos.z - cop.position.z;
      const dist = Math.hypot(dx, dz);

      // Flash police lightbar
      if (cop.rig.policeRedLight && cop.rig.policeBlueLight) {
        (cop.rig.policeRedLight.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 2.0 : 0.2;
        (cop.rig.policeBlueLight.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.2 : 2.0;
      }

      if (dist < 62 && !this.insideBuildingName) {
        anyHasLineOfSight = true;
      }

      // Steer toward player
      const targetAngle = Math.atan2(dx, dz);
      let angleDiff = targetAngle - cop.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      cop.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, angleDiff * 2.5 * dt));
      const targetSpd = dist > 10 ? 28 + this.wantedLevel * 3.5 : 8;
      cop.speed += (targetSpd - cop.speed) * 2.2 * dt;

      cop.position.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.position.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.position.y = Math.max(0.02, getTerrainElevation(cop.position.x, cop.position.z));
      cop.rig.root.position.copy(cop.position);
      cop.rig.root.rotation.y = cop.heading;

      // Ram collision check with player vehicle or player on foot
      if (this.activeVehicle && dist < 3.6 && Math.abs(this.activeVehicle.position.y - cop.position.y) < 2.2) {
        this.activeVehicle.health = Math.max(0, this.activeVehicle.health - 12 * dt);
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.18);
      } else if (!this.activeVehicle && dist < 3.8 && !this.insideBuildingName) {
        // Arrest timer if cornered at low speed on foot!
        if (this.playerVel.length() < 3.5) {
          this.arrestTimer += dt;
          if (this.arrestTimer > 2.8) {
            this.triggerGameOver('busted');
            return;
          }
        } else {
          this.arrestTimer = Math.max(0, this.arrestTimer - dt);
        }
      }

      // Despawn far-behind police unit so a fresh unit can spawn ahead
      if (dist > 185) {
        this.scene.remove(cop.rig.root);
        const idx = this.vehicles.indexOf(cop);
        if (idx !== -1) this.vehicles.splice(idx, 1);
      }
    }

    // 3+ Star Police SkyEye Helicopter overhead!
    if (this.wantedLevel >= 3) {
      this.policeChopperGroup.visible = true;
      const t = performance.now() * 0.0008;
      this.policeChopperGroup.position.set(
        activePursuitPos.x + Math.cos(t) * 16,
        activePursuitPos.y + 34,
        activePursuitPos.z + Math.sin(t) * 16
      );
      this.policeChopperGroup.lookAt(activePursuitPos.x, activePursuitPos.y + 32, activePursuitPos.z);
      this.policeChopperRotor.rotation.y += dt * 24;
      if (!this.insideBuildingName) {
        anyHasLineOfSight = true;
      }
    } else {
      this.policeChopperGroup.visible = false;
    }

    // Search & Evade Cooldown
    if (!anyHasLineOfSight) {
      this.policeSearching = true;
      this.wantedSightLostTimer += dt;
      const needed = 9 + this.wantedLevel * 3;
      if (this.wantedSightLostTimer >= needed) {
        const bonus = this.wantedLevel * 650;
        this.wantedLevel = 0;
        this.policeSearching = false;
        this.wantedSightLostTimer = 0;
        this.clearPoliceUnits();
        this.addScore('EVADED PPD PURSUIT!', bonus, '#38bdf8');
        this.sound.playElevatorDing();
      }
    } else {
      this.policeSearching = false;
      this.wantedSightLostTimer = Math.max(0, this.wantedSightLostTimer - dt * 0.5);
    }
  }

  private triggerGameOver(reason: 'wasted' | 'busted'): void {
    if (this.gamePhase === 'wasted' || this.gamePhase === 'busted') return;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.gamePhase = reason;
    SaveManager.submitHighScore({
      playerName: PLAYABLE_CHARACTERS[this.activeCharacter].name,
      character: this.activeCharacter,
      score: Math.floor(this.score),
      cashEarned: Math.floor(this.cash + this.bank),
      missionsCompleted: this.completedMissionIds.length,
    });
    this.sound.playCollision(0.9);
    this.emitHud();
  }

  // --- SCORE, PARTICLES & DIALOGUE ---

  public addScore(label: string, basePoints: number, color = '#38bdf8'): void {
    const pts = Math.round(basePoints * this.comboMultiplier);
    this.score += pts;
    this.comboTimer = 5.5;
    this.comboMultiplier = Math.min(5.0, Number((this.comboMultiplier + 0.25).toFixed(2)));

    this.scorePopups.push({
      id: this.nextPopupId++,
      label,
      points: pts,
      multiplier: this.comboMultiplier,
      color,
    });
    if (this.scorePopups.length > 5) {
      this.scorePopups.shift();
    }
  }

  public showDialogue(speaker: string, text: string): void {
    this.dialogueBanner = { speaker, text, timer: 5.5 };
  }

  private skipCutscene(): void {
    this.cutsceneQueue = [];
    this.gamePhase = 'playing';
    if (this.activeMissionDef) {
      const first = this.activeMissionDef.steps[0];
      if (first.dialogueSpeaker && first.dialogueLine) {
        this.showDialogue(first.dialogueSpeaker, first.dialogueLine);
      }
    }
    this.emitHud();
  }

  private spawnBurstParticles(origin: THREE.Vector3, color: string, count: number): void {
    const maxBudget = this.settings.graphics === 'low' ? 25 : 85;
    if (this.particles.length > maxBudget) return;

    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({ color });

    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(origin);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          1.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * 6
        ),
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        scaleRate: -0.9,
      });
    }
  }

  // --- MAIN FRAME LOOP ---

  private startLoop(): void {
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      // FPS tracker
      this.fpsAccum += rawDt;
      this.fpsFrames++;
      if (this.fpsAccum >= 0.5) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      this.updateEnvironmentAndWeather(dt);
      this.updateTrafficAndSignals(dt);
      this.updateNPCs(dt);
      this.updateDoorsAndElevators(dt);

      if (this.gamePhase === 'start') {
        this.updateStartScreenCamera(dt);
      } else if (this.gamePhase === 'cutscene') {
        this.updateCutscene(dt);
      } else if (this.gamePhase === 'playing') {
        this.pollGamepad(dt);
        if (this.activeVehicle) {
          this.updateActiveVehiclePhysics(dt);
        } else {
          this.updatePlayerOnFoot(dt);
        }
        this.updatePoliceSimulation(dt);
        this.updateMissionsAndEvents(dt);
        this.scanNearbyInteractables();
        this.updateGameplayCamera(dt);
      }

      this.updateParticlesAndTimers(dt);
      this.renderer.render(this.scene, this.camera);

      this.hudEmitTimer += dt;
      if (this.hudEmitTimer >= 0.1) {
        this.hudEmitTimer = 0;
        this.emitHud();
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private isNightTime(): boolean {
    return this.timeOfDay < 6.0 || this.timeOfDay > 19.2;
  }

  private updateEnvironmentAndWeather(dt: number): void {
    // Advance Day-Night clock smoothly
    if (this.gamePhase === 'playing' || this.gamePhase === 'start') {
      this.timeOfDay = (this.timeOfDay + dt * 0.045) % 24;
    }

    // Passive daily property income every 45 real seconds
    if (this.gamePhase === 'playing' && this.ownedPropertyIds.length > 0) {
      this.incomeTickTimer += dt;
      if (this.incomeTickTimer >= 45) {
        this.incomeTickTimer = 0;
        const payout = this.ownedPropertyIds.reduce((acc, pid) => {
          const p = PROPERTIES.find((x) => x.id === pid);
          return acc + (p ? p.dailyIncome : 0);
        }, 0);
        if (payout > 0) {
          this.bank += payout;
          this.showDialogue('PacificTrust Bank', `Property portfolio rent deposited: +$${payout.toLocaleString()}!`);
        }
      }
    }

    // Dynamic Weather Transitions
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 85 + Math.random() * 60;
      const cycle: WeatherType[] = ['clear', 'partly-cloudy', 'rain', 'thunderstorm', 'fog', 'clear'];
      this.weather = cycle[Math.floor(Math.random() * cycle.length)];
    }

    // Sun Elevation & Atmospheric Sky Color
    const dayAngle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunElev = Math.sin(dayAngle); // >0 daytime, <0 nighttime
    const focus = this.activeVehicle ? this.activeVehicle.position : this.playerPos;

    this.sunLight.position.set(
      focus.x + Math.cos(dayAngle) * 180,
      Math.max(28, Math.abs(sunElev) * 220 + 25),
      focus.z + 95
    );
    this.sunLight.target.position.copy(focus);

    let skyHex = '#60a5fa';
    let sunIntensity = 1.6;
    if (sunElev > 0.25) {
      skyHex = this.weather === 'rain' || this.weather === 'thunderstorm' ? '#475569' : this.weather === 'fog' ? '#94a3b8' : '#38bdf8';
      sunIntensity = this.weather === 'thunderstorm' ? 0.55 : 1.65;
    } else if (sunElev > -0.08) {
      // Golden Sunrise / Sunset!
      skyHex = '#fb923c';
      sunIntensity = 0.95;
    } else {
      // Nighttime
      skyHex = '#060b19';
      sunIntensity = 0.22;
    }

    if (this.lightningFlash > 0) {
      this.lightningFlash -= dt * 4;
      skyHex = '#e2e8f0';
      sunIntensity = 3.2;
    } else if (this.weather === 'thunderstorm' && Math.random() < dt * 0.14) {
      this.lightningFlash = 1.0;
      this.sound.playThunder();
    }

    (this.scene.background as THREE.Color).lerp(new THREE.Color(skyHex), dt * 2.5);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.scene.background as THREE.Color);
    fog.density =
      this.weather === 'fog'
        ? 0.0052
        : this.weather === 'thunderstorm'
        ? 0.0028
        : 0.0012;

    this.sunLight.intensity = sunIntensity;
    this.hemiLight.intensity = sunElev > 0 ? 0.85 : 0.34;

    // Nighttime City Illumination (Skyscraper windows + Streetlamps + Vehicle Headlights)
    const nightGlow = sunElev < 0.08 ? 1.15 : 0.05;
    for (const m of this.world.skyscraperMaterials) {
      m.emissiveIntensity = nightGlow;
    }
    for (const b of this.world.streetLightBulbs) {
      b.emissiveIntensity = sunElev < 0.1 ? 1.8 : 0.1;
    }

    // Wet Road Reflections when raining!
    const isWet = this.weather === 'rain' || this.weather === 'thunderstorm';
    for (const rm of this.world.roadMaterials) {
      rm.roughness = isWet ? 0.18 : 0.68;
      rm.metalness = isWet ? 0.45 : 0.08;
    }

    // Rain Falling Streaks around camera
    if (isWet) {
      this.rainLines.visible = true;
      this.rainLines.position.set(
        this.camera.position.x,
        (this.rainLines.position.y - dt * 36 + 45) % 12,
        this.camera.position.z
      );
    } else {
      this.rainLines.visible = false;
    }

    // Showroom turntable rotation
    if (this.world.showroomTurntable) {
      this.world.showroomTurntable.rotation.y += dt * 0.6;
    }

    // Spin world collectibles & objective beacon
    const spinT = performance.now() * 0.0025;
    for (const node of this.world.interactables) {
      if (node.mesh && !node.collected && node.prompt.actionType === 'collect-item') {
        node.mesh.rotation.y = spinT;
      }
    }
    if (this.worldEventActive) {
      this.worldEventMesh.rotation.y = spinT * 1.3;
    }
  }

  private updateTrafficAndSignals(dt: number): void {
    this.trafficSignalTimer = (this.trafficSignalTimer + dt) % 18;
    // 0..8s: NS Green / EW Red; 8..9s: Yellow; 9..17s: NS Red / EW Green; 17..18s: Yellow
    const nsGreen = this.trafficSignalTimer < 8;
    const ewGreen = this.trafficSignalTimer >= 9 && this.trafficSignalTimer < 17;

    for (const tl of this.world.trafficLights) {
      const nsCol = nsGreen ? '#22c55e' : this.trafficSignalTimer < 9 ? '#facc15' : '#ef4444';
      const ewCol = ewGreen ? '#22c55e' : this.trafficSignalTimer >= 17 ? '#facc15' : '#ef4444';
      tl.nsBulbs.forEach((b) => {
        b.color.set(nsCol);
        b.emissive.set(nsCol);
      });
      tl.ewBulbs.forEach((b) => {
        b.color.set(ewCol);
        b.emissive.set(ewCol);
      });
    }

    const night = this.isNightTime();

    for (const v of this.vehicles) {
      if (v === this.activeVehicle || v.isPoliceUnit) continue;

      // Smoothly close open doors when unattended
      if (v.doorOpenProgress > 0) {
        v.doorOpenProgress = Math.max(0, v.doorOpenProgress - dt * 2.5);
        if (v.rig.driverDoorPivot) {
          v.rig.driverDoorPivot.rotation.y = -v.doorOpenProgress * 1.05;
        }
      }

      if (!v.isTraffic || !v.trafficAxis || !v.trafficDir) {
        // Idle rotor animation on parked helicopters or wave bobbing on boats
        if (v.spec.category === 'boat') {
          v.position.y = -0.72 + Math.sin(performance.now() * 0.002 + v.position.x) * 0.08;
          v.rig.root.position.copy(v.position);
        }
        continue;
      }

      // Check red light ahead or vehicle/player obstruction ahead
      let mustStop = false;
      const axis = v.trafficAxis;
      const dir = v.trafficDir;
      const posCoord = axis === 'z' ? v.position.z : v.position.x;

      const axisIsGreen = axis === 'z' ? nsGreen : ewGreen;
      if (!axisIsGreen) {
        for (const rc of ROAD_COORDS) {
          const distToStopLine = (rc - dir * 13.5 - posCoord) * dir;
          if (distToStopLine > 0.5 && distToStopLine < 11) {
            mustStop = true;
            break;
          }
        }
      }

      // Check distance to player or other vehicles ahead in lane
      const checkPoint = v.position
        .clone()
        .add(new THREE.Vector3(Math.sin(v.heading) * 9.5, 0, Math.cos(v.heading) * 9.5));

      if (!this.activeVehicle && this.playerPos.distanceTo(checkPoint) < 5.5) {
        mustStop = true;
      } else if (this.activeVehicle && this.activeVehicle.position.distanceTo(checkPoint) < 7.5) {
        mustStop = true;
      } else {
        for (const other of this.vehicles) {
          if (other !== v && other.position.distanceTo(checkPoint) < 6.8) {
            mustStop = true;
            break;
          }
        }
      }

      const targetSpeed = mustStop ? 0 : 14.5;
      v.speed += (targetSpeed - v.speed) * 3.5 * dt;

      if (axis === 'z') {
        v.position.z += dir * v.speed * dt;
        if (v.position.z > 355) v.position.z = -355;
        if (v.position.z < -355) v.position.z = 355;
      } else {
        v.position.x += dir * v.speed * dt;
        if (v.position.x > 355) v.position.x = -355;
        if (v.position.x < -355) v.position.x = 355;
      }

      v.rig.root.position.copy(v.position);
      v.rig.headlightCones.forEach((c) => (c.visible = night));
      v.rig.wheels.forEach((w) => {
        w.rotation.x += v.speed * dt * 2.2;
      });
    }
  }

  private updateNPCs(dt: number): void {
    const raining = this.weather === 'rain' || this.weather === 'thunderstorm';

    for (const npc of this.npcs) {
      npc.rig.umbrellaMesh.visible = raining && npc.behavior !== 'flee';

      if (npc.behavior === 'flee') {
        npc.fleeTimer -= dt;
        const runSpd = 5.4;
        npc.position.x += Math.sin(npc.heading) * runSpd * dt;
        npc.position.z += Math.cos(npc.heading) * runSpd * dt;
        npc.walkPhase += dt * 13;
        this.animateHumanoidLimbs(npc.rig, npc.walkPhase, 0.85, false, false, false, 0);
        if (npc.fleeTimer <= 0) {
          npc.behavior = 'walk';
        }
      } else if (npc.behavior === 'phone' || npc.behavior === 'chat') {
        npc.timer -= dt;
        npc.rig.phoneMesh.visible = npc.behavior === 'phone';
        this.animateHumanoidLimbs(npc.rig, performance.now() * 0.002, 0, false, false, npc.behavior === 'phone', 0);
        if (npc.timer <= 0) {
          npc.behavior = 'walk';
          npc.rig.phoneMesh.visible = false;
          npc.timer = 10 + Math.random() * 12;
        }
      } else {
        // Natural sidewalk strolling
        npc.timer -= dt;
        const spd = raining ? npc.speed * 1.35 : npc.speed;
        npc.position.x += Math.sin(npc.heading) * spd * dt;
        npc.position.z += Math.cos(npc.heading) * spd * dt;
        if (Math.abs(npc.position.x) > 350 || Math.abs(npc.position.z) > 350 || npc.timer <= 0) {
          npc.heading += Math.PI;
          npc.timer = 14 + Math.random() * 14;
        }
        npc.walkPhase += dt * spd * 3.6;
        this.animateHumanoidLimbs(npc.rig, npc.walkPhase, 0.5, false, false, false, 0);
      }

      npc.rig.root.position.copy(npc.position);
      npc.rig.root.rotation.y = npc.heading;
    }
  }

  private updateDoorsAndElevators(dt: number): void {
    // Automatic / Interactive Double Glass Doors
    for (const door of this.world.doors) {
      const dist = door.position.distanceTo(this.playerPos);
      const shouldOpen = dist < 4.5;
      if (shouldOpen && !door.isOpen) {
        door.isOpen = true;
        this.sound.playDoor(true);
      } else if (!shouldOpen && door.isOpen && dist > 5.8) {
        door.isOpen = false;
      }
      const target = door.isOpen ? 1 : 0;
      door.openAmount += (target - door.openAmount) * Math.min(1, dt * 6);
      door.leftPivot.rotation.y = -door.openAmount * 1.35;
      door.rightPivot.rotation.y = door.openAmount * 1.35;
    }

    // Physical Moving Glass Elevators
    for (const elev of this.world.elevators) {
      const diff = elev.targetY - elev.currentY;
      if (Math.abs(diff) > 0.01) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * 4.5);
        const prevY = elev.currentY;
        elev.currentY += step;
        elev.mesh.position.y = elev.currentY;

        // If player is standing on this elevator car, carry them smoothly!
        if (
          !this.activeVehicle &&
          Math.abs(this.playerPos.x - elev.centerX) <= elev.halfSize &&
          Math.abs(this.playerPos.z - elev.centerZ) <= elev.halfSize &&
          Math.abs(this.playerPos.y - prevY) < 1.5
        ) {
          this.playerPos.y = elev.currentY + 0.18;
        }
      }
    }
  }

  private updatePlayerOnFoot(dt: number): void {
    const profile = PLAYABLE_CHARACTERS[this.activeCharacter];

    // Input vector from WASD + Virtual Thumbstick
    let ix = this.touchMove.x;
    let iz = this.touchMove.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;

    const inputMag = Math.min(1, Math.hypot(ix, iz));
    if (inputMag > 0.08 && this.isProne) {
      this.isProne = false;
    }
    if (inputMag > 0.08 && this.isSitting) {
      this.isSitting = false;
    }

    const sprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint) && this.stamina > 5;
    if (sprinting && inputMag > 0.1) {
      this.stamina = Math.max(0, this.stamina - (16 / profile.staminaBonus) * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 14 * profile.staminaBonus * dt);
    }

    const baseSpeed = this.isCrouching ? 3.2 : sprinting ? 9.6 : 5.4;
    const moveSpeed = baseSpeed * profile.speedBonus * inputMag;

    if (inputMag > 0.06 && !this.isSitting) {
      // Camera-relative movement direction
      const forwardX = -Math.sin(this.camYaw);
      const forwardZ = -Math.cos(this.camYaw);
      const rightX = Math.cos(this.camYaw);
      const rightZ = -Math.sin(this.camYaw);

      const moveDirX = (forwardX * iz + rightX * ix) / Math.max(0.001, Math.hypot(ix, iz));
      const moveDirZ = (forwardZ * iz + rightZ * ix) / Math.max(0.001, Math.hypot(ix, iz));

      this.playerVel.x = moveDirX * moveSpeed;
      this.playerVel.z = moveDirZ * moveSpeed;

      const targetYaw = Math.atan2(moveDirX, moveDirZ);
      let dYaw = targetYaw - this.playerHeading;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      this.playerHeading += dYaw * Math.min(1, dt * 12);
    } else {
      this.playerVel.x *= Math.max(0, 1 - dt * 14);
      this.playerVel.z *= Math.max(0, 1 - dt * 14);
    }

    // Gravity
    this.playerVel.y -= 21 * dt;

    // Proposed horizontal motion + Wall AABB Collision Resolution
    const nextX = Math.max(-680, Math.min(680, this.playerPos.x + this.playerVel.x * dt));
    const nextZ = Math.max(-680, Math.min(680, this.playerPos.z + this.playerVel.z * dt));
    const radius = 0.42;

    let resolvedX = nextX;
    let resolvedZ = nextZ;
    for (const wall of this.world.wallColliders) {
      if (this.playerPos.y + 1.5 < wall.minY || this.playerPos.y + 0.3 > wall.maxY) continue;
      if (
        resolvedX + radius > wall.minX &&
        resolvedX - radius < wall.maxX &&
        resolvedZ + radius > wall.minZ &&
        resolvedZ - radius < wall.maxZ
      ) {
        // Push out along shallowest axis so sliding along walls feels effortless
        const overlapLeft = resolvedX + radius - wall.minX;
        const overlapRight = wall.maxX - (resolvedX - radius);
        const overlapNorth = resolvedZ + radius - wall.minZ;
        const overlapSouth = wall.maxZ - (resolvedZ - radius);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapNorth, overlapSouth);
        if (minOverlap === overlapLeft) resolvedX = wall.minX - radius;
        else if (minOverlap === overlapRight) resolvedX = wall.maxX + radius;
        else if (minOverlap === overlapNorth) resolvedZ = wall.minZ - radius;
        else resolvedZ = wall.maxZ + radius;
      }
    }

    this.playerPos.x = resolvedX;
    this.playerPos.z = resolvedZ;
    this.playerPos.y += this.playerVel.y * dt;

    // Floor & Multi-Story Elevation Solver (Terrain + Floors + Ramps/Stairs + Elevators + Water!)
    let supportY = getTerrainElevation(this.playerPos.x, this.playerPos.z);
    let activeFloorName: string | null = null;
    let activeBuildingId: string | null = null;

    // Swimming buoyancy in Ocean / River
    if (supportY < -0.65) {
      supportY = -0.65;
    }

    for (const plat of this.world.floorPlatforms) {
      if (
        this.playerPos.x >= plat.minX &&
        this.playerPos.x <= plat.maxX &&
        this.playerPos.z >= plat.minZ &&
        this.playerPos.z <= plat.maxZ
      ) {
        let py = plat.y;
        if (
          plat.isRamp &&
          plat.rampStartZ !== undefined &&
          plat.rampEndZ !== undefined &&
          plat.rampStartY !== undefined &&
          plat.rampEndY !== undefined
        ) {
          const t = Math.max(
            0,
            Math.min(1, (this.playerPos.z - plat.rampStartZ) / (plat.rampEndZ - plat.rampStartZ))
          );
          py = plat.rampStartY + (plat.rampEndY - plat.rampStartY) * t;
        }
        if (py <= this.playerPos.y + 1.45 && py >= supportY) {
          supportY = py;
          activeFloorName = plat.floorLabel || null;
          activeBuildingId = plat.buildingId || null;
        }
      }
    }

    for (const elev of this.world.elevators) {
      if (
        Math.abs(this.playerPos.x - elev.centerX) <= elev.halfSize &&
        Math.abs(this.playerPos.z - elev.centerZ) <= elev.halfSize &&
        elev.currentY <= this.playerPos.y + 1.5 &&
        elev.currentY + 0.18 >= supportY
      ) {
        supportY = elev.currentY + 0.18;
        activeFloorName = `${elev.buildingName} Lift`;
        activeBuildingId = elev.buildingId;
      }
    }

    if (this.playerPos.y <= supportY + 0.04) {
      if (this.playerVel.y < -18) {
        // High fall impact damage + shake!
        const dmg = Math.round((-this.playerVel.y - 18) * 2.5);
        this.applyDamageToPlayer(dmg);
        this.shakeIntensity = 0.35;
      }
      this.playerPos.y = supportY + 0.04;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    this.currentFloorLabel = activeFloorName;
    const bldgObj = activeBuildingId
      ? ENTERABLE_BUILDINGS.find((b) => b.id === activeBuildingId)
      : null;
    this.insideBuildingName = bldgObj ? bldgObj.name : null;
    this.sound.setIndoorAcoustics(!!this.insideBuildingName);

    // Update Humanoid Limb Animation & Footstep Audio
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (horizSpeed > 0.35 && this.isGrounded) {
      this.walkAnimPhase += dt * (horizSpeed * 1.65);
      this.footstepTimer -= dt * horizSpeed;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 2.3;
        this.sound.playFootstep(this.insideBuildingName ? 'indoor' : 'concrete');
      }
    }

    if (this.meleeTimer > 0) {
      this.meleeTimer = Math.max(0, this.meleeTimer - dt);
    }

    const strideAmp = !this.isGrounded ? 0.55 : Math.min(1.0, horizSpeed / 7.5);
    this.animateHumanoidLimbs(
      this.playerRig,
      this.walkAnimPhase,
      strideAmp,
      this.isCrouching,
      this.isSitting,
      this.isPhoneOut,
      this.meleeTimer
    );
    this.updateAnimCharacter(dt, horizSpeed);

    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerHeading;

    // Continuous outdoor audio update
    this.sound.updateContinuous({
      inVehicle: false,
      category: 'sedan',
      rpm: 0,
      skidIntensity: 0,
      weather: this.weather,
      wantedLevel: this.wantedLevel,
      nearestPoliceDist: this.getNearestPoliceDistance(),
      paused: false,
    });
  }

  private animateHumanoidLimbs(
    rig: HumanoidRig,
    phase: number,
    strideAmp: number,
    crouching: boolean,
    sitting: boolean,
    phoneOut: boolean,
    meleeTimer: number
  ): void {
    if (sitting) {
      rig.hips.position.y = 0.58;
      rig.leftLeg.rotation.x = -Math.PI * 0.45;
      rig.rightLeg.rotation.x = -Math.PI * 0.45;
      rig.leftArm.rotation.x = -0.35;
      rig.rightArm.rotation.x = -0.35;
      return;
    }

    rig.hips.position.y = crouching ? 0.68 : 0.92 + Math.abs(Math.sin(phase)) * strideAmp * 0.05;
    rig.torso.rotation.x = crouching ? 0.28 : strideAmp * 0.1;

    const swing = Math.sin(phase) * strideAmp * 0.78;
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.leftArm.rotation.x = -swing * 0.85;

    if (meleeTimer > 0) {
      const punch = Math.sin((meleeTimer / 0.42) * Math.PI);
      rig.rightArm.rotation.x = -punch * 1.65;
      rig.torso.rotation.y = punch * 0.45;
    } else if (phoneOut) {
      rig.rightArm.rotation.x = -1.05;
      rig.rightArm.rotation.z = -0.22;
      rig.torso.rotation.y = 0;
    } else {
      rig.rightArm.rotation.x = swing * 0.85;
      rig.rightArm.rotation.z = 0;
      rig.torso.rotation.y = 0;
    }
  }

  private updateActiveVehiclePhysics(dt: number): void {
    const v = this.activeVehicle!;
    const spec = v.spec;
    const profile = PLAYABLE_CHARACTERS[this.activeCharacter];

    // Animate door closing after entry
    if (v.doorOpenProgress > 0) {
      v.doorOpenProgress = Math.max(0, v.doorOpenProgress - dt * 2.8);
      if (v.rig.driverDoorPivot) {
        v.rig.driverDoorPivot.rotation.y = -v.doorOpenProgress * 1.05;
      }
    }

    let throttle = this.touchMove.y;
    let steerInput = -this.touchMove.x;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttle = 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.touchBrake) throttle = -1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steerInput = 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steerInput = -1;

    const nitroActive =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint) &&
      v.fuel > 1 &&
      spec.category !== 'bicycle';
    const handbrake = this.keys.has('Space') || this.touchHandbrake;

    // Fuel consumption
    if (spec.category !== 'bicycle' && (Math.abs(throttle) > 0.1 || spec.category === 'helicopter')) {
      v.fuel = Math.max(0, v.fuel - dt * (nitroActive ? 1.35 : 0.28));
    }
    const hasPower = v.fuel > 0 || spec.category === 'bicycle';

    // --- HELICOPTER FLIGHT MODEL ---
    if (spec.category === 'helicopter') {
      if (v.rig.mainRotor) v.rig.mainRotor.rotation.y += dt * 26;
      if (v.rig.tailRotor) v.rig.tailRotor.rotation.x += dt * 32;

      const ascend = this.keys.has('Space') || this.touchAscend;
      const descend = this.keys.has('KeyC') || this.touchDescend;
      const targetVy = hasPower ? (ascend ? 14 : descend ? -12 : 0) : -9;
      v.verticalVel += (targetVy - v.verticalVel) * 3.2 * dt;

      if (hasPower) {
        v.speed += throttle * spec.acceleration * dt;
        v.heading += steerInput * 1.65 * dt;
      }
      v.speed *= Math.max(0, 1 - dt * 0.85);
      v.speed = Math.max(-18, Math.min(spec.maxSpeed, v.speed));

      v.position.x = Math.max(-680, Math.min(680, v.position.x + Math.sin(v.heading) * v.speed * dt));
      v.position.z = Math.max(-680, Math.min(680, v.position.z + Math.cos(v.heading) * v.speed * dt));
      v.position.y += v.verticalVel * dt;

      // Ground / Helipad landing check
      let groundY = Math.max(-0.5, getTerrainElevation(v.position.x, v.position.z));
      for (const plat of this.world.floorPlatforms) {
        if (
          v.position.x >= plat.minX &&
          v.position.x <= plat.maxX &&
          v.position.z >= plat.minZ &&
          v.position.z <= plat.maxZ &&
          plat.y <= v.position.y + 1.5
        ) {
          groundY = Math.max(groundY, plat.y);
        }
      }
      if (v.position.y < groundY + 0.05) {
        v.position.y = groundY + 0.05;
        v.verticalVel = 0;
        v.speed *= 0.92;
      }

      v.rig.root.position.copy(v.position);
      v.rig.root.rotation.set((v.speed / spec.maxSpeed) * 0.22, v.heading, -steerInput * 0.22);
      this.playerPos.copy(v.position);
      this.playerHeading = v.heading;

      this.sound.updateContinuous({
        inVehicle: true,
        category: 'helicopter',
        rpm: 0.45 + Math.abs(v.speed) / spec.maxSpeed * 0.5,
        skidIntensity: 0,
        weather: this.weather,
        wantedLevel: this.wantedLevel,
        nearestPoliceDist: this.getNearestPoliceDistance(),
        paused: false,
      });
      return;
    }

    // --- SPEEDBOAT MARINE PHYSICS ---
    if (spec.category === 'boat') {
      if (hasPower) {
        v.speed += throttle * spec.acceleration * dt;
      }
      v.speed *= Math.max(0, 1 - dt * 0.7);
      v.speed = Math.max(-12, Math.min(spec.maxSpeed, v.speed));
      v.heading += steerInput * spec.handling * 0.7 * (Math.abs(v.speed) > 1 ? 1 : 0.3) * dt;

      const nextX = v.position.x + Math.sin(v.heading) * v.speed * dt;
      const nextZ = v.position.z + Math.cos(v.heading) * v.speed * dt;
      // Keep boat in navigable water (Bay z > 460 or River x = 298..322)
      const inWater = nextZ > 455 || (nextX > 298 && nextX < 322);
      if (inWater) {
        v.position.x = nextX;
        v.position.z = nextZ;
      } else {
        v.speed *= -0.35;
      }
      v.position.y = -0.72 + Math.sin(performance.now() * 0.004) * 0.09;
      v.rig.root.position.copy(v.position);
      v.rig.root.rotation.set(-Math.abs(v.speed) * 0.003, v.heading, -steerInput * 0.14);

      if (Math.abs(v.speed) > 8 && Math.random() < 0.45) {
        this.spawnBurstParticles(
          v.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
          '#e0f2fe',
          1
        );
      }

      this.playerPos.copy(v.position);
      this.playerHeading = v.heading;
      this.sound.updateContinuous({
        inVehicle: true,
        category: 'boat',
        rpm: Math.abs(v.speed) / spec.maxSpeed,
        skidIntensity: 0,
        weather: this.weather,
        wantedLevel: this.wantedLevel,
        nearestPoliceDist: this.getNearestPoliceDistance(),
        paused: false,
      });
      return;
    }

    // --- AUTOMOBILE / MOTORCYCLE / TRUCK PHYSICS ---
    const engineBoost = 1 + (v.engineLevel - 1) * 0.14;
    const maxSpd = spec.maxSpeed * engineBoost * (nitroActive ? 1.28 : 1.0);
    const accel = spec.acceleration * engineBoost * (nitroActive ? 1.45 : 1.0);

    if (hasPower && throttle > 0) {
      v.speed += throttle * accel * dt;
    } else if (throttle < 0) {
      if (v.speed > 1.5) {
        v.speed -= spec.braking * dt;
      } else if (hasPower) {
        v.speed += throttle * accel * 0.55 * dt;
      }
    } else {
      v.speed *= Math.max(0, 1 - dt * 1.15);
    }

    if (handbrake) {
      v.speed *= Math.max(0, 1 - dt * 2.4);
    }
    v.speed = Math.max(-maxSpd * 0.35, Math.min(maxSpd, v.speed));

    // Speed-sensitive Steering & Handbrake Drift
    v.steerAngle += (steerInput * 0.55 - v.steerAngle) * Math.min(1, dt * 10);
    const speedFactor = Math.min(1, Math.abs(v.speed) / 7);
    const dirSign = v.speed >= -0.2 ? 1 : -1;
    const driftTurnMult = handbrake && Math.abs(v.speed) > 12 ? 1.42 : 1.0;
    v.heading +=
      v.steerAngle *
      spec.handling *
      profile.drivingBonus *
      driftTurnMult *
      speedFactor *
      dirSign *
      dt;

    // Nitro Exhaust Flame & Drift Tire Smoke Juice!
    const isDrifting = handbrake && Math.abs(v.speed) > 14 && Math.abs(steerInput) > 0.25;
    if (isDrifting) {
      this.driftScoreAccum += dt * Math.abs(v.speed) * 3.2;
      if (this.driftScoreAccum >= 95) {
        this.driftScoreAccum = 0;
        this.addScore('DRIFT CHAIN!', 150, '#fb923c');
      }
      if (Math.random() < 0.55) {
        this.spawnBurstParticles(
          v.position
            .clone()
            .add(new THREE.Vector3(-Math.sin(v.heading) * 1.8, 0.2, -Math.cos(v.heading) * 1.8)),
          '#cbd5e1',
          1
        );
      }
    }
    if (nitroActive && Math.abs(v.speed) > 6 && Math.random() < 0.65) {
      this.spawnBurstParticles(
        v.position
          .clone()
          .add(new THREE.Vector3(-Math.sin(v.heading) * 2.2, 0.35, -Math.cos(v.heading) * 2.2)),
        '#38bdf8',
        1
      );
    }

    // Proposed movement + Building Wall Collision + Traffic Collision
    v.verticalVel -= 22 * dt;
    let nx = Math.max(-680, Math.min(680, v.position.x + Math.sin(v.heading) * v.speed * dt));
    let nz = Math.max(-680, Math.min(680, v.position.z + Math.cos(v.heading) * v.speed * dt));
    const vRad = Math.max(spec.dimensions[0], spec.dimensions[2]) * 0.42;

    for (const wall of this.world.wallColliders) {
      if (v.position.y + 1.8 < wall.minY || v.position.y > wall.maxY) continue;
      if (
        nx + vRad > wall.minX &&
        nx - vRad < wall.maxX &&
        nz + vRad > wall.minZ &&
        nz - vRad < wall.maxZ
      ) {
        const impact = Math.abs(v.speed);
        if (impact > 9) {
          this.sound.playCollision(Math.min(1, impact / 40));
          this.shakeIntensity = Math.min(0.45, impact / 65);
          v.health = Math.max(5, v.health - impact * 0.32);
          this.spawnBurstParticles(v.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#facc15', 6);
        }
        v.speed *= -0.32;
        nx = v.position.x;
        nz = v.position.z;
        break;
      }
    }

    // Vehicle-to-Vehicle Collision & Near-Miss Combo Detection!
    for (const other of this.vehicles) {
      if (other === v) continue;
      if (other.nearMissCooldown > 0) other.nearMissCooldown -= dt;
      const dist = Math.hypot(nx - other.position.x, nz - other.position.z);
      const minSep = (spec.dimensions[0] + other.spec.dimensions[0]) * 0.52;
      if (dist < minSep && Math.abs(v.position.y - other.position.y) < 2.2) {
        const relImpact = Math.abs(v.speed - other.speed);
        if (relImpact > 8) {
          this.sound.playCollision(Math.min(1, relImpact / 38));
          this.shakeIntensity = Math.min(0.4, relImpact / 60);
          v.health = Math.max(5, v.health - relImpact * 0.25);
          this.spawnBurstParticles(v.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#fb923c', 6);
          if (other.isPoliceUnit) {
            this.raiseWantedLevel(Math.max(2, this.wantedLevel));
          }
        }
        // Elastic pushback
        const pushAngle = Math.atan2(nx - other.position.x, nz - other.position.z);
        nx = other.position.x + Math.sin(pushAngle) * (minSep + 0.15);
        nz = other.position.z + Math.cos(pushAngle) * (minSep + 0.15);
        v.speed *= 0.45;
      } else if (
        dist < minSep + 2.3 &&
        Math.abs(v.speed) > 28 &&
        other.nearMissCooldown <= 0
      ) {
        other.nearMissCooldown = 4.0;
        this.addScore('HIGH-SPEED NEAR MISS!', 150, '#38bdf8');
      }
    }

    v.position.x = nx;
    v.position.z = nz;
    v.position.y += v.verticalVel * dt;

    // Ground & Mountain Ramp Elevation
    let roadSupportY = getTerrainElevation(v.position.x, v.position.z);
    for (const plat of this.world.floorPlatforms) {
      if (
        v.position.x >= plat.minX &&
        v.position.x <= plat.maxX &&
        v.position.z >= plat.minZ &&
        v.position.z <= plat.maxZ
      ) {
        let py = plat.y;
        if (
          plat.isRamp &&
          plat.rampStartZ !== undefined &&
          plat.rampEndZ !== undefined &&
          plat.rampStartY !== undefined &&
          plat.rampEndY !== undefined
        ) {
          const t = Math.max(
            0,
            Math.min(1, (v.position.z - plat.rampStartZ) / (plat.rampEndZ - plat.rampStartZ))
          );
          py = plat.rampStartY + (plat.rampEndY - plat.rampStartY) * t;
        }
        if (py <= v.position.y + 1.8) {
          roadSupportY = Math.max(roadSupportY, py);
        }
      }
    }

    if (v.position.y <= roadSupportY + 0.02) {
      if (v.verticalVel < -10) {
        this.addScore('STUNT AIRTIME!', 250, '#a855f7');
        this.shakeIntensity = 0.24;
      }
      v.position.y = roadSupportY + 0.02;
      v.verticalVel = 0;
    }

    // Visual Wheel Spin, Front Wheel Steer, Steering Wheel, Suspension Roll/Pitch, Brake Lights & Damage Smoke!
    v.rig.wheels.forEach((w) => {
      w.rotation.x += v.speed * dt * 2.4;
    });
    v.rig.frontWheelSteerPivots.forEach((p) => {
      p.rotation.y = v.steerAngle * 0.7;
    });
    if (v.rig.steeringWheel) {
      v.rig.steeringWheel.rotation.z = -v.steerAngle * 2.2;
    }
    const brakingNow = throttle < -0.1 || handbrake;
    v.rig.brakeLightMeshes.forEach((bl) => {
      (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = brakingNow ? 2.2 : 0.35;
    });
    const showBeams = v.headlightsOn || this.isNightTime();
    v.rig.headlightCones.forEach((c) => (c.visible = showBeams));

    // Suspension pitch & roll + slight deformation if heavily damaged
    const bodyRoll = -v.steerAngle * (Math.abs(v.speed) / maxSpd) * (spec.category === 'motorcycle' ? -0.45 : 0.12);
    const bodyPitch = -throttle * 0.03;
    v.rig.bodyGroup.rotation.set(bodyPitch, 0, bodyRoll);
    if (v.health < 45) {
      v.rig.bodyGroup.scale.set(1, 0.96, 0.97);
      if (Math.random() < 0.3) {
        this.spawnBurstParticles(v.position.clone().add(v.rig.damageSmokeOffset), '#64748b', 1);
      }
    }

    v.rig.root.position.copy(v.position);
    v.rig.root.rotation.y = v.heading;

    if (spec.category === 'motorcycle' || spec.category === 'bicycle') {
      this.playerRig.root.position.set(v.position.x, v.position.y + 0.25, v.position.z);
      this.playerRig.root.rotation.y = v.heading;
      this.animateHumanoidLimbs(this.playerRig, 0, 0, false, true, false, 0);
    }

    this.playerPos.copy(v.position);
    this.playerHeading = v.heading;

    this.sound.updateContinuous({
      inVehicle: true,
      category: spec.category,
      rpm: Math.min(1, Math.abs(v.speed) / spec.maxSpeed),
      skidIntensity: isDrifting ? 0.9 : 0,
      weather: this.weather,
      wantedLevel: this.wantedLevel,
      nearestPoliceDist: this.getNearestPoliceDistance(),
      paused: false,
    });
  }

  private getNearestPoliceDistance(): number {
    let best = 999;
    for (const v of this.vehicles) {
      if (v.isPoliceUnit) {
        const d = v.position.distanceTo(this.playerPos);
        if (d < best) best = d;
      }
    }
    return best;
  }

  private applyDamageToPlayer(amount: number): void {
    if (amount <= 0) return;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.7);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.triggerGameOver('wasted');
    }
  }

  // --- INTERACTION SCANNER ---

  private scanNearbyInteractables(): void {
    this.currentPrompt = null;
    this.currentPromptAction = null;
    if (this.activeVehicle) return;

    const p = this.playerPos;

    // 1. Check Active Mission Start Beacons (when no mission is active)
    if (!this.activeMissionDef) {
      for (const m of MISSIONS) {
        const d = Math.hypot(p.x - m.startPos[0], p.z - m.startPos[2]);
        if (d < 4.0 && Math.abs(p.y - m.startPos[1]) < 2.5) {
          const replayTag = this.completedMissionIds.includes(m.id) ? ' (Replay)' : '';
          this.currentPrompt = {
            id: 'mission_start_' + m.id,
            title: m.title + replayTag,
            subtitle: `Start Mission • Reward $${m.cashReward.toLocaleString()}`,
            actionKey: 'E',
            actionType: 'start-mission',
            targetId: m.id,
          };
          this.currentPromptAction = () => this.startMissionById(m.id);
          return;
        }
      }
    }

    // 2. Check World Interactables (Elevators, Shops, Dealership, Wardrobes, ATMs, Beds, TVs, Collectibles, Gas Pumps!)
    let bestDist = 999;
    for (const node of this.world.interactables) {
      if (node.collected) continue;
      const d = node.position.distanceTo(p);
      if (d <= node.radius && d < bestDist) {
        bestDist = d;
        this.currentPrompt = node.prompt;
        this.currentPromptAction = () => this.executeWorldNodeAction(node);
      }
    }
    if (this.currentPrompt) return;

    // 3. Check Nearby Vehicles to Enter
    const nearVeh = this.findNearestVehicle(4.2);
    if (nearVeh && Math.abs(nearVeh.position.y - p.y) < 2.4) {
      this.currentPrompt = {
        id: 'enter_' + nearVeh.id,
        title: `${nearVeh.spec.manufacturer} ${nearVeh.spec.name}`,
        subtitle: 'Enter & Drive Vehicle',
        actionKey: 'E',
        actionType: 'enter-vehicle',
      };
      this.currentPromptAction = () => this.enterVehicle(nearVeh);
    }
  }

  private executeWorldNodeAction(node: typeof this.world.interactables[number]): void {
    const act = node.prompt.actionType;
    switch (act) {
      case 'collect-item': {
        node.collected = true;
        if (node.mesh) node.mesh.visible = false;
        const shardDef = WORLD_COLLECTIBLES.find((c) => c.id === node.id);
        if (shardDef) {
          this.cash += shardDef.cashValue;
          if (!this.collectedShardIds.includes(shardDef.id)) {
            this.collectedShardIds.push(shardDef.id);
          }
          this.addScore(shardDef.name, shardDef.scoreValue, '#facc15');
          this.sound.playCashSound();
          this.spawnBurstParticles(node.position, '#facc15', 14);
          this.autoSave();
        } else {
          // Picked up dropped consumable
          this.inventory.push({ ...SHOP_CATALOG[0], quantity: 1 });
          this.sound.playUiClick(840);
        }
        break;
      }
      case 'use-elevator': {
        const elev = this.world.elevators.find((e) => e.id === node.prompt.targetId);
        if (elev) {
          if (document.pointerLockElement) document.exitPointerLock();
          this.onModalRequest({ type: 'elevator', elevator: elev });
        }
        break;
      }
      case 'open-dealership':
        if (document.pointerLockElement) document.exitPointerLock();
        this.onModalRequest({ type: 'dealership' });
        break;
      case 'open-wardrobe':
        if (document.pointerLockElement) document.exitPointerLock();
        this.onModalRequest({ type: 'wardrobe' });
        break;
      case 'open-garage':
        if (document.pointerLockElement) document.exitPointerLock();
        this.onModalRequest({ type: 'garage' });
        break;
      case 'open-shop':
        if (document.pointerLockElement) document.exitPointerLock();
        this.onModalRequest({ type: 'shop' });
        break;
      case 'use-atm':
        if (document.pointerLockElement) document.exitPointerLock();
        this.onModalRequest({ type: 'atm' });
        break;
      case 'buy-property':
        if (node.prompt.targetId) {
          if (document.pointerLockElement) document.exitPointerLock();
          this.onModalRequest({ type: 'property', propertyId: node.prompt.targetId });
        }
        break;
      case 'sleep-bed': {
        const propId = node.prompt.targetId;
        if (propId && !this.ownedPropertyIds.includes(propId)) {
          this.showDialogue('Safehouse Security', 'Purchase this property deed first to unlock the master suite!');
          return;
        }
        this.timeOfDay = (this.timeOfDay + 6) % 24;
        this.health = this.maxHealth;
        this.stamina = 100;
        this.wantedLevel = 0;
        this.clearPoliceUnits();
        this.sound.playElevatorDing();
        this.showDialogue('Safehouse Rest', 'Rested 6 hours. Health restored & progress auto-saved.');
        this.autoSave();
        break;
      }
      case 'sit-chair':
        this.playerPos.x = node.position.x;
        this.playerPos.z = node.position.z;
        this.isSitting = true;
        this.sound.playUiClick(580);
        break;
      case 'watch-tv':
        node.tvOn = !node.tvOn;
        if (node.tvScreenMat) {
          node.tvScreenMat.emissive.set(node.tvOn ? '#38bdf8' : '#09090b');
          node.tvScreenMat.emissiveIntensity = node.tvOn ? 1.4 : 0.1;
        }
        this.sound.playUiClick(760);
        if (node.tvOn) {
          this.showDialogue('WPAC Channel 7 News', `"Live over Port Pacifica: Traffic moving smoothly across Emerald River Bridges..."`);
        }
        break;
      case 'heal-hospital': {
        const cost = node.prompt.cost || 50;
        if (this.cash >= cost) {
          this.cash -= cost;
          this.health = this.maxHealth;
          this.stamina = 100;
          this.sound.playElevatorDing();
          this.showDialogue('Pacifica Medical', 'Full trauma checkup complete. Health 100%.');
        }
        break;
      }
      case 'pay-fine': {
        if (this.wantedLevel === 0) {
          this.showDialogue('PPD Desk Sergeant', 'Your record is clean today, citizen.');
        } else if (this.cash >= 250) {
          this.cash -= 250;
          this.wantedLevel = 0;
          this.clearPoliceUnits();
          this.sound.playCashSound();
          this.showDialogue('PPD Desk Sergeant', 'Citation settled. All units standing down.');
        }
        break;
      }
      case 'refuel-pump': {
        const near = this.findNearestVehicle(12);
        if (!near) {
          this.showDialogue('Horizon Fuel', 'Park a vehicle next to the fuel canopy first!');
        } else if (this.cash >= 45) {
          this.cash -= 45;
          near.fuel = near.spec.fuelCapacity;
          near.health = Math.min(100, near.health + 35);
          this.sound.playCashSound();
          this.showDialogue('Horizon Fuel', `${near.spec.name} tank topped to 100%!`);
        }
        break;
      }
    }
    this.emitHud();
  }

  private updateMissionsAndEvents(dt: number): void {
    // Random World Event Supply Drop check
    if (this.worldEventActive && this.playerPos.distanceTo(this.worldEventPos) < 4.5) {
      this.worldEventActive = false;
      this.worldEventMesh.visible = false;
      this.cash += 2500;
      this.addScore('WORLD EVENT: SUPPLY CRATE!', 1200, '#38bdf8');
      this.sound.playMissionFanfare();
      this.showDialogue('World Event Discovery', 'Secured unlisted courier crate (+$2,500 & +1,200 PTS)!');
      // Respawn new random event across city after 45s
      window.setTimeout(() => {
        const spots: [number, number][] = [
          [-240, 120],
          [120, 240],
          [-120, -240],
          [460, 60],
        ];
        const pick = spots[Math.floor(Math.random() * spots.length)];
        this.worldEventPos.set(pick[0], 0.8, pick[1]);
        this.worldEventMesh.position.copy(this.worldEventPos);
        this.worldEventMesh.visible = true;
        this.worldEventActive = true;
      }, 45000);
    }

    // Active Mission Step Check
    if (this.activeMissionDef) {
      const step = this.activeMissionDef.steps[this.activeMissionStepIdx];
      this.objectiveBeacon.visible = true;
      this.objectiveBeacon.position.set(step.targetPos[0], step.targetPos[1] + 9, step.targetPos[2]);

      const dx = this.playerPos.x - step.targetPos[0];
      const dy = this.playerPos.y - step.targetPos[1];
      const dz = this.playerPos.z - step.targetPos[2];
      const dist3D = Math.hypot(dx, dy, dz);
      if (dist3D <= step.radius) {
        this.advanceMissionStep();
      }
    } else {
      this.objectiveBeacon.visible = false;
    }

    // Also allow refuel prompt while sitting INSIDE a vehicle at a gas station!
    if (this.activeVehicle) {
      for (const node of this.world.interactables) {
        if (
          node.prompt.actionType === 'refuel-pump' &&
          this.activeVehicle.position.distanceTo(node.position) < 9 &&
          Math.abs(this.activeVehicle.speed) < 3 &&
          this.activeVehicle.fuel < this.activeVehicle.spec.fuelCapacity - 5 &&
          this.cash >= 45
        ) {
          this.cash -= 45;
          this.activeVehicle.fuel = this.activeVehicle.spec.fuelCapacity;
          this.activeVehicle.health = 100;
          this.sound.playCashSound();
          this.showDialogue('Horizon Drive-Thru Fuel', 'Tank topped to 100% & windshield serviced (-$45)!');
        }
      }
    }
    void dt;
  }

  private updateCutscene(dt: number): void {
    this.cutsceneTimer -= dt;
    const angle = performance.now() * 0.0005;
    this.camera.position.set(
      this.playerPos.x + Math.sin(angle) * 6.5,
      this.playerPos.y + 2.6,
      this.playerPos.z + Math.cos(angle) * 6.5
    );
    this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.35, this.playerPos.z);

    if (this.cutsceneTimer <= 0) {
      this.cutsceneQueue.shift();
      if (this.cutsceneQueue.length === 0) {
        this.skipCutscene();
      } else {
        this.cutsceneTimer = 3.6;
        this.sound.playUiClick(640);
      }
    }
  }

  private updateStartScreenCamera(dt: number): void {
    this.startMenuOrbitAngle += dt * 0.14;
    const radius = 92;
    this.camera.position.set(
      Math.cos(this.startMenuOrbitAngle) * radius,
      36 + Math.sin(this.startMenuOrbitAngle * 0.7) * 8,
      Math.sin(this.startMenuOrbitAngle) * radius + 10
    );
    this.camera.lookAt(-20, 12, -25);
  }

  private updateGameplayCamera(dt: number): void {
    const focus = this.activeVehicle ? this.activeVehicle.position : this.playerPos;

    if (this.cameraMode === 'first-person') {
      if (this.activeVehicle) {
        // Interior Dashboard / Hood First-Person Camera!
        const forward = new THREE.Vector3(Math.sin(this.activeVehicle.heading), 0, Math.cos(this.activeVehicle.heading));
        this.camera.position.set(
          focus.x + forward.x * 0.35,
          focus.y + this.activeVehicle.spec.dimensions[1] * 0.78,
          focus.z + forward.z * 0.35
        );
        this.camera.lookAt(
          this.camera.position.x + forward.x * 20,
          this.camera.position.y - 0.3,
          this.camera.position.z + forward.z * 20
        );
      } else {
        this.playerRig.root.visible = false;
        this.camera.position.set(focus.x, focus.y + (this.isCrouching ? 1.15 : 1.62), focus.z);
        const lookX = focus.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * 15;
        const lookY = this.camera.position.y - Math.sin(this.camPitch) * 15;
        const lookZ = focus.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * 15;
        this.camera.lookAt(lookX, lookY, lookZ);
      }
      return;
    }

    if (!this.activeVehicle) {
      this.playerRig.root.visible = true;
    }

    // Gentle auto-follow behind moving vehicle when mouse isn't actively orbiting
    if (this.activeVehicle && Math.abs(this.activeVehicle.speed) > 2 && !this.pointerLocked) {
      const desiredYaw = this.activeVehicle.heading + Math.PI;
      let diff = desiredYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 3.8);
    }

    const baseDist =
      this.activeVehicle
        ? this.activeVehicle.spec.category === 'helicopter' || this.activeVehicle.spec.category === 'bus'
          ? 12.5
          : this.cameraMode === 'third-close'
          ? 6.4
          : 8.6
        : this.insideBuildingName
        ? 3.8
        : this.cameraMode === 'third-close'
        ? 4.2
        : 6.4;

    this.camDist += (baseDist - this.camDist) * Math.min(1, dt * 7);

    const targetY = focus.y + (this.activeVehicle ? 1.6 : 1.45);
    let cx = focus.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    let cy = targetY + Math.sin(this.camPitch) * this.camDist;
    let cz = focus.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;

    // Prevent camera from dipping underground
    const minGround = getTerrainElevation(cx, cz) + 0.6;
    if (cy < minGround) cy = minGround;

    // Screen Shake Juice
    if (this.shakeIntensity > 0.005) {
      cx += (Math.random() - 0.5) * this.shakeIntensity;
      cy += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.max(0, 1 - dt * 6.5);
    }

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(focus.x, targetY, focus.z);
  }

  private updateParticlesAndTimers(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = Math.max(0.05, p.life / p.maxLife);
      p.mesh.scale.setScalar(s);
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1;
      }
    }

    if (this.dialogueBanner) {
      this.dialogueBanner.timer -= dt;
      if (this.dialogueBanner.timer <= 0) {
        this.dialogueBanner = null;
      }
    }
  }

  // --- HUD SNAPSHOT EMISSION ---

  public emitHud(): void {
    const district = getDistrictAt(this.playerPos.x, this.playerPos.z);
    const neededEvade = 9 + this.wantedLevel * 3;
    const cooldownPct = Math.min(100, Math.round((this.wantedSightLostTimer / neededEvade) * 100));

    let activeMissionHud: HUDSnapshot['activeMission'] = null;
    if (this.activeMissionDef) {
      const step = this.activeMissionDef.steps[this.activeMissionStepIdx];
      const dist = Math.round(
        Math.hypot(this.playerPos.x - step.targetPos[0], this.playerPos.z - step.targetPos[2])
      );
      activeMissionHud = {
        id: this.activeMissionDef.id,
        title: this.activeMissionDef.title,
        stepIndex: this.activeMissionStepIdx + 1,
        totalSteps: this.activeMissionDef.steps.length,
        instruction: step.instruction,
        targetPos: step.targetPos,
        distance: dist,
      };
    }

    const activeDialogue =
      this.gamePhase === 'cutscene' && this.cutsceneQueue.length > 0
        ? this.cutsceneQueue[0]
        : this.dialogueBanner
        ? { speaker: this.dialogueBanner.speaker, text: this.dialogueBanner.text }
        : null;

    const gpsDistance = this.gpsTarget
      ? Math.round(Math.hypot(this.playerPos.x - this.gpsTarget[0], this.playerPos.z - this.gpsTarget[1]))
      : 0;

    // Build Minimap Blips
    const minimapEntities: HUDSnapshot['minimapEntities'] = [];
    for (const v of this.vehicles) {
      if (v === this.activeVehicle) continue;
      if (v.isPoliceUnit) {
        minimapEntities.push({ x: v.position.x, z: v.position.z, type: 'police' });
      } else if (!v.isTraffic && v.position.distanceTo(this.playerPos) < 180) {
        minimapEntities.push({ x: v.position.x, z: v.position.z, type: 'vehicle' });
      }
    }
    if (!this.activeMissionDef) {
      for (const m of MISSIONS) {
        minimapEntities.push({ x: m.startPos[0], z: m.startPos[2], type: 'mission', label: m.title });
      }
    }
    for (const b of ENTERABLE_BUILDINGS) {
      minimapEntities.push({
        x: b.position[0],
        z: b.position[2],
        type: b.propertyId ? 'property' : 'shop',
        label: b.name,
      });
    }
    if (this.worldEventActive) {
      minimapEntities.push({ x: this.worldEventPos.x, z: this.worldEventPos.z, type: 'event' });
    }

    const spdMph = this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 2.35) : 0;
    const gear = !this.activeVehicle
      ? 'N'
      : this.activeVehicle.speed < -1
      ? 'R'
      : spdMph < 2
      ? 'N'
      : String(Math.min(6, Math.max(1, Math.ceil(spdMph / 22))));

    this.onHudUpdate({
      gamePhase: this.gamePhase,
      activeCharacter: this.activeCharacter,
      districtName: district.name,
      streetStatus: district.tagline,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      armor: Math.round(this.armor),
      stamina: Math.round(this.stamina),
      cash: Math.round(this.cash),
      bank: Math.round(this.bank),
      score: Math.round(this.score),
      comboMultiplier: this.comboMultiplier,
      comboTimer: this.comboTimer,
      wantedLevel: this.wantedLevel,
      policeSearching: this.policeSearching,
      wantedCooldownPct: cooldownPct,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      cameraMode: this.cameraMode,
      fps: this.currentFps,
      playerPos: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
      playerHeading: this.playerHeading,
      currentFloorLabel: this.currentFloorLabel,
      insideBuildingName: this.insideBuildingName,
      isSitting: this.isSitting,
      isPhoneOut: this.isPhoneOut,
      inVehicle: {
        active: !!this.activeVehicle,
        name: this.activeVehicle ? `${this.activeVehicle.spec.manufacturer} ${this.activeVehicle.spec.name}` : '',
        category: this.activeVehicle ? this.activeVehicle.spec.category : 'sedan',
        speedMph: spdMph,
        gear,
        rpm: this.activeVehicle
          ? Math.min(1, Math.abs(this.activeVehicle.speed) / this.activeVehicle.spec.maxSpeed)
          : 0,
        fuel: this.activeVehicle
          ? Math.round((this.activeVehicle.fuel / this.activeVehicle.spec.fuelCapacity) * 100)
          : 100,
        health: this.activeVehicle ? Math.round(this.activeVehicle.health) : 100,
        headlights: this.activeVehicle ? this.activeVehicle.headlightsOn || this.isNightTime() : false,
        radioStation: this.sound.getStationName(),
      },
      prompt: this.currentPrompt,
      activeMission: activeMissionHud,
      dialogue: activeDialogue,
      gpsTarget: this.gpsTarget,
      gpsDistance,
      collectiblesFound: this.collectedShardIds.length,
      totalCollectibles: WORLD_COLLECTIBLES.length,
      completedMissionIds: [...this.completedMissionIds],
      ownedPropertyIds: [...this.ownedPropertyIds],
      ownedVehicles: [...this.ownedVehicles],
      inventory: [...this.inventory],
      scorePopups: [...this.scorePopups],
      minimapEntities,
    });
  }

  // --- DOM EVENT LISTENERS (KEYBOARD, MOUSE ORBIT, WHEEL ZOOM, TOUCH LOOK) ---

  public rotateCameraByDelta(dx: number, dy: number): void {
    const sens = 0.0032 * this.settings.cameraSensitivity;
    this.camYaw -= dx * sens;
    const ySign = this.settings.invertY ? -1 : 1;
    this.camPitch = Math.max(-0.35, Math.min(1.15, this.camPitch + dy * sens * ySign));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);

    if (e.code === 'Escape') {
      if (this.gamePhase === 'playing') this.pauseGame();
      else if (this.gamePhase === 'paused') this.resumeGame();
      return;
    }

    if (this.gamePhase === 'cutscene' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) {
      this.skipCutscene();
      return;
    }

    if (this.gamePhase !== 'playing') return;

    if (e.code === 'KeyE' || e.code === 'KeyG') {
      this.triggerPrimaryInteraction();
    } else if (e.code === 'KeyF') {
      this.triggerMeleeOrHorn();
    } else if (e.code === 'Space') {
      this.triggerJumpOrHandbrake();
    } else if (e.code === 'KeyC' && !this.activeVehicle) {
      this.isCrouching = !this.isCrouching;
    } else if (e.code === 'KeyV') {
      this.toggleCameraMode();
    } else if (e.code === 'KeyH' && this.activeVehicle) {
      this.sound.playHorn(this.activeVehicle.spec.category === 'emergency');
    } else if (e.code === 'KeyL' && this.activeVehicle) {
      this.activeVehicle.headlightsOn = !this.activeVehicle.headlightsOn;
      this.sound.playUiClick(720);
      this.emitHud();
    } else if (e.code === 'KeyR' && this.activeVehicle) {
      this.sound.nextRadioStation();
      this.emitHud();
    } else if (e.code === 'KeyZ') {
      this.toggleProne();
    } else if (e.code === 'Digit4') {
      this.switchCharacter('bc2');
    } else if (e.code === 'Digit5') {
      this.switchCharacter('bc4');
    } else if (e.code === 'Digit6') {
      this.switchCharacter('boy');
    } else if (e.code === 'Digit1') {
      this.switchCharacter('dante');
    } else if (e.code === 'Digit2') {
      this.switchCharacter('elena');
    } else if (e.code === 'Digit3') {
      this.switchCharacter('marcus');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private prevPadButtons: boolean[] = [];
  private hadGamepadInput = false;

  private pollGamepad(dt: number): void {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = pads && pads[0];
    if (!pad) return;

    const lx = Math.abs(pad.axes[0] || 0) > 0.14 ? pad.axes[0] : 0;
    const ly = Math.abs(pad.axes[1] || 0) > 0.14 ? -pad.axes[1] : 0;
    const rx = Math.abs(pad.axes[2] || 0) > 0.14 ? pad.axes[2] : 0;
    const ry = Math.abs(pad.axes[3] || 0) > 0.14 ? pad.axes[3] : 0;

    if (lx !== 0 || ly !== 0) {
      this.touchMove = { x: lx, y: ly };
      this.hadGamepadInput = true;
    } else if (this.hadGamepadInput) {
      this.touchMove = { x: 0, y: 0 };
      this.hadGamepadInput = false;
    }
    if (rx !== 0 || ry !== 0) {
      this.rotateCameraByDelta(rx * 480 * dt, ry * 340 * dt);
    }

    const rt = pad.buttons[7]?.value || 0;
    const lt = pad.buttons[6]?.value || 0;
    if (this.activeVehicle && rt > 0.15) {
      this.touchMove.y = rt;
    }
    this.touchBrake = lt > 0.2;
    this.touchSprint = !!pad.buttons[10]?.pressed || (!this.activeVehicle && rt > 0.4);
    this.touchHandbrake = !!pad.buttons[0]?.pressed && !!this.activeVehicle;

    const justPressed = (idx: number) =>
      !!pad.buttons[idx]?.pressed && !this.prevPadButtons[idx];

    if (justPressed(3)) this.triggerPrimaryInteraction(); // Y / Triangle: Enter/Exit/Interact
    if (justPressed(0) && !this.activeVehicle) this.triggerJumpOrHandbrake(); // A / Cross: Jump
    if (justPressed(2)) this.triggerMeleeOrHorn(); // X / Square: Melee / Horn
    if (justPressed(9)) this.pauseGame(); // Start

    this.prevPadButtons = pad.buttons.map((b) => b.pressed);
  }

  private isMouseDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private onMouseDown = (e: MouseEvent) => {
    if (e.target !== this.renderer.domElement) return;
    this.sound.unlock();
    if (this.gamePhase !== 'playing') return;
    this.isMouseDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onDblClick = (e: MouseEvent) => {
    if (e.target !== this.renderer.domElement || this.gamePhase !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    } else {
      this.renderer.domElement.requestPointerLock?.();
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.gamePhase !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.pointerLocked = true;
      this.rotateCameraByDelta(e.movementX, e.movementY);
    } else if (this.isMouseDragging) {
      this.pointerLocked = false;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.rotateCameraByDelta(dx * 1.4, dy * 1.4);
    }
  };

  private onMouseUp = () => {
    this.isMouseDragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.gamePhase !== 'playing') return;
    this.camDist = Math.max(2.5, Math.min(15, this.camDist + e.deltaY * 0.005));
  };

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('dblclick', this.onDblClick);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize);
  }

  public dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('dblclick', this.onDblClick);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
