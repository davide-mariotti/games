// Wordle online: Google sign-in, stats kept in the cloud, leaderboard. Same Firestore schema as before:
// wordle_users/{uid} = { stats, displayName, photoURL, lastUpdated }, wordle_scores = { uid, displayName, photoURL, attempts, won, timestamp }.
// Loaded with a dynamic import, so the game still works offline or when Firebase is blocked.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, setDoc, doc, getDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// a web app's config is public by design; access is decided by the Firestore rules
const app = initializeApp({
  apiKey: 'AIzaSyBsm6eBLzFZYkw8lxUSKUBkrxxZlk6Ytrw',
  authDomain: 'wordle-dm.firebaseapp.com',
  projectId: 'wordle-dm',
  storageBucket: 'wordle-dm.firebasestorage.app',
  messagingSenderId: '29159589489',
  appId: '1:29159589489:web:6738d75567de387fb7bdd0',
  measurementId: 'G-R070GKEH8P',
});
const auth = getAuth(app);
const db = getFirestore(app);

export const login = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = () => signOut(auth);
export const onAuth = (callback) => onAuthStateChanged(auth, callback);

export async function rename(user, displayName) {
  await updateProfile(user, { displayName });
  await setDoc(doc(db, 'wordle_users', user.uid), { displayName, lastUpdated: serverTimestamp() }, { merge: true });
}

export async function loadStats(user) {
  const snap = await getDoc(doc(db, 'wordle_users', user.uid));
  return snap.exists() ? snap.data().stats || null : null;
}

export function saveStats(user, stats) {
  return setDoc(doc(db, 'wordle_users', user.uid), {
    stats, displayName: user.displayName, photoURL: user.photoURL, lastUpdated: serverTimestamp(),
  }, { merge: true });
}

export function saveScore(user, attempts, won) {
  return addDoc(collection(db, 'wordle_scores'), {
    uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, attempts, won, timestamp: serverTimestamp(),
  });
}

// Best wins of a period, one line per player (their best try). 'all' keeps the old query and its index;
// the others read the period by timestamp (a single-field index, always there) and rank here.
export async function leaderboard(period) {
  let docs;
  if (period === 'all') {
    docs = await getDocs(query(collection(db, 'wordle_scores'), orderBy('attempts', 'asc'), orderBy('timestamp', 'desc'), limit(60)));
  } else {
    const since = new Date();
    if (period === 'today') since.setHours(0, 0, 0, 0);
    else since.setDate(since.getDate() - (period === 'week' ? 7 : 30));
    docs = await getDocs(query(collection(db, 'wordle_scores'), where('timestamp', '>=', Timestamp.fromDate(since)), orderBy('timestamp', 'desc'), limit(400)));
  }
  const best = new Map();
  docs.forEach((d) => {
    const s = d.data();
    if (!s.won || !s.timestamp) return;
    const key = s.uid || s.displayName;
    const old = best.get(key);
    if (!old || s.attempts < old.attempts || (s.attempts === old.attempts && s.timestamp.seconds < old.timestamp.seconds)) best.set(key, s);
  });
  return [...best.values()].sort((a, b) => a.attempts - b.attempts || a.timestamp.seconds - b.timestamp.seconds).slice(0, 20);
}
