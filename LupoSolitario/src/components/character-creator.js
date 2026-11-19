// Character creation, Book 1 rules: Combat Skill = roll + 10, Endurance = roll + 20, Gold = roll,
// 5 Kai Disciplines (Weaponskill's weapon picked by the Destiny Table), an Axe, a Meal, the Map, one item from the table.
import { getRandomDestinyNumber } from './destiny-table.js';
import { gameState } from '../game-state.js';
import { UIHelpers } from '../utils/ui-helpers.js';
import { icon, esc, rollDigits, sfx } from '../ui/kit.js';

export const KAI_ARTS = [
  { name: 'Mimetismo', image: 'public/img/arti-ramas/mimetismo.webp', description: 'Ti confondi con l\'ambiente e passi inosservato.' },
  { name: 'Caccia', image: 'public/img/arti-ramas/caccia.webp', description: 'Trovi cibo in natura: non consumi Pasti quando richiesto.' },
  { name: 'Sesto Senso', image: 'public/img/arti-ramas/sesto-senso.webp', description: 'Senti il pericolo prima che arrivi e capisci le intenzioni altrui.' },
  { name: 'Orientamento', image: 'public/img/arti-ramas/orientamento.webp', description: 'Trovi sempre la strada giusta, anche al buio.' },
  { name: 'Guarigione', image: 'public/img/arti-ramas/guarigione.webp', description: '+1 Resistenza per ogni sezione senza combattimento.' },
  { name: 'Scherma', image: 'public/img/arti-ramas/scherma.webp', description: 'Maestria in un\'arma: +2 Combattività quando la impugni.' },
  { name: 'Psicoschermo', image: 'public/img/arti-ramas/psicoschermo.webp', description: 'Ti protegge dagli attacchi mentali dei nemici.' },
  { name: 'Psicolaser', image: 'public/img/arti-ramas/psicolaser.webp', description: 'Attacchi con la mente: +2 Combattività, se il nemico non è immune.' },
  { name: 'Affinità animale', image: 'public/img/arti-ramas/affinita-animale.webp', description: 'Capisci gli animali e a volte li convinci ad aiutarti.' },
  { name: 'Telecinesi', image: 'public/img/arti-ramas/telecinesi.webp', description: 'Muovi piccoli oggetti con la forza della mente.' },
];

// The Weaponskill table, indexed by the Destiny Table number: the Sword appears twice in the book too.
export const WEAPONS = ['Pugnale', 'Lancia', 'Mazza', 'Daga', 'Martello', 'Spada', 'Ascia', 'Spada', 'Asta', 'Spadone'];

export const WEAPON_IMAGES = {
  'Pugnale': 'public/img/weapon/pugnale.webp',
  'Daga': 'public/img/weapon/daga.webp',
  'Lancia': 'public/img/weapon/lancia.webp',
  'Mazza': 'public/img/weapon/mazza.webp',
  'Martello': 'public/img/weapon/martello.webp',
  'Spada': 'public/img/weapon/spada.webp',
  'Spada Corta': 'public/img/weapon/spada-corta.webp',
  'Ascia': 'public/img/weapon/ascia.webp',
  'Asta': 'public/img/weapon/asta.webp',
  'Spadone': 'public/img/weapon/spadone.webp',
};

