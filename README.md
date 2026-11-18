<p align="center">
  <img src="https://davide-mariotti.github.io/favicon.svg" width="96" alt="dm. logo">
</p>

<h1 align="center">Games</h1>

<p align="center">
  Small browser games. Made for fun, finished anyway.<br>
  <a href="#english">English</a> · <a href="#italiano">Italiano</a> · <a href="https://davide-mariotti.github.io/games/">Play</a>
</p>

<p align="center">
  <a href="https://ko-fi.com/Z0X32ATNHL"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Buy me a coffee on Ko-fi"></a>
</p>

---

## English

### What it does

- Ten games that run in the browser, served at **davide-mariotti.github.io/games/**.
- **Lupo Solitario**: gamebooks you can play, with dice, inventory and saves (Firebase, sign in with Google).
- **War Run**, **Digital Jump**, **Snake**, **Maze Rush**, **Fruit Catcher**, **Tic-Tac-Toe**: quick arcade games.
- **Never Have I Ever** (Non ho mai): the party game, 381 cards in English and Italian.
- **Truth or Dare** (Obbligo o Verità): with friends, as a couple or in a parked car, 199 cards in English and Italian.
- **Wordle Italiano**: in Italian, because some jokes don't translate.

### What it doesn't do

- No install, no account (except the optional Google sign-in of Lupo Solitario, for cloud saves).
- No ads, no in-app purchases, no "watch a video to continue".
- No build step: plain HTML, CSS and JavaScript, straight from this repo.

### How it's organised

One folder per game, each with its own `index.html`. `index.html` at the root is the list of games.
`shared/arcade.css` and `shared/arcade.js` are the kit of the rebuilt games (Fruit Catcher, Digital Jump, Snake, Maze Rush, Tic-Tac-Toe, War Run, Non ho mai, Obbligo o Verità): site colours, icons, sound, menus.
`shared/legacy.*` is what the older games still take from the old website, until they get rebuilt too.
The repo is served as it is by GitHub Pages (`.nojekyll`): push to `main` and it's online.

### Support

If one of these games kept you busy on a train, you can [buy me a coffee on Ko-fi](https://ko-fi.com/Z0X32ATNHL).

### License

The code is [MIT](LICENSE). Lupo Solitario's texts belong to their authors and are here for personal, non-commercial play.

---

## Italiano

### Cosa fa

- Dieci giochi che girano nel browser, su **davide-mariotti.github.io/games/**.
- **Lupo Solitario**: i librogame giocabili, con dadi, inventario e salvataggi (Firebase, accesso con Google).
- **War Run**, **Digital Jump**, **Snake**, **Maze Rush**, **Fruit Catcher**, **Tic-Tac-Toe**: giochi arcade veloci.
- **Non ho mai** (Never Have I Ever): il gioco da serata, 381 carte in italiano e in inglese.
- **Obbligo o Verità** (Truth or Dare): tra amici, in due o in un parcheggio, 199 carte in italiano e in inglese.
- **Wordle Italiano**: in italiano, perché certe battute non si traducono.

### Cosa non fa

- Niente da installare, niente account (a parte l'accesso Google facoltativo di Lupo Solitario, per salvare online).
- Niente pubblicità, niente acquisti, niente "guarda un video per continuare".
- Niente build: HTML, CSS e JavaScript semplici, direttamente da questa repo.

### Com'è organizzata

Una cartella per gioco, ognuna col suo `index.html`. L'`index.html` nella radice è l'elenco dei giochi.
`shared/arcade.css` e `shared/arcade.js` sono il kit dei giochi rifatti (Fruit Catcher, Digital Jump, Snake, Maze Rush, Tic-Tac-Toe, War Run, Non ho mai, Obbligo o Verità): colori del sito, icone, suoni, menu.
`shared/legacy.*` è quello che i giochi più vecchi prendono ancora dal vecchio sito, finché non tocca anche a loro.
La repo viene servita così com'è da GitHub Pages (`.nojekyll`): push su `main` ed è online.

### Supporto

Se uno di questi giochi ti ha tenuto compagnia in treno, puoi [offrirmi un caffè su Ko-fi](https://ko-fi.com/Z0X32ATNHL).

### Licenza

Il codice è [MIT](LICENSE). I testi di Lupo Solitario appartengono ai loro autori e sono qui per giocare, senza scopo commerciale.
