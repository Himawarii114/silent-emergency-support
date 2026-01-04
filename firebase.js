// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvYj3MCbyK5VcRrOAecfp6cE8tx3pmj8Q",
  authDomain: "emergency-chatbot-20e0a.firebaseapp.com",
  projectId: "emergency-chatbot-20e0a",
  storageBucket: "emergency-chatbot-20e0a.appspot.com",
  messagingSenderId: "1091920179528",
  appId: "1:1091920179528:web:f7549ea2d4be57028d037d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
