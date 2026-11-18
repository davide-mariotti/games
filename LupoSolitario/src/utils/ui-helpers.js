// UI helpers: toasts and dialogs. Every dialog settles its promise however it is closed
// (button, X, backdrop or Esc), so whatever is awaiting it never hangs.
import { icon, noEmoji } from '../ui/kit.js';

const TOAST_ICON = { success: 'check', error: 'triangle-alert', warning: 'triangle-alert', info: 'info' };

export class UIHelpers {
  static showToast(message, type = 'info') {
    let box = document.querySelector('.toast-container');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toast-container';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = icon(TOAST_ICON[type] || 'info');
    toast.append(noEmoji(message));
    box.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // options: title, wide, buttons {selector: (event, modal) => ...}, dismissible (default true), onDismiss.
  // modal.close() removes it without calling onDismiss.
  static showModal(content, options = {}) {
    const dismissible = options.dismissible !== false;
    const before = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${options.wide ? 'wide' : ''}" role="dialog" aria-modal="true" ${options.title ? 'aria-labelledby="modal-title"' : ''}>
        ${options.title || dismissible ? `<div class="modal-header">
          <h2 id="modal-title">${options.title || ''}</h2>
          ${dismissible ? `<button class="modal-close" type="button" data-action="close" aria-label="Chiudi">${icon('x')}</button>` : ''}
        </div>` : ''}
        <div class="modal-content">${content}</div>
      </div>`;

    let open = true;
    const close = () => {
      if (!open) return;
      open = false;
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (before && before.isConnected) before.focus({ preventScroll: true });
    };
    const dismiss = () => { if (!open) return; close(); if (options.onDismiss) options.onDismiss(); };
    const onKey = (e) => { // Esc closes only the topmost dialog
      if (e.key === 'Escape' && dismissible && overlay === [...document.querySelectorAll('.modal-overlay')].pop()) dismiss();
    };

    overlay.close = close;
    if (dismissible) {
      overlay.querySelector('[data-action="close"]').addEventListener('click', dismiss);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
    }
    document.addEventListener('keydown', onKey);

    for (const [selector, handler] of Object.entries(options.buttons || {})) {
      overlay.querySelectorAll(selector).forEach((btn) => btn.addEventListener('click', (e) => handler(e, overlay)));
    }

    document.body.appendChild(overlay);
    const first = overlay.querySelector('.modal-content button, .modal-content input') || overlay.querySelector('button');
    if (first) first.focus({ preventScroll: true });
    return overlay;
  }

  static showConfirm(message, onConfirm, onCancel, { yes = 'Conferma', no = 'Annulla', danger = false } = {}) {
    return this.showModal(`
      <p class="modal-text">${message}</p>
      <div class="modal-actions two">
        <button class="btn btn-ghost" type="button" data-action="cancel">${no}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-action="confirm">${yes}</button>
      </div>`, {
      onDismiss: () => onCancel && onCancel(),
      buttons: {
        '[data-action="confirm"]': (e, modal) => { modal.close(); if (onConfirm) onConfirm(); },
        '[data-action="cancel"]': (e, modal) => { modal.close(); if (onCancel) onCancel(); },
      },
    });
  }

  static confirmAsync(message, labels) {
    return new Promise((resolve) => this.showConfirm(message, () => resolve(true), () => resolve(false), labels));
  }

  // One button per option, resolving to the chosen option's value. Can't be dismissed: the story needs an answer.
  static chooseAsync(message, options, title = '') {
    return new Promise((resolve) => {
      const buttons = {};
      const html = options.map((opt, i) => {
        buttons[`[data-action="choice-${i}"]`] = (e, modal) => { modal.close(); resolve(opt.value); };
        return `<button class="btn btn-ghost btn-block" type="button" data-action="choice-${i}">${opt.label}</button>`;
      }).join('');
      this.showModal(`<p class="modal-text">${message}</p><div class="modal-actions">${html}</div>`, { title, buttons, dismissible: false });
    });
  }

  static showAlert(message, title = 'Attenzione') {
    return new Promise((resolve) => {
      this.showModal(`
        <p class="modal-text">${message}</p>
        <div class="modal-actions"><button class="btn btn-primary btn-block" type="button" data-action="ok">OK</button></div>`, {
        title,
        onDismiss: resolve,
        buttons: { '[data-action="ok"]': (e, modal) => { modal.close(); resolve(); } },
      });
    });
  }

  // A one-line text prompt (e.g. a save's name): resolves to the trimmed text, or null if cancelled.
  static promptAsync(message, { title = '', placeholder = '', yes = 'Salva', maxLength = 40 } = {}) {
    return new Promise((resolve) => {
      const modal = this.showModal(`
        <form class="prompt-form">
          <p class="modal-text">${message}</p>
          <input class="puzzle-input" style="font-size:1.1rem;font-family:inherit;text-align:left" maxlength="${maxLength}" placeholder="${placeholder}" autocomplete="off">
          <div class="modal-actions two">
            <button class="btn btn-ghost" type="button" data-action="cancel">Annulla</button>
            <button class="btn btn-primary" type="submit">${yes}</button>
          </div>
        </form>`, {
        title,
        onDismiss: () => resolve(null),
        buttons: { '[data-action="cancel"]': (e, m) => { m.close(); resolve(null); } },
      });
      const input = modal.querySelector('input');
      input.focus();
      modal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const value = input.value.trim();
        if (!value) { input.focus(); return; }
        modal.close();
        resolve(value);
      });
    });
  }
}
