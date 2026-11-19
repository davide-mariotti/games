<p align="center">
  <img src="public/img/icon-192.png" width="112" alt="Lupo Solitario">
</p>

<h1 align="center">Lupo Solitario</h1>

<p align="center">
  The first five Lone Wolf gamebooks, in Italian, playable in the browser.<br>
  <a href="#english">English</a> · <a href="#italiano">Italiano</a> · <a href="https://davide-mariotti.github.io/games/LupoSolitario/">Play</a>
</p>

<p align="center">
  <a href="https://ko-fi.com/Z0X32ATNHL"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Buy me a coffee on Ko-fi"></a>
</p>

---

## English

### What it does

- Books 1 to 5 of Joe Dever's Lone Wolf (Kai series), in the Italian edition, section by section, illustrated: a cover for every book, painted scenes, enemy portraits in combat.
- Keeps the Action Chart for you: Combat Skill, Endurance, Kai Disciplines, weapons, backpack, Gold Crowns, Special Items.
- Rolls the Random Number Table and fights with the Combat Results Table as printed in the books, round by round.
- Character creation for Book 1, and the "continuing your adventure" rules between one book and the next.
- Saves on its own. Named saves too, plus a restart point at the beginning of every book: dying sends you back there, not to Book 1.
- Works signed out (saves stay in the browser). Sign in with Google and the saves move to the cloud, so they follow you to another device.

### What it doesn't do

- No ads, no purchases, no tracking. Signed out, nothing goes to Firebase.
- No Book 6 and beyond. Yet.
- No cheating on the dice. There is an easy mode, but you have to find it.

### How it works

Plain HTML, CSS and JavaScript modules, no build. The books are JSON files in `data/books/`, one section per key, with choices, fights and effects described as data; `src/components/story-reader.js` turns them into pages. The look and the sounds come from the shared kit of the other games (`/games/shared/arcade.css`), icons are Lucide.

Cloud saves use Firebase (project `luposolitario-dm`): Google sign-in and Firestore, one document per save under `users/{uid}/saves`. The rules are in `firestore.rules`: each user reads and writes only their own saves. Firebase is loaded only when someone signs in.

### Run it locally

```bash
# from the root of the games repo
python -m http.server 8000
# then open http://localhost:8000/LupoSolitario/
```

Tests (Node 22 or newer): `npm test` in this folder. `node scripts/validate-book.mjs` checks the book files (missing sections, broken links). The other scripts in `scripts/` converted the original books and prepared the illustrations.

### License

The code is [MIT](../LICENSE). The texts of Lone Wolf belong to Joe Dever's estate and are here for personal, non-commercial play.

---

## Italiano

### Cosa fa

- I libri da 1 a 5 di Lupo Solitario (la saga dei Ramas) di Joe Dever, nell'edizione italiana, sezione per sezione, illustrati: una copertina per libro, scene dipinte, il ritratto del nemico in combattimento.
- Tiene il Registro di Guerra al posto tuo: Combattività, Resistenza, Arti Ramas, armi, zaino, Corone d'Oro, Oggetti Speciali.
- Lancia la Tabella del Destino e combatte con la Tabella di Combattimento dei libri, round per round.
- Creazione del personaggio nel Libro 1, e le regole di passaggio da un libro all'altro.
- Salva da solo. Si possono anche fare salvataggi con un nome, e all'inizio di ogni libro resta un punto di ripartenza: se muori, riparti da lì e non dal Libro 1.
- Si gioca senza accedere (i salvataggi restano nel browser). Con l'accesso Google i salvataggi vanno nel cloud e li ritrovi su un altro dispositivo.

### Cosa non fa

- Niente pubblicità, niente acquisti, niente tracciamento. Senza accesso, a Firebase non arriva niente.
- Niente Libro 6 e seguenti. Per ora.
- Niente trucchi con i dadi. Una modalità facile c'è, ma bisogna trovarla.

### Come funziona

HTML, CSS e moduli JavaScript, senza build. I libri sono file JSON in `data/books/`, una chiave per sezione, con scelte, combattimenti ed effetti descritti come dati; `src/components/story-reader.js` li trasforma in pagine. Grafica e suoni vengono dal kit condiviso degli altri giochi (`/games/shared/arcade.css`), le icone sono Lucide.

I salvataggi nel cloud usano Firebase (progetto `luposolitario-dm`): accesso Google e Firestore, un documento per salvataggio in `users/{uid}/saves`. Le regole sono in `firestore.rules`: ognuno legge e scrive solo i propri. Firebase si carica solo quando qualcuno accede.

### Provarlo in locale

```bash
# dalla radice della repo dei giochi
python -m http.server 8000
# poi apri http://localhost:8000/LupoSolitario/
```

Test (Node 22 o più recente): `npm test` in questa cartella. `node scripts/validate-book.mjs` controlla i file dei libri (sezioni mancanti, collegamenti rotti). Gli altri script in `scripts/` sono serviti a convertire i libri originali e a preparare le illustrazioni.

### Licenza

Il codice è [MIT](../LICENSE). I testi di Lupo Solitario appartengono agli eredi di Joe Dever e sono qui per giocare, senza scopo commerciale.
