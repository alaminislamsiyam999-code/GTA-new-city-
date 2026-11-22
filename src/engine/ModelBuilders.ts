import * as THREE from 'three';
import { CharacterCustomization, VehicleSpec } from '../types/game';

export interface HumanoidRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  phoneMesh: THREE.Mesh;
  umbrellaMesh: THREE.Group;
}

export function buildHumanoidRig(custom: CharacterCustomization, isPolice = false): HumanoidRig {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const skinMat = new THREE.MeshStandardMaterial({
    color: custom.skinTone,
    roughness: 0.65,
  });

  const jacketColor = isPolice ? '#0f172a' : custom.jacketColor;
  const shirtColor = isPolice ? '#1e3a8a' : custom.shirtColor;
  const trouserColor = isPolice ? '#09090b' : custom.trouserColor;

  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: custom.jacketStyle === 'leather-racer' ? 0.32 : 0.72,
    metalness: custom.jacketStyle === 'leather-racer' ? 0.15 : 0.04,
  });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75 });
  const trouserMat = new THREE.MeshStandardMaterial({ color: trouserColor, roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: custom.shoeColor, roughness: 0.5 });

  // Pelvis
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.24), trouserMat);
  pelvis.castShadow = true;
  hips.add(pelvis);

  // Torso
  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.54, 0.26),
    custom.jacketStyle === 'casual-tee' ? shirtMat : jacketMat
  );
  chest.position.y = 0.28;
  chest.castShadow = true;
  torso.add(chest);

  // Inner shirt V-panel / collar
  const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.27), shirtMat);
  shirtPanel.position.set(0, 0.29, 0.005);
  torso.add(shirtPanel);

  if (isPolice) {
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.07, 0.02),
      new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.85, roughness: 0.2 })
    );
    badge.position.set(-0.12, 0.42, 0.14);
    torso.add(badge);
  }

  if (custom.accessory === 'gold-chain' && !isPolice) {
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.014, 6, 16),
      new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.9, roughness: 0.2 })
    );
    chain.position.set(0, 0.5, 0.11);
    chain.rotation.x = 0.35;
    torso.add(chain);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 10), skinMat);
  neck.position.y = 0.03;
  head.add(neck);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.26), skinMat);
  skull.position.y = 0.2;
  skull.castShadow = true;
  head.add(skull);

  // Facial features (eyes, brows, subtle nose & mouth)
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
  [-0.055, 0.055].forEach((ex) => {
    const ew = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.026, 0.01), eyeWhiteMat);
    ew.position.set(ex, 0.22, 0.132);
    head.add(ew);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 0.014), pupilMat);
    pupil.position.set(ex, 0.22, 0.135);
    head.add(pupil);
  });
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.035), skinMat);
  nose.position.set(0, 0.19, 0.14);
  head.add(nose);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.016, 0.01),
    new THREE.MeshBasicMaterial({ color: '#7f1d1d' })
  );
  mouth.position.set(0, 0.13, 0.132);
  head.add(mouth);

  // Hair / Hat
  const hairMat = new THREE.MeshStandardMaterial({ color: custom.hairColor, roughness: 0.85 });
  if (isPolice || custom.accessory === 'cap') {
    const capColor = isPolice ? '#0f172a' : jacketColor;
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.6 });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.28), capMat);
    crown.position.set(0, 0.33, 0);
    head.add(crown);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.025, 0.14), capMat);
    visor.position.set(0, 0.29, 0.17);
    head.add(visor);
  } else {
    const hairTop = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.27,
        custom.hairStyle === 'buzz' ? 0.05 : 0.1,
        0.28
      ),
      hairMat
    );
    hairTop.position.set(0, 0.33, -0.01);
    head.add(hairTop);

    if (custom.hairStyle === 'ponytail') {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.09), hairMat);
      tail.position.set(0, 0.22, -0.17);
      tail.rotation.x = 0.25;
      head.add(tail);
    } else if (custom.hairStyle === 'slick-back' || custom.hairStyle === 'textured-crop') {
      const sideBack = new THREE.Mesh(new THREE.BoxGeometry(0.275, 0.16, 0.16), hairMat);
      sideBack.position.set(0, 0.25, -0.07);
      head.add(sideBack);
    }
  }

  // Eyewear
  if (custom.accessory === 'aviators' || custom.accessory === 'cyber-visor' || isPolice) {
    const visorMat = new THREE.MeshStandardMaterial({
      color: custom.accessory === 'cyber-visor' ? '#38bdf8' : '#09090b',
      emissive: custom.accessory === 'cyber-visor' ? '#0284c7' : '#000000',
      emissiveIntensity: custom.accessory === 'cyber-visor' ? 0.7 : 0,
      metalness: 0.85,
      roughness: 0.15,
    });
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.055, 0.03), visorMat);
    glasses.position.set(0, 0.225, 0.138);
    head.add(glasses);
  }

  // Arms
  const sleeveMat = custom.jacketStyle === 'casual-tee' ? skinMat : jacketMat;
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.29, 0.5, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.52, 0.13), sleeveMat);
    upper.position.y = -0.22;
    upper.castShadow = true;
    armPivot.add(upper);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), skinMat);
    hand.position.y = -0.5;
    armPivot.add(hand);
    torso.add(armPivot);
    return armPivot;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Handheld Smartphone mesh
  const phoneMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.015, 0.15),
    new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: '#38bdf8',
      emissiveIntensity: 0.85,
    })
  );
  phoneMesh.position.set(0, -0.54, 0.09);
  phoneMesh.visible = false;
  rightArm.add(phoneMesh);

  // Rain Umbrella for NPCs in rainy weather
  const umbrellaMesh = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.85, 6),
    new THREE.MeshStandardMaterial({ color: '#cbd5e1' })
  );
  pole.position.set(0, 0.35, 0.08);
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.22, 10),
    new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 })
  );
  canopy.position.set(0, 0.78, 0.08);
  umbrellaMesh.add(pole, canopy);
  umbrellaMesh.position.set(0, -0.45, 0);
  umbrellaMesh.visible = false;
  leftArm.add(umbrellaMesh);

  // Legs
  const makeLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.11, -0.06, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.74, 0.16), trouserMat);
    legMesh.position.y = -0.37;
    legMesh.castShadow = true;
    legPivot.add(legMesh);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.25), shoeMat);
    shoe.position.set(0, -0.78, 0.04);
    shoe.castShadow = true;
    legPivot.add(shoe);
    hips.add(legPivot);
    return legPivot;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  return {
    root,
    hips,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    phoneMesh,
    umbrellaMesh,
  };
}

