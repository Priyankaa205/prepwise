import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBkX04Vs__3shR8kY5DaaM880UBJjpHxnE",
  authDomain: "prepwise-5e22f.firebaseapp.com",
  projectId: "prepwise-5e22f",
  storageBucket: "prepwise-5e22f.appspot.com", // ✅ FIX
  messagingSenderId: "721911605629",
  appId: "1:721911605629:web:aab36d8de4f519f2908414"
};

const app = initializeApp(firebaseConfig);

// ✅ Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ✅ (optional but useful later)
googleProvider.setCustomParameters({
  prompt: "select_account"
});

export default app;