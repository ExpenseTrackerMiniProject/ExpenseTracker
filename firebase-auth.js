// ----------------------
// Firebase Initialization
// ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, linkWithPopup }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCSyxnlJDrLCzXLt_ozdDD-XVipVNtpQjA",
    authDomain: "expense-tracker-d4b45.firebaseapp.com",
    projectId: "expense-tracker-d4b45",
    storageBucket: "expense-tracker-d4b45.firebasestorage.app",
    messagingSenderId: "455721176179",
    appId: "1:455721176179:web:9c875458413a5445816e06",
    measurementId: "G-7N5VX2GBCC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ----------------------
// Guest Login
// ----------------------
const guestBtn = document.getElementById("guest-btn");
if (guestBtn) {
    guestBtn.addEventListener("click", () => {
        localStorage.setItem("loginMode", "guest");
        window.location.href = "index.html";
    });
}

// ----------------------
// Google Login
// ----------------------
const googleBtn = document.getElementById("google-btn");
if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        try {
            const result = await signInWithPopup(auth, provider);

            localStorage.setItem("loginMode", "google");
            localStorage.setItem("uid", result.user.uid);

            window.location.href = "index.html";
        } catch (error) {
            alert("Google Sign-in Failed");
            console.error(error);
        }
    });
}
