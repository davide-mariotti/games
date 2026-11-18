// Between books: the character carries over, then each book's own "continuing your adventure" rules apply:
// Gold Crowns + roll + 10 (max 50), one new Kai Discipline, some new equipment, the book's automatic Special Items.
import { getRandomDestinyNumber } from './destiny-table.js';
import { gameState } from '../game-state.js';
import { UIHelpers } from '../utils/ui-helpers.js';
import { icon, esc, rollDigits, sfx } from '../ui/kit.js';
import { KAI_ARTS, thumbHTML, itemLabel, rollWeaponMastery } from './character-creator.js';

// Per book: story recap, the note under it, the equipment on offer, how many picks (exact or "up to"), automatic Special Items.
export const BOOK_TRANSITIONS ={
  "2": {
    title: "Fuoco sulle Acque",
    story: [
      "Da molti secoli, nella terra settentrionale di Sommerlund, è tradizione che i figli dei Signori Guerrieri vengano mandati al monastero di Ramas, dove apprendono le arti e le discipline dei loro nobili padri. In tempi antichi, durante l'Era della Luna Nera, i Signori delle Tenebre mossero guerra a Sommerlund: un conflitto lungo e amaro che si concluse con la vittoria dei Sommlending nella grande battaglia di Maakengorge. Re Ulnar e gli alleati di Durenor spezzarono gli eserciti delle Tenebre al passo di Moytura e li ricacciarono nell'abisso senza fondo di Maakengorge. Vashna, il più potente dei Signori delle Tenebre, fu ucciso dalla spada di Re Ulnar, chiamata «Spada del Sole». Da quell'epoca, i Signori delle Tenebre hanno giurato vendetta contro Sommerlund e la Casa di Ulnar.",
      "Tu sei Lupo Solitario, un giovane iniziato Ramas che stava apprendendo le arti segrete dei cavalieri Ramas. Due giorni fa, il tuo pacifico paese è stato gettato nella guerra quando un vasto esercito dei Signori delle Tenebre ha invaso Sommerlund e distrutto il monastero di Ramas. Tutti i cavalieri Ramas erano riuniti per la festa di Fehmarn, e tutti sono periti quando le mura del monastero sono crollate sulla compagnia. Tu, l'unico sopravvissuto alla strage, hai giurato di vendicare le loro morti.",
      "Sapevi che il tuo primo compito doveva essere avvertire il Re: senza i cavalieri Ramas a guidare i suoi eserciti, Sommerlund non avrebbe potuto mobilitarsi in tempo per respingere i Signori delle Tenebre. Il viaggio verso la capitale fu pericoloso, ma nonostante le insidie ti sei fatto strada fino a Holmgard e hai consegnato il tuo avvertimento alla corte del Re.",
      "Là sei stato lodato per il tuo valore, ma ti è stato detto che la missione non era completa: con i cavalieri Ramas morti, restava un solo potere in tutto Magnamund capace di salvare il tuo popolo — la Spada del Sole. Dopo la sconfitta di Vashna, l'arma era stata affidata agli alleati di Durenor come segno di fiducia tra i due regni; in cambio, Re Alin di Durenor donò a Sommerlund un anello d'oro con lo stemma reale di Durenor, il Sigillo di Hammerdal, giurando che se mai l'ombra fosse tornata a minacciare Sommerlund, Durenor sarebbe accorsa in aiuto.",
      "Il Re ti ha ora consegnato il Sigillo di Hammerdal. La tua missione è raggiungere Durenor per recuperare la Spada del Sole. Ma il nemico ha già sfondato le difese esterne della capitale e si prepara ad assediarne le mura. Mentre il Capitano D'Val della Guardia Reale ti conduce all'Armeria Reale per equipaggiarti, le parole del Re ti risuonano in mente: «Quaranta giorni, Lupo Solitario. Abbiamo la forza di resistere solo per quaranta giorni.»"
    ],
    note: "Il tuo Registro di Guerra - Combattività, Resistenza, Arti Ramas, Armi e Oggetti Speciali - resta invariato. Prima di partire, però, aggiornerai l'equipaggiamento per il nuovo viaggio.",
    equipment: [
      {
        type: "weapon",
        name: "Spada"
      },
      {
        type: "weapon",
        name: "Spada Corta"
      },
      {
        type: "meal",
        count: 2
      },
      {
        type: "special",
        name: "Cotta di Maglia",
        bonus: {
          resistenza: 4
        }
      },
      {
        type: "weapon",
        name: "Mazza"
      },
      {
        type: "potion",
        name: "Pozione Curativa"
      },
      {
        type: "weapon",
        name: "Asta"
      },
      {
        type: "weapon",
        name: "Lancia"
      },
      {
        type: "special",
        name: "Scudo",
        bonus: {
          combattivita: 2
        }
      },
      {
        type: "weapon",
        name: "Spadone"
      }
    ],
    picks: 2,
    exact: true,
    auto: [
      "Mappa",
      "Sigillo di Hammerdal"
    ]
  },
  "3": {
    title: "Le Caverne di Kalte",
    story: [
      "Da molti secoli, nella terra settentrionale di Sommerlund, è tradizione che i figli dei Signori Guerrieri vengano mandati al monastero di Ramas, dove apprendono le arti e le discipline dei loro nobili padri.",
      "Tu sei Lupo Solitario, e sei ora l'ultimo dei Signori Guerrieri di Sommerlund. Un anno fa, l'antico nemico del tuo popolo — i Signori delle Tenebre di Helgedad — invase improvvisamente Sommerlund e devastò completamente il monastero di Ramas. Tutti i cavalieri Ramas erano riuniti per la festa di Fehmarn, e tutti tranne te furono massacrati.",
      "Ti sei fatto strada combattendo fino a Holmgard, la capitale del tuo paese, dove il Re ti inviò in una disperata missione in cerca di aiuto. La tua impresa fu irta di grandi pericoli, poiché Sommerlund era stata tradita da uno dei suoi stessi maghi: Vonotar il Traditore. I suoi agenti cercarono di ucciderti a ogni occasione, ma la tua abilità e la tua forza sventarono i loro malvagi intenti. Tornasti a Holmgard alla testa di una grande flotta — gli alleati di Durenor — e distruggesti l'esercito dei Signori delle Tenebre che assediava la tua capitale.",
      "Gran parte di Sommerlund fu devastata dalla guerra. Le ricche terre coltivate furono rase al suolo insieme a molte città. Ma i Sommlending sono un popolo tenace, e non si lasciarono scoraggiare dall'enorme compito che li attendeva. Si dedicarono alla ricostruzione di Sommerlund, straziata dalla guerra, con una determinazione tale che ora, un anno dopo, poche cicatrici del conflitto sono ancora visibili.",
      "Per il ruolo cruciale che hai avuto nella vittoria, il Re ti ha conferito il rango e il titolo di «Conte di Fryelund», un raro onore per uno così giovane. Le rovine del monastero di Ramas e gran parte delle terre circostanti sono ora note come «Fryelund», sotto la tua protezione.",
      "I lavori di ricostruzione del monastero stavano per iniziare quando inquietanti notizie dal nord spinsero il Re a convocarti nella capitale. Molti mercanti, di ritorno dalle spedizioni commerciali estive a Kalte, raccontavano della caduta del Brumalmarc, il condottiero dei Barbari dei Ghiacci. La descrizione del mago gobbo che ha preso il posto del feroce Brumalmarc corrisponde a un solo uomo: Vonotar il Traditore.",
      "Dopo la sconfitta dei Signori delle Tenebre, Vonotar era fuggito nelle desolate distese ghiacciate di Kalte. Si era fatto strada fino alla fortezza di ghiaccio di Ikaya, dove, con l'inganno, aveva convinto il crudele Brumalmarc ad adottarlo come proprio mago. Fu un errore che sarebbe costato al condottiero barbaro la sua fortezza e la sua vita.",
      "La notizia che Vonotar è ancora vivo si diffonde come un incendio in tutto Sommerlund. Migliaia di Sommlending si radunano intorno alla capitale e chiedono che Vonotar paghi per il suo tradimento. La protesta è tale che il Re è costretto a promettere che il malvagio traditore sarà riportato a Holmgard e processato per i suoi crimini.",
      "Per te, Lupo Solitario, la promessa del Re segna l'inizio di una missione che ti metterà di fronte a un nemico odiato, nel cuore ostile delle Caverne di Kalte."
    ],
    note: "Il tuo Registro di Guerra - Combattività, Resistenza, Arti Ramas, Armi e Oggetti Speciali - resta invariato. Prima di partire, però, aggiornerai l'equipaggiamento per il nuovo viaggio: a Kalte non potrai usare l'Arte Ramas della Caccia, poiché è un deserto di ghiaccio dove non c'è selvaggina.",
    equipment: [
      {
        type: "weapon",
        name: "Spada"
      },
      {
        type: "weapon",
        name: "Spada Corta"
      },
      {
        type: "special",
        name: "Giubba di Cuoio Imbottito",
        bonus: {
          resistenza: 2
        }
      },
      {
        type: "weapon",
        name: "Lancia"
      },
      {
        type: "weapon",
        name: "Mazza"
      },
      {
        type: "weapon",
        name: "Martello"
      },
      {
        type: "weapon",
        name: "Ascia"
      },
      {
        type: "potion",
        name: "Pozione di Laumspur"
      },
      {
        type: "weapon",
        name: "Asta"
      },
      {
        type: "meal",
        count: 1
      },
      {
        type: "weapon",
        name: "Spadone"
      }
    ],
    picks: 2,
    exact: true,
    auto: [
      "Mappa di Kalte"
    ]
  },
  "4": {
    title: "Il Baratro della Perdizione",
    story: [
      "Ruanon è una remota provincia mineraria a sud della tua terra natale, Sommerlund. Incastonata tra le cupe vette delle montagne di Durncrag e Maaken, la popolazione di questa provincia ha da tempo prosperato grazie al lavoro nelle sue ricche miniere, vivendo e godendo della propria ricchezza sotto la protezione del loro signore: il Barone Vanalund.",
      "L'oro e le gemme estratte a Ruanon costituiscono un'importante fonte di reddito per la tua patria. Il convoglio di carri, scortato da una robusta guardia armata, che lascia la provincia per raggiungere la capitale è diventato una routine mensile regolare; una routine mai interrotta fino a un mese fa, quando improvvisamente ogni contatto con Ruanon è cessato. Una truppa di cento cavalieri della Guardia Reale fu immediatamente inviata per scoprire che fine avesse fatto il convoglio scomparso. Il loro comandante, il Capitano D'Val, ricevette l'ordine di fare rapporto al Re non appena stabilito un contatto, ma né lui né i suoi uomini hanno fatto ritorno: anche loro sono scomparsi senza lasciare traccia.",
      "Il Re ha convocato te, Lupo Solitario, ultimo dei cavalieri Ramas, alla sua cittadella di Holmgard. La tua missione è ritrovare il Capitano D'Val e i suoi uomini, scoprire cosa sia accaduto al convoglio scomparso, e svelare il velo di mistero che ora avvolge Ruanon. Il Re ha radunato una compagnia di Ranger di Frontiera, un'unità di esploratori scelti, tutti abili cavalieri ed esperti di sopravvivenza. Ha ordinato a questi cinquanta uomini di accompagnarti, nella speranza che, sotto la tua guida, possano riuscire dove la forza più numerosa e visibile ha fallito.",
      "Mentre tu e i tuoi uomini entrate nell'Armeria Reale per equipaggiarvi in vista della lunga cavalcata che vi attende, scorgi un corvo nero appollaiato su un davanzale in alto sopra di voi. Vola via, ma non prima che un brivido ti percorra la schiena: a Holmgard, il corvo è un uccello di cattivo presagio."
    ],
    note: "Il tuo Registro di Guerra - Combattività, Resistenza, Arti Ramas, Armi e Oggetti Speciali - resta invariato. Prima di partire, però, aggiornerai l'equipaggiamento per il nuovo viaggio: questa volta potrai scegliere fino a sei nuovi oggetti, non solo due.",
    equipment: [
      {
        type: "weapon",
        name: "Martello"
      },
      {
        type: "weapon",
        name: "Daga"
      },
      {
        type: "potion",
        name: "Pozione di Laumspur",
        count: 2
      },
      {
        type: "weapon",
        name: "Spada"
      },
      {
        type: "weapon",
        name: "Lancia"
      },
      {
        type: "meal",
        count: 5
      },
      {
        type: "weapon",
        name: "Mazza"
      },
      {
        type: "special",
        name: "Cotta di Maglia",
        bonus: {
          resistenza: 4
        }
      },
      {
        type: "special",
        name: "Scudo",
        bonus: {
          combattivita: 2
        }
      }
    ],
    picks: 6,
    exact: false,
    auto: [
      "Mappa delle Terre del Sud",
      "Distintivo di Grado"
    ]
  },
  "5": {
    title: "Ombra sulla Sabbia",
    story: [
      "Sei Lupo Solitario, l'ultimo dei cavalieri Ramas del Sommerlund e unico sopravvissuto al massacro che li ha distrutti durante una spietata guerra contro i vostri nemici giurati, i Signori delle Tenebre di Helgedad.",
      "È pieno inverno nella tua patria settentrionale e una coltre di neve alta fino al ginocchio ricopre le strade di Holmgard, la capitale, quando vieni convocato dal tuo monastero sulle colline da un messaggero recante una pergamena firmata e sigillata dalla mano di Re Ulnar. Sei sorpreso di leggere il messaggio del Re, poiché si tratta di una richiesta di aiuto per risolvere un problema urgente di grande rilevanza diplomatica. Sembra una richiesta insolita da rivolgere a un guerriero, le cui abilità sono più adatte al campo di battaglia che alle trattative con inviati stranieri. Tuttavia, obbedisci alla convocazione e, al tuo arrivo alla capitale, ogni cosa ti diventa chiara.",
      "Lo Zakhan di Vassagonia, il sovrano imperiale di questo impero desertico, ha inviato il suo messaggero più fidato per stipulare un trattato di pace tra i vostri due paesi, e ti è stato chiesto di firmare il trattato a nome della tua patria. Il motivo è facilmente comprensibile.",
      "Meno di un anno ago, un nobile rinnegato di Vassagonia di nome Barraka guidò il suo esercito di banditi all'assalto della provincia sommlending di Ruanon. Questa città mineraria e gran parte delle terre circostanti furono invase e distrutte. Molti Sommlending persero la vita, e molti altri furono ridotti in schiavitù e costretti a lavorare nelle miniere dei Monti Maaken. Quando il regolare convoglio da Ruanon non giunse alla capitale, il Re ti inviò a investigare. Ne seguì una grande battaglia in cui sconfiggesti Barraka in un duello mortale. Senza il tuo coraggio e la tua abilità, la sicurezza del Sommerlund e di tutte le Terre Libere sarebbe stata in grave pericolo.",
      "«Maestà, lo Zakhan è profondamente imbarazzato dal vile tradimento di Barraka, ed è ansioso che la nostra amicizia e la nostra fiducia siano ristabilite. Chiede che inviate il guerriero Ramas, Lupo Solitario, a firmare il trattato di pace con lui presso il Gran Palazzo di Barrakeesh», sussurra l'emissario dello Zakhan, inginocchiandosi ai piedi di Re Ulnar.",
      "Il Re si alza dal trono, riuscendo a stento a nascondere il suo disgusto per l'inviato servile. Volge lo sguardo verso di te e ti invita a seguirlo nella riservatezza di un'anticamera.",
      "«Non ho alcuna simpatia per questo regno desertico, Lupo Solitario, ma mi piace ancor meno la prospettiva di una guerra. Lo Zakhan è vecchio e debole, e non ha figli che possano rivendicare il trono alla sua morte. Barraka era solo uno dei tanti spietati nobili che attendono come sciacalli l'opportunità di prendere il potere, e temo che siano troppo impazienti per lasciare che lo Zakhan muoia di morte naturale. Il trattato potrebbe non garantirci la pace con la Vassagonia dopo la morte dello Zakhan, ma almeno ci guadagnerà tempo prezioso per rafforzare il nostro confine meridionale».",
      "Il Re ti conduce a una finestra e indica il porto, a malapena visibile attraverso la neve che cade. Una galea vassagoniana è ancorata vicino al molo.",
      "«Va' in Vassagonia, Lupo Solitario. Firma il trattato e ritorna in fretta. Anche con la promessa di pace, temo che l'ombra della guerra si abbatterà su di noi prima che l'anno sia trascorso».",
      "Dici addio a Holmgard in questo gelido giorno d'inverno, fiducioso che farai ritorno prima del disgelo. Ma mentre guardi le guglie di Holmgard scomparire tra i fiocchi di neve, non hai alcun sentore dell'ombra che ti attende in Vassagonia."
    ],
    note: "Il tuo Registro di Guerra - Combattività, Resistenza, Arti Ramas, Armi e Oggetti Speciali - resta invariato. Prima di imbarcarti, però, aggiornerai l'equipaggiamento per il viaggio: potrai scegliere fino a quattro nuovi oggetti.",
    equipment: [
      {
        type: "weapon",
        name: "Daga"
      },
      {
        type: "potion",
        name: "Pozione di Laumspur",
        count: 1
      },
      {
        type: "weapon",
        name: "Spada"
      },
      {
        type: "weapon",
        name: "Lancia"
      },
      {
        type: "meal",
        count: 2,
        label: "Pasti Speciali"
      },
      {
        type: "weapon",
        name: "Mazza"
      },
      {
        type: "special",
        name: "Scudo",
        bonus: {
          combattivita: 2
        }
      }
    ],
    picks: 4,
    exact: false,
    auto: [
      "Mappa di Vassagonia"
    ]
  }
};

