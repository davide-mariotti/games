// Lupo Solitario: which screen is on, and the moves between them (title, creation, game, next book, the end).
import { authManager } from './auth.js';
import { gameState } from './game-state.js';
import { saveManager, stateFromSave } from './save-manager.js';
import { bookLoader } from './book-loader.js';
import { CharacterCreator } from './components/character-creator.js';
import { CharacterSheet } from './components/character-sheet.js';
import { StoryReader } from './components/story-reader.js';
import { BookTransition } from './components/book-transition.js';
import { ScreenManager, BOOKS } from './utils/screen-manager.js';
import { openMenu, openSaves, openRules } from './utils/menu-manager.js';
import { UIHelpers } from './utils/ui-helpers.js';
import { icon, esc, sound } from './ui/kit.js';

class App {
  constructor() {
    this.root = document.getElementById('app');
    this.screens = new ScreenManager(this.root);
    this.parts = []; // live components of the current screen, destroyed when it changes
    this.book = null;
    this.intro = null;
  }

  async init() {
    // Easy mode: highlights the choices that lead to the end of the book. Hidden on purpose, for whoever finds it.
    window.easyMode = (enable = null) => {
      const on = enable === null ? !gameState.getState().easyMode : !!enable;
      gameState.setEasyMode(on);
      return on ? 'Easy Mode: ON' : 'Easy Mode: OFF';
    };

    this.screens.showLoadingScreen('Apro il libro...');
    fetch('./data/intro-common.json').then((r) => r.json()).then((d) => { this.intro = d; }).catch(() => {});
    await authManager.init();
    authManager.onAuthStateChange(() => { if (this.onTitle) this.showTitle(); });

    // don't lose the last move if the tab is closed right after it
    addEventListener('pagehide', () => saveManager.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveManager.flush(); });