// Only the items handed out at creation and between books have artwork; the many one-off items found in the books get a glyph.
export const ITEM_IMAGES = {
  'Elmo': 'public/img/oggetti/elmo.webp',
  'Cotta di Maglia': 'public/img/oggetti/cotta-di-maglia.webp',
  'Scudo': 'public/img/oggetti/scudo.webp',
  'Giubba di Cuoio Imbottito': 'public/img/oggetti/giubba-di-cuoio-imbottito.webp',
  'Mappa di Sommerlund': 'public/img/oggetti/mappa.webp',
  'Mappa': 'public/img/oggetti/mappa.webp',
  'Mappa di Kalte': 'public/img/oggetti/mappa.webp',
  'Mappa delle Terre del Sud': 'public/img/oggetti/mappa.webp',
  'Mappa di Vassagonia': 'public/img/oggetti/mappa.webp',
  'Sigillo di Hammerdal': 'public/img/oggetti/sigillo-di-hammerdal.webp',
  'Pozione Magica': 'public/img/oggetti/pozione-magica.webp',
  'Pozione Curativa': 'public/img/oggetti/pozione-curativa.webp',
  'Pozione di Laumspur': 'public/img/oggetti/pozione-di-laumspur.webp',
  'Spada del Sole': 'public/img/oggetti/spada-del-sole.webp',
  'Triangolo di Pietra Blu': 'public/img/oggetti/triangolo-di-pietra-blu.webp',
  'Disco di Pietra Blu': 'public/img/oggetti/triangolo-di-pietra-blu.webp',
  "Bracciale d'Oro": 'public/img/oggetti/bracciale-d-oro.webp',
  'Corda': 'public/img/oggetti/corda.webp',
  'Torcia': 'public/img/oggetti/torcia.webp',
  'Acciarino': 'public/img/oggetti/acciarino.webp',
  'Lancia Magica': 'public/img/oggetti/lancia-magica.webp',
  'Gemma Vordak': 'public/img/oggetti/gemma-vordak.webp',
  'Cristallo Luminoso': 'public/img/oggetti/cristallo-luminoso.webp',
  'Mazza Ingioiellata': 'public/img/oggetti/mazza-ingioiellata.webp',
  'Cubo di Cristallo Nero': 'public/img/oggetti/cubo-di-cristallo-nero.webp',
  'Fiala di Acqua Santa': 'public/img/oggetti/fiala-di-acqua-santa.webp',
  'Pergamena': 'public/img/oggetti/pergamena.webp',
  'Stella di Cristallo': 'public/img/oggetti/stella-di-cristallo.webp',
};
// Names the books write in several ways ("Chiave di Rame", "Elmo d'Argento (+2 Combattività)"...): matched on how they start.
const ITEM_PREFIXES = [
  ['Chiav', 'public/img/oggetti/chiave.webp'],
  ["Elmo d'Argento", 'public/img/oggetti/elmo-d-argento.webp'],
  ['Pozione di Alether', 'public/img/oggetti/pozione-di-alether.webp'],
  ['Pozione Alether', 'public/img/oggetti/pozione-di-alether.webp'],
  ['Fiala di Alether', 'public/img/oggetti/pozione-di-alether.webp'],
];
const itemArt = (name) => ITEM_IMAGES[name] || ITEM_PREFIXES.find(([p]) => String(name).startsWith(p))?.[1];

// Picture for an item (weapon, Kai art or object): its artwork, or a Lucide glyph.
export function thumbHTML(name, kind = 'item') {
  const art = kind === 'art' ? KAI_ARTS.find((a) => a.name === name)?.image : (WEAPON_IMAGES[name] || itemArt(name));
  if (art) return `<img src="${art}" alt="" loading="lazy">`;
  const glyph = kind === 'weapon' ? 'sword' : kind === 'art' ? 'sparkles' : /pozione|fiala|olio/i.test(name) ? 'flask-conical' : /mappa/i.test(name) ? 'map' : kind === 'special' ? 'gem' : 'backpack';
  return `<span class="glyph">${icon(glyph)}</span>`;
}

// Book 1 equipment table, indexed by the Destiny Table number (0 is the Broadsword, as in the book).
const STARTING_ITEMS = [
  { type: 'weapon', name: 'Spadone' },
  { type: 'weapon', name: 'Spada' },
  { type: 'special', name: 'Elmo', bonus: { resistenza: 2 } },
  { type: 'meal', count: 2 },
  { type: 'special', name: 'Cotta di Maglia', bonus: { resistenza: 4 } },
  { type: 'weapon', name: 'Mazza' },
  { type: 'potion', name: 'Pozione Magica' },
  { type: 'weapon', name: 'Asta' },
  { type: 'weapon', name: 'Lancia' },
  { type: 'gold', amount: 12 },
];
const RECOMMENDED = ['Sesto Senso', 'Mimetismo', 'Guarigione', 'Caccia', 'Scherma']; // easy mode
const STEPS = ['intro', 'stats', 'arts', 'item', 'summary'];

export function itemLabel(item) {
  if (item.type === 'meal') return `${item.count} Pasti`;
  if (item.type === 'gold') return `${item.amount} Corone d'Oro`;
  if (item.bonus?.resistenza) return `${item.name} (+${item.bonus.resistenza} Resistenza)`;
  if (item.bonus?.combattivita) return `${item.name} (+${item.bonus.combattivita} Combattività)`;
  return item.name + (item.count > 1 ? ` (x${item.count})` : '');
}

