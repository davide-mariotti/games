// Menus: the in-game menu, the saves list and the rules. Used from the title screen too.
import { UIHelpers } from './ui-helpers.js';
import { saveManager } from '../save-manager.js';
import { icon, esc, noEmoji } from '../ui/kit.js';
import { BOOKS } from './screen-manager.js';

const when = (ms) => (ms ? new Date(ms).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// actions: { onSave, onSaves, onRules, onNewGame, onTitle }
export function openMenu(actions) {
  const item = (id, ic, label, cls = 'btn-ghost') => `<button class="btn ${cls} btn-block" type="button" data-action="${id}">${icon(ic)}${label}</button>`;
  const run = (fn) => (e, modal) => { modal.close(); fn(); };
  UIHelpers.showModal(`
    <div class="modal-actions" style="margin-top:0">
      ${item('save', 'save', 'Salva ora', 'btn-primary')}
      ${item('saves', 'folder-open', 'Salvataggi')}
      ${item('rules', 'scroll-text', 'Regole')}
      ${item('new', 'plus', 'Nuova partita')}
      ${item('title', 'arrow-left', 'Torna all\'inizio')}
    </div>`, {
    title: 'Menu',
    buttons: {
      '[data-action="save"]': run(actions.onSave),
      '[data-action="saves"]': run(actions.onSaves),
      '[data-action="rules"]': run(actions.onRules),
      '[data-action="new"]': run(actions.onNewGame),
      '[data-action="title"]': run(actions.onTitle),
    },
  });
}

// canSave: a game is open, so it can be saved under a name. onLoad(save) gets the chosen save.
export async function openSaves({ canSave, state, onLoad }) {
  const modal = UIHelpers.showModal(`
    <p class="muted" style="margin-bottom:1rem;font-size:.9rem">${saveManager.cloud ? 'Salvati nel cloud, con il tuo account Google.' : 'Salvati in questo browser.'} Quello automatico si aggiorna da solo mentre giochi.</p>
    <div class="save-list" id="saves-list"><div class="loading" style="min-height:6rem"><div class="spinner"></div></div></div>
    ${canSave ? `<div class="modal-actions"><button class="btn btn-primary btn-block" type="button" data-action="new-save">${icon('plus')}Salva con un nome</button></div>` : ''}`, {
    title: 'Salvataggi',
    wide: true,
    buttons: {
      '[data-action="new-save"]': async () => {
        const name = await UIHelpers.promptAsync('Come vuoi chiamare questo salvataggio?', { title: 'Nuovo salvataggio', placeholder: 'Prima del ponte' });
        if (!name) return;
        try {
          await saveManager.saveGame('save_' + Date.now(), state(), name);
          UIHelpers.showToast(`Salvato: ${name}`, 'success');
        } catch (error) {
          console.error(error);
          UIHelpers.showToast('Non riesco a salvare', 'error');
        }
        render();
      },
    },
  });
  const list = modal.querySelector('#saves-list');

  async function render() {
    let saves;
    try {
      saves = await saveManager.listSaves();
    } catch (error) {
      console.error('Error listing saves', error);
      list.innerHTML = '<p class="muted">Non riesco a leggere i salvataggi. Riprova tra poco.</p>';
      return;
    }
    if (!saves.length) {
      list.innerHTML = '<p class="muted">Ancora nessun salvataggio.</p>';
      return;
    }
    list.innerHTML = saves.map((s, i) => `
      <div class="save-item">
        <div>
          <b>${s.saveId === 'autosave' ? 'Salvataggio automatico' : esc(s.name || 'Senza nome')}</b>
          <small>Libro ${esc(s.bookNumber)} · ${esc(BOOKS[s.bookNumber]?.title || '')} · sezione ${esc(s.currentSection)}</small>
          <small>${when(s.savedAt)}</small>
        </div>
        <div class="acts">
          <button class="btn btn-primary btn-sm" type="button" data-load="${i}">Carica</button>
          <button class="icon-btn" type="button" data-del="${i}" aria-label="Elimina">${icon('trash-2')}</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', async () => {
      const save = saves[Number(b.dataset.load)];
      if (canSave && !(await UIHelpers.confirmAsync('Caricare questo salvataggio? La partita in corso resta solo nel salvataggio automatico.', { yes: 'Carica' }))) return;
      modal.close();
      onLoad(save);
    }));
    list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const save = saves[Number(b.dataset.del)];
      const label = save.saveId === 'autosave' ? 'il salvataggio automatico' : `"${esc(save.name || 'Senza nome')}"`;
      if (!(await UIHelpers.confirmAsync(`Eliminare ${label}? Non si torna indietro.`, { yes: 'Elimina', danger: true }))) return;
      try {
        await saveManager.deleteSave(save.saveId);
        UIHelpers.showToast('Salvataggio eliminato', 'info');
      } catch (error) {
        console.error(error);
        UIHelpers.showToast('Non riesco a eliminarlo', 'error');
      }
      render();
    }));
  }
  render();
}

export function openRules(intro) {
  const s = intro?.sections;
  if (!s) return;
  const arts = (s.kaiArts.arts || []).map((a) => `<li><b>${esc(a.name)}</b>: ${a.description}</li>`).join('');
  UIHelpers.showModal(`
    <div class="rules">
      ${s.rules.content}
      <h3>${noEmoji(s.combat.title)}</h3>${s.combat.content}
      <h3>${noEmoji(s.kaiArts.title)}</h3>${s.kaiArts.content}<ul>${arts}</ul>
      <h3>${noEmoji(s.equipment.title)}</h3>${s.equipment.content}
    </div>`, { title: noEmoji(s.rules.title), wide: true });
}