    this.showTitle();
  }

  // leave the current screen: stop its components and the autosave
  leave() {
    saveManager.flush();
    this.parts.forEach((p) => p.destroy && p.destroy());
    this.parts = [];
    saveManager.paused = true;
    this.onTitle = false;
  }

  mount(el) {
    this.root.innerHTML = '';
    this.root.appendChild(el);
    window.scrollTo({ top: 0 });
  }

  async showTitle() {
    this.leave();
    this.onTitle = true;
    let save = null;
    try { save = await saveManager.loadGame('autosave'); } catch (error) { console.warn('Autosave unreadable:', error); }
    if (!this.onTitle) return; // moved on while reading
    this.screens.showTitleScreen({
      save,
      user: authManager.getCurrentUser(),
      onContinue: () => this.loadSave(save),
      onNewGame: async () => {
        if (save && !(await UIHelpers.confirmAsync('Iniziare una nuova partita? Il salvataggio automatico verrà sostituito appena cominci a giocare. Quelli con un nome restano.', { yes: 'Nuova partita' }))) return;
        this.newGame();
      },
      onSaves: () => openSaves({ canSave: false, onLoad: (s) => this.loadSave(s) }),
      onRules: () => openRules(this.intro),
      onSignIn: () => this.signIn(),
      onSignOut: async () => { await authManager.signOut(); this.showTitle(); },
    });
  }

  async signIn() {
    try {
      await authManager.signInWithGoogle();
      const moved = await saveManager.uploadLocalSaves();
      UIHelpers.showToast(moved ? `Accesso fatto: ${moved} salvataggi portati nel cloud` : 'Accesso fatto', 'success');
    } catch (error) {
      console.error(error);
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error?.code)) {
        UIHelpers.showToast('Accesso non riuscito. Riprova tra poco.', 'error');
      }
    }
    if (this.onTitle) this.showTitle();
  }

  async loadBook(n) {
    this.book = await bookLoader.loadBook(BOOKS[n].id);
    return this.book;
  }

  async newGame() {
    this.leave();
    this.screens.showLoadingScreen('Preparo il Libro 1...');
    try { await this.loadBook(1); } catch (error) { console.error(error); this.screens.showErrorScreen('Il libro non si apre'); return; }
    gameState.resetGame();
    const creator = new CharacterCreator(() => {
      gameState.setState({ currentSection: 0, history: [0] }); // Book 1 opens with its introduction, section 0
      this.startBook();
    });
    this.mount(creator.render());
  }

  // A book begins (after creation or between books): this point is kept, so a death can restart the book from here.
  async startBook() {
    const n = gameState.getState().bookNumber;
    try { await saveManager.saveGame('bookstart', gameState.getState(), `Inizio del Libro ${n}`); } catch (error) { console.warn(error); }
    this.showGame();
    saveManager.autoSave(gameState.getState());
  }

  async loadSave(save) {
    if (!save) return;
    this.leave();
    this.screens.showLoadingScreen('Riapro la partita...');
    try {
      const state = stateFromSave(save);
      const n = Number(state.bookNumber) || 1;
      await this.loadBook(n); // the save decides the book, whatever was open before
      gameState.loadState({ ...state, bookNumber: n, bookId: BOOKS[n].id });
      this.showGame();
    } catch (error) {
      console.error(error);
      this.screens.showErrorScreen('La partita non si riapre');
    }
  }

  async nextBook(n) {
    this.leave();
    this.screens.showLoadingScreen(`Preparo il Libro ${n}...`);
    try { await this.loadBook(n); } catch (error) { console.error(error); this.screens.showErrorScreen(`Il Libro ${n} non si apre`); return; }
    const transition = new BookTransition(n, () => {
      gameState.switchBook(BOOKS[n].id, n, 1);
      this.startBook();
    });
    this.mount(transition.render());
  }

  async restartBook() {
    let start = null;
    try { start = await saveManager.loadGame('bookstart'); } catch (error) { console.warn(error); }
    if (!start) {
      UIHelpers.showToast('Non trovo l\'inizio del libro: si riparte da capo', 'info');
      this.newGame();
      return;
    }
    await this.loadSave(start);
    saveManager.autoSave(gameState.getState());
  }

  async gameOver(message, title) {
    this.leave();
    try { await saveManager.deleteSave('autosave'); } catch (error) { console.warn(error); }
    const n = gameState.getState().bookNumber;
    let start = null;
    try { start = await saveManager.loadGame('bookstart'); } catch { /* offline: no restart point */ }
    const el = document.createElement('div');
    el.className = 'screen enter';
    el.innerHTML = `
      <div class="ending lose" style="margin-top:0">
        <p class="kicker">${esc(title || 'Fine')}</p>
        <img class="section-image" src="public/img/death/book${n}.webp" alt="" onerror="this.remove()">
        <p class="big" style="margin-top:.6rem">Fine.</p>
        <p>${esc(message)}</p>
        <div class="stack">
          ${start && Number(start.bookNumber) === n ? `<button class="btn btn-primary" type="button" id="restart-book">${icon('rotate-ccw')}Ricomincia il Libro ${n}</button>` : ''}
          <button class="btn btn-ghost" type="button" id="new-game">${icon('plus')}Nuova partita</button>
          <button class="btn btn-ghost" type="button" id="to-title">${icon('arrow-left')}Torna all'inizio</button>
        </div>
      </div>`;
    this.mount(el);
    el.querySelector('#restart-book')?.addEventListener('click', () => this.restartBook());
    el.querySelector('#new-game').addEventListener('click', () => this.newGame());
    el.querySelector('#to-title').addEventListener('click', () => this.showTitle());
  }

  showGame() {
    this.leave();
    const state = gameState.getState();
    const n = state.bookNumber;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="topbar">
        <div class="where">
          <span class="kicker">Libro ${n} · <span id="where-section">sezione ${state.currentSection}</span></span>
          <span class="book">${BOOKS[n].title}</span>
        </div>
        <div class="acts">
          <button class="icon-btn" type="button" id="save-btn" aria-label="Salva">${icon('save')}</button>
          <button class="icon-btn" type="button" id="mute-btn"></button>
          <button class="icon-btn" type="button" id="menu-btn" aria-label="Menu">${icon('menu')}</button>
        </div>
      </div>
      <div class="game"><aside id="sheet-slot"></aside><div id="story-slot"></div></div>`;
    this.mount(wrap);

    const sheet = new CharacterSheet();
    const reader = new StoryReader(this.book, n < 5 ? () => this.nextBook(n + 1) : null, {
      onRestartBook: () => this.restartBook(),
      onNewGame: () => this.newGame(),
      onGameOver: (message, title) => this.gameOver(message, title),
    });
    reader.resumeCombat(); // a save made mid-fight
    wrap.querySelector('#sheet-slot').appendChild(sheet.render());
    wrap.querySelector('#story-slot').appendChild(reader.render());
    const where = wrap.querySelector('#where-section');
    this.parts.push(sheet, reader, { destroy: gameState.subscribe((s) => { where.textContent = `sezione ${s.currentSection}`; }) });
    saveManager.paused = false;

    const mute = wrap.querySelector('#mute-btn');
    const paint = () => {
      mute.innerHTML = icon(sound.muted ? 'volume-x' : 'volume-2');
      mute.setAttribute('aria-label', sound.muted ? 'Riattiva l\'audio' : 'Disattiva l\'audio');
      mute.setAttribute('aria-pressed', String(sound.muted));
    };
    paint();
    mute.addEventListener('click', () => { sound.toggle(); paint(); });

    const saveNow = async () => {
      try {
        await saveManager.saveGame('autosave', gameState.getState());
        UIHelpers.showToast(saveManager.cloud ? 'Salvato nel cloud' : 'Salvato in questo browser', 'success');
      } catch (error) {
        console.error(error);
        UIHelpers.showToast('Non riesco a salvare', 'error');
      }
    };
    wrap.querySelector('#save-btn').addEventListener('click', saveNow);
    wrap.querySelector('#menu-btn').addEventListener('click', () => openMenu({
      onSave: saveNow,
      onSaves: () => openSaves({ canSave: true, state: () => gameState.getState(), onLoad: (s) => this.loadSave(s) }),
      onRules: () => openRules(this.intro),
      onNewGame: async () => {
        if (await UIHelpers.confirmAsync('Iniziare una nuova partita? Questa resta nei salvataggi solo se l\'hai salvata con un nome.', { yes: 'Nuova partita' })) this.newGame();
      },
      onTitle: () => this.showTitle(),
    }));
  }
}

new App().init();