export class CharacterCreator {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.character = {
      combattivita: 0, resistenza: 0, resistenzaMax: 0,
      artiRamas: [], armi: ['Ascia'], zaino: [], corone: 0, pasti: 1,
      oggettiSpeciali: ['Mappa di Sommerlund'],
    };
    this.rolled = { combattivita: null, resistenza: null, corone: null };
    this.weaponMastery = null;
    this.itemRoll = null;
    this.step = 'intro';
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'screen wide';
    this.draw();
    return this.el;
  }

  go(step) { this.step = step; sfx.page(); this.draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  draw() {
    const i = STEPS.indexOf(this.step);
    const enter = this.drawn !== this.step; // animate a new step in, not every click inside it
    this.drawn = this.step;
    this.el.innerHTML = `<div class="card ${enter ? 'enter' : ''}">
      <div class="steps" aria-hidden="true">${STEPS.map((_, n) => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</div>
      ${this[this.step]()}
    </div>`;
    this.bind();
  }

  intro() {
    return `
      <p class="kicker">Libro 1 · Creazione del personaggio</p>
      <h2 class="title" style="margin-top:.6rem">Benvenuto, <span class="grad">giovane Ramas.</span></h2>
      <img class="section-image" src="public/img/covers/book1.webp" alt="" onerror="this.remove()">
      <div class="prose">
        <p>Sei l'ultimo sopravvissuto del monastero di Ramas. Prima di partire, la Tabella del Destino deciderà quanto sei forte, quanto resisti e cosa porti con te.</p>
        <p>Poi sceglierai cinque Arti Ramas. Scegli bene: ti accompagneranno per tutti e cinque i libri.</p>
      </div>
      <div class="stack"><button class="btn btn-primary" type="button" data-go="stats">${icon('dices')}Iniziamo</button></div>`;
  }

  stats() {
    const box = (key, label, ic, plus) => {
      const r = this.rolled[key];
      return `<div class="roll-box">
        <h3 style="display:flex;align-items:center;justify-content:center;gap:.45rem">${icon(ic)}${label}</h3>
        <p class="muted" style="font-size:.85rem;margin-top:.2rem">Tabella del Destino${plus ? ` + ${plus}` : ''}</p>
        <div class="dice ${r !== null ? 'landed' : ''}" id="dice-${key}">${r !== null ? r : '?'}</div>
        <div class="total" id="total-${key}">${r !== null ? `${this.character[key]}` : ''}</div>
        <button class="btn btn-ghost btn-sm" type="button" data-roll="${key}" ${r !== null ? 'disabled' : ''} style="margin-top:.5rem">${icon('dices')}Lancia</button>
      </div>`;
    };
    const done = Object.values(this.rolled).every((v) => v !== null);
    return `
      <p class="kicker">Il tuo Registro di Guerra</p>
      <h2 class="title" style="margin-top:.6rem">Forza, <span class="grad">resistenza, oro.</span></h2>
      <div class="rolls">
        ${box('combattivita', 'Combattività', 'swords', 10)}
        ${box('resistenza', 'Resistenza', 'heart', 20)}
        ${box('corone', 'Corone d\'Oro', 'coins', 0)}
      </div>
      <div class="stack"><button class="btn btn-primary" type="button" data-go="arts" ${done ? '' : 'disabled'}>Avanti${icon('arrow-right')}</button></div>`;
  }

  arts() {
    const easy = gameState.getState().easyMode;
    const chosen = this.character.artiRamas;
    return `
      <p class="kicker">Arti Ramas · ${chosen.length}/5</p>
      <h2 class="title" style="margin-top:.6rem">Scegli <span class="grad">cinque Arti.</span></h2>
      ${easy ? `<p class="note easy">${icon('lightbulb')} Facile: le cinque Arti più utili per arrivare in fondo sono evidenziate.</p>` : ''}
      <div class="choose">
        ${KAI_ARTS.map((a) => `
          <button class="option ${chosen.includes(a.name) ? 'on' : ''} ${easy && RECOMMENDED.includes(a.name) ? 'rec' : ''}" type="button" data-art="${a.name}" aria-pressed="${chosen.includes(a.name)}">
            <img src="${a.image}" alt="" loading="lazy">
            <span><b>${a.name}${easy && RECOMMENDED.includes(a.name) ? '<span class="badge">Consigliata</span>' : ''}</b>
            <small>${a.description}</small>
            ${a.name === 'Scherma' && this.weaponMastery ? `<small class="master">Maestria: ${this.weaponMastery}</small>` : ''}</span>
          </button>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" type="button" data-go="stats">${icon('arrow-left')}Indietro</button>
        <button class="btn btn-primary" type="button" data-go="item" ${chosen.length === 5 ? '' : 'disabled'}>Avanti${icon('arrow-right')}</button>
      </div>`;
  }

  item() {
    const r = this.itemRoll;
    const found = r !== null ? STARTING_ITEMS[r] : null;
    return `
      <p class="kicker">Equipaggiamento</p>
      <h2 class="title" style="margin-top:.6rem">Tra le rovine <span class="grad">del monastero...</span></h2>
      <p class="muted" style="margin-top:.75rem">Hai un'Ascia, un Pasto e la Mappa di Sommerlund. Il Destino decide cos'altro trovi.</p>
      <div class="table10">${STARTING_ITEMS.map((it, n) => `<div class="${n === r ? 'on' : ''}"><b>${n}</b>${it.name ? thumbHTML(it.name, it.type) : `<span class="glyph">${icon(it.type === 'gold' ? 'coins' : 'drumstick')}</span>`}${itemLabel(it)}</div>`).join('')}</div>
      <div class="dice ${r !== null ? 'landed' : ''}" id="dice-item">${r !== null ? r : '?'}</div>
      <div id="found">${found ? `<div class="found"><b>${esc(itemLabel(found))}</b><span class="muted">${this.foundText(found)}</span></div>` : ''}</div>
      <div class="btn-row">
        ${r === null ? `<button class="btn btn-primary" type="button" data-roll-item>${icon('dices')}Lancia il Destino</button>` : `<button class="btn btn-primary" type="button" data-go="summary">Avanti${icon('arrow-right')}</button>`}
      </div>`;
  }

  foundText(it) {
    return { weapon: 'Va tra le tue armi.', special: 'Oggetto Speciale: la tua Resistenza sale.', meal: 'Nello zaino.', potion: 'Nello zaino: +4 Resistenza quando la bevi.', gold: `Ora hai ${this.character.corone} Corone.` }[it.type];
  }

  summary() {
    const c = this.character;
    const list = (items, kind) => `<div class="tiles">${items.map((n) => `<div class="tile">${thumbHTML(n, kind)}<span>${esc(n)}</span></div>`).join('')}</div>`;
    return `
      <p class="kicker">Pronto a partire</p>
      <h2 class="title" style="margin-top:.6rem">Lupo <span class="grad">Solitario.</span></h2>
      <div class="sheet-stats" style="margin-top:1.25rem">
        <div class="stat">${icon('swords')}<span>Combattività</span><b>${c.combattivita}</b></div>
        <div class="stat">${icon('heart')}<span>Resistenza</span><b>${c.resistenza}</b></div>
        <div class="stat">${icon('coins')}<span>Corone d'Oro</span><b>${c.corone}</b></div>
        <div class="stat">${icon('drumstick')}<span>Pasti</span><b>${c.pasti}</b></div>
      </div>
      <p class="label">${icon('sparkles')}Arti Ramas</p>${list(c.artiRamas, 'art')}
      ${this.weaponMastery && c.artiRamas.includes('Scherma') ? `<p class="muted" style="font-size:.85rem;margin-top:.5rem">Maestria con: <b>${this.weaponMastery}</b></p>` : ''}
      <p class="label">${icon('sword')}Armi</p>${list(c.armi, 'weapon')}
      ${c.zaino.length ? `<p class="label">${icon('backpack')}Zaino</p>${list(c.zaino, 'item')}` : ''}
      <p class="label">${icon('gem')}Oggetti Speciali</p>${list(c.oggettiSpeciali, 'special')}
      <div class="btn-row">
        <button class="btn btn-primary" type="button" id="begin-adventure">${icon('book-open')}Inizia l'avventura</button>
      </div>`;
  }

  bind() {
    const $ = (s) => this.el.querySelectorAll(s);
    $('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
    $('[data-roll]').forEach((b) => b.addEventListener('click', () => this.rollStat(b.dataset.roll, b)));
    $('[data-art]').forEach((b) => b.addEventListener('click', () => this.toggleArt(b.dataset.art)));
    $('[data-roll-item]').forEach((b) => b.addEventListener('click', () => this.rollItem(b)));
    $('#begin-adventure').forEach((b) => b.addEventListener('click', () => this.finish()));
  }

  async rollStat(key, btn) {
    if (this.rolled[key] !== null) return;
    btn.disabled = true;
    const roll = getRandomDestinyNumber();
    this.rolled[key] = roll;
    const total = roll + ({ combattivita: 10, resistenza: 20, corone: 0 })[key];
    this.character[key] = total;
    if (key === 'resistenza') this.character.resistenzaMax = total;
    await rollDigits(this.el.querySelector(`#dice-${key}`), roll);
    this.el.querySelector(`#total-${key}`).textContent = total;
    if (Object.values(this.rolled).every((v) => v !== null)) this.el.querySelector('[data-go="arts"]').disabled = false;
  }

  async toggleArt(name) {
    const arts = this.character.artiRamas;
    if (arts.includes(name)) arts.splice(arts.indexOf(name), 1);
    else if (arts.length < 5) {
      arts.push(name);
      sfx.item();
      if (name === 'Scherma' && !this.weaponMastery) this.weaponMastery = await rollWeaponMastery();
    } else {
      UIHelpers.showToast('Hai già cinque Arti: togline una per cambiarla', 'info');
    }
    this.draw();
  }

  async rollItem(btn) {
    if (this.itemRoll !== null) return;
    btn.disabled = true;
    const roll = getRandomDestinyNumber();
    this.itemRoll = roll;
    const it = STARTING_ITEMS[roll];
    const c = this.character;
    if (it.type === 'weapon') c.armi.push(it.name);
    else if (it.type === 'special') {
      c.oggettiSpeciali.push(it.name);
      c.resistenza += it.bonus.resistenza; c.resistenzaMax += it.bonus.resistenza;
    } else if (it.type === 'meal') c.pasti += it.count;
    else if (it.type === 'potion') c.zaino.push(it.name);
    else if (it.type === 'gold') c.corone = Math.min(50, c.corone + it.amount);
    await rollDigits(this.el.querySelector('#dice-item'), roll);
    this.draw();
  }

  finish() {
    const character = { ...this.character, weaponMastery: this.character.artiRamas.includes('Scherma') ? this.weaponMastery : null };
    gameState.setCharacter(character);
    if (this.onComplete) this.onComplete();
  }
}

