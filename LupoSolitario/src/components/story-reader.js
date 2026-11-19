import { gameState } from '../game-state.js';
import { combatManager } from './combat-manager.js';
import { UIHelpers } from '../utils/ui-helpers.js';
import { getRandomDestinyNumber } from './destiny-table.js';
import { WEAPONS } from './character-creator.js';
import { swapWeapon } from './book-transition.js';
import { icon, esc, noEmoji, rollDigits, sfx, replay } from '../ui/kit.js';

// Loot piles mix weapons with Backpack Items; anything that is a weapon goes to the weapon slots.
const WEAPON_NAME = /^(Pugnale|Lancia|Mazza|Daga|Martello|Spada|Ascia|Asta|Spadone|Arco|Tridente|Sciabola)\b/i;
export const isWeapon = (name) => WEAPONS.includes(name) || WEAPON_NAME.test(name);

// Combat thumbnails (public/img/portraits/<slug>.webp): the first rule whose pattern matches the enemy's name
// (lower case, no accents, words joined by "-") and that applies to the current book. One picture per kind of enemy:
// the same "Guardia" is a city watchman in Book 2, a bandit in Book 4, a Vassagonian in Book 5.
const SAME_NAME = ['akraaneonor', 'baknar', 'barbaro-dei-ghiacci', 'barraka', 'demone-di-ghiaccio', 'elix', 'giak', 'gurgaz', 'helghast',
  'kalkoth', 'kraan', 'tigerwolf', 'vonotar', 'vordak', 'zlanbeast', 'haakon', 'itikar', 'kwaraz', 'dhorgaan', 'szall', 'zombie',
  'viveka', 'javek', 'hammerfist', 'serpe-glaciale', 'progenie-della-cripta'];
const PORTRAIT_RULES = [
  ['drakkarim', /drakkar/, [5]], // Book 5 describes them as men in death masks
  ['guerriero-vassagoniano', /vassagonian|sharnazim|guardi|carcerier|sentinell|cavaliere|corriere/, [5]],
  ['guerriero-bandito', /bandit|guardi/, [4]],
  ['guardia-cittadina', /guardi|sergente|caporale|soldat/, [1, 2]],
  ['guerriero-vassagoniano', /vassagonian/],
  ['cane-da-guerra', /can[ei]-da-guerra|akataz/],
  ['lupo-della-perdizione', /lup[oi]-della-perdizione/],
  ['ladro', /ladr|bull[io]|imbroglion|balord|assassin/],
  ['barbaro-dei-ghiacci', /barbar[oi]-dei-ghiacci/],
  ['cavaliere-della-montagna-bianca', /montagna-bianca|dorier|ganon/],
  ['demone-del-tunnel', /demon[ei]-del-tunnel/],
  ['piovra-gigante', /piovra|meresquid/],
  ['verme-di-pietra', /verme-di-pietra/],
  ['serpente-alato', /serpente-alato/],
  ['ragno-talpa', /ragno-talpa/],
  ['orso-nero', /(^|-)orso/],
  ['yas', /(^|-)yas(-|$)/],
  ['drakkar', /drakkar/],
  ...SAME_NAME.map((p) => [p, new RegExp(`(^|-)${p}`)]),
];
export function portraitFor(name, book = 0) {
  const slug = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ']/g, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const hit = PORTRAIT_RULES.find(([, re, books]) => re.test(slug) && (!books || books.includes(book)));
  return hit ? `public/img/portraits/${hit[0]}.webp` : null;
}

const NEXT_BOOK = { 1: 'Fuoco sulle Acque', 2: 'Le Caverne di Kalte', 3: 'Il Baratro della Perdizione', 4: 'Ombra sulla Sabbia' };

export class StoryReader {
  // hooks: { onNextBook, onRestartBook, onNewGame, onGameOver(message, title) }
  constructor(bookData, onContinueNextBook = null, hooks = {}) {
    this.bookData = bookData;
    this.onContinueNextBook = onContinueNextBook;
    this.hooks = hooks;
    this.easyModeMap = {};
    this.shownSection = null;
    this.busy = false; // a choice, roll or combat round is being resolved: ignore further clicks
    if (bookData) this.buildEasyModeMap(bookData);
  }

  buildEasyModeMap(bookData) {
    if (!bookData || !bookData.sections) return;

    let victorySectionId = null;
    for (const [id, sec] of Object.entries(bookData.sections)) {
      if (sec.isVictory) {
        victorySectionId = parseInt(id);
        break;
      }
    }
    if (!victorySectionId) return;

    const dist = {};
    const bestNext = {};
    dist[victorySectionId] = 0;
    let updated = true;

    while (updated) {
      updated = false;
      for (const [sIdStr, sec] of Object.entries(bookData.sections)) {
        const sId = parseInt(sIdStr);

        let minD = Infinity;
        let best = null;

        for (const c of sec.choices || []) {
          if (c.section && dist[c.section] !== undefined) {
            if (dist[c.section] + 1 < minD) {
              minD = dist[c.section] + 1;
              best = c.section;
            }
          }
        }

        // Combat outcomes and map/code puzzles aren't buttons in a choices
        // list, but they're still real story edges - without them, any
        // section whose only way onward is a fight (win/flee/lose) or a
        // numeric puzzle looks like a dead end, and everything upstream of
        // it silently loses its distance-to-victory too. `best` stays a
        // choices-only target since that's the only thing the UI can
        // actually highlight as a clickable button.
        const combats = Array.isArray(sec.combat) ? sec.combat : (sec.combat ? [sec.combat] : []);
        for (const c of combats) {
          const targets = [c.fleeSection, c.loseSection, c.forceEndSection, ...(c.fleeSections || []).map(f => f.section)];
          for (const target of targets) {
            if (target && dist[target] !== undefined && dist[target] + 1 < minD) {
              minD = dist[target] + 1;
            }
          }
        }
        if (sec.numericPuzzle && dist[sec.numericPuzzle.correctSection] !== undefined) {
          minD = Math.min(minD, dist[sec.numericPuzzle.correctSection] + 1);
        }

        if (minD !== Infinity && (dist[sId] === undefined || minD < dist[sId])) {
          dist[sId] = minD;
          bestNext[sId] = best;
          updated = true;
        }
      }
    }

    this.easyModeDistances = dist;
    this.easyModeMap = bestNext;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'story';
    container.id = 'story-reader';
    this.container = container;
    this.unsubscribe = gameState.subscribe((state) => this.update(container, state));
    this.update(container, gameState.getState());
    return container;
  }

