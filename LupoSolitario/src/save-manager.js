// Saves: in this browser when signed out, in Firestore (users/{uid}/saves) when signed in with Google.
// The autosave slot is "autosave"; named saves get their own id. Each save is the game state plus
// a few fields of its own (saveId, name, savedAt), stripped again on load.
import { authManager } from './auth.js';
import { firestoreApi } from './firebase-config.js';

const LOCAL = 'lupo_saves';
const META = ['saveId', 'userId', 'timestamp', 'savedAt', 'name', 'id'];

const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || {}; } catch { return {}; } };
const writeLocal = (all) => { localStorage.setItem(LOCAL, JSON.stringify(all)); };

// JSON round trip: drops undefined values (Firestore refuses them) and detaches the save from live state
const plain = (state) => JSON.parse(JSON.stringify(state));
const savedAt = (s) => s.savedAt ?? (s.timestamp?.toMillis ? s.timestamp.toMillis() : (s.timestamp?.seconds || 0) * 1000);

class SaveManager {
  constructor() {
    this.paused = true; // nothing is autosaved until a game is on screen (the title screen and character creation don't count)
    this.autoSaveTimeout = null;
    this.lastError = 0;
  }

  get cloud() { return !!authManager.getCurrentUser(); }

  async ref(saveId) {
    const fs = await firestoreApi();
    const uid = authManager.getCurrentUser().uid;
    return { fs, doc: saveId ? fs.doc(fs.db, 'users', uid, 'saves', saveId) : null, col: fs.collection(fs.db, 'users', uid, 'saves') };
  }

  scheduleAutoSave(state) {
    if (this.paused) return;
    clearTimeout(this.autoSaveTimeout);
    this.pending = state;
    this.autoSaveTimeout = setTimeout(() => { this.pending = null; this.autoSave(state); }, 1500);
  }

  // Save now whatever is waiting for the debounce (tab closing, screen changing).
  flush() {
    if (!this.pending) return;
    clearTimeout(this.autoSaveTimeout);
    const state = this.pending;
    this.pending = null;
    this.autoSave(state);
  }

  async autoSave(state) {
    try {
      await this.saveGame('autosave', state);
    } catch (error) {
      console.error('Autosave failed:', error);
      this.lastError = Date.now();
    }
  }

  async saveGame(saveId, state, name = null) {
    const data = { ...plain(state), saveId, savedAt: Date.now() };
    for (const k of ['userId', 'timestamp', 'name', 'id']) delete data[k];
    if (name) data.name = name;
    if (data.flags) delete data.flags.saveName; // old saves kept their name here and passed it on to the autosave
    if (this.cloud) {
      const { fs, doc } = await this.ref(saveId);
      await fs.setDoc(doc, { ...data, userId: authManager.getCurrentUser().uid });
    } else {
      const all = readLocal();
      all[saveId] = data;
      writeLocal(all);
    }
    return data;
  }

  async loadGame(saveId) {
    if (this.cloud) {
      const { fs, doc } = await this.ref(saveId);
      const snap = await fs.getDoc(doc);
      return snap.exists() ? { ...snap.data(), saveId } : null;
    }
    return readLocal()[saveId] || null;
  }

  async listSaves() {
    let saves;
    if (this.cloud) {
      const { fs, col } = await this.ref();
      saves = (await fs.getDocs(col)).docs.map((d) => ({ ...d.data(), saveId: d.id }));
    } else {
      saves = Object.entries(readLocal()).map(([saveId, s]) => ({ ...s, saveId }));
    }
    return saves
      .map((s) => ({ ...s, savedAt: savedAt(s), name: s.name || s.flags?.saveName || null }))
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  async deleteSave(saveId) {
    if (this.cloud) {
      const { fs, doc } = await this.ref(saveId);
      await fs.deleteDoc(doc);
    } else {
      const all = readLocal();
      delete all[saveId];
      writeLocal(all);
    }
  }

  async hasAutoSave() {
    return (await this.loadGame('autosave')) !== null;
  }

  // Signing in after playing signed out: the browser's saves go up to the cloud, unless the cloud has a newer one with the same id.
  async uploadLocalSaves() {
    const local = readLocal();
    if (!this.cloud || !Object.keys(local).length) return 0;
    const cloud = Object.fromEntries((await this.listSaves()).map((s) => [s.saveId, s.savedAt]));
    let n = 0;
    for (const [saveId, s] of Object.entries(local)) {
      if ((cloud[saveId] || 0) >= (s.savedAt || 0)) continue;
      const { fs, doc } = await this.ref(saveId);
      await fs.setDoc(doc, { ...s, userId: authManager.getCurrentUser().uid });
      n++;
    }
    return n;
  }
}

// The game state stored in a save, without the save's own fields.
export function stateFromSave(save) {
  const state = { ...save };
  for (const k of META) delete state[k];
  if (state.flags) { state.flags = { ...state.flags }; delete state.flags.saveName; }
  return state;
}

export const saveManager = new SaveManager();
