import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, onSnapshot, query, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCyRmnH6xKA41-lVm5jzb56qCsED1gpWsI',
  authDomain: 'proclean-siteclean.firebaseapp.com',
  projectId: 'proclean-siteclean',
  storageBucket: 'proclean-siteclean.firebasestorage.app',
  messagingSenderId: '345091105482',
  appId: '1:345091105482:web:b2e0e82b9e7280608f8a33'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log('Testing client getDocs...');
  const snap = await getDocs(query(collection(db, 'work_orders'), limit(5)));
  console.log(`Successfully fetched ${snap.docs.length} work orders!`);
  for (const doc of snap.docs) {
    console.log(`- OT ID: ${doc.id}`);
  }

  console.log('Testing client onSnapshot listener...');
  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(query(collection(db, 'work_orders'), limit(3)), (snapshot) => {
      console.log(`Listener fired successfully! Received ${snapshot.docs.length} docs from ${snapshot.metadata.fromCache ? 'cache' : 'server'}.`);
      unsub();
      resolve();
    }, (err) => {
      console.error('Listener failed:', err);
      reject(err);
    });
  });
}

test().then(() => {
  console.log('ALL CLIENT TESTS PASSED! Firestore is fully operational.');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
