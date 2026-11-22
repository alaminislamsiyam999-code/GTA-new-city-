import * as THREE from 'three';
import {
  DISTRICTS,
  ENTERABLE_BUILDINGS,
  PROPERTIES,
  ROAD_COORDS,
  ROAD_WIDTH,
  WORLD_COLLECTIBLES,
  getTerrainElevation,
} from '../world/WorldData';
import { TextureBundle } from '../world/ProceduralTextures';
import { EnterableBuilding, InteractivePrompt } from '../types/game';

export interface WallCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface FloorPlatform {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  buildingId?: string;
  floorLabel?: string;
  isRamp?: boolean;
  rampStartZ?: number;
  rampEndZ?: number;
  rampStartY?: number;
  rampEndY?: number;
}

export interface DoorController {
  id: string;
  buildingId: string;
  position: THREE.Vector3;
  leftPivot: THREE.Group;
  rightPivot: THREE.Group;
  isOpen: boolean;
  openAmount: number; // 0..1
}

export interface ElevatorController {
  id: string;
  buildingId: string;
  buildingName: string;
  mesh: THREE.Mesh;
  centerX: number;
  centerZ: number;
  halfSize: number;
  currentY: number;
  targetY: number;
  floors: { level: number; label: string; y: number }[];
}

export interface TrafficLightNode {
  x: number;
  z: number;
  nsBulbs: THREE.MeshStandardMaterial[];
  ewBulbs: THREE.MeshStandardMaterial[];
}

export interface WorldInteractableNode {
  id: string;
  position: THREE.Vector3;
  radius: number;
  prompt: InteractivePrompt;
  mesh?: THREE.Object3D;
  collected?: boolean;
  tvScreenMat?: THREE.MeshStandardMaterial;
  tvOn?: boolean;
}

export interface BuiltWorld {
  wallColliders: WallCollider[];
  floorPlatforms: FloorPlatform[];
  doors: DoorController[];
  elevators: ElevatorController[];
  trafficLights: TrafficLightNode[];
  interactables: WorldInteractableNode[];
  waterMesh: THREE.Mesh;
  streetLightBulbs: THREE.MeshStandardMaterial[];
  skyscraperMaterials: THREE.MeshStandardMaterial[];
  roadMaterials: THREE.MeshStandardMaterial[];
  showroomTurntable: THREE.Group | null;
}