export interface VehicleRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  bodyPaintMesh: THREE.Mesh;
  paintMaterial: THREE.MeshStandardMaterial;
  wheels: THREE.Group[];
  frontWheelSteerPivots: THREE.Group[];
  steeringWheel: THREE.Mesh | null;
  driverDoorPivot: THREE.Group | null;
  headlightMeshes: THREE.Mesh[];
  headlightCones: THREE.Mesh[];
  brakeLightMeshes: THREE.Mesh[];
  policeRedLight: THREE.Mesh | null;
  policeBlueLight: THREE.Mesh | null;
  mainRotor: THREE.Group | null;
  tailRotor: THREE.Group | null;
  damageSmokeOffset: THREE.Vector3;
}

export function buildVehicleRig(spec: VehicleSpec, customColor?: string): VehicleRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const color = customColor || spec.defaultColor;
  // Physical material with a clearcoat layer gives the glossy, showroom-style paint
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.62,
    roughness: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    metalness: 0.3,
    roughness: 0.65,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.62,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    emissive: '#fef08a',
    emissiveIntensity: 0.9,
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.35,
  });

  const [w, h, l] = spec.dimensions;
  const wheels: THREE.Group[] = [];
  const frontWheelSteerPivots: THREE.Group[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const headlightCones: THREE.Mesh[] = [];
  const brakeLightMeshes: THREE.Mesh[] = [];
  let steeringWheel: THREE.Mesh | null = null;
  let driverDoorPivot: THREE.Group | null = null;
  let policeRedLight: THREE.Mesh | null = null;
  let policeBlueLight: THREE.Mesh | null = null;
  let mainRotor: THREE.Group | null = null;
  let tailRotor: THREE.Group | null = null;
  let bodyPaintMesh: THREE.Mesh;

  // --- HELICOPTER ---
  if (spec.category === 'helicopter') {
    bodyPaintMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.55, 3.8), paintMaterial);
    bodyPaintMesh.position.set(0, 1.35, 0.3);
    bodyPaintMesh.castShadow = true;
    bodyGroup.add(bodyPaintMesh);

    const noseBubble = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.25, 1.6), glassMat);
    noseBubble.position.set(0, 1.3, 2.3);
    bodyGroup.add(noseBubble);

    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.48, 3.8), paintMaterial);
    tailBoom.position.set(0, 1.55, -3.1);
    tailBoom.castShadow = true;
    bodyGroup.add(tailBoom);

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.25, 0.7), paintMaterial);
    tailFin.position.set(0, 2.0, -4.85);
    bodyGroup.add(tailFin);

    // Skids
    [-0.95, 0.95].forEach((sx) => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 8), darkTrimMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, 0.12, 0.4);
      bodyGroup.add(skid);

      const strutF = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), darkTrimMat);
      strutF.position.set(sx * 0.85, 0.45, 1.2);
      bodyGroup.add(strutF);

      const strutR = strutF.clone();
      strutR.position.z = -0.5;
      bodyGroup.add(strutR);
    });

    // Main Rotor
    mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.32, 0.3);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 8), darkTrimMat);
    mainRotor.add(mast);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.04, 0.28), darkTrimMat);
    blade1.position.y = 0.14;
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 7.8), darkTrimMat);
    blade2.position.y = 0.14;
    mainRotor.add(blade1, blade2);
    bodyGroup.add(mainRotor);

    // Tail Rotor
    tailRotor = new THREE.Group();
    tailRotor.position.set(0.16, 2.1, -4.85);
    const tb1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.35, 0.14), darkTrimMat);
    const tb2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 1.35), darkTrimMat);
    tailRotor.add(tb1, tb2);
    bodyGroup.add(tailRotor);

    return {
      root,
      bodyGroup,
      bodyPaintMesh,
      paintMaterial,
      wheels,
      frontWheelSteerPivots,
      steeringWheel,
      driverDoorPivot,
      headlightMeshes,
      headlightCones,
      brakeLightMeshes,
      policeRedLight,
      policeBlueLight,
      mainRotor,
      tailRotor,
      damageSmokeOffset: new THREE.Vector3(0, 2.0, -0.6),
    };
  }

  // --- SPEEDBOAT ---
  if (spec.category === 'boat') {
    bodyPaintMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, l * 0.82), paintMaterial);
    bodyPaintMesh.position.set(0, 0.55, -0.3);
    bodyPaintMesh.castShadow = true;
    bodyGroup.add(bodyPaintMesh);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(w * 0.52, l * 0.36, 4), paintMaterial);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 0.62, l * 0.44);
    bodyGroup.add(bow);

    const deckPit = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.25, l * 0.55), darkTrimMat);
    deckPit.position.set(0, 0.92, -0.4);
    bodyGroup.add(deckPit);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.45, 0.6), glassMat);
    windshield.position.set(0, 1.18, 0.65);
    windshield.rotation.x = -0.35;
    bodyGroup.add(windshield);

    return {
      root,
      bodyGroup,
      bodyPaintMesh,
      paintMaterial,
      wheels,
      frontWheelSteerPivots,
      steeringWheel,
      driverDoorPivot,
      headlightMeshes,
      headlightCones,
      brakeLightMeshes,
      policeRedLight,
      policeBlueLight,
      mainRotor,
      tailRotor,
      damageSmokeOffset: new THREE.Vector3(0, 0.9, -2.5),
    };
  }

  // --- MOTORCYCLE & BICYCLE ---
  if (spec.category === 'motorcycle' || spec.category === 'bicycle') {
    const isBike = spec.category === 'bicycle';
    const wheelR = isBike ? 0.36 : 0.39;
    const wheelThick = isBike ? 0.08 : 0.22;

    bodyPaintMesh = new THREE.Mesh(
      new THREE.BoxGeometry(isBike ? 0.12 : 0.42, isBike ? 0.38 : 0.48, l * 0.55),
      paintMaterial
    );
    bodyPaintMesh.position.set(0, wheelR + 0.34, 0);
    bodyPaintMesh.castShadow = true;
    bodyGroup.add(bodyPaintMesh);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(isBike ? 0.18 : 0.36, 0.12, 0.55), darkTrimMat);
    seat.position.set(0, wheelR + 0.58, -0.22);
    bodyGroup.add(seat);

    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), darkTrimMat);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, wheelR + 0.72, l * 0.26);
    bodyGroup.add(handleBar);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.1), headlightMat);
    hl.position.set(0, wheelR + 0.62, l * 0.34);
    bodyGroup.add(hl);
    headlightMeshes.push(hl);

    [l * 0.35, -l * 0.35].forEach((wz, idx) => {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(0, wheelR, wz);
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelR, wheelR, wheelThick, 16),
        darkTrimMat
      );
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);
      steerPivot.add(wheelGroup);
      root.add(steerPivot);
      wheels.push(wheelGroup);
      if (idx === 0) frontWheelSteerPivots.push(steerPivot);
    });

    return {
      root,
      bodyGroup,
      bodyPaintMesh,
      paintMaterial,
      wheels,
      frontWheelSteerPivots,
      steeringWheel,
      driverDoorPivot,
      headlightMeshes,
      headlightCones,
      brakeLightMeshes,
      policeRedLight,
      policeBlueLight,
      mainRotor,
      tailRotor,
      damageSmokeOffset: new THREE.Vector3(0, 0.7, -0.4),
    };
  }

  // --- 4-WHEEL AUTOMOBILES, SUVS, TRUCKS & BUSES ---
  const wheelRadius = spec.category === 'bus' || spec.category === 'truck' ? 0.52 : 0.38;
  const wheelWidth = spec.category === 'supercar' || spec.category === 'sports' ? 0.3 : 0.26;
  const chassisY = wheelRadius + 0.24;

  const lowerHeight =
    spec.category === 'bus'
      ? h * 0.88
      : spec.category === 'truck'
      ? h * 0.38
      : h * 0.46;

  bodyPaintMesh = new THREE.Mesh(new THREE.BoxGeometry(w, lowerHeight, l), paintMaterial);
  bodyPaintMesh.position.set(0, chassisY + lowerHeight * 0.36, 0);
  bodyPaintMesh.castShadow = true;
  bodyPaintMesh.receiveShadow = true;
  bodyGroup.add(bodyPaintMesh);

  // Cabin / Greenhouse + Interior seats + Dashboard + Steering wheel
  if (spec.category === 'bus') {
    const windowBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h * 0.36, l * 0.92), glassMat);
    windowBand.position.set(0, chassisY + lowerHeight * 0.55, 0);
    bodyGroup.add(windowBand);
  } else if (spec.category === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.58, l * 0.3), paintMaterial);
    cab.position.set(0, chassisY + h * 0.44, l * 0.32);
    cab.castShadow = true;
    bodyGroup.add(cab);

    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.28, l * 0.24), glassMat);
    cabGlass.position.set(0, chassisY + h * 0.56, l * 0.35);
    bodyGroup.add(cabGlass);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.98, h * 0.68, l * 0.64),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.6 })
    );
    cargoBox.position.set(0, chassisY + h * 0.5, -l * 0.17);
    cargoBox.castShadow = true;
    bodyGroup.add(cargoBox);
  } else {
    const cabinLength = spec.category === 'pickup' ? l * 0.42 : l * 0.54;
    const cabinOffsetZ = spec.category === 'pickup' ? l * 0.08 : -l * 0.04;
    const cabinHeight = h * 0.46;

    // Interior seats & dashboard visible inside glass!
    const interiorFloor = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.82, 0.08, cabinLength * 0.88),
      darkTrimMat
    );
    interiorFloor.position.set(0, chassisY + lowerHeight * 0.65, cabinOffsetZ);
    bodyGroup.add(interiorFloor);

    [-w * 0.22, w * 0.22].forEach((sx) => {
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.14), darkTrimMat);
      seatBack.position.set(sx, chassisY + lowerHeight * 0.85, cabinOffsetZ - 0.18);
      bodyGroup.add(seatBack);
    });

    steeringWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 6, 14),
      darkTrimMat
    );
    steeringWheel.position.set(-w * 0.22, chassisY + lowerHeight * 0.92, cabinOffsetZ + cabinLength * 0.28);
    steeringWheel.rotation.x = -0.35;
    bodyGroup.add(steeringWheel);

    // Cabin Roof Pillars + Glass
    const cabinGlass = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.86, cabinHeight * 0.88, cabinLength),
      glassMat
    );
    cabinGlass.position.set(0, chassisY + lowerHeight * 0.8 + cabinHeight * 0.35, cabinOffsetZ);
    bodyGroup.add(cabinGlass);

    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.84, 0.09, cabinLength * 0.82),
      spec.category === 'emergency' ? new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 }) : paintMaterial
    );
    roofCap.position.set(0, chassisY + lowerHeight * 0.8 + cabinHeight * 0.8, cabinOffsetZ);
    roofCap.castShadow = true;
    bodyGroup.add(roofCap);

    // Hinged Left Driver Door for realistic entry/exit animation
    driverDoorPivot = new THREE.Group();
    driverDoorPivot.position.set(-w * 0.5, chassisY + lowerHeight * 0.36, cabinOffsetZ + cabinLength * 0.42);
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, lowerHeight * 0.92, cabinLength * 0.72),
      spec.category === 'emergency'
        ? new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 })
        : paintMaterial
    );
    doorPanel.position.set(0, 0, -cabinLength * 0.36);
    driverDoorPivot.add(doorPanel);
    bodyGroup.add(driverDoorPivot);

    // Rear spoiler on Supercar / Sports car
    if (spec.category === 'supercar' || spec.category === 'sports') {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.06, 0.32), darkTrimMat);
      wing.position.set(0, chassisY + lowerHeight * 0.94, -l * 0.45);
      bodyGroup.add(wing);
    }

    // Emergency Police Lightbar
    if (spec.category === 'emergency') {
      policeRedLight = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.34, 0.14, 0.24),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.2 })
      );
      policeRedLight.position.set(-w * 0.18, chassisY + lowerHeight * 0.8 + cabinHeight * 0.92, cabinOffsetZ);
      policeBlueLight = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.34, 0.14, 0.24),
        new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: '#3b82f6', emissiveIntensity: 1.2 })
      );
      policeBlueLight.position.set(w * 0.18, chassisY + lowerHeight * 0.8 + cabinHeight * 0.92, cabinOffsetZ);
      bodyGroup.add(policeRedLight, policeBlueLight);
    }
  }

  // Front Grille + Bumpers
  const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.58, lowerHeight * 0.45, 0.08), darkTrimMat);
  frontGrille.position.set(0, chassisY + lowerHeight * 0.28, l * 0.5 + 0.01);
  bodyGroup.add(frontGrille);

  // Headlights + Volumetric Night Light Cones
  const coneGeo = new THREE.ConeGeometry(1.9, 13, 12, 1, true);
  coneGeo.translate(0, -6.5, 0);
  coneGeo.rotateX(-Math.PI / 2);
  const coneMat = new THREE.MeshBasicMaterial({
    color: '#fef9c3',
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  [-w * 0.36, w * 0.36].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, 0.16, 0.08), headlightMat);
    hl.position.set(hx, chassisY + lowerHeight * 0.42, l * 0.5 + 0.02);
    bodyGroup.add(hl);
    headlightMeshes.push(hl);

    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(hx, chassisY + lowerHeight * 0.35, l * 0.5 + 0.1);
    cone.visible = false;
    bodyGroup.add(cone);
    headlightCones.push(cone);

    const bl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, 0.16, 0.08), brakeMat.clone());
    bl.position.set(hx, chassisY + lowerHeight * 0.44, -l * 0.5 - 0.02);
    bodyGroup.add(bl);
    brakeLightMeshes.push(bl);
  });

  // 4 Independent Wheels (Front pair steerable, all 4 rotate with speed)
  const wheelZFront = l * 0.33;
  const wheelZRear = -l * 0.33;
  const wheelX = w * 0.48;
  const rimMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.25 });

  [
    [-wheelX, wheelZFront, true],
    [wheelX, wheelZFront, true],
    [-wheelX, wheelZRear, false],
    [wheelX, wheelZRear, false],
  ].forEach(([wx, wz, isFront]) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx as number, wheelRadius, wz as number);

    const spinGroup = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16),
      darkTrimMat
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    spinGroup.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, wheelWidth + 0.02, 10),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    spinGroup.add(rim);

    steerPivot.add(spinGroup);
    root.add(steerPivot);
    wheels.push(spinGroup);
    if (isFront) frontWheelSteerPivots.push(steerPivot);
  });

  return {
    root,
    bodyGroup,
    bodyPaintMesh,
    paintMaterial,
    wheels,
    frontWheelSteerPivots,
    steeringWheel,
    driverDoorPivot,
    headlightMeshes,
    headlightCones,
    brakeLightMeshes,
    policeRedLight,
    policeBlueLight,
    mainRotor,
    tailRotor,
    damageSmokeOffset: new THREE.Vector3(0, chassisY + lowerHeight * 0.85, l * 0.34),
  };
}