  update(container, state) {
    const { currentSection, inCombat, combatState } = state;
    if (!this.easyModeMap || Object.keys(this.easyModeMap).length === 0) {
      this.buildEasyModeMap(this.bookData);
    }
    const section = this.bookData.sections[currentSection];
    const fresh = this.shownSection !== currentSection; // a new page: animate it in and go back to the top
    this.shownSection = currentSection;

    if (!section) {
      container.innerHTML = `<div class="card"><p class="kicker">Sezione ${esc(currentSection)}</p>
        <h2 class="title" style="margin-top:.6rem">Pagina mancante</h2>
        <p class="muted" style="margin-top:.75rem">Questa sezione non c'è nel libro caricato. Dal menu puoi caricare un salvataggio.</p></div>`;
      return;
    }

    let html = `
      <article class="card ${fresh ? '' : 'still'}">
        <p class="kicker section-num">Sezione <b>${currentSection}</b></p>
        ${section.title ? `<h2 class="title section-title">${noEmoji(section.title)}</h2>` : ''}
        ${section.image ? `<img src="${section.image}" alt="" class="section-image" loading="lazy">`
          : section.isDeathSection ? `<img src="public/img/death/book${state.bookNumber}.webp" alt="" class="section-image" onerror="this.remove()">` : ''}
        <div class="prose">${section.text}</div>`;

    if (inCombat && combatState) {
      html += this.renderCombat(combatState);
    } else if (section.isDeathSection) {
      html += this.renderDeathSection();
    } else if (section.isFailureEnding) {
      html += this.renderFailureEndingSection();
    } else if (section.isVictory) {
      html += this.renderVictorySection(state.bookNumber, this.onContinueNextBook && state.bookNumber < 5);
    } else if (section.numericPuzzle) {
      // A physical-book puzzle (a combination lock, a map-derived code): the right answer is a section number
      // worked out from clues; any other guess goes to numericPuzzle.wrongSection. Regular choices can sit alongside.
      if (section.choices && section.choices.length > 0) html += this.renderStandardChoices(section.choices, state);
      html += this.renderNumericPuzzle();
    } else if (section.choices && section.choices.length > 0) {
      if (section.doubleDestinyRoll) {
        html += this.renderDestinyTest();
      } else if (this.isDestinyTest(section.choices)) {
        // A "bypass" choice (e.g. "if you have the Sommerswerd, turn to X") can sit next to a real roll
        const bypassChoices = section.choices.filter((c) => this.parseDestinyRange(c.text) === null);
        if (bypassChoices.length > 0) html += this.renderStandardChoices(bypassChoices, state);
        html += this.renderDestinyTest();
      } else {
        html += this.renderStandardChoices(section.choices, state);
      }
    }
    html += '</article>';
    container.innerHTML = html;

    if (fresh && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      sfx.page();
    }
    const log = container.querySelector('.log');
    if (log) log.scrollTop = log.scrollHeight;

    container.querySelectorAll('.choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choice = section.choices[Number(btn.dataset.index)];
        this.navigateToSection(Number(btn.dataset.section), section, choice);
      });
    });
    const on = (sel, fn) => { const el = container.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('#fight-btn', () => this.executeCombatRound());
    on('#flee-btn', () => this.fleeCombat());
    on('#destiny-roll-btn', () => (section.doubleDestinyRoll ? this.handleDoubleDestinyRoll(container, section) : this.handleDestinyRoll(container, section)));
    on('#numeric-puzzle-btn', () => this.handleNumericPuzzle(container, section));
    on('#continue-next-book-btn', () => this.onContinueNextBook && this.onContinueNextBook());
    on('#restart-book-btn', () => this.hooks.onRestartBook && this.hooks.onRestartBook());
    on('#new-game-btn', () => this.hooks.onNewGame && this.hooks.onNewGame());
    const input = container.querySelector('#numeric-puzzle-input');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleNumericPuzzle(container, section); });
  }

  async navigateToSection(sectionNumber, currentSection, choice = null) {
    if (this.navigating) return; // a double click must not apply the section's effects twice
    this.navigating = true;
    try {
      for (const effects of [currentSection.effects, choice && choice.effects]) {
        if (!effects) continue;
        try {
          await this.applyEffects(effects);
        } catch (error) {
          console.error('Error applying effects:', error);
          UIHelpers.showToast('Errore nell\'applicare gli effetti', 'warning');
        }
        if (this.dead) return;
      }

      const nextSection = this.bookData.sections[sectionNumber];
      // A single-enemy combat can be skipped under some condition (e.g. "you cannot fight with an injured arm,
      // you fall instead") - bypassEffects then replaces the fight. See Book 5 section 162.
      const combatSkipped = nextSection && nextSection.combat && !Array.isArray(nextSection.combat) &&
        nextSection.combat.requirements && !this.checkRequirements(nextSection.combat.requirements, gameState.getState());
      if (combatSkipped && nextSection.combat.bypassEffects) {
        try {
          await this.applyEffects(nextSection.combat.bypassEffects);
        } catch (error) {
          console.error('Error applying combat bypass effects:', error);
          UIHelpers.showToast('Errore nell\'applicare gli effetti', 'warning');
        }
        if (this.dead) return;
      }

      // Move first, then start the fight: Healing (+1 per section without combat) looks at whether the section
      // being left had a fight, and starting the new fight first used to flag the wrong section.
      gameState.goToSection(sectionNumber);

      if (!combatSkipped && nextSection && nextSection.combat) {
        // Section-wide bonus/penalty (terrain, surprise) is folded into every enemy of the fight
        let combatData = nextSection.combat;
        const fold = (key, amount) => {
          const add = (enemy) => ({ ...enemy, [key]: (enemy[key] || 0) + amount });
          combatData = Array.isArray(combatData) ? combatData.map(add) : add(combatData);
        };
        if (nextSection.playerCombatBonus) fold('playerCombatBonus', nextSection.playerCombatBonus);
        if (nextSection.playerCombatPenalty) fold('playerCombatPenalty', nextSection.playerCombatPenalty);
        combatManager.startCombat(combatData);
      }
    } finally {
      this.navigating = false;
    }
  }

  // After a reload in the middle of a fight, put the combat manager back in step with the save.
  resumeCombat() {
    const state = gameState.getState();
    const section = this.bookData.sections[state.currentSection];
    if (state.inCombat && state.combatState && section && section.combat && !combatManager.combatData) {
      combatManager.resume(section.combat, state.combatState);
    }
  }

  // All keys present on a requirements object must pass (AND, not "first match
  // wins") - a choice can combine e.g. a Kai Discipline AND an item at once.
  // Use `anyOf: [requirements, ...]` for OR - passes if ANY alternative object
  // passes (each alternative can itself combine multiple ANDed keys).
  checkRequirements(requirements, state) {
    if (!requirements) return true;
    const character = state.character;

    if (requirements.anyOf !== undefined) {
      if (!requirements.anyOf.some(alt => this.checkRequirements(alt, state))) return false;
    }
    if (requirements.not !== undefined) {
      if (this.checkRequirements(requirements.not, state)) return false;
    }
    if (requirements.kaiArt !== undefined) {
      if (!character.artiRamas.includes(requirements.kaiArt)) return false;
    }
    // All of these Kai Disciplines must be held at once (e.g. "if you have
    // Camouflage AND Hunting") - `kaiArt` above only ever checks a single one.
    if (requirements.kaiArts !== undefined) {
      if (!requirements.kaiArts.every(art => character.artiRamas.includes(art))) return false;
    }
    if (requirements.item !== undefined) {
      const has = character.zaino.includes(requirements.item) ||
        character.oggettiSpeciali.includes(requirements.item) ||
        character.armi.includes(requirements.item);
      if (!has) return false;
    }
    // All of these items must be held at once (e.g. "if you have a Torch AND
    // a Tinderbox") - `item` above only ever checks a single name.
    if (requirements.items !== undefined) {
      const hasAll = requirements.items.every(item =>
        character.zaino.includes(item) ||
        character.oggettiSpeciali.includes(item) ||
        character.armi.includes(item)
      );
      if (!hasAll) return false;
    }
    if (requirements.minGold !== undefined) {
      if (character.corone < requirements.minGold) return false;
    }
    // Kai rank is derived from how many Disciplines you know, not tracked
    // separately - see levels.htm: 5 at start (Initiate), +1 per book
    // completed (Aspirant=6, Guardian=7, Warmarn=8, Savant=9, Master=10).
    if (requirements.minDisciplines !== undefined) {
      if (character.artiRamas.length < requirements.minDisciplines) return false;
    }
    if (requirements.minResistenza !== undefined) {
      if (character.resistenza < requirements.minResistenza) return false;
    }
    if (requirements.maxResistenza !== undefined) {
      if (character.resistenza >= requirements.maxResistenza) return false;
    }
    // "Kai Discipline of Weaponskill WITH the weapon you are now using" -
    // Scherma only helps while the mastered weapon is actually equipped.
    // Persistent narrative injury flag (e.g. Limbdeath numbing an arm) - set/
    // cleared via effects.setArmInjured/clearArmInjured, see Book 5 sections 166/2
    if (requirements.armInjured !== undefined) {
      if (!!state.flags.armInjured !== requirements.armInjured) return false;
    }
    if (requirements.weaponMasteryEquipped !== undefined) {
      const equipped = character.artiRamas.includes('Scherma') &&
        !!character.weaponMastery && character.armi.includes(character.weaponMastery);
      if (equipped !== requirements.weaponMasteryEquipped) return false;
    }
    // Gate a choice on how the combat that just ended actually went
    if (requirements.maxRounds !== undefined) {
      if (!state.lastCombatSummary || state.lastCombatSummary.rounds > requirements.maxRounds) return false;
    }
    if (requirements.minRounds !== undefined) {
      if (!state.lastCombatSummary || state.lastCombatSummary.rounds < requirements.minRounds) return false;
    }
    if (requirements.tookDamage !== undefined) {
      if (!state.lastCombatSummary) return false;
      const took = state.lastCombatSummary.damageTaken > 0;
      if (took !== requirements.tookDamage) return false;
    }
    // Compares how much Resistenza each side lost in the combat that just
    // ended (e.g. a single-round surprise clash with a 3-way outcome: "you
    // lost more" / "the enemy lost more" / "exact tie").
    if (requirements.enemyLostMore !== undefined) {
      if (!state.lastCombatSummary) return false;
      const result = state.lastCombatSummary.damageDealt > state.lastCombatSummary.damageTaken;
      if (result !== requirements.enemyLostMore) return false;
    }
    if (requirements.playerLostMore !== undefined) {
      if (!state.lastCombatSummary) return false;
      const result = state.lastCombatSummary.damageTaken > state.lastCombatSummary.damageDealt;
      if (result !== requirements.playerLostMore) return false;
    }
    if (requirements.combatTied !== undefined) {
      if (!state.lastCombatSummary) return false;
      const result = state.lastCombatSummary.damageTaken === state.lastCombatSummary.damageDealt;
      if (result !== requirements.combatTied) return false;
    }

    return true;
  }

  // Sum every applicable entry's value (they stack independently - e.g. Book 3
  // section 284 adds 2 for Caccia AND separately deducts 2 when badly wounded).
  // Each entry's `requirements` (or `anyOf` inside it) is checked with the same
  // checkRequirements used for choices, so "Discipline A OR B OR C" etc. all work.
  calculateDestinyModifier(section, state) {
    if (!section.destinyModifier) return 0;
    return section.destinyModifier.reduce((total, mod) => {
      return total + (this.checkRequirements(mod.requirements, state) ? mod.value : 0);
    }, 0);
  }

  // Pure computation shared by effects.loseEnduranceFromRoll and
  // effects.addGoldFromRoll - kept separate from the gameState/UIHelpers side
  // effects in applyEffects so it's unit-testable.
  resolveModifiedRoll(spec, roll, state) {
    const adjustedRoll = (spec.zeroMeansTen && roll === 0) ? 10 : roll;
    const modifier = (spec.modifiers || []).reduce((sum, mod) =>
      sum + (this.checkRequirements(mod.requirements, state) ? mod.value : 0), 0);
    return { total: Math.max(0, adjustedRoll + modifier), modifier };
  }

  async applyEffects(effects) {
    // Add single item
    if (effects.addItem) {
      if (gameState.addToZaino(effects.addItem)) {
        UIHelpers.showToast(`✅ Aggiunto: ${effects.addItem}`, 'success');
      } else {
        UIHelpers.showToast(`🎒 Zaino Pieno! Impossibile prendere: ${effects.addItem}`, 'error');
      }
    }

    // Add multiple items with confirmation
    if (effects.canAddItems) {
      for (const item of effects.canAddItems) {
        // A loot pile sometimes mixes weapons in with Backpack Items (e.g.
        // "search the bodies: Sword, Mace, Dagger, Backpack"). A weapon picked
        // up this way must still go through the weapon slot (with its own
        // 2-weapon swap prompt), not into the Zaino - otherwise it silently
        // never counts as "equipped" for Scherma's mastery bonus.
        if (isWeapon(item)) {
          await this.handleWeaponAcquisition(item);
          continue;
        }
        const confirmed = await UIHelpers.confirmAsync(`Vuoi prendere ${item}?`, { yes: 'Prendi', no: 'Lascia' });
        if (confirmed) {
          if (gameState.addToZaino(item)) {
            UIHelpers.showToast(`✅ Preso: ${item}`, 'success');
          } else {
            UIHelpers.showToast(`🎒 Zaino Pieno! Impossibile prendere: ${item}`, 'error');
          }
        }
      }
    }

    // Add weapon with confirmation/swap
    if (effects.canAddWeapon) {
      await this.handleWeaponAcquisition(effects.canAddWeapon);
    }

    // Add meals
    if (effects.canAddMeals) {
      const added = gameState.addPasti(effects.canAddMeals);
      if (added === effects.canAddMeals) {
        UIHelpers.showToast(`🍖 Hai trovato ${effects.canAddMeals} pasti!`, 'success');
      } else if (added > 0) {
        UIHelpers.showToast(`🍖 Hai preso ${added} pasti, ma lo zaino è pieno.`, 'warning');
      } else {
        UIHelpers.showToast(`🎒 Zaino Pieno! Impossibile prendere i pasti.`, 'error');
      }
    }

    // Choose exactly N of the listed options (e.g. "pick any 2 of these 6
    // items") - ask about each in turn, stop once N have been accepted.
    if (effects.chooseNItems) {
      const { count, options } = effects.chooseNItems;
      let accepted = 0;
      for (const opt of options) {
        if (accepted >= count) break;
        const confirmed = await UIHelpers.confirmAsync(`Vuoi prendere: ${opt.label}?`, { yes: 'Prendi', no: 'Lascia' });
        if (!confirmed) continue;
        if (opt.type === 'weapon') {
          await this.handleWeaponAcquisition(opt.value);
        } else if (opt.type === 'meals') {
          const added = gameState.addPasti(opt.value);
          UIHelpers.showToast(added === opt.value ? `🍖 Hai preso ${opt.value} pasti!` : `🎒 Zaino Pieno! Impossibile prendere i pasti.`, added === opt.value ? 'success' : 'error');
        } else if (gameState.addToZaino(opt.value)) {
          UIHelpers.showToast(`✅ Preso: ${opt.value}`, 'success');
        } else {
          UIHelpers.showToast(`🎒 Zaino Pieno! Impossibile prendere: ${opt.value}`, 'error');
        }
        accepted++;
      }
    }

    // A shop selling any/all of several items, each at its own Gold Crown
    // price (unlike chooseNItems, which is free and capped at N picks) - see
    // Book 5 sections 27/211/388.
    if (effects.shopItems) {
      for (const opt of effects.shopItems) {
        const confirmed = await UIHelpers.confirmAsync(`Vuoi comprare: ${opt.label}?`, { yes: 'Compra', no: 'No, grazie' });
        if (!confirmed) continue;
        if (gameState.getState().character.corone < opt.cost) {
          UIHelpers.showToast(`💰 Non hai abbastanza Corone d'Oro per: ${opt.label}`, 'error');
          continue;
        }
        gameState.removeCorone(opt.cost);
        if (opt.type === 'weapon') {
          await this.handleWeaponAcquisition(opt.value);
        } else if (opt.type === 'meals') {
          const added = gameState.addPasti(opt.value);
          UIHelpers.showToast(added === opt.value ? `🍖 Hai comprato ${opt.value} pasti!` : `🎒 Zaino Pieno! Impossibile prendere i pasti.`, added === opt.value ? 'success' : 'error');
        } else if (gameState.addToZaino(opt.value)) {
          UIHelpers.showToast(`✅ Acquistato: ${opt.value}`, 'success');
        } else {
          UIHelpers.showToast(`🎒 Zaino Pieno! Impossibile prendere: ${opt.value}`, 'error');
        }
      }
    }

    // Add gold
    if (effects.addGold) {
      gameState.addCorone(effects.addGold);
      UIHelpers.showToast(`💰 Trovate ${effects.addGold} Corone d'oro`, 'success');
    }

    // Remove gold
    if (effects.removeGold) {
      gameState.removeCorone(effects.removeGold);
      UIHelpers.showToast(`💰 Spese ${effects.removeGold} Corone d'oro`, 'warning');
    }

    // Gold gain equal to a Destiny Table roll (see resolveModifiedRoll) - e.g.
    // "pick a number and add 5, that's how many Crowns you win"
    if (effects.addGoldFromRoll) {
      const roll = getRandomDestinyNumber();
      const { total, modifier } = this.resolveModifiedRoll(effects.addGoldFromRoll, roll, gameState.getState());
      gameState.addCorone(total);
      UIHelpers.showToast(`🎲 Tabella del Destino: ${roll}${modifier ? ` (${modifier > 0 ? '+' : ''}${modifier})` : ''} - guadagni ${total} Corone d'Oro`, 'success');
    }

    // Direct endurance loss (sometimes waived entirely by a Kai Discipline, e.g.
    // "lose 2 Endurance unless you have Mindshield", or by possessing/having
    // applied an item, e.g. "lose 2 Endurance unless you applied Baknar oil" -
    // see Book 3 sections 331/150).
    if (effects.loseEndurance) {
      const character = gameState.getState().character;
      const hasItem = (item) => character.zaino.includes(item) || character.armi.includes(item) || character.oggettiSpeciali.includes(item);
      const prevented = (effects.psicoschermoPreventsLoss && gameState.hasKaiArt('Psicoschermo')) ||
        (effects.waivedByKaiArt && gameState.hasKaiArt(effects.waivedByKaiArt)) ||
        (effects.waivedByItem && hasItem(effects.waivedByItem));
      if (!prevented) {
        gameState.takeDamage(effects.loseEndurance);
        UIHelpers.showToast(`💔 Persi ${effects.loseEndurance} punti Resistenza`, 'error');
        if (await this.checkDeath()) return;
      }
    }

    // Endurance loss equal to a Destiny Table roll, adjusted by the same
    // requirements-based modifiers as calculateDestinyModifier (e.g. "pick a
    // number - if you have Hunting, subtract 2 - lose that much Resistenza").
    // zeroMeansTen matches the book's own "(0 = 10)" notation on some rolls.
    if (effects.loseEnduranceFromRoll) {
      const roll = getRandomDestinyNumber();
      const { total, modifier } = this.resolveModifiedRoll(effects.loseEnduranceFromRoll, roll, gameState.getState());
      gameState.takeDamage(total);
      UIHelpers.showToast(`🎲 Tabella del Destino: ${roll}${modifier ? ` (${modifier > 0 ? '+' : ''}${modifier})` : ''} - perdi ${total} punti Resistenza`, 'error');
      if (await this.checkDeath()) return;
    }

    // Erase an item from the Action Chart (e.g. handing over a Special Item)
    if (effects.removeItem) {
      gameState.removeItem(effects.removeItem);
      UIHelpers.showToast(`📜 Rimosso dal Registro di Guerra: ${effects.removeItem}`, 'info');
    }

    // Must eat or lose endurance
    if (effects.mustEatOrLoseEndurance) {
      // Check for Caccia (Hunting) - doesn't work in Book 3, nor in Book 5 section 320
      const state = gameState.getState();
      const huntingWorks = state.bookNumber !== 3 && !(state.bookNumber === 5 && state.currentSection === 320);
      const currentSection = state.currentSection;
      const mealFlagKey = `meal_consumed_section_${currentSection}`;

      if (huntingWorks && gameState.hasKaiArt('Caccia')) {
        // (this used to `return`, silently skipping every effect listed after the meal)
        UIHelpers.showToast('Caccia: trovi da mangiare, niente Pasto', 'success');
        gameState.setFlag(mealFlagKey, true);
      } else if (gameState.getFlag(mealFlagKey)) {
        UIHelpers.showToast('ℹ️ Hai già consumato il pasto per questa sezione.', 'info');
      } else {
        if (state.character.pasti > 0) {
          const confirmed = await UIHelpers.confirmAsync(`Devi mangiare un Pasto o perdi ${effects.mustEatOrLoseEndurance} punti Resistenza. Mangi?`, { yes: 'Mangio', no: 'Resto a digiuno' });
          if (confirmed) {
            gameState.consumePasto();
            UIHelpers.showToast('🍖 Hai consumato un pasto', 'info');
            gameState.setFlag(mealFlagKey, true);
          } else {
            gameState.takeDamage(effects.mustEatOrLoseEndurance);
            UIHelpers.showToast(`💔 Hai perso ${effects.mustEatOrLoseEndurance} punti Resistenza`, 'error');
            if (await this.checkDeath()) return;
            gameState.setFlag(mealFlagKey, true); // Mark as handled even if took damage
          }
        } else {
          await UIHelpers.showAlert(`Non hai pasti! Perdi ${effects.mustEatOrLoseEndurance} punti Resistenza.`, 'Denutrizione');
          gameState.takeDamage(effects.mustEatOrLoseEndurance);
          if (await this.checkDeath()) return;
          gameState.setFlag(mealFlagKey, true);
        }
      }
    }

    // Heal
    if (effects.health) {
      gameState.heal(effects.health);
      UIHelpers.showToast(`💚 Recuperati ${effects.health} punti Resistenza`, 'success');
    }

    // Full or partial endurance restore (e.g. "riposo presso un guaritore")
    if (effects.restoreEndurance) {
      const state = gameState.getState();
      const amount = effects.restoreEndurance === 'full'
        ? state.character.resistenzaMax
        : effects.restoreEndurance;
      gameState.heal(amount);
      UIHelpers.showToast(effects.restoreEndurance === 'full' ? 'Resistenza al massimo' : `Recuperi ${amount} punti Resistenza`, 'success');
    }

    // Restore ENDURANCE based on lifetime damage taken (not just the last
    // combat): full recovery with the given Kai Discipline, half of all
    // ENDURANCE ever lost without it - see Book 2 section 240.
    if (effects.restoreEnduranceFromTotalLost) {
      const state = gameState.getState();
      if (gameState.hasKaiArt(effects.restoreEnduranceFromTotalLost.kaiArt)) {
        gameState.heal(state.character.resistenzaMax);
        UIHelpers.showToast('💚 Resistenza completamente recuperata!', 'success');
      } else {
        const amount = Math.floor((state.character.totalEnduranceLost || 0) / 2);
        gameState.heal(amount);
        UIHelpers.showToast(`💚 Recuperati ${amount} punti Resistenza`, 'success');
      }
    }

    // Damage
    if (effects.damage) {
      gameState.takeDamage(effects.damage);
      UIHelpers.showToast(`💔 Subiti ${effects.damage} danni`, 'error');
      if (await this.checkDeath()) return;
    }

    // Lose all weapons only (backpack, if any, is kept)
    if (effects.loseAllWeapons) {
      gameState.clearWeapons();
      UIHelpers.showToast('⚔️ Hai perso tutte le tue armi!', 'error');
    }

    // Lose a single random weapon (e.g. a weapon breaks)
    if (effects.loseRandomWeapon) {
      const weapons = gameState.getState().character.armi;
      if (weapons.length > 0) {
        const lostWeapon = weapons[Math.floor(Math.random() * weapons.length)];
        gameState.removeWeapon(lostWeapon);
        UIHelpers.showToast(`⚔️ La tua arma si è spezzata: ${lostWeapon}`, 'error');
      }
    }

    // Lose the Backpack and everything in it - Weapons are untouched (they're
    // a separate Action Chart section); combine with loseAllWeapons for
    // sections that narrate losing both - see Book 3 section 49 / Book 4
    // sections 94/158/342 (Backpack only) vs Book 1 sections 258/294 (both).
    if (effects.loseAllItems) {
      gameState.clearZaino();
      UIHelpers.showToast('🎒 Hai perso lo Zaino e tutto il suo contenuto!', 'error');
    }

    // Lose a single random Backpack item (e.g. pickpocketed); falls back to a
    // random weapon if the Backpack is empty - see Book 1 section 144.
    if (effects.loseRandomItem) {
      const { zaino, armi } = gameState.getState().character;
      if (zaino.length > 0) {
        const lostItem = zaino[Math.floor(Math.random() * zaino.length)];
        gameState.removeFromZaino(lostItem);
        UIHelpers.showToast(`🎒 Ti hanno rubato: ${lostItem}`, 'error');
      } else if (armi.length > 0) {
        const lostWeapon = armi[Math.floor(Math.random() * armi.length)];
        gameState.removeWeapon(lostWeapon);
        UIHelpers.showToast(`⚔️ Ti hanno rubato l'arma: ${lostWeapon}`, 'error');
      }
    }

    // Permanent Combat Skill reduction ("your initial COMBAT SKILL is reduced
    // by 1 point for the rest of your life") - rare, see Book 1 section 236.
    if (effects.loseCombattivita) {
      const state = gameState.getState();
      gameState.updateStats({ combattivita: state.character.combattivita - effects.loseCombattivita });
      UIHelpers.showToast(`⚔️ Combattività ridotta permanentemente di ${effects.loseCombattivita}`, 'error');
    }

    // Persistent narrative injury (Limbdeath numbing an arm): -3 Combattività
    // until cured, at which point clearArmInjured restores it - see Book 5
    // sections 166 (set) and 2 (cure).
    if (effects.setArmInjured) {
      gameState.setFlag('armInjured', true);
      const state = gameState.getState();
      gameState.updateStats({ combattivita: state.character.combattivita - 3 });
      UIHelpers.showToast('🩹 Il tuo braccio è ora inutilizzabile: -3 Combattività', 'error');
    }
    if (effects.clearArmInjured) {
      gameState.setFlag('armInjured', false);
      const state = gameState.getState();
      gameState.updateStats({ combattivita: state.character.combattivita + 3 });
      UIHelpers.showToast('💚 Hai riacquistato l\'uso del braccio: +3 Combattività', 'success');
    }

    // Restore half the ENDURANCE lost in the combat that just ended (rounded
    // down) - a "got off lightly" outcome (quick win, evasion, spared rather
    // than killed), see Book 5 sections 20/135/161.
    if (effects.restoreHalfDamageTaken) {
      const state = gameState.getState();
      if (state.lastCombatSummary) {
        gameState.heal(Math.floor(state.lastCombatSummary.damageTaken / 2));
      }
    }
  }


  renderCombat(combat) {
    const state = gameState.getState();
    const c = state.character;
    const ratio = combatManager.combatData ? combatManager.calculateForceRatio() : null;
    const canFlee = combatManager.canFlee;
    const fleeReady = canFlee && combatManager.canPlayerFlee();
    const fleeIn = canFlee && !fleeReady && combatManager.combatData?.fleeAfterRounds
      ? combatManager.combatData.fleeAfterRounds - combat.rounds.length : 0;
    const pct = (v, max) => Math.max(0, Math.min(1, v / (max || 1)));
    const heroP = pct(c.resistenza, c.resistenzaMax);
    const foe = portraitFor(combat.enemy, state.bookNumber);
    const queue = combatManager.enemyQueue.length;
    return `
      <section class="combat" id="combat">
        <div class="combat-head">
          <h3>${icon('swords')}Combattimento</h3>
          ${ratio !== null ? `<span class="ratio ${ratio > 0 ? 'good' : ratio < 0 ? 'bad' : ''}">Rapporto di forza <b>${ratio > 0 ? '+' : ''}${ratio}</b></span>` : ''}
        </div>
        <div class="fighters">
          <div class="fighter hero" id="fighter-hero">
            <img class="portrait" src="public/img/portraits/lupo-solitario.webp" alt="">
            <span class="name">Lupo Solitario</span>
            <span class="meta">Combattività ${c.combattivita}</span>
            <div class="meter ${heroP <= 0.3 ? 'low' : heroP <= 0.6 ? 'mid' : ''}"><i style="--p:${heroP}"></i></div>
            <span class="hp">${c.resistenza}/${c.resistenzaMax}</span>
          </div>
          <span class="vs">vs</span>
          <div class="fighter foe ${combat.currentEnemyResistenza <= 0 ? 'down' : ''}" id="fighter-foe">
            ${foe ? `<img class="portrait" src="${foe}" alt="">` : `<span class="portrait glyph">${icon('skull')}</span>`}
            <span class="name">${esc(combat.enemy)}</span>
            <span class="meta">Combattività ${combat.combattivita}${queue ? ` · poi altri ${queue}` : ''}</span>
            <div class="meter enemy"><i style="--p:${pct(combat.currentEnemyResistenza, combat.resistenza)}"></i></div>
            <span class="hp">${Math.max(0, combat.currentEnemyResistenza)}/${combat.resistenza}</span>
          </div>
        </div>
        <div class="log" aria-live="polite">${combatManager.getLog().map((e) => `<div class="${e.kind || ''}">${esc(noEmoji(e.message))}</div>`).join('')}</div>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" id="fight-btn" ${this.busy ? 'disabled' : ''}>${icon('swords')}Combatti</button>
          ${canFlee ? `<button class="btn btn-ghost" type="button" id="flee-btn" ${fleeReady && !this.busy ? '' : 'disabled'}>${icon('footprints')}Fuggi${fleeIn > 0 ? `<small>tra ${fleeIn} round</small>` : ''}</button>` : ''}
        </div>
      </section>`;
  }

  executeCombatRound() {
    if (this.busy || !combatManager.combatData) return;
    const before = gameState.getState();
    const heroBefore = before.character.resistenza;
    const result = combatManager.fightRound();
    const terminal = ['victory', 'defeat', 'force-end'].includes(result);
    if (terminal) this.busy = true; // the fight is over: no more rounds while the outcome plays out
    const container = this.container || document.getElementById('story-reader');
    this.update(container, gameState.getState());

    // feedback: who got hurt this round
    const last = before.combatState && gameState.getState().combatState?.rounds.at(-1);
    if (last) {
      if (last.heroDamage > 0) { replay(container.querySelector('#fighter-hero'), 'hurt'); replay(container.querySelector('#combat'), 'hit'); sfx.hurt(); }
      if (last.enemyDamage > 0) { replay(container.querySelector('#fighter-foe'), 'hurt'); sfx.strike(); }
    } else if (gameState.getState().character.resistenza < heroBefore) sfx.hurt();

    if (result === 'next-enemy') return;

    if (result === 'force-end') {
      // Some fights stop after a fixed number of rounds whatever the score (e.g. reinforcements arrive)
      setTimeout(() => {
        const forceEndSection = combatManager.combatData.forceEndSection;
        const currentSectionNum = gameState.getState().currentSection;
        combatManager.endCombat('force-end');
        this.busy = false;
        if (forceEndSection === currentSectionNum) {
          // the section's own choices branch on how this round went (enemyLostMore/playerLostMore/combatTied)
          this.update(container, gameState.getState());
        } else {
          this.navigateToSection(forceEndSection, this.bookData.sections[currentSectionNum]);
        }
      }, 900);
      return;
    }

    if (result === 'victory') {
      sfx.victory();
      setTimeout(() => {
        combatManager.endCombat('victory');
        this.busy = false;
        UIHelpers.showToast('Hai vinto il combattimento', 'success');
        // endCombat already re-rendered the section's choices (gated on how the fight went). Only move on by
        // ourselves when there is a single way forward - flee choices only make sense mid-fight.
        const state = gameState.getState();
        const currentSection = this.bookData.sections[state.currentSection];
        const combatObj = (currentSection.combat && !Array.isArray(currentSection.combat)) ? currentSection.combat : null;
        const fleeSection = combatObj ? combatObj.fleeSection : undefined;
        const fleeTargets = combatObj ? (combatObj.fleeSections || []).map((f) => f.section) : [];
        const forward = (currentSection.choices || []).filter((c) => c.section !== fleeSection && !fleeTargets.includes(c.section));
        if (forward.length === 1 && this.checkRequirements(forward[0].requirements, state)) {
          this.navigateToSection(forward[0].section, currentSection, forward[0]);
        }
      }, 900);
    } else if (result === 'defeat') {
      setTimeout(async () => {
        // Some enemies spare the hero (knocked out, captured): loseSection instead of the end. See Book 5 sections 20/135.
        const loseSection = combatManager.combatData.loseSection;
        combatManager.endCombat('defeat');
        this.busy = false;
        if (loseSection) {
          this.navigateToSection(loseSection, this.bookData.sections[gameState.getState().currentSection]);
        } else {
          await this.endGame('Sei stato sconfitto. L\'avventura finisce qui.', 'Sconfitta');
        }
      }, 900);
    }
  }

  // The run ends now (death in combat, wounds, or a roll whose outcome is death with no section to turn to).
  async endGame(message, title) {
    if (this.dead) return;
    this.dead = true;
    sfx.defeat();
    if (this.hooks.onGameOver) this.hooks.onGameOver(message, title);
    else await UIHelpers.showAlert(message, title);
  }

  async fleeCombat() {
    if (this.busy) return;
    if (!combatManager.canPlayerFlee()) {
      UIHelpers.showToast('Non puoi ancora fuggire', 'warning');
      return;
    }
    this.busy = true;
    try {
      // fleeSection(s) belong to the enemy being fought (combatManager.combatData): a multi-enemy fight is an array
      const fleeSection = combatManager.combatData && combatManager.combatData.fleeSection;
      // some encounters let the hero pick where to run (e.g. north or south) - see Book 3 section 108
      const fleeSections = combatManager.combatData && combatManager.combatData.fleeSections;

      if (combatManager.flee()) {
        if (await this.checkDeath()) return; // fleeing can still cost enough Resistenza to kill
        const destination = fleeSections && fleeSections.length
          ? await UIHelpers.chooseAsync('Da che parte vuoi fuggire?', fleeSections.map((f) => ({ label: f.label, value: f.section })))
          : fleeSection;
        this.busy = false;
        if (destination) {
          const state = gameState.getState();
          await this.navigateToSection(destination, this.bookData.sections[state.currentSection]);
        } else {
          this.update(this.container || document.getElementById('story-reader'), gameState.getState());
        }
      }
    } finally {
      this.busy = false;
    }
  }

  // --- Rendering helpers ---

  renderStandardChoices(choices, state) {
    // Easy mode: highlight the available choice closest to the book's victory section
    let recommendedSection = null;
    if (state.easyMode && this.easyModeDistances) {
      let minDistance = Infinity;
      choices.forEach((choice) => {
        if (this.checkRequirements(choice.requirements, state) && choice.section && this.easyModeDistances[choice.section] !== undefined) {
          const d = this.easyModeDistances[choice.section];
          if (d < minDistance) { minDistance = d; recommendedSection = choice.section; }
        }
      });
    }
    return `<div class="choices">${choices.map((choice, index) => {
      const canChoose = this.checkRequirements(choice.requirements, state);
      const easy = state.easyMode && recommendedSection && choice.section === recommendedSection && canChoose;
      return `<button class="choice ${easy ? 'easy' : ''}" type="button" data-section="${choice.section}" data-index="${index}" ${canChoose ? '' : 'disabled data-locked="1"'}>
          <span>${noEmoji(choice.text)}${easy ? '<span class="badge">Facile</span>' : ''}</span>${icon(canChoose ? 'chevron-right' : 'lock')}
        </button>`;
    }).join('')}</div>`;
  }

  isDestinyTest(choices) {
    const rangeChoices = choices.filter((c) => this.parseDestinyRange(c.text) !== null);
    const nonRangeChoices = choices.filter((c) => this.parseDestinyRange(c.text) === null);
    // A pure Destiny Table roll: 2+ choices describing a range ("Numero X-Y", "Numero da X a Y", "Da X a Y",
    // or a single "numero è N") and nothing else.
    if (nonRangeChoices.length === 0) return rangeChoices.length > 1;
    // A roll with bypass choice(s) mixed in - only when EVERY non-range choice is gated by `requirements`,
    // proving it's an intentional shortcut and not an oddly-phrased range the parser missed.
    return rangeChoices.length > 1 && nonRangeChoices.every((c) => !!c.requirements);
  }

  // The {min, max} roll range a choice text refers to, or null. Handles the several phrasings used across the books.
  parseDestinyRange(text) {
    let match = text.match(/(\d+)\s*-\s*(\d+)/);
    if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) };

    // Min bound may be negative once a destinyModifier deduction is in play (e.g. "da -3 a 3")
    match = text.match(/\bda\s*(-?\d+)\s*a\s*(\d+)\b/i);
    if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) };

    // "numero è N", and the shortened follow-up "Se è 0". JS \b treats "è" as a non-word char, so anchor on whitespace.
    match = text.match(/(?:^|\s)(?:è|e)\s+(-?\d+)\b/i);
    if (match) return { min: parseInt(match[1]), max: parseInt(match[1]) };

    // Bare "Numero N" (e.g. "Numero 0" next to "Numero 1-4" / "Numero 5-9")
    match = text.match(/\bnumero\s+(-?\d+)\b/i);
    if (match) return { min: parseInt(match[1]), max: parseInt(match[1]) };

    return null;
  }

  renderDestinyTest() {
    const state = gameState.getState();
    const recommendedSection = (state.easyMode && this.easyModeMap) ? this.easyModeMap[state.currentSection] : null;
    return `
      <div class="widget">
        <h3>${icon('dices')}Tabella del Destino</h3>
        <p>Decide la sorte, non tu.</p>
        ${recommendedSection ? `<p class="note easy">${icon('lightbulb')} Facile: la strada giusta passa dalla sezione ${recommendedSection}.</p>` : ''}
        <div class="dice" id="destiny-roll-result">?</div>
        <button class="btn btn-primary" type="button" id="destiny-roll-btn">${icon('dices')}Lancia il Destino</button>
        <div class="result" id="destiny-message" aria-live="polite"></div>
      </div>`;
  }

  renderNumericPuzzle() {
    return `
      <div class="widget">
        <h3>${icon('lock')}Enigma</h3>
        <p>Se hai capito a quale sezione andare, scrivi il numero.</p>
        <input type="number" inputmode="numeric" id="numeric-puzzle-input" class="puzzle-input" placeholder="?" aria-label="Numero della sezione">
        <button class="btn btn-primary" type="button" id="numeric-puzzle-btn">${icon('arrow-right')}Vai</button>
      </div>`;
  }

  endingButtons(primary = '') {
    const n = gameState.getState().bookNumber;
    return `<div class="stack">
      ${primary}
      ${this.hooks.onRestartBook ? `<button class="btn ${primary ? 'btn-ghost' : 'btn-primary'}" type="button" id="restart-book-btn">${icon('rotate-ccw')}Ricomincia il Libro ${n}</button>` : ''}
      <button class="btn btn-ghost" type="button" id="new-game-btn">${icon('plus')}Nuova partita</button>
    </div>`;
  }

  renderDeathSection() {
    if (!this.endedHere) { this.endedHere = true; sfx.defeat(); }
    return `<div class="ending lose"><p class="big">Fine.</p><p>La tua avventura finisce qui.</p>${this.endingButtons()}</div>`;
  }

  renderFailureEndingSection() {
    if (!this.endedHere) { this.endedHere = true; sfx.defeat(); }
    return `<div class="ending fail"><p class="big">Missione fallita.</p><p>Sei vivo, ma non ce l'hai fatta.</p>${this.endingButtons()}</div>`;
  }

  renderVictorySection(bookNumber, canContinueToNextBook) {
    if (!this.endedHere) { this.endedHere = true; sfx.victory(); }
    const next = canContinueToNextBook
      ? `<button class="btn btn-primary" type="button" id="continue-next-book-btn">${icon('book-open')}Continua nel Libro ${bookNumber + 1}<small>${NEXT_BOOK[bookNumber]}</small></button>`
      : '';
    return `<div class="ending win"><p class="big">Vittoria.</p><p>${bookNumber < 5 ? 'Hai completato il libro. Il Registro di Guerra viene con te.' : 'Hai completato tutti i libri disponibili. Per ora.'}</p>${this.endingButtons(next)}</div>`;
  }

  // Locks the section's buttons while a roll plays out, so nothing else can be clicked meanwhile.
  lockChoices(container, locked) {
    container.querySelectorAll('.choice, #destiny-roll-btn').forEach((b) => { b.disabled = locked || b.dataset.locked === '1'; });
  }

  async handleDestinyRoll(container, section) {
    if (this.busy) return;
    this.busy = true;
    this.lockChoices(container, true);
    const display = container.querySelector('#destiny-roll-result');
    const message = container.querySelector('#destiny-message');

    // the roll, adjusted by any Kai Discipline/rank/Endurance modifier this section declares
    const roll = getRandomDestinyNumber();
    const modifier = this.calculateDestinyModifier(section, gameState.getState());
    const total = roll + modifier;
    await rollDigits(display, roll);

    const matchedChoice = section.choices.find((choice) => {
      const range = this.parseDestinyRange(choice.text);
      return range && total >= range.min && total <= range.max;
    });
    if (!matchedChoice) {
      message.textContent = 'Nessuna uscita corrisponde a questo numero. Lancia di nuovo.';
      this.busy = false;
      this.lockChoices(container, false);
      return;
    }
    const totalLabel = modifier !== 0 ? `${roll} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)} = ${total}` : `${roll}`;
    message.innerHTML = `<b>${totalLabel}</b> · ${noEmoji(matchedChoice.text)}`;
    setTimeout(async () => {
      this.busy = false;
      // Rare case: the outcome is a death narrated inline, with no section to turn to (e.g. Book 3 section 94).
      if (matchedChoice.section === null && matchedChoice.isDeathSection) {
        await this.endGame(noEmoji(matchedChoice.text), 'Fine');
      } else {
        await this.navigateToSection(matchedChoice.section, section, matchedChoice);
      }
    }, 1600);
  }

  // A puzzle from the printed book (a lock, a code from the map): the right number leads to correctSection,
  // anything else (blank included) to the book's single "wrong guess" section.
  handleNumericPuzzle(container, section) {
    if (this.busy) return;
    const input = container.querySelector('#numeric-puzzle-input');
    const guess = parseInt(input.value, 10);
    const { correctSection, wrongSection } = section.numericPuzzle;
    this.navigateToSection(guess === correctSection ? correctSection : wrongSection, section);
  }

  // Rarer Destiny Table variant: two numbers drawn in sequence and compared to each other. Only the first takes
  // the section's destinyModifier. Choices match on an explicit `outcome`: 'secondLess' | 'secondMore' | 'equal'.
  async handleDoubleDestinyRoll(container, section) {
    if (this.busy) return;
    this.busy = true;
    this.lockChoices(container, true);
    const display = container.querySelector('#destiny-roll-result');
    const message = container.querySelector('#destiny-message');

    const first = getRandomDestinyNumber();
    const modifier = this.calculateDestinyModifier(section, gameState.getState());
    const firstTotal = first + modifier;
    const second = getRandomDestinyNumber();
    display.classList.add('wide');
    await rollDigits(display, `${firstTotal} · ${second}`);

    const outcome = second < firstTotal ? 'secondLess' : (second > firstTotal ? 'secondMore' : 'equal');
    const matchedChoice = section.choices.find((choice) => choice.outcome === outcome);
    if (!matchedChoice) {
      message.textContent = 'Nessuna uscita corrisponde. Lancia di nuovo.';
      this.busy = false;
      this.lockChoices(container, false);
      return;
    }
    const firstLabel = modifier !== 0 ? `${first} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)} = ${firstTotal}` : `${firstTotal}`;
    message.innerHTML = `<b>Primo ${firstLabel} · secondo ${second}</b> · ${noEmoji(matchedChoice.text)}`;
    setTimeout(() => {
      this.busy = false;
      this.navigateToSection(matchedChoice.section, section, matchedChoice);
    }, 1600);
  }

  async checkDeath() {
    if (this.dead) return true;
    if (gameState.getState().character.resistenza <= 0) {
      await this.endGame('Le ferite hanno avuto la meglio. L\'avventura finisce qui.', 'Fine');
      return true;
    }
    return false;
  }

  async handleWeaponAcquisition(newWeapon) {
    if (gameState.getState().character.armi.length < 2) {
      if (await UIHelpers.confirmAsync(`Vuoi prendere ${esc(newWeapon)}?`, { yes: 'Prendi', no: 'Lascia' })) {
        gameState.addWeapon(newWeapon);
        UIHelpers.showToast(`Preso: ${newWeapon}`, 'success');
      }
    } else {
      await swapWeapon(newWeapon);
    }
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}