export function constructOpenWorld(scene: THREE.Scene, textures: TextureBundle): BuiltWorld {
  const wallColliders: WallCollider[] = [];
  const floorPlatforms: FloorPlatform[] = [];
  const doors: DoorController[] = [];
  const elevators: ElevatorController[] = [];
  const trafficLights: TrafficLightNode[] = [];
  const interactables: WorldInteractableNode[] = [];
  const streetLightBulbs: THREE.MeshStandardMaterial[] = [];
  const skyscraperMaterials: THREE.MeshStandardMaterial[] = [];
  const roadMaterials: THREE.MeshStandardMaterial[] = [];
  let showroomTurntable: THREE.Group | null = null;

  // 1. Base Ground, Beach, Ocean & Mountains
  const mainGround = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 900),
    new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.92 })
  );
  mainGround.rotation.x = -Math.PI / 2;
  mainGround.position.set(60, -0.04, -30);
  mainGround.receiveShadow = true;
  scene.add(mainGround);

  // Urban concrete plaza underlay inside main city grid
  const cityPaving = new THREE.Mesh(
    new THREE.PlaneGeometry(780, 780),
    new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.85 })
  );
  cityPaving.rotation.x = -Math.PI / 2;
  cityPaving.position.set(0, -0.01, 0);
  cityPaving.receiveShadow = true;
  scene.add(cityPaving);

  // Sunset Beach Sand
  const beachMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 115),
    new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.9 })
  );
  beachMesh.rotation.x = -Math.PI / 2;
  beachMesh.rotation.x = -Math.PI / 2 + 0.025;
  beachMesh.position.set(0, -0.45, 430);
  beachMesh.receiveShadow = true;
  scene.add(beachMesh);

  // Ocean + Emerald River Water
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#0284c7',
    metalness: 0.75,
    roughness: 0.16,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, -0.85, 450);
  scene.add(waterMesh);

  // Emerald River trench strip
  const riverWater = new THREE.Mesh(new THREE.PlaneGeometry(30, 900), waterMat);
  riverWater.rotation.x = -Math.PI / 2;
  riverWater.position.set(310, -0.8, 0);
  scene.add(riverWater);

  // Sunset Marina Wooden Pier & Boat Slip
  const pierMat = new THREE.MeshStandardMaterial({ map: textures.woodFloor, roughness: 0.78 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 112), pierMat);
  pierDeck.position.set(0, 0.9, 432);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  scene.add(pierDeck);
  floorPlatforms.push({
    minX: -9,
    maxX: 9,
    minZ: 376,
    maxZ: 488,
    y: 1.2,
    floorLabel: 'Sunset Marina Pier',
  });
  // Ramp onto Pier from Coastal Sidewalk
  const pierRamp = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 14), pierMat);
  pierRamp.position.set(0, 0.55, 373);
  pierRamp.rotation.x = -0.09;
  scene.add(pierRamp);
  floorPlatforms.push({
    minX: -7,
    maxX: 7,
    minZ: 366,
    maxZ: 378,
    y: 0.6,
    isRamp: true,
    rampStartZ: 366,
    rampEndZ: 378,
    rampStartY: 0.02,
    rampEndY: 1.2,
  });

  // Sierra Vista Mountains geometry in North (z < -385)
  const mtnGeo = new THREE.PlaneGeometry(1100, 320, 44, 18);
  mtnGeo.rotateX(-Math.PI / 2);
  const posAttr = mtnGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i) - 540;
    const h = getTerrainElevation(vx, vz);
    posAttr.setY(i, h);
  }
  mtnGeo.computeVertexNormals();
  const mtnMesh = new THREE.Mesh(
    mtnGeo,
    new THREE.MeshStandardMaterial({ color: '#365314', roughness: 0.94 })
  );
  mtnMesh.position.set(0, -0.05, -540);
  mtnMesh.receiveShadow = true;
  scene.add(mtnMesh);

  // Summit Overlook Platform at (0, 18, -460)
  const overlookDeck = new THREE.Mesh(
    new THREE.BoxGeometry(36, 1.2, 28),
    new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.7 })
  );
  overlookDeck.position.set(0, 17.4, -460);
  scene.add(overlookDeck);
  floorPlatforms.push({
    minX: -18,
    maxX: 18,
    minZ: -474,
    maxZ: -446,
    y: 18.0,
    floorLabel: 'Sierra Vista Summit Overlook',
  });

  // 2. Road Network, Intersections, Bridges & Traffic Lights
  const roadNSMat = new THREE.MeshStandardMaterial({
    map: textures.roadStraight,
    roughness: 0.68,
    metalness: 0.08,
  });
  const roadEWTexture = textures.roadStraight.clone();
  roadEWTexture.needsUpdate = true;
  roadEWTexture.rotation = Math.PI / 2;
  roadEWTexture.center.set(0.5, 0.5);
  const roadEWMat = new THREE.MeshStandardMaterial({
    map: roadEWTexture,
    roughness: 0.68,
    metalness: 0.08,
  });
  const intersectMat = new THREE.MeshStandardMaterial({
    map: textures.roadIntersection,
    roughness: 0.65,
    metalness: 0.08,
  });
  roadMaterials.push(roadNSMat, roadEWMat, intersectMat);

  for (let i = 0; i < ROAD_COORDS.length; i++) {
    const rx = ROAD_COORDS[i];
    for (let j = 0; j < ROAD_COORDS.length; j++) {
      const rz = ROAD_COORDS[j];
      // Intersection tile
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH), intersectMat);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(rx, 0.02, rz);
      tile.receiveShadow = true;
      scene.add(tile);

      // Traffic lights on central/major intersections
      if (Math.abs(rx) <= 240 && Math.abs(rz) <= 240) {
        const poleMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.4 });
        const nsMat = new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 1.1 });
        const ewMat = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.1 });

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6.2, 8), poleMat);
        pole.position.set(rx + 12.2, 3.1, rz + 12.2);
        scene.add(pole);

        const armNS = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 0.18), poleMat);
        armNS.position.set(rx + 10.2, 5.8, rz + 12.2);
        scene.add(armNS);

        const bulbNS = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.35), nsMat);
        bulbNS.position.set(rx + 8.6, 5.5, rz + 12.2);
        scene.add(bulbNS);

        const bulbEW = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.45), ewMat);
        bulbEW.position.set(rx + 12.2, 5.5, rz + 10.2);
        scene.add(bulbEW);

        trafficLights.push({
          x: rx,
          z: rz,
          nsBulbs: [nsMat],
          ewBulbs: [ewMat],
        });
      }

      // Connect North-South segment to next Z
      if (j < ROAD_COORDS.length - 1) {
        const nextZ = ROAD_COORDS[j + 1];
        const segLen = nextZ - rz - ROAD_WIDTH;
        const segMat = roadNSMat.clone();
        const tex = textures.roadStraight.clone();
        tex.needsUpdate = true;
        tex.repeat.set(1, segLen / 28);
        segMat.map = tex;
        roadMaterials.push(segMat);

        const seg = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, segLen), segMat);
        seg.rotation.x = -Math.PI / 2;
        seg.position.set(rx, 0.018, (rz + nextZ) / 2);
        seg.receiveShadow = true;
        scene.add(seg);
      }

      // Connect East-West segment to next X
      if (i < ROAD_COORDS.length - 1) {
        const nextX = ROAD_COORDS[i + 1];
        const segLen = nextX - rx - ROAD_WIDTH;
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(segLen, ROAD_WIDTH), roadEWMat);
        seg.rotation.x = -Math.PI / 2;
        seg.position.set((rx + nextX) / 2, 0.018, rz);
        seg.receiveShadow = true;
        scene.add(seg);

        // If crossing Emerald River (between 240 and 360), add bridge deck & guardrails!
        if (rx === 240 && nextX === 360) {
          const bridgeRailMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.5, roughness: 0.4 });
          [-11.5, 11.5].forEach((oz) => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(38, 1.1, 0.6), bridgeRailMat);
            rail.position.set(310, 0.55, rz + oz);
            scene.add(rail);
          });
        }
      }
    }
  }

  // Mountain Access Road (x = 0, z = -360..-450)
  const mtnRoad = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 96), roadNSMat);
  mtnRoad.position.set(0, 8.8, -408);
  mtnRoad.rotation.x = 0.188;
  scene.add(mtnRoad);
  floorPlatforms.push({
    minX: -8,
    maxX: 8,
    minZ: -454,
    maxZ: -362,
    y: 9,
    isRamp: true,
    rampStartZ: -362,
    rampEndZ: -454,
    rampStartY: 0.02,
    rampEndY: 18.0,
  });

  // Airfield Access Road + Runway 18L/36R (x = 490, z = -220..180)
  const airfieldLink = new THREE.Mesh(new THREE.PlaneGeometry(110, ROAD_WIDTH), roadEWMat);
  airfieldLink.rotation.x = -Math.PI / 2;
  airfieldLink.position.set(415, 0.02, 0);
  scene.add(airfieldLink);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 420),
    new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.75 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(485, 0.015, -20);
  apron.receiveShadow = true;
  scene.add(apron);

  // Runway Centerline stripes
  for (let rz = -200; rz <= 160; rz += 24) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 12),
      new THREE.MeshBasicMaterial({ color: '#f8fafc' })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(505, 0.03, rz);
    scene.add(stripe);
  }

  // Airfield Helipad Circle + Control Tower
  const afHelipad = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshStandardMaterial({ map: textures.helipad, roughness: 0.6 })
  );
  afHelipad.rotation.x = -Math.PI / 2;
  afHelipad.position.set(445, 0.03, -45);
  scene.add(afHelipad);

  const atcTower = new THREE.Mesh(
    new THREE.BoxGeometry(10, 28, 10),
    new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.5 })
  );
  atcTower.position.set(435, 14, -110);
  atcTower.castShadow = true;
  scene.add(atcTower);
  wallColliders.push({ minX: 430, maxX: 440, minY: 0, maxY: 28, minZ: -115, maxZ: -105 });

  // 3. Streetlights along boulevards
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#fde047',
    emissiveIntensity: 0.2,
  });
  streetLightBulbs.push(lampBulbMat);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.6, roughness: 0.4 });

  for (const rx of [-240, -120, 0, 120, 240]) {
    for (let z = -300; z <= 320; z += 60) {
      if (ROAD_COORDS.some((rc) => Math.abs(z - rc) < 18)) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 6), lampPoleMat);
      pole.position.set(rx - 13, 3.5, z);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.45), lampBulbMat);
      head.position.set(rx - 12.3, 6.9, z);
      scene.add(head);
    }
  }

  // 4. Two Interactive Horizon Gas Stations
  const buildGasStation = (gx: number, gz: number, idSuffix: string) => {
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.8, 12),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 })
    );
    canopy.position.set(gx, 5.2, gz);
    canopy.castShadow = true;
    scene.add(canopy);

    [-7, 7].forEach((px) => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 5.2, 0.7),
        new THREE.MeshStandardMaterial({ color: '#f8fafc' })
      );
      pillar.position.set(gx + px, 2.6, gz);
      scene.add(pillar);

      const pump = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 2.1, 0.8),
        new THREE.MeshStandardMaterial({ color: '#1e293b' })
      );
      pump.position.set(gx + px * 0.5, 1.05, gz);
      scene.add(pump);
    });

    interactables.push({
      id: 'fuel_station_' + idSuffix,
      position: new THREE.Vector3(gx, 0.5, gz),
      radius: 9.5,
      prompt: {
        id: 'prompt_fuel_' + idSuffix,
        title: 'Horizon Octane Station',
        subtitle: 'Refuel & Top Up Vehicle ($45)',
        actionKey: 'E',
        actionType: 'refuel-pump',
        cost: 45,
      },
    });
  };
  buildGasStation(152, 48, 'midtown');
  buildGasStation(-278, -155, 'palmhills');

  // 5. Construct All Hollow, Multi-Floor Enterable Buildings
  const glassWallMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    metalness: 0.75,
    roughness: 0.15,
    transparent: true,
    opacity: 0.34,
  });

  for (const bldg of ENTERABLE_BUILDINGS) {
    const res = buildEnterableBuildingMesh(
      scene,
      bldg,
      textures,
      glassWallMat,
      wallColliders,
      floorPlatforms,
      doors,
      elevators,
      interactables
    );
    if (res.turntable) {
      showroomTurntable = res.turntable;
    }
  }

  // 6. Populate Decorative City Skyline, Suburbs, Industrial Harbor & Trees (avoiding roads & enterable footprints!)
  const occupiedRects = ENTERABLE_BUILDINGS.map((b) => ({
    minX: b.position[0] - b.size[0] * 0.5 - 10,
    maxX: b.position[0] + b.size[0] * 0.5 + 10,
    minZ: b.position[2] - b.size[2] * 0.5 - 10,
    maxZ: b.position[2] + b.size[2] * 0.5 + 10,
  }));
  // Keep starting plaza & gas stations clear
  occupiedRects.push({ minX: -38, maxX: 15, minZ: 8, maxZ: 60 });
  occupiedRects.push({ minX: 138, maxX: 168, minZ: 34, maxZ: 64 });
  occupiedRects.push({ minX: -294, maxX: -262, minZ: -170, maxZ: -140 });

  const isAreaFree = (cx: number, cz: number, hw: number, hd: number): boolean => {
    for (const rc of ROAD_COORDS) {
      if (Math.abs(cx - rc) < ROAD_WIDTH * 0.5 + hw + 4) return false;
      if (Math.abs(cz - rc) < ROAD_WIDTH * 0.5 + hd + 4) return false;
    }
    if (cx > 286 && cx < 336) return false; // river
    for (const r of occupiedRects) {
      if (cx + hw > r.minX && cx - hw < r.maxX && cz + hd > r.minZ && cz - hd < r.maxZ) {
        return false;
      }
    }
    return true;
  };

  // Seeded deterministic PRNG so city skyline looks bespoke and consistent every run
  let seed = 421337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const skyMatBase = new THREE.MeshStandardMaterial({
    map: textures.skyscraperGlass,
    emissiveMap: textures.skyscraperEmissive,
    emissive: new THREE.Color('#fef08a'),
    emissiveIntensity: 0.15,
    roughness: 0.25,
    metalness: 0.65,
  });
  skyscraperMaterials.push(skyMatBase);

  const subMat = new THREE.MeshStandardMaterial({ map: textures.residentialWall, roughness: 0.8 });
  const indMat = new THREE.MeshStandardMaterial({ map: textures.industrialWall, roughness: 0.65, metalness: 0.35 });

  // Place district architecture across blocks
  for (let bx = -330; bx <= 220; bx += 48) {
    for (let bz = -330; bz <= 320; bz += 48) {
      const cx = bx + (rand() - 0.5) * 10;
      const cz = bz + (rand() - 0.5) * 10;
      const district = DISTRICTS.find(
        (d) => cx >= d.minX && cx <= d.maxX && cz >= d.minZ && cz <= d.maxZ
      );
      const dId = district?.id || 'midtown';

      let bw = 22;
      let bd = 22;
      let bh = 28;
      let mat: THREE.MeshStandardMaterial = skyMatBase;

      if (dId === 'downtown') {
        bw = 22 + rand() * 10;
        bd = 22 + rand() * 10;
        bh = 36 + rand() * 52;
        mat = skyMatBase;
      } else if (dId === 'palmhills') {
        bw = 14 + rand() * 6;
        bd = 14 + rand() * 6;
        bh = 6.5 + rand() * 5;
        mat = subMat;
      } else if (dId === 'harbor') {
        bw = 24 + rand() * 10;
        bd = 16 + rand() * 8;
        bh = 9 + rand() * 8;
        mat = indMat;
      } else {
        bw = 18 + rand() * 8;
        bd = 18 + rand() * 8;
        bh = 14 + rand() * 20;
        mat = rand() > 0.45 ? skyMatBase : subMat;
      }

      if (!isAreaFree(cx, cz, bw * 0.5, bd * 0.5)) continue;
      occupiedRects.push({
        minX: cx - bw * 0.5 - 3,
        maxX: cx + bw * 0.5 + 3,
        minZ: cz - bd * 0.5 - 3,
        maxZ: cz + bd * 0.5 + 3,
      });

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      mesh.position.set(cx, bh * 0.5, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      wallColliders.push({
        minX: cx - bw * 0.5,
        maxX: cx + bw * 0.5,
        minY: 0,
        maxY: bh,
        minZ: cz - bd * 0.5,
        maxZ: cz + bd * 0.5,
      });
    }
  }

  // 7. Park Benches (interactive Sit spots!) & Palm / Pine Trees
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.75 });
  const pineLeafMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.85 });

  // Palm trees along Sunset Beach & Downtown Plaza
  for (let tx = -340; tx <= 340; tx += 34) {
    const tz = 376;
    if (Math.abs(tx) < 14) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.8, 7), trunkMat);
    trunk.position.set(tx, 3.4, tz);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 7), palmLeafMat);
    crown.position.set(tx, 7.0, tz);
    scene.add(crown);
  }

  // Pine forest in Sierra Vista Mountains
  for (let i = 0; i < 65; i++) {
    const px = (rand() - 0.5) * 700;
    const pz = -395 - rand() * 210;
    if (Math.abs(px) < 22) continue; // keep mountain highway clear
    const py = getTerrainElevation(px, pz);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 3.2, 6), trunkMat);
    trunk.position.set(px, py + 1.6, pz);
    scene.add(trunk);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 6.5, 7), pineLeafMat);
    cone.position.set(px, py + 5.2, pz);
    scene.add(cone);
  }

  // Interactive Park Benches & Street Vending / ATMs outdoors
  const benchPositions: [number, number][] = [
    [-12, 24],
    [16, 24],
    [0, 412],
    [-290, -48],
  ];
  benchPositions.forEach(([bx, bz], idx) => {
    const gy = bz > 380 ? 1.2 : 0;
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.55, 0.75),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.75 })
    );
    bench.position.set(bx, gy + 0.3, bz);
    scene.add(bench);
    interactables.push({
      id: 'bench_outdoor_' + idx,
      position: new THREE.Vector3(bx, gy + 0.5, bz),
      radius: 2.2,
      prompt: {
        id: 'prompt_bench_' + idx,
        title: 'City Promenade Bench',
        subtitle: 'Sit & Relax',
        actionKey: 'E',
        actionType: 'sit-chair',
      },
    });
  });

  // 8. World Collectibles (Golden Horizon Shards & Cash Briefcases)
  const shardMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#eab308',
    emissiveIntensity: 0.8,
    metalness: 0.85,
    roughness: 0.15,
  });
  const caseMat = new THREE.MeshStandardMaterial({
    color: '#10b981',
    emissive: '#059669',
    emissiveIntensity: 0.5,
    metalness: 0.5,
    roughness: 0.3,
  });

  for (const col of WORLD_COLLECTIBLES) {
    const mesh =
      col.type === 'shard'
        ? new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), shardMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.25), caseMat);
    mesh.position.set(col.position[0], col.position[1], col.position[2]);
    scene.add(mesh);

    interactables.push({
      id: col.id,
      position: new THREE.Vector3(col.position[0], col.position[1], col.position[2]),
      radius: 2.8,
      mesh,
      collected: false,
      prompt: {
        id: 'prompt_' + col.id,
        title: col.name,
        subtitle: `Collect (+$${col.cashValue.toLocaleString()} & +${col.scoreValue} PTS)`,
        actionKey: 'E',
        actionType: 'collect-item',
        targetId: col.id,
      },
    });
  }

  return {
    wallColliders,
    floorPlatforms,
    doors,
    elevators,
    trafficLights,
    interactables,
    waterMesh,
    streetLightBulbs,
    skyscraperMaterials,
    roadMaterials,
    showroomTurntable,
  };
}

