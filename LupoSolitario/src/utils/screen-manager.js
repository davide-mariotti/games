// Screen Manager: the full-page screens (loading, error, title) that replace whatever #app shows.
import { icon, esc } from '../ui/kit.js';

export const BOOKS = {
  1: { id: '01-flight-from-the-dark', title: 'Fuga dalle Tenebre' },
  2: { id: '02-fire-on-the-water', title: 'Fuoco sulle Acque' },
  3: { id: '03-the-caverns-of-kalte', title: 'Le Caverne di Kalte' },
  4: { id: '04-the-chasm-of-doom', title: 'Il Baratro della Perdizione' },
  5: { id: '05-shadow-on-the-sand', title: 'Ombra sulla Sabbia' },
};

export class ScreenManager {
  constructor(appElement) {
    this.app = appElement;
  }

  showLoadingScreen(message = 'Caricamento...') {
    this.app.innerHTML = `<div class="loading" role="status"><div class="spinner"></div><p>${esc(message)}</p></div>`;
  }

  showErrorScreen(message) {
    this.app.innerHTML = `
      <div class="screen enter" style="text-align:center">
        <p class="kicker">Qualcosa non va</p>
        <h1 class="title" style="margin-top:.75rem">${esc(message)}</h1>
        <p class="muted" style="margin-top:1rem">Controlla la connessione e riprova.</p>
        <div class="stack"><button class="btn btn-primary" type="button" id="reload-btn">${icon('rotate-ccw')}Ricarica</button></div>
      </div>`;
    this.app.querySelector('#reload-btn').addEventListener('click', () => location.reload());
  }

  // save: the autosave (or null); user: the signed-in Google user (or null)
  showTitleScreen({ save, user, onContinue, onNewGame, onSaves, onRules, onSignIn, onSignOut }) {
    const where = save ? `Libro ${save.bookNumber} · sezione ${save.currentSection}` : '';
    this.app.innerHTML = `
      <div class="screen hero enter">
        <img class="wolf" src="public/img/portraits/lupo-solitario.webp" alt="" width="112" height="112">
        <p class="kicker" style="margin-top:1.5rem">Giochi · Librogame</p>
        <h1>Lupo <span class="serif grad">Solitario</span></h1>
        <p class="lead">I primi cinque librogame della saga dei Ramas. Dadi, combattimenti e Registro di Guerra li tiene il gioco: a te restano le scelte, e le conseguenze.</p>
        <div class="books">${Object.entries(BOOKS).map(([n, b]) => `<span class="${save && Number(n) === save.bookNumber ? 'on' : ''}">${n} · ${b.title}</span>`).join('')}</div>
        <div class="stack">
          ${save ? `<button class="btn btn-primary" type="button" id="continue-btn">${icon('play')}Continua<small>${esc(where)}</small></button>` : ''}
          <button class="btn ${save ? 'btn-ghost' : 'btn-primary'}" type="button" id="new-game-btn">${icon(save ? 'plus' : 'play')}Nuova partita</button>
          <div class="btn-row" style="margin-top:0">
            <button class="btn btn-ghost btn-sm" type="button" id="saves-btn">${icon('folder-open')}Salvataggi</button>
            <button class="btn btn-ghost btn-sm" type="button" id="rules-btn">${icon('scroll-text')}Regole</button>
          </div>
        </div>
        <p class="account">${user
          ? `${icon('cloud')}<span>Salvataggi nel cloud come <b>${esc(user.displayName || user.email || 'utente Google')}</b></span><button class="link" type="button" id="signout-btn">Esci</button>`
          : `${icon('cloud-off')}<span>I salvataggi restano in questo browser.</span><button class="link" type="button" id="signin-btn">Accedi con Google</button><span>per ritrovarli anche altrove.</span>`}
        </p>
      </div>`;
    const on = (id, fn) => { const el = this.app.querySelector(id); if (el && fn) el.addEventListener('click', fn); };
    on('#continue-btn', onContinue);
    on('#new-game-btn', onNewGame);
    on('#saves-btn', onSaves);
    on('#rules-btn', onRules);
    on('#signin-btn', onSignIn);
    on('#signout-btn', onSignOut);
  }
}