// Weaponskill: the Destiny Table picks the weapon (book rules). Resolves to the weapon's name.
export function rollWeaponMastery() {
  return new Promise((resolve) => {
    const modal = UIHelpers.showModal(`
      <p class="modal-text">La Tabella del Destino sceglie l'arma in cui sei maestro: +2 Combattività quando la impugni.</p>
      <div class="table10">${WEAPONS.map((w, n) => `<div data-n="${n}"><b>${n}</b>${thumbHTML(w, 'weapon')}${w}</div>`).join('')}</div>
      <div class="dice" id="dice-mastery">?</div>
      <div class="modal-actions"><button class="btn btn-primary btn-block" type="button" data-action="roll">${icon('dices')}Lancia il Destino</button></div>`, {
      title: 'Scherma',
      dismissible: false,
      buttons: {
        '[data-action="roll"]': async (e, m) => {
          const btn = e.currentTarget;
          if (btn.dataset.weapon) { m.close(); resolve(btn.dataset.weapon); return; }
          btn.disabled = true;
          const n = getRandomDestinyNumber();
          await rollDigits(m.querySelector('#dice-mastery'), n);
          m.querySelector(`[data-n="${n}"]`).classList.add('on');
          btn.dataset.weapon = WEAPONS[n];
          btn.innerHTML = `${icon('check')}Maestria: ${WEAPONS[n]}`;
          btn.disabled = false;
        },
      },
    });
    modal.querySelector('.modal').classList.add('wide');
  });
}
