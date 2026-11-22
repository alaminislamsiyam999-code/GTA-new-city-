import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type AnimName = 'idle' | 'walk' | 'run' | 'jump' | 'sit' | 'prone';

/** Animation files used by the player. Paths are relative to the page, served from /public. */
export const PLAYER_ANIMATIONS: Record<AnimName, string> = {
  idle: 'models/animations/Idle.fbx',
  walk: 'models/animations/Walk.fbx',
  run: 'models/animations/Run.fbx',
  jump: 'models/animations/jump.fbx',
  sit: 'models/animations/standtosit.fbx',
  prone: 'models/animations/prone.fbx',
};

/** Height in game units (metres) that every character is scaled to. */
const TARGET_HEIGHT = 1.85;

/**
 * Mixamo rigs use different bone prefixes depending on the export:
 *   mixamorig:Hips, mixamorigHips, mixamorig10:Hips, mixamorig12Hips
 * Everything is normalized to "mixamorigHips" so any clip drives any character.
 */
function normalizeMixamoName(name: string): string {
  return name.replace(/mixamorig\d*:?/g, 'mixamorig');
}

function retargetClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.map((track) => {
    const copy = track.clone();
    copy.name = normalizeMixamoName(track.name);

    // Lock horizontal root motion: world position is driven by game logic, not the clip.
    if (copy.name === 'mixamorigHips.position') {
      const values = copy.values as unknown as Float32Array;
      const count = copy.times.length;
      const startX = values[0];
      const startZ = values[2];
      for (let i = 0; i < count; i++) {
        values[i * 3] = startX;
        values[i * 3 + 2] = startZ;
      }
    }
    return copy;
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

async function loadModel(url: string): Promise<THREE.Object3D> {
  if (url.toLowerCase().endsWith('.fbx')) {
    return await new FBXLoader().loadAsync(url);
  }
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}

/** Scales the model to TARGET_HEIGHT, puts its feet on the ground and centres it. */
function normalizeToGameScale(model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.y - box.min.y;
  if (height <= 0) return;

  model.scale.multiplyScalar(TARGET_HEIGHT / height);
  model.updateMatrixWorld(true);

  const scaled = new THREE.Box3().setFromObject(model);
  const center = scaled.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaled.min.y;
}

export class CharacterAnimator {
  /** Add this under the player's rig so it follows position, rotation and visibility. */
  readonly root: THREE.Group;

  private mixer: THREE.AnimationMixer;
  private actions = new Map<AnimName, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;

  private constructor(model: THREE.Object3D) {
    this.root = new THREE.Group();
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
  }

  /** Loads a character (GLB or FBX) and all given animations. */
  static async load(
    characterUrl: string,
    animUrls: Partial<Record<AnimName, string>>
  ): Promise<CharacterAnimator> {
    const model = await loadModel(characterUrl);

    model.traverse((obj) => {
      if (obj.name.includes('mixamorig')) {
        obj.name = normalizeMixamoName(obj.name);
      }
    });
    normalizeToGameScale(model);

    const animator = new CharacterAnimator(model);

    const fbxLoader = new FBXLoader();
    for (const [name, url] of Object.entries(animUrls) as [AnimName, string][]) {
      const fbx = await fbxLoader.loadAsync(url);
      const clip = fbx.animations[0];
      if (!clip) {
        console.warn(`[CharacterAnimator] No clip found in ${url}`);
        continue;
      }
      animator.actions.set(name, animator.mixer.clipAction(retargetClip(clip)));
    }

    return animator;
  }

  has(name: AnimName): boolean {
    return this.actions.has(name);
  }

  /** Crossfades to the named animation. Loops by default. */
  play(name: AnimName, { loop = true, fade = 0.25 } = {}): void {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;

    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.play();

    if (this.current) {
      this.current.crossFadeTo(next, fade, false);
    }
    this.current = next;
  }

  update(deltaSeconds: number): void {
    this.mixer.update(deltaSeconds);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    this.root.clear();
  }
}
