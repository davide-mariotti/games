# Wordle Italiano

Indovina la parola italiana di cinque lettere in sei tentativi. Dopo ogni tentativo le tessere diventano verdi (lettera giusta al posto giusto), lime con un puntino (lettera giusta in un altro posto) o scure (lettera assente).

- **Oggi**: la stessa parola per tutti, una al giorno, calcolata dalla data. Con l'accesso Google le vittorie vanno in classifica.
- **Libera**: una parola nuova a ogni partita.
- **A tempo**: 30 secondi dal primo tentativo.
- **Difficile**: gli indizi trovati vanno riusati.

Le parole sono 8.262, in `parole.txt`. Statistiche e traguardi restano nel browser; con l'accesso Google anche su Firebase (progetto `wordle-dm`). Il service worker tiene il gioco disponibile offline.
