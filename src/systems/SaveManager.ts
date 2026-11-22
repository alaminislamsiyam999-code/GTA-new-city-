import { GameSettings, HighScoreEntry, SaveSlotData } from '../types/game';

const SAVE_PREFIX = 'pacifica_horizon_save_';
const SETTINGS_KEY = 'pacifica_horizon_settings_v1';
const HIGHSCORES_KEY = 'pacifica_horizon_highscores_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: 'high',
  cameraSensitivity: 1.0,
  masterVolume: 0.75,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  showTouchControls: 'auto',
  invertY: false,
  minimapRotate: true,
};

const SEEDED_HIGH_SCORES: HighScoreEntry[] = [
  {
    id: 'seed_1',
    playerName: 'ValkyrieKing',
    character: 'dante',
    score: 28500,
    cashEarned: 64000,
    missionsCompleted: 5,
    date: '2026-02-14',
  },
  {
    id: 'seed_2',
    playerName: 'SkylineElena',
    character: 'elena',
    score: 19400,
    cashEarned: 42500,
    missionsCompleted: 3,
    date: '2026-02-18',
  },
  {
    id: 'seed_3',
    playerName: 'HarborPilot',
    character: 'marcus',
    score: 12800,
    cashEarned: 29000,
    missionsCompleted: 2,
    date: '2026-02-20',
  },
  {
    id: 'seed_4',
    playerName: 'NeonDrifter',
    character: 'dante',
    score: 7600,
    cashEarned: 15200,
    missionsCompleted: 1,
    date: '2026-02-22',
  },
];

export class SaveManager {
  public static loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  public static saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
  }

  public static saveSlot(slotId: string, data: SaveSlotData): void {
    try {
      localStorage.setItem(SAVE_PREFIX + slotId, JSON.stringify(data));
    } catch {
      // ignore storage quota errors
    }
  }

  public static loadSlot(slotId: string): SaveSlotData | null {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slotId);
      if (!raw) return null;
      return JSON.parse(raw) as SaveSlotData;
    } catch {
      return null;
    }
  }

  public static listSlots(): (SaveSlotData | null)[] {
    return ['autosave', 'slot1', 'slot2', 'slot3'].map((id) => this.loadSlot(id));
  }

  public static hasAnySave(): boolean {
    return this.listSlots().some((s) => s !== null);
  }

  public static loadHighScores(): HighScoreEntry[] {
    try {
      const raw = localStorage.getItem(HIGHSCORES_KEY);
      if (!raw) {
        localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(SEEDED_HIGH_SCORES));
        return [...SEEDED_HIGH_SCORES];
      }
      const parsed = JSON.parse(raw) as HighScoreEntry[];
      return parsed.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch {
      return [...SEEDED_HIGH_SCORES];
    }
  }

  public static submitHighScore(entry: Omit<HighScoreEntry, 'id' | 'date'>): HighScoreEntry[] {
    const list = this.loadHighScores();
    const newEntry: HighScoreEntry = {
      ...entry,
      id: 'hs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      date: new Date().toISOString().slice(0, 10),
    };
    const merged = [...list, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    try {
      localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
    return merged;
  }
}
