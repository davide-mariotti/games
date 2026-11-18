// Character sheet (the Action Chart): always on screen, collapsible on phones. Potions are drunk from here.
import { gameState } from '../game-state.js';
import { UIHelpers } from '../utils/ui-helpers.js';
import { thumbHTML } from './character-creator.js';
import { icon, esc, sfx, replay } from '../ui/kit.js';

// What a potion does when drunk. Healing ones only outside combat ("after combat", as the books say);
// Alether adds 2 Combat Skill to the fight in progress.
export const POTIONS = {
  'Pozione Magica': { heal: 4 },
  'Pozione Curativa': { heal: 4 },
  'Pozione di Laumspur': { heal: 4 },
  'Pozione di Laumspur Rossa': { heal: 4 },
  'Fiala di Olio di Larnuma': { heal: 2 },
  'Olio di Larnuma': { heal: 2 },
  'Pozione di Alether': { combat: 2 },
};

export class CharacterSheet {
  constructor() {
    this.isCollapsed = typeof window !== 'undefined' && window.innerWidth < 860;
    this.last = null;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'card sheet';
    container.id = 'character-sheet';
    this.unsubscribe = gameState.subscribe((state) => this.update(container, state));
    this.update(container, gameState.getState());
    return container;
  }

  destroy() { if (this.unsubscribe) this.unsubscribe(); }