const STEPS = ['intro', 'gold', 'art', 'equipment', 'summary'];

export class BookTransition {
  constructor(bookNumber, onComplete) {
    this.n = bookNumber;
    this.book = BOOK_TRANSITIONS[bookNumber];
    this.onComplete = onComplete;
    this.step = 'intro';
    this.goldRoll = null;
    this.newArt = null;
    this.weaponMastery = null;
    this.picks = [];
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
      <div class="steps" aria-hidden="true">${STEPS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      ${this[this.step]()}
    </div>`;
    this.el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
    this.el.querySelectorAll('[data-art]').forEach((b) => b.addEventListener('click', () => this.chooseArt(b.dataset.art)));
    this.el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => this.togglePick(Number(b.dataset.pick))));
    this.el.querySelector('#roll-gold')?.addEventListener('click', (e) => this.rollGold(e.currentTarget));
    this.el.querySelector('#to-summary')?.addEventListener('click', (e) => this.apply(e.currentTarget));
    this.el.querySelector('#begin-book')?.addEventListener('click', () => this.onComplete && this.onComplete());
  }

  intro() {
    return `
      <p class="kicker">Libro ${this.n}</p>
      <h2 class="title" style="margin-top:.6rem"><span class="grad">${this.book.title}</span></h2>
      <div class="prose">${this.book.story.map((p) => `<p>${p}</p>`).join('')}</div>
      <p class="note">${this.book.note}</p>
      <div class="stack"><button class="btn btn-primary" type="button" data-go="gold">Prepara il viaggio${icon('arrow-right')}</button></div>`;
  }

  gold() {
    const r = this.goldRoll, c = gameState.getState().character;
    return `
      <p class="kicker">Corone d'Oro</p>
      <h2 class="title" style="margin-top:.6rem">La borsa <span class="grad">per il viaggio.</span></h2>
      <p class="muted" style="margin-top:.75rem">Tabella del Destino + 10 Corone, fino a un massimo di 50.</p>
      <div class="dice ${r !== null ? 'landed' : ''}" id="dice-gold">${r !== null ? r : '?'}</div>
      <p class="result" style="text-align:center">${r !== null ? `<b>+${r + 10} Corone</b> · ora ne hai ${c.corone}` : ''}</p>
      <div class="btn-row">${r === null
        ? `<button class="btn btn-primary" type="button" id="roll-gold">${icon('dices')}Lancia il Destino</button>`
        : `<button class="btn btn-primary" type="button" data-go="art">Avanti${icon('arrow-right')}</button>`}</div>`;
  }

  art() {
    const owned = gameState.getState().character.artiRamas;
    return `
      <p class="kicker">Nuova Arte Ramas</p>
      <h2 class="title" style="margin-top:.6rem">Hai imparato <span class="grad">qualcosa di nuovo.</span></h2>
      <p class="muted" style="margin-top:.75rem">Scegli un'Arte da aggiungere alle tue.</p>
      <div class="choose">${KAI_ARTS.filter((a) => !owned.includes(a.name)).map((a) => `
        <button class="option ${this.newArt === a.name ? 'on' : ''}" type="button" data-art="${a.name}" aria-pressed="${this.newArt === a.name}">
          <img src="${a.image}" alt="" loading="lazy"><span><b>${a.name}</b><small>${a.description}</small>
          ${a.name === 'Scherma' && this.weaponMastery ? `<small class="master">Maestria: ${this.weaponMastery}</small>` : ''}</span>
        </button>`).join('')}</div>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-go="equipment" ${this.newArt ? '' : 'disabled'}>Avanti${icon('arrow-right')}</button></div>`;
  }

  equipment() {
    const { picks, exact, equipment } = this.book, n = this.picks.length;
    const ok = exact ? n === picks : n > 0;
    return `
      <p class="kicker">Equipaggiamento · ${n}/${picks}</p>
      <h2 class="title" style="margin-top:.6rem">Scegli ${exact ? '' : 'fino a '}<span class="grad">${picks} oggetti.</span></h2>
      <p class="muted" style="margin-top:.75rem">Lo Zaino tiene 8 oggetti, Pasti compresi; le armi sono al massimo due.</p>
      <div class="choose">${equipment.map((it, k) => `
        <button class="option ${this.picks.includes(k) ? 'on' : ''}" type="button" data-pick="${k}" aria-pressed="${this.picks.includes(k)}">
          ${it.name ? thumbHTML(it.name, it.type === 'potion' ? 'item' : it.type) : `<span class="glyph">${icon('drumstick')}</span>`}
          <span><b>${esc(it.label ? `${it.label} (x${it.count})` : itemLabel(it))}</b><small>${{ weapon: 'Arma', special: 'Oggetto Speciale', potion: 'Zaino · +4 Resistenza', meal: 'Zaino' }[it.type]}</small></span>
        </button>`).join('')}</div>
      <div class="btn-row"><button class="btn btn-primary" type="button" id="to-summary" ${ok ? '' : 'disabled'}>Avanti${icon('arrow-right')}</button></div>`;
  }

  summary() {
    const c = gameState.getState().character;
    const list = (items, kind) => `<div class="tiles">${items.map((x) => `<div class="tile">${thumbHTML(x, kind)}<span>${esc(x)}</span></div>`).join('')}</div>`;
    return `
      <p class="kicker">Pronto per il Libro ${this.n}</p>
      <h2 class="title" style="margin-top:.6rem"><span class="grad">${this.book.title}</span></h2>
      <div class="sheet-stats" style="margin-top:1.25rem">
        <div class="stat">${icon('swords')}<span>Combattività</span><b>${c.combattivita}</b></div>
        <div class="stat">${icon('heart')}<span>Resistenza</span><b>${c.resistenza}<small>/${c.resistenzaMax}</small></b></div>
        <div class="stat">${icon('coins')}<span>Corone d'Oro</span><b>${c.corone}</b></div>
        <div class="stat">${icon('drumstick')}<span>Pasti</span><b>${c.pasti}</b></div>
      </div>
      <p class="label">${icon('sparkles')}Arti Ramas</p>${list(c.artiRamas, 'art')}
      <p class="label">${icon('sword')}Armi</p>${c.armi.length ? list(c.armi, 'weapon') : '<p class="muted">Nessuna</p>'}
      ${c.zaino.length ? `<p class="label">${icon('backpack')}Zaino</p>${list(c.zaino, 'item')}` : ''}
      <p class="label">${icon('gem')}Oggetti Speciali</p>${list(c.oggettiSpeciali, 'special')}
      <div class="btn-row"><button class="btn btn-primary" type="button" id="begin-book">${icon('book-open')}Inizia il Libro ${this.n}</button></div>`;
  }

  async rollGold(btn) {
    if (this.goldRoll !== null) return;
    btn.disabled = true;
    this.goldRoll = getRandomDestinyNumber();
    gameState.addCorone(this.goldRoll + 10);
    await rollDigits(this.el.querySelector('#dice-gold'), this.goldRoll);
    this.draw();
  }

  async chooseArt(name) {
    this.newArt = name;
    if (name === 'Scherma' && !this.weaponMastery && !gameState.getState().character.weaponMastery) {
      this.weaponMastery = await rollWeaponMastery();
    }
    this.draw();
  }

  togglePick(k) {
    const at = this.picks.indexOf(k);
    if (at > -1) this.picks.splice(at, 1);
    else if (this.picks.length < this.book.picks) this.picks.push(k);
    else UIHelpers.showToast(`Al massimo ${this.book.picks} oggetti`, 'info');
    this.draw();
  }

  async apply(btn) {
    btn.disabled = true;
    const c = gameState.getState().character;
    gameState.updateStats({ artiRamas: [...c.artiRamas, this.newArt] });
    if (this.newArt === 'Scherma' && this.weaponMastery) gameState.updateStats({ weaponMastery: this.weaponMastery });

    for (const k of this.picks) {
      const it = this.book.equipment[k];
      if (it.type === 'weapon') {
        if (!gameState.addWeapon(it.name)) await swapWeapon(it.name);
      } else if (it.type === 'meal') {
        const added = gameState.addPasti(it.count);
        if (added < it.count) UIHelpers.showToast(`Zaino pieno: ${it.count - added} Pasti restano qui`, 'warning');
      } else if (it.type === 'potion') {
        for (let i = 0; i < (it.count || 1); i++) {
          if (!gameState.addToZaino(it.name)) { UIHelpers.showToast(`Zaino pieno: ${it.name} resta qui`, 'warning'); break; }
        }
      } else if (it.type === 'special') {
        gameState.addOggettoSpeciale(it.name);
        const now = gameState.getState().character;
        if (it.bonus?.resistenza) gameState.updateStats({ resistenza: now.resistenza + it.bonus.resistenza, resistenzaMax: now.resistenzaMax + it.bonus.resistenza });
        if (it.bonus?.combattivita) gameState.updateStats({ combattivita: now.combattivita + it.bonus.combattivita });
      }
    }
    for (const name of this.book.auto) gameState.addOggettoSpeciale(name);
    this.go('summary');
  }
}

// Two weapons already: drop one for the new one, or leave the new one behind. Resolves true if taken.
export function swapWeapon(newWeapon) {
  const [a, b] = gameState.getState().character.armi;
  return new Promise((resolve) => {
    const take = (old) => (e, modal) => {
      modal.close();
      gameState.removeWeapon(old);
      gameState.addWeapon(newWeapon);
      UIHelpers.showToast(`Lasci ${old}, prendi ${newWeapon}`, 'success');
      resolve(true);
    };
    UIHelpers.showModal(`
      <p class="modal-text">Porti già due armi: ${esc(a)} e ${esc(b)}. Per prendere <strong>${esc(newWeapon)}</strong> devi lasciarne una.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-block" type="button" data-action="a">Lascia ${esc(a)}</button>
        <button class="btn btn-ghost btn-block" type="button" data-action="b">Lascia ${esc(b)}</button>
        <button class="btn btn-ghost btn-block" type="button" data-action="no">Non prendere ${esc(newWeapon)}</button>
      </div>`, {
      title: 'Due armi al massimo',
      onDismiss: () => resolve(false),
      buttons: {
        '[data-action="a"]': take(a),
        '[data-action="b"]': take(b),
        '[data-action="no"]': (e, modal) => { modal.close(); resolve(false); },
      },
    });
  });
}