function buildEnterableBuildingMesh(
  scene: THREE.Scene,
  bldg: EnterableBuilding,
  textures: TextureBundle,
  glassWallMat: THREE.MeshStandardMaterial,
  wallColliders: WallCollider[],
  floorPlatforms: FloorPlatform[],
  doors: DoorController[],
  elevators: ElevatorController[],
  interactables: WorldInteractableNode[]
): { turntable: THREE.Group | null } {
  const [cx, baseY, cz] = bldg.position;
  const [w, h, d] = bldg.size;
  const hw = w * 0.5;
  const hd = d * 0.5;
  const wallThick = 0.45;
  const doorWidth = 4.6;
  const doorHeight = 3.4;

  const wallMat = new THREE.MeshStandardMaterial({ color: bldg.wallColor, roughness: 0.65 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: bldg.accentColor,
    emissive: bldg.accentColor,
    emissiveIntensity: 0.55,
    roughness: 0.3,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: bldg.type === 'villa' || bldg.type === 'apartment' ? textures.woodFloor : textures.marbleFloor,
    roughness: 0.35,
  });

  // Helper to add wall box + collider
  const addSolidWall = (wx: number, wy: number, wz: number, sx: number, sy: number, sz: number, mat: THREE.Material = wallMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(wx, wy, wz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    wallColliders.push({
      minX: wx - sx * 0.5,
      maxX: wx + sx * 0.5,
      minY: wy - sy * 0.5,
      maxY: wy + sy * 0.5,
      minZ: wz - sz * 0.5,
      maxZ: wz + sz * 0.5,
    });
  };

  // Build 4 exterior walls: non-door sides have solid lower wainscot + panoramic upper glass windows!
  const sides: ('north' | 'south' | 'east' | 'west')[] = ['north', 'south', 'east', 'west'];
  for (const side of sides) {
    const isEW = side === 'east' || side === 'west';
    const span = isEW ? d : w;
    const wx = side === 'east' ? cx + hw : side === 'west' ? cx - hw : cx;
    const wz = side === 'south' ? cz + hd : side === 'north' ? cz - hd : cz;

    if (side === bldg.doorSide) {
      // Split around doorway at ground floor, then glass/wall above doorway
      const sideSeg = (span - doorWidth) * 0.5;
      if (isEW) {
        addSolidWall(wx, baseY + h * 0.5, wz - doorWidth * 0.5 - sideSeg * 0.5, wallThick, h, sideSeg, wallMat);
        addSolidWall(wx, baseY + h * 0.5, wz + doorWidth * 0.5 + sideSeg * 0.5, wallThick, h, sideSeg, wallMat);
        if (h > doorHeight) {
          addSolidWall(wx, baseY + doorHeight + (h - doorHeight) * 0.5, wz, wallThick, h - doorHeight, doorWidth, glassWallMat);
        }
      } else {
        addSolidWall(wx - doorWidth * 0.5 - sideSeg * 0.5, baseY + h * 0.5, wz, sideSeg, h, wallThick, wallMat);
        addSolidWall(wx + doorWidth * 0.5 + sideSeg * 0.5, baseY + h * 0.5, wz, sideSeg, h, wallThick, wallMat);
        if (h > doorHeight) {
          addSolidWall(wx, baseY + doorHeight + (h - doorHeight) * 0.5, wz, doorWidth, h - doorHeight, wallThick, glassWallMat);
        }
      }

      // Glowing Neon Sign Header over Entrance
      const signW = isEW ? 0.35 : Math.min(span * 0.72, 14);
      const signD = isEW ? Math.min(span * 0.72, 14) : 0.35;
      const signMesh = new THREE.Mesh(new THREE.BoxGeometry(signW, 0.85, signD), accentMat);
      signMesh.position.set(
        wx + (side === 'east' ? 0.3 : side === 'west' ? -0.3 : 0),
        baseY + doorHeight + 0.65,
        wz + (side === 'south' ? 0.3 : side === 'north' ? -0.3 : 0)
      );
      scene.add(signMesh);

      // Animated Double Glass Doors
      const doorGroup = new THREE.Group();
      doorGroup.position.set(wx, baseY, wz);
      if (side === 'north') doorGroup.rotation.y = Math.PI;
      if (side === 'east') doorGroup.rotation.y = Math.PI / 2;
      if (side === 'west') doorGroup.rotation.y = -Math.PI / 2;
      scene.add(doorGroup);

      const leafMat = new THREE.MeshStandardMaterial({
        color: '#bae6fd',
        metalness: 0.7,
        roughness: 0.15,
        transparent: true,
        opacity: 0.62,
      });

      const leftPivot = new THREE.Group();
      leftPivot.position.set(-doorWidth * 0.5, 0, 0);
      const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth * 0.49, doorHeight, 0.12), leafMat);
      leftLeaf.position.set(doorWidth * 0.245, doorHeight * 0.5, 0);
      leftPivot.add(leftLeaf);

      const rightPivot = new THREE.Group();
      rightPivot.position.set(doorWidth * 0.5, 0, 0);
      const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth * 0.49, doorHeight, 0.12), leafMat);
      rightLeaf.position.set(-doorWidth * 0.245, doorHeight * 0.5, 0);
      rightPivot.add(rightLeaf);

      doorGroup.add(leftPivot, rightPivot);
      doors.push({
        id: 'door_' + bldg.id,
        buildingId: bldg.id,
        position: new THREE.Vector3(wx, baseY + 1.2, wz),
        leftPivot,
        rightPivot,
        isOpen: false,
        openAmount: 0,
      });
    } else {
      // Lower solid wall + Upper transparent panoramic window band
      const solidH = Math.min(h, 2.2);
      if (isEW) {
        addSolidWall(wx, baseY + solidH * 0.5, wz, wallThick, solidH, span, wallMat);
        if (h > solidH) {
          addSolidWall(wx, baseY + solidH + (h - solidH) * 0.5, wz, wallThick * 0.5, h - solidH, span, glassWallMat);
        }
      } else {
        addSolidWall(wx, baseY + solidH * 0.5, wz, span, solidH, wallThick, wallMat);
        if (h > solidH) {
          addSolidWall(wx, baseY + solidH + (h - solidH) * 0.5, wz, span, h - solidH, wallThick * 0.5, glassWallMat);
        }
      }
    }
  }

  // Roof cap for single-story buildings without rooftop terrace
  if (!bldg.hasRooftopAccess) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.45, d + 0.4), wallMat);
    roof.position.set(cx, baseY + h + 0.2, cz);
    roof.castShadow = true;
    scene.add(roof);
  }

  // Interior Warm PointLight for inviting glow day & night
  const interiorLight = new THREE.PointLight('#fef3c7', 1.4, Math.max(w, d) * 1.4);
  interiorLight.position.set(cx, baseY + 4.2, cz);
  scene.add(interiorLight);

  // Build Walkable Floor Slabs, Staircases & Physical Elevator!
  const elevX = cx + hw - 3.2;
  const elevZ = cz - hd + 3.2;

  for (let fi = 0; fi < bldg.floors.length; fi++) {
    const fl = bldg.floors[fi];
    const fy = fl.elevationY;

    if (fi === 0) {
      const groundSlab = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.12, d - 0.5), floorMat);
      groundSlab.position.set(cx, fy, cz);
      groundSlab.receiveShadow = true;
      scene.add(groundSlab);
      floorPlatforms.push({
        minX: cx - hw + 0.3,
        maxX: cx + hw - 0.3,
        minZ: cz - hd + 0.3,
        maxZ: cz + hd - 0.3,
        y: fy + 0.06,
        buildingId: bldg.id,
        floorLabel: fl.label,
      });
    } else {
      // Upper floor slab leaving cut-out shaft on East side for Elevator (elevX) and West side for Stairs!
      const mainSlabW = w - 8.2;
      const slabMesh = new THREE.Mesh(
        new THREE.BoxGeometry(mainSlabW, 0.35, d - 0.6),
        fl.level === 3 && bldg.id === 'bldg_horizon_tower'
          ? new THREE.MeshStandardMaterial({ map: textures.helipad, roughness: 0.5 })
          : floorMat
      );
      slabMesh.position.set(cx - 0.2, fy - 0.15, cz);
      slabMesh.receiveShadow = true;
      scene.add(slabMesh);

      floorPlatforms.push({
        minX: cx - 0.2 - mainSlabW * 0.5,
        maxX: cx - 0.2 + mainSlabW * 0.5 + 0.8,
        minZ: cz - hd + 0.3,
        maxZ: cz + hd - 0.3,
        y: fy,
        buildingId: bldg.id,
        floorLabel: fl.label,
      });

      // Landing bridge next to elevator shaft (overlaps cleanly with elevator exit)
      const landing = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, d - 5.4), floorMat);
      landing.position.set(cx + hw - 2.5, fy - 0.15, cz + 2.5);
      scene.add(landing);
      floorPlatforms.push({
        minX: cx + hw - 5.2,
        maxX: cx + hw - 0.3,
        minZ: cz - hd + 5.0,
        maxZ: cz + hd - 0.3,
        y: fy,
        buildingId: bldg.id,
        floorLabel: fl.label,
      });

      // Rooftop architectural glass parapet on top accessible deck
      if (fi === bldg.floors.length - 1 && bldg.hasRooftopAccess) {
        const parapetMat = new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          transparent: true,
          opacity: 0.42,
          metalness: 0.7,
          roughness: 0.15,
        });
        const pN = new THREE.Mesh(new THREE.BoxGeometry(w, 1.05, 0.18), parapetMat);
        pN.position.set(cx, fy + 0.52, cz - hd);
        const pS = pN.clone();
        pS.position.set(cx, fy + 0.52, cz + hd);
        const pE = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.05, d), parapetMat);
        pE.position.set(cx + hw, fy + 0.52, cz);
        const pW = pE.clone();
        pW.position.set(cx - hw, fy + 0.52, cz);
        scene.add(pN, pS, pE, pW);
      }

      // Walkable Staircase Ramp on West wall connecting previous floor to this floor!
      const prevY = bldg.floors[fi - 1].elevationY;
      const rampStartZ = cz + hd - 3.5;
      const rampEndZ = cz - hd + 3.5;
      const rampLen = Math.abs(rampStartZ - rampEndZ);
      const dy = fy - prevY;
      const hyp = Math.hypot(rampLen, dy);
      const angle = Math.atan2(dy, rampLen);

      const stairRamp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, hyp), floorMat);
      stairRamp.position.set(cx - hw + 2.1, (prevY + fy) * 0.5, cz);
      stairRamp.rotation.x = angle;
      scene.add(stairRamp);

      floorPlatforms.push({
        minX: cx - hw + 0.4,
        maxX: cx - hw + 3.8,
        minZ: rampEndZ,
        maxZ: rampStartZ,
        y: fy,
        buildingId: bldg.id,
        floorLabel: 'Stairwell -> ' + fl.label,
        isRamp: true,
        rampStartZ,
        rampEndZ,
        rampStartY: prevY,
        rampEndY: fy,
      });

      // Top Landing at north end of stairs
      const stairLanding = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 3.6), floorMat);
      stairLanding.position.set(cx - hw + 2.1, fy - 0.15, cz - hd + 2.0);
      scene.add(stairLanding);
      floorPlatforms.push({
        minX: cx - hw + 0.3,
        maxX: cx - hw + 4.0,
        minZ: cz - hd + 0.3,
        maxZ: cz - hd + 3.8,
        y: fy,
        buildingId: bldg.id,
        floorLabel: fl.label,
      });
    }
  }

  // Physical Glass Elevator Car + Call Panels on Every Floor!
  if (bldg.hasElevator && bldg.floors.length > 1) {
    const elevMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.35, 4.2),
      new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#0369a1',
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.2,
      })
    );
    elevMesh.position.set(elevX, 0.08, elevZ);
    scene.add(elevMesh);

    // Shaft guide rails
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, h, 0.25),
      new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8 })
    );
    rail.position.set(elevX + 2.0, baseY + h * 0.5, elevZ - 2.0);
    scene.add(rail);

    const elevId = 'elev_' + bldg.id;
    elevators.push({
      id: elevId,
      buildingId: bldg.id,
      buildingName: bldg.name,
      mesh: elevMesh,
      centerX: elevX,
      centerZ: elevZ,
      halfSize: 2.2,
      currentY: bldg.floors[0].elevationY,
      targetY: bldg.floors[0].elevationY,
      floors: bldg.floors.map((f) => ({ level: f.level, label: f.label, y: f.elevationY })),
    });

    // Place Floor Call Panel at each floor near elevator
    for (const fl of bldg.floors) {
      const kiosk = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 1.4, 0.35),
        new THREE.MeshStandardMaterial({ color: '#0f172a', emissive: '#38bdf8', emissiveIntensity: 0.6 })
      );
      kiosk.position.set(elevX - 2.3, fl.elevationY + 0.7, elevZ + 2.2);
      scene.add(kiosk);

      interactables.push({
        id: `${elevId}_panel_${fl.level}`,
        position: new THREE.Vector3(elevX - 1.2, fl.elevationY + 0.9, elevZ + 1.2),
        radius: 3.8,
        prompt: {
          id: `prompt_${elevId}_${fl.level}`,
          title: `${bldg.name} Elevator`,
          subtitle: 'Select Floor / Ride Glass Lift',
          actionKey: 'E',
          actionType: 'use-elevator',
          targetId: elevId,
        },
      });
    }
  }

  // Populate Interior Counters, Showrooms, Beds, Wardrobes, ATMs & Property Deeds
  let turntable: THREE.Group | null = null;
  const counterMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.4 });

  if (bldg.type === 'dealership') {
    turntable = new THREE.Group();
    turntable.position.set(cx - 4, 0.2, cz - 2);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.25, 24),
      new THREE.MeshStandardMaterial({ color: '#0f172a', emissive: '#ef4444', emissiveIntensity: 0.35 })
    );
    turntable.add(disc);
    // Display supercar body silhouette on turntable
    const displayCar = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.9, 4.4),
      new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.85, roughness: 0.15 })
    );
    displayCar.position.y = 0.65;
    turntable.add(displayCar);
    scene.add(turntable);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.4), counterMat);
    desk.position.set(cx + 5.5, 0.6, cz - 4);
    scene.add(desk);

    interactables.push({
      id: 'kiosk_dealership',
      position: new THREE.Vector3(cx + 5.5, 1.0, cz - 2.5),
      radius: 4.2,
      prompt: {
        id: 'prompt_dealership',
        title: 'Apex Auto Showroom Catalog',
        subtitle: 'Browse, Customize & Buy Vehicles',
        actionKey: 'E',
        actionType: 'open-dealership',
      },
    });
  }

  if (bldg.type === 'boutique') {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.3), counterMat);
    desk.position.set(cx, 0.6, cz + 4);
    scene.add(desk);

    interactables.push({
      id: 'counter_boutique',
      position: new THREE.Vector3(cx, 1.0, cz + 2.5),
      radius: 4.0,
      prompt: {
        id: 'prompt_boutique',
        title: 'Vogue Pacifica Stylist',
        subtitle: 'Customize Hairstyles, Outfits, Jackets & Character',
        actionKey: 'E',
        actionType: 'open-wardrobe',
      },
    });
  }

  if (bldg.type === 'supermarket') {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.1, 1.3), counterMat);
    counter.position.set(cx - 3, 0.6, cz + 4);
    scene.add(counter);

    interactables.push({
      id: 'counter_market',
      position: new THREE.Vector3(cx - 3, 1.0, cz + 2.4),
      radius: 4.0,
      prompt: {
        id: 'prompt_market',
        title: 'FreshMart & Sunset Bistro',
        subtitle: 'Buy Food, Espresso, Medkits & Supplies',
        actionKey: 'E',
        actionType: 'open-shop',
      },
    });

    // ATM inside Market
    const atm = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.9, 0.8),
      new THREE.MeshStandardMaterial({ color: '#0284c7', emissive: '#38bdf8', emissiveIntensity: 0.4 })
    );
    atm.position.set(cx + 6.5, 1.0, cz + 4);
    scene.add(atm);
    interactables.push({
      id: 'atm_market',
      position: new THREE.Vector3(cx + 6.5, 1.0, cz + 2.8),
      radius: 2.8,
      prompt: {
        id: 'prompt_atm_market',
        title: 'PacificTrust ATM',
        subtitle: 'Deposit / Withdraw Cash',
        actionKey: 'E',
        actionType: 'use-atm',
      },
    });
  }

  if (bldg.type === 'garage') {
    const lift = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.3, 6.5),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.5, roughness: 0.4 })
    );
    lift.position.set(cx, 0.25, cz + 1);
    scene.add(lift);

    interactables.push({
      id: 'bay_customs_garage',
      position: new THREE.Vector3(cx, 1.0, cz),
      radius: 6.5,
      prompt: {
        id: 'prompt_garage',
        title: 'Port Customs & Personal Garage',
        subtitle: 'Spawn Owned Vehicles, Respray, Tune Engine & Repair',
        actionKey: 'E',
        actionType: 'open-garage',
      },
    });
  }

  if (bldg.type === 'hospital') {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 1.4), counterMat);
    desk.position.set(cx, 0.6, cz + 4);
    scene.add(desk);

    interactables.push({
      id: 'desk_hospital',
      position: new THREE.Vector3(cx, 1.0, cz + 2.2),
      radius: 4.0,
      prompt: {
        id: 'prompt_hospital',
        title: 'Emergency Medical Triage',
        subtitle: 'Restore Full Health & Stamina ($50)',
        actionKey: 'E',
        actionType: 'heal-hospital',
        cost: 50,
      },
    });
  }

  if (bldg.type === 'police') {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 1.4), counterMat);
    desk.position.set(cx, 0.6, cz - 4);
    scene.add(desk);

    interactables.push({
      id: 'desk_police',
      position: new THREE.Vector3(cx, 1.0, cz - 2.2),
      radius: 4.0,
      prompt: {
        id: 'prompt_police',
        title: 'PPD Precinct Front Desk',
        subtitle: 'Pay Citation & Clear Wanted Level ($250)',
        actionKey: 'E',
        actionType: 'pay-fine',
        cost: 250,
      },
    });
  }

  // Lobby ATM in Horizon Tower 1F
  if (bldg.id === 'bldg_horizon_tower') {
    const lobbyDesk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.15, 1.5), counterMat);
    lobbyDesk.position.set(cx - 2, 0.65, cz - 4);
    scene.add(lobbyDesk);

    const atm = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.0, 0.8),
      new THREE.MeshStandardMaterial({ color: '#0284c7', emissive: '#38bdf8', emissiveIntensity: 0.45 })
    );
    atm.position.set(cx + 5, 1.05, cz - 8);
    scene.add(atm);

    interactables.push({
      id: 'atm_tower_lobby',
      position: new THREE.Vector3(cx + 5, 1.0, cz - 6.8),
      radius: 2.8,
      prompt: {
        id: 'prompt_atm_tower',
        title: 'Horizon Tower Private ATM',
        subtitle: 'Access Bank Account & Property Income',
        actionKey: 'E',
        actionType: 'use-atm',
      },
    });
  }

  // Residential / Penthouse Safehouse Amenities (Bed, Wardrobe, Interactive TV, Lounge Chair & Deed Sign!)
  if (bldg.propertyId) {
    const propDef = PROPERTIES.find((p) => p.id === bldg.propertyId)!;
    const suiteY = bldg.id === 'bldg_horizon_tower' ? 12.0 : 0.08;

    // Property Deed Kiosk outside or at suite entrance
    const deedX = bldg.doorSide === 'east' ? cx + hw + 2.4 : cx - 4.5;
    const deedZ =
      bldg.doorSide === 'south'
        ? cz + hd + 2.4
        : bldg.doorSide === 'north'
        ? cz - hd - 2.4
        : cz + 4.5;

    const signPost = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.8, 0.35),
      new THREE.MeshStandardMaterial({ color: '#0f172a', emissive: '#eab308', emissiveIntensity: 0.45 })
    );
    signPost.position.set(deedX, 0.95, deedZ);
    scene.add(signPost);

    interactables.push({
      id: 'deed_' + propDef.id,
      position: new THREE.Vector3(deedX, 1.0, deedZ),
      radius: 3.2,
      prompt: {
        id: 'prompt_deed_' + propDef.id,
        title: propDef.name,
        subtitle: `Real Estate Deed ($${propDef.price.toLocaleString()} • +$${propDef.dailyIncome}/day)`,
        actionKey: 'E',
        actionType: 'buy-property',
        targetId: propDef.id,
        cost: propDef.price,
      },
    });

    // Bed inside suite
    const bedFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.65, 3.2),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 })
    );
    bedFrame.position.set(cx - 4.2, suiteY + 0.35, cz - 3.5);
    scene.add(bedFrame);

    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.25, 2.9),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.85 })
    );
    mattress.position.set(cx - 4.2, suiteY + 0.75, cz - 3.5);
    scene.add(mattress);

    interactables.push({
      id: 'bed_' + propDef.id,
      position: new THREE.Vector3(cx - 4.2, suiteY + 0.9, cz - 3.5),
      radius: 2.8,
      prompt: {
        id: 'prompt_bed_' + propDef.id,
        title: 'Luxury Master Bed',
        subtitle: 'Sleep 6 Hours, Restore Health & Auto-Save',
        actionKey: 'E',
        actionType: 'sleep-bed',
        targetId: propDef.id,
      },
    });

    // Personal Walk-in Wardrobe Closet
    const closet = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.5, 1.0),
      new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.5 })
    );
    closet.position.set(cx + 2.5, suiteY + 1.25, cz - 5.2);
    scene.add(closet);

    interactables.push({
      id: 'wardrobe_' + propDef.id,
      position: new THREE.Vector3(cx + 2.5, suiteY + 1.0, cz - 4.0),
      radius: 2.6,
      prompt: {
        id: 'prompt_wardrobe_' + propDef.id,
        title: 'Personal Safehouse Wardrobe',
        subtitle: 'Change Outfits, Clothing & Character',
        actionKey: 'E',
        actionType: 'open-wardrobe',
        targetId: propDef.id,
      },
    });

    // Lounge Sofa + Interactive Widescreen TV
    const sofa = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.7, 1.2),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 })
    );
    sofa.position.set(cx - 0.5, suiteY + 0.35, cz + 2.2);
    scene.add(sofa);

    const tvScreenMat = new THREE.MeshStandardMaterial({
      color: '#09090b',
      emissive: '#38bdf8',
      emissiveIntensity: 0.15,
    });
    const tvMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.45, 0.14), tvScreenMat);
    tvMesh.position.set(cx - 0.5, suiteY + 1.5, cz + 5.2);
    scene.add(tvMesh);

    interactables.push({
      id: 'tv_' + propDef.id,
      position: new THREE.Vector3(cx - 0.5, suiteY + 1.0, cz + 3.2),
      radius: 3.0,
      tvScreenMat,
      tvOn: false,
      prompt: {
        id: 'prompt_tv_' + propDef.id,
        title: 'Horizon 8K Smart TV',
        subtitle: 'Toggle Pacifica News Broadcast',
        actionKey: 'E',
        actionType: 'watch-tv',
        targetId: propDef.id,
      },
    });
  }

  return { turntable };
}