  update(container, state) {
    const c = state.character;
    const p = c.resistenzaMax ? c.resistenza / c.resistenzaMax : 0;
    const health = p <= 0.3 ? 'low' : p <= 0.6 ? 'mid' : '';
    const prev = this.last;
    this.last = { r: c.resistenza, cs: c.combattivita, g: c.corone, m: c.pasti };
    container.classList.toggle('collapsed', this.isCollapsed);

    const tile = (name, kind, type, index) => {
      const potion = POTIONS[name];
      return `<div class="tile ${potion ? 'usable' : ''}" ${potion ? `data-drink="${index}" role="button" tabindex="0" title="Bevi"` : ''}>
        ${thumbHTML(name, kind)}<span>${esc(name)}</span>
        <button class="tile-x" type="button" data-type="${type}" data-index="${index}" aria-label="Lascia ${esc(name)}">${icon('x')}</button>
      </div>`;
    };
    const empty = (n, label) => Array.from({ length: Math.max(0, n) }, () => `<div class="tile empty">${label}</div>`).join('');
    const mastery = c.artiRamas.includes('Scherma') && c.weaponMastery;

    container.innerHTML = `
      <div class="sheet-head">
        <h3>Registro di Guerra</h3>
        <button class="icon-btn sheet-toggle" type="button" id="toggle-sheet" aria-expanded="${!this.isCollapsed}" aria-label="${this.isCollapsed ? 'Mostra il Registro' : 'Nascondi il Registro'}">${icon(this.isCollapsed ? 'backpack' : 'x')}</button>
      </div>
      ${this.isCollapsed ? `<div class="sheet-stats" style="grid-template-columns:repeat(4,auto);justify-content:space-between;margin-top:.6rem">
        <span class="mono">${icon('swords')} ${c.combattivita}</span><span class="mono ${health}" style="${health === 'low' ? 'color:var(--danger)' : ''}">${icon('heart')} ${c.resistenza}</span>
        <span class="mono">${icon('coins')} ${c.corone}</span><span class="mono">${icon('drumstick')} ${c.pasti}</span></div>` : ''}
      <div class="sheet-body">
        <div class="sheet-stats">
          <div class="stat" id="st-cs">${icon('swords')}<span>Combattività</span><b>${c.combattivita}</b></div>
          <div class="stat ${health}" id="st-r">${icon('heart')}<span>Resistenza</span><b>${c.resistenza}<small>/${c.resistenzaMax}</small></b></div>
          <div class="meter ${health}"><i style="--p:${Math.max(0, Math.min(1, p))}"></i></div>
          <div class="stat" id="st-g">${icon('coins')}<span>Corone d'Oro</span><b>${c.corone}<small>/50</small></b></div>
          <div class="stat" id="st-m">${icon('drumstick')}<span>Pasti</span><b>${c.pasti}</b></div>
        </div>

        <p class="label">${icon('sparkles')}Arti Ramas</p>
        <div class="tiles">${c.artiRamas.map((a) => `<div class="tile">${thumbHTML(a, 'art')}<span>${esc(a)}</span></div>`).join('')}</div>
        ${mastery ? `<p class="muted" style="font-size:.78rem;margin-top:.4rem">Scherma con: <b style="color:var(--ink)">${esc(c.weaponMastery)}</b>${c.armi.includes(c.weaponMastery) ? ' · in mano, +2' : ''}</p>` : ''}

        <p class="label">${icon('sword')}Armi · ${c.armi.length}/2</p>
        <div class="tiles">${c.armi.map((w, i) => tile(w, 'weapon', 'weapon', i)).join('')}${empty(2 - c.armi.length, 'Libera')}</div>

        <p class="label">${icon('backpack')}Zaino · ${c.zaino.length + c.pasti}/8</p>
        <div class="tiles">${c.zaino.map((it, i) => tile(it, 'item', 'zaino', i)).join('')}${c.pasti ? `<div class="tile"><span class="glyph">${icon('drumstick')}</span><span>${c.pasti} ${c.pasti === 1 ? 'Pasto' : 'Pasti'}</span></div>` : ''}${empty(8 - c.zaino.length - c.pasti, 'Vuoto')}</div>
        ${c.zaino.some((it) => POTIONS[it]) ? '<p class="muted" style="font-size:.75rem;margin-top:.4rem">Tocca una pozione per berla.</p>' : ''}

        ${c.oggettiSpeciali.length ? `<p class="label">${icon('gem')}Oggetti Speciali</p>
        <div class="tiles">${c.oggettiSpeciali.map((it, i) => tile(it, 'special', 'special', i)).join('')}</div>` : ''}
      </div>`;

    // flash what changed since the last render
    if (prev) {
      if (prev.r !== c.resistenza) replay(container.querySelector('#st-r b'), 'bump');
      if (prev.cs !== c.combattivita) replay(container.querySelector('#st-cs b'), 'bump');
      if (prev.g !== c.corone) replay(container.querySelector('#st-g b'), 'bump');
      if (prev.m !== c.pasti) replay(container.querySelector('#st-m b'), 'bump');
    }

    container.querySelector('#toggle-sheet').addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      this.update(container, gameState.getState());
    });
    container.querySelectorAll('.tile-x').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeItem(btn.dataset.type, Number(btn.dataset.index));
    }));
    container.querySelectorAll('[data-drink]').forEach((el) => {
      const drink = () => this.drink(c.zaino[Number(el.dataset.drink)]);
      el.addEventListener('click', drink);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drink(); } });
    });
  }

  async drink(name) {
    const potion = POTIONS[name];
    const state = gameState.getState();
    if (!potion) return;
    if (potion.heal) {
      if (state.inCombat) { UIHelpers.showToast('Le pozioni curative si bevono a combattimento finito', 'info'); return; }
      const c = state.character;
      if (c.resistenza >= c.resistenzaMax) { UIHelpers.showToast('Sei già al massimo della Resistenza', 'info'); return; }
      if (!(await UIHelpers.confirmAsync(`Bere ${esc(name)}? Recuperi ${potion.heal} punti Resistenza (fino a ${c.resistenzaMax}).`, { yes: 'Bevi' }))) return;
      gameState.removeFromZaino(name, true);
      gameState.heal(potion.heal);
      sfx.item();
      UIHelpers.showToast(`+${Math.min(potion.heal, c.resistenzaMax - c.resistenza)} Resistenza`, 'success');
    } else if (potion.combat) {
      if (!state.inCombat || !state.combatState) { UIHelpers.showToast('L\'Alether si beve durante un combattimento', 'info'); return; }
      if (!(await UIHelpers.confirmAsync(`Bere ${esc(name)}? +${potion.combat} Combattività fino alla fine di questo combattimento.`, { yes: 'Bevi' }))) return;
      gameState.removeFromZaino(name, true);
      const cs = gameState.getState().combatState;
      gameState.setState({ combatState: { ...cs, playerCombatBonus: (cs.playerCombatBonus || 0) + potion.combat } });
      sfx.item();
      UIHelpers.showToast(`+${potion.combat} Combattività per questo combattimento`, 'success');
    }
  }

  async removeItem(type, index) {
    const c = gameState.getState().character;
    const name = type === 'weapon' ? c.armi[index] : type === 'zaino' ? c.zaino[index] : c.oggettiSpeciali[index];
    if (!name) return;
    const warn = type === 'special' ? ' Gli Oggetti Speciali di solito servono più avanti.' : '';
    if (!(await UIHelpers.confirmAsync(`Lasciare ${esc(name)}?${warn} Non potrai riprenderlo.`, { yes: 'Lascia', danger: true }))) return;
    if (type === 'weapon') gameState.removeWeapon(name);
    else if (type === 'zaino') gameState.removeFromZaino(name, true);
    else gameState.updateStats({ oggettiSpeciali: c.oggettiSpeciali.filter((_, i) => i !== index) });
    UIHelpers.showToast(`Hai lasciato: ${name}`, 'info');
  }
}
