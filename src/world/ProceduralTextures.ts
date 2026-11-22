import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export interface TextureBundle {
  roadStraight: THREE.CanvasTexture;
  roadIntersection: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  skyscraperGlass: THREE.CanvasTexture;
  skyscraperEmissive: THREE.CanvasTexture;
  residentialWall: THREE.CanvasTexture;
  industrialWall: THREE.CanvasTexture;
  marbleFloor: THREE.CanvasTexture;
  woodFloor: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  helipad: THREE.CanvasTexture;
}

export function buildProceduralTextures(): TextureBundle {
  // 1. Road Straight (2-way 4-lane boulevard with dashed white lines & double yellow center)
  const [roadC, rCtx] = makeCanvas(512, 512);
  rCtx.fillStyle = '#232730';
  rCtx.fillRect(0, 0, 512, 512);
  // Subtle asphalt grain
  for (let i = 0; i < 4500; i++) {
    const v = 28 + Math.floor(Math.random() * 24);
    rCtx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    rCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // Outer shoulder lines
  rCtx.fillStyle = '#cbd5e1';
  rCtx.fillRect(18, 0, 6, 512);
  rCtx.fillRect(488, 0, 6, 512);
  // Double yellow center line
  rCtx.fillStyle = '#eab308';
  rCtx.fillRect(249, 0, 5, 512);
  rCtx.fillRect(258, 0, 5, 512);
  // Dashed lane dividers
  rCtx.fillStyle = '#e2e8f0';
  for (let y = 16; y < 512; y += 64) {
    rCtx.fillRect(132, y, 5, 32);
    rCtx.fillRect(375, y, 5, 32);
  }
  const roadStraight = new THREE.CanvasTexture(roadC);
  roadStraight.wrapS = THREE.RepeatWrapping;
  roadStraight.wrapT = THREE.RepeatWrapping;
  roadStraight.colorSpace = THREE.SRGBColorSpace;

  // 2. Road Intersection with zebra crosswalks
  const [intC, iCtx] = makeCanvas(512, 512);
  iCtx.fillStyle = '#22262f';
  iCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3500; i++) {
    const v = 30 + Math.floor(Math.random() * 20);
    iCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    iCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  iCtx.fillStyle = '#e2e8f0';
  // Zebra stripes on 4 sides
  for (let s = 48; s <= 440; s += 36) {
    iCtx.fillRect(s, 14, 18, 44); // north
    iCtx.fillRect(s, 454, 18, 44); // south
    iCtx.fillRect(14, s, 44, 18); // west
    iCtx.fillRect(454, s, 44, 18); // east
  }
  const roadIntersection = new THREE.CanvasTexture(intC);
  roadIntersection.colorSpace = THREE.SRGBColorSpace;

  // 3. Sidewalk concrete paver
  const [swC, swCtx] = makeCanvas(256, 256);
  swCtx.fillStyle = '#94a3b8';
  swCtx.fillRect(0, 0, 256, 256);
  swCtx.strokeStyle = '#64748b';
  swCtx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    swCtx.beginPath();
    swCtx.moveTo(x, 0);
    swCtx.lineTo(x, 256);
    swCtx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    swCtx.beginPath();
    swCtx.moveTo(0, y);
    swCtx.lineTo(256, y);
    swCtx.stroke();
  }
  const sidewalk = new THREE.CanvasTexture(swC);
  sidewalk.wrapS = THREE.RepeatWrapping;
  sidewalk.wrapT = THREE.RepeatWrapping;
  sidewalk.repeat.set(8, 8);
  sidewalk.colorSpace = THREE.SRGBColorSpace;

  // 4. Skyscraper Glass Facade + Nighttime Emissive Window Map
  const [skyC, skyCtx] = makeCanvas(512, 512);
  const [emiC, emiCtx] = makeCanvas(512, 512);
  skyCtx.fillStyle = '#1e293b';
  skyCtx.fillRect(0, 0, 512, 512);
  emiCtx.fillStyle = '#000000';
  emiCtx.fillRect(0, 0, 512, 512);

  const cols = 8;
  const rows = 16;
  const cw = 512 / cols;
  const ch = 512 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.38;
      const warm = Math.random() > 0.45;
      skyCtx.fillStyle = lit
        ? warm
          ? '#475569'
          : '#334155'
        : '#0f172a';
      skyCtx.fillRect(c * cw + 5, r * ch + 4, cw - 10, ch - 8);

      // Mullion highlight
      skyCtx.strokeStyle = '#64748b';
      skyCtx.lineWidth = 1.5;
      skyCtx.strokeRect(c * cw + 4, r * ch + 3, cw - 8, ch - 6);

      if (lit) {
        emiCtx.fillStyle = warm ? '#fde68a' : '#bae6fd';
        emiCtx.fillRect(c * cw + 6, r * ch + 5, cw - 12, ch - 10);
      }
    }
  }
  const skyscraperGlass = new THREE.CanvasTexture(skyC);
  skyscraperGlass.wrapS = THREE.RepeatWrapping;
  skyscraperGlass.wrapT = THREE.RepeatWrapping;
  skyscraperGlass.colorSpace = THREE.SRGBColorSpace;

  const skyscraperEmissive = new THREE.CanvasTexture(emiC);
  skyscraperEmissive.wrapS = THREE.RepeatWrapping;
  skyscraperEmissive.wrapT = THREE.RepeatWrapping;
  skyscraperEmissive.colorSpace = THREE.SRGBColorSpace;

  // 5. Residential Facade
  const [resC, resCtx] = makeCanvas(256, 256);
  resCtx.fillStyle = '#e2d9c8';
  resCtx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      resCtx.fillStyle = '#334155';
      resCtx.fillRect(c * 64 + 14, r * 64 + 12, 36, 38);
      resCtx.strokeStyle = '#f8fafc';
      resCtx.lineWidth = 3;
      resCtx.strokeRect(c * 64 + 14, r * 64 + 12, 36, 38);
    }
  }
  const residentialWall = new THREE.CanvasTexture(resC);
  residentialWall.wrapS = THREE.RepeatWrapping;
  residentialWall.wrapT = THREE.RepeatWrapping;
  residentialWall.colorSpace = THREE.SRGBColorSpace;

  // 6. Industrial Corrugated Metal
  const [indC, indCtx] = makeCanvas(256, 256);
  indCtx.fillStyle = '#475569';
  indCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    indCtx.fillStyle = x % 32 === 0 ? '#334155' : '#64748b';
    indCtx.fillRect(x, 0, 8, 256);
  }
  // Caution hazard stripe at base
  indCtx.fillStyle = '#f59e0b';
  indCtx.fillRect(0, 232, 256, 24);
  const industrialWall = new THREE.CanvasTexture(indC);
  industrialWall.wrapS = THREE.RepeatWrapping;
  industrialWall.wrapT = THREE.RepeatWrapping;
  industrialWall.colorSpace = THREE.SRGBColorSpace;

  // 7. Luxury Marble Lobby Floor
  const [marC, marCtx] = makeCanvas(256, 256);
  marCtx.fillStyle = '#f1f5f9';
  marCtx.fillRect(0, 0, 256, 256);
  marCtx.strokeStyle = '#cbd5e1';
  marCtx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    marCtx.strokeRect(i, 0, 64, 256);
    marCtx.strokeRect(0, i, 256, 64);
  }
  // Subtle marble veins
  marCtx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  for (let v = 0; v < 14; v++) {
    marCtx.beginPath();
    marCtx.moveTo(Math.random() * 256, Math.random() * 256);
    marCtx.bezierCurveTo(
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 256
    );
    marCtx.stroke();
  }
  const marbleFloor = new THREE.CanvasTexture(marC);
  marbleFloor.wrapS = THREE.RepeatWrapping;
  marbleFloor.wrapT = THREE.RepeatWrapping;
  marbleFloor.repeat.set(4, 4);
  marbleFloor.colorSpace = THREE.SRGBColorSpace;

  // 8. Warm Wood Floor
  const [wdC, wdCtx] = makeCanvas(256, 256);
  wdCtx.fillStyle = '#784b2a';
  wdCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    wdCtx.fillStyle = y % 64 === 0 ? '#6e4324' : '#855532';
    wdCtx.fillRect(0, y, 256, 30);
  }
  const woodFloor = new THREE.CanvasTexture(wdC);
  woodFloor.wrapS = THREE.RepeatWrapping;
  woodFloor.wrapT = THREE.RepeatWrapping;
  woodFloor.repeat.set(4, 4);
  woodFloor.colorSpace = THREE.SRGBColorSpace;

  // 9. Grass Texture
  const [grC, grCtx] = makeCanvas(256, 256);
  grCtx.fillStyle = '#2d5a36';
  grCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    grCtx.fillStyle = Math.random() > 0.5 ? '#366b40' : '#244b2c';
    grCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const grass = new THREE.CanvasTexture(grC);
  grass.wrapS = THREE.RepeatWrapping;
  grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(48, 48);
  grass.colorSpace = THREE.SRGBColorSpace;

  // 10. Golden Beach Sand
  const [sdC, sdCtx] = makeCanvas(256, 256);
  sdCtx.fillStyle = '#dec48f';
  sdCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    sdCtx.fillStyle = Math.random() > 0.5 ? '#e7d1a1' : '#cfb37c';
    sdCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const sand = new THREE.CanvasTexture(sdC);
  sand.wrapS = THREE.RepeatWrapping;
  sand.wrapT = THREE.RepeatWrapping;
  sand.repeat.set(24, 24);
  sand.colorSpace = THREE.SRGBColorSpace;

  // 11. Helipad Deck Marking
  const [hpC, hpCtx] = makeCanvas(256, 256);
  hpCtx.fillStyle = '#334155';
  hpCtx.fillRect(0, 0, 256, 256);
  hpCtx.strokeStyle = '#facc15';
  hpCtx.lineWidth = 10;
  hpCtx.beginPath();
  hpCtx.arc(128, 128, 96, 0, Math.PI * 2);
  hpCtx.stroke();
  hpCtx.fillStyle = '#f8fafc';
  hpCtx.fillRect(88, 68, 18, 120);
  hpCtx.fillRect(150, 68, 18, 120);
  hpCtx.fillRect(88, 119, 80, 18);
  const helipad = new THREE.CanvasTexture(hpC);
  helipad.colorSpace = THREE.SRGBColorSpace;

  return {
    roadStraight,
    roadIntersection,
    sidewalk,
    skyscraperGlass,
    skyscraperEmissive,
    residentialWall,
    industrialWall,
    marbleFloor,
    woodFloor,
    grass,
    sand,
    helipad,
  };
}
