// Firebase, loaded only when someone signs in (or signed in last time): signed out, the game never contacts Google.
// The web API key is public by design; access is limited by the Firestore rules (each user reads and writes only their own saves).
const SDK = 'https://www.gstatic.com/firebasejs/10.8.0/';
const firebaseConfig = {
  apiKey: 'AIzaSyDmZrAr_n9Ml1qDyE0Yfd9FTJVfPE6_o-Q',
  authDomain: 'luposolitario-dm.firebaseapp.com',
  projectId: 'luposolitario-dm',
  storageBucket: 'luposolitario-dm.firebasestorage.app',
  messagingSenderId: '281621563108',
  appId: '1:281621563108:web:24a9271c8463e9854ecef1',
};

let app = null;
async function firebaseApp() {
  if (!app) {
    const { initializeApp } = await import(`${SDK}firebase-app.js`);
    app = initializeApp(firebaseConfig);
  }
  return app;
}

// { auth, ...firebase-auth exports }
export async function authApi() {
  const [a, mod] = await Promise.all([firebaseApp(), import(`${SDK}firebase-auth.js`)]);
  return { ...mod, auth: mod.getAuth(a) };
}

// { db, ...firebase-firestore exports }
export async function firestoreApi() {
  const [a, mod] = await Promise.all([firebaseApp(), import(`${SDK}firebase-firestore.js`)]);
  return { ...mod, db: mod.getFirestore(a) };
}
