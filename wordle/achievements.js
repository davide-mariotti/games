// Wordle achievements. The ids are the ones already saved in players' stats: never rename them.
// check(stats, game): stats already include the game just finished; game = { won, attempts, mode, timeRemaining, date }.
const quickWins = (s) => (s.guesses[1] || 0) + (s.guesses[2] || 0) + (s.guesses[3] || 0);
const rate = (s) => (s.gamesPlayed ? (s.gamesWon / s.gamesPlayed) * 100 : 0);
const lastWon = (s, n) => (s.gameHistory || []).length >= n && s.gameHistory.slice(-n).every((g) => g.won);
const hour = (g) => new Date(g.date).getHours();
const dayKey = (t) => new Date(t).toDateString();
const timed = (g, test) => g && g.won && g.mode === 'timed' && g.timeRemaining != null && test(g.timeRemaining);

// [id, icon, rarity, [name, description] in Italian, [name, description] in English, check]
const LIST = [
  ['first_win', 'party-popper', 'common', ['Prima vittoria', 'Vinci la prima partita'], ['First win', 'Win your first game'], (s) => s.gamesWon >= 1],
  ['perfect', 'gem', 'legendary', ['Perfetto', 'Indovina al primo tentativo'], ['Perfect', 'Guess it on the first try'], (s, g) => g && g.won && g.attempts === 1],
  ['streak_7', 'flame', 'rare', ['Sette di fila', '7 vittorie di fila'], ['Seven in a row', 'Win 7 games in a row'], (s) => s.currentStreak >= 7],
  ['streak_30', 'trophy', 'legendary', ['Trenta di fila', '30 vittorie di fila'], ['Thirty in a row', 'Win 30 games in a row'], (s) => s.currentStreak >= 30],
  ['speed', 'zap', 'rare', ['Velocissimo', 'Vinci a tempo con 20 secondi o più'], ['Lightning', 'Win a timed game with 20+ seconds left'], (s, g) => timed(g, (t) => t >= 20)],
  ['clutch', 'snowflake', 'epic', ['Sangue freddo', 'Vinci a tempo con meno di 5 secondi'], ['Ice cold', 'Win a timed game with under 5 seconds left'], (s, g) => timed(g, (t) => t < 5)],
  ['veteran', 'medal', 'rare', ['Veterano', 'Gioca 100 partite'], ['Veteran', 'Play 100 games'], (s) => s.gamesPlayed >= 100],
  ['master', 'crown', 'epic', ['Maestro', 'Vinci 50 partite'], ['Master', 'Win 50 games'], (s) => s.gamesWon >= 50],
  ['hard_win', 'dumbbell', 'rare', ['Difficoltà superata', 'Vinci una partita difficile'], ['Hard won', 'Win a hard game'], (s, g) => g && g.won && g.mode === 'hard'],
  ['hard_master', 'swords', 'legendary', ['Maestro del difficile', 'Vinci 20 partite difficili'], ['Hard master', 'Win 20 hard games'], (s) => (s.hardModeWins || 0) >= 20],
  ['efficient', 'target', 'epic', ['Efficiente', 'Vinci 15 volte in 3 tentativi o meno'], ['Efficient', 'Win 15 times in 3 tries or fewer'], (s) => quickWins(s) >= 15],
  ['lucky', 'clover', 'common', ['Fortunato', "Vinci all'ultimo tentativo"], ['Lucky', 'Win on the last try'], (s, g) => g && g.won && g.attempts === 6],
  ['comeback', 'undo-2', 'common', ['Ritorno', 'Vinci subito dopo una sconfitta'], ['Bounce back', 'Win right after a loss'], (s, g) => g && g.won && (s.gameHistory || []).length >= 2 && !s.gameHistory[s.gameHistory.length - 2].won],
  ['consistent', 'trending-up', 'epic', ['Costante', "Almeno l'80% di vittorie su 20 partite"], ['Consistent', '80%+ wins over 20+ games'], (s) => s.gamesPlayed >= 20 && rate(s) >= 80],
  ['night_owl', 'moon', 'common', ['Gufo notturno', 'Vinci tra le 23 e le 6'], ['Night owl', 'Win between 11 pm and 6 am'], (s, g) => g && g.won && (hour(g) >= 23 || hour(g) < 6)],
  ['early_bird', 'sunrise', 'common', ['Mattiniero', 'Vinci tra le 5 e le 7'], ['Early bird', 'Win between 5 and 7 am'], (s, g) => g && g.won && hour(g) >= 5 && hour(g) < 7],
  ['quick_learner', 'brain', 'rare', ['Ci prendo gusto', '3 vittorie di fila'], ['On a roll', 'Win 3 games in a row'], (s) => lastWon(s, 3)],
  ['no_hints', 'lightbulb', 'epic', ['Intuizione pura', 'Vinci in 2 tentativi o meno'], ['Pure intuition', 'Win in 2 tries or fewer'], (s, g) => g && g.won && g.attempts <= 2],
  ['timed_master', 'alarm-clock', 'rare', ['Maestro del tempo', 'Vinci 10 partite a tempo'], ['Time keeper', 'Win 10 timed games'], (s) => (s.timedModeWins || 0) >= 10],
  ['triple_threat', 'layers', 'rare', ['Tripletta', 'Vinci una partita libera, una a tempo e una difficile'], ['Triple threat', 'Win a free, a timed and a hard game'], (s) => s.gamesWon - (s.hardModeWins || 0) - (s.timedModeWins || 0) > 0 && s.hardModeWins > 0 && s.timedModeWins > 0],
  ['unstoppable', 'rocket', 'epic', ['Inarrestabile', '5 vittorie di fila'], ['Unstoppable', 'Win 5 games in a row'], (s) => lastWon(s, 5)],
  ['collector', 'award', 'epic', ['Collezionista', 'Sblocca 10 traguardi'], ['Collector', 'Unlock 10 achievements'], (s) => (s.achievements || []).length >= 10],
  ['dedication', 'calendar-days', 'rare', ['Dedizione', 'Gioca in 7 giorni diversi'], ['Dedication', 'Play on 7 different days'], (s) => new Set((s.gameHistory || []).map((g) => dayKey(g.date))).size >= 7],
  ['flawless_week', 'sparkles', 'legendary', ['Settimana perfetta', 'Gioca e vinci tutto per 7 giorni di fila'], ['Flawless week', 'Play and win everything 7 days running'], (s) => {
    const recent = (s.gameHistory || []).filter((g) => g.date >= Date.now() - 7 * 864e5);
    return new Set(recent.map((g) => dayKey(g.date))).size >= 7 && recent.every((g) => g.won);
  }],
  ['speedrunner', 'gauge', 'rare', ['Speedrunner', 'Vinci a tempo con 25 secondi o più'], ['Speedrunner', 'Win a timed game with 25+ seconds left'], (s, g) => timed(g, (t) => t >= 25)],
  ['close_call', 'hourglass', 'epic', ['Per un soffio', 'Vinci a tempo con meno di 3 secondi'], ['Close call', 'Win a timed game with under 3 seconds left'], (s, g) => timed(g, (t) => t < 3)],
  ['comeback_kid', 'heart-pulse', 'rare', ['Rimonta', 'Vinci dopo 3 sconfitte di fila'], ['Comeback kid', 'Win after 3 losses in a row'], (s, g) => {
    const h = s.gameHistory || [];
    return g && g.won && h.length >= 4 && h.slice(-4, -1).every((x) => !x.won);
  }],
  ['overachiever', 'star', 'legendary', ['Superstar', 'Sblocca 15 traguardi'], ['Superstar', 'Unlock 15 achievements'], (s) => (s.achievements || []).length >= 15],
  ['weekend_warrior', 'gamepad-2', 'common', ['Guerriero del weekend', 'Vinci di sabato o di domenica'], ['Weekend warrior', 'Win on a Saturday or Sunday'], (s, g) => g && g.won && [0, 6].includes(new Date(g.date).getDay())],
  ['midweek_champion', 'sun', 'common', ['Gobba superata', 'Vinci di mercoledì'], ['Hump day', 'Win on a Wednesday'], (s, g) => g && g.won && new Date(g.date).getDay() === 3],
  ['centurion', 'shield-check', 'legendary', ['Centurione', 'Vinci 100 partite'], ['Centurion', 'Win 100 games'], (s) => s.gamesWon >= 100],
  ['grand_master', 'graduation-cap', 'legendary', ['Gran maestro', 'Almeno il 90% di vittorie su 30 partite'], ['Grand master', '90%+ wins over 30+ games'], (s) => s.gamesPlayed >= 30 && rate(s) >= 90],
  ['sharp_mind', 'crosshair', 'rare', ['Mente acuta', 'Vinci 5 volte in 3 tentativi o meno'], ['Sharp mind', 'Win 5 times in 3 tries or fewer'], (s) => quickWins(s) >= 5],
  ['persistence', 'footprints', 'rare', ['Perseveranza', 'Gioca 50 partite'], ['Persistence', 'Play 50 games'], (s) => s.gamesPlayed >= 50],
  ['time_lord', 'timer', 'epic', ['Signore del tempo', 'Vinci 25 partite a tempo'], ['Time lord', 'Win 25 timed games'], (s) => (s.timedModeWins || 0) >= 25],
  ['hard_legend', 'mountain', 'legendary', ['Leggenda del difficile', 'Vinci 50 partite difficili'], ['Hard legend', 'Win 50 hard games'], (s) => (s.hardModeWins || 0) >= 50],
];

export const ACHIEVEMENTS = LIST.map(([id, icon, rarity, it, en, check]) => ({ id, icon, rarity, it, en, check }));

// achievements the player has just earned (and didn't have yet)
export const earned = (stats, game, unlocked) => ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id) && a.check(stats, game));
