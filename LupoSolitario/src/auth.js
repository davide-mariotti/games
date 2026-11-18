// Optional Google sign-in, only to keep saves in the cloud. Firebase is loaded on demand.
import { authApi } from './firebase-config.js';

const REMEMBER = 'lupo_cloud'; // set while signed in, so the next visit restores the session

const remember = (on) => { try { localStorage.setItem(REMEMBER, on ? '1' : '0'); } catch { /* not remembered */ } };
const remembered = () => { try { return localStorage.getItem(REMEMBER) === '1'; } catch { return false; } };

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.callbacks = [];
    this.api = null;
  }

  async connect() {
    if (!this.api) {
      this.api = await authApi();
      this.api.onAuthStateChanged(this.api.auth, (user) => {
        this.currentUser = user;
        remember(!!user);
        this.callbacks.forEach((cb) => cb(user));
      });
      await this.api.auth.authStateReady();
    }
    return this.api;
  }

  // Restores a previous session if there was one; resolves quickly (and offline) otherwise.
  async init() {
    if (!remembered()) return null;
    try { await this.connect(); } catch (error) { console.warn('Cloud saves unavailable:', error); }
    return this.currentUser;
  }

  onAuthStateChange(callback) {
    this.callbacks.push(callback);
  }

  async signInWithGoogle() {
    const api = await this.connect();
    const provider = new api.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await api.signInWithPopup(api.auth, provider);
    return result.user;
  }

  async signOut() {
    if (this.api) await this.api.signOut(this.api.auth);
    remember(false);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }
}

export const authManager = new AuthManager();
