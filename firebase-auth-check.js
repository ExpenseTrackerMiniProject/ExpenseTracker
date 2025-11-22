import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } 
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
const db = getFirestore(app);

// ==========================================
// SMART GATEKEEPER LOGIC
// ==========================================

// 1. Determine where we are right now
const currentPage = window.location.pathname;
const isAuthPage = currentPage.includes("auth.html");

onAuthStateChanged(auth, async (user) => {
    const loginMode = localStorage.getItem("loginMode");
    const isAuthenticated = user || loginMode === 'guest';

    // --- SCENARIO A: We are on the Login Page (auth.html) ---
    if (isAuthPage) {
        if (isAuthenticated) {
            // User is already logged in? Kick them to dashboard.
            // using .replace() to allow back button to work better
            console.log("Already logged in. Redirecting to Dashboard...");
            window.location.replace("index.html"); 
        }
        // If not logged in, DO NOTHING. Let them see the login screen.
        return;
    }

    // --- SCENARIO B: We are on an Internal Page (index.html, analytics, etc) ---
    if (!isAuthPage) {
        if (!isAuthenticated) {
            // User is NOT logged in? Kick them out to login.
            console.log("Not authorized. Redirecting to Login...");
            // Clear data just in case
            localStorage.clear();
            window.location.replace("auth.html");
            return;
        }
    }

    // ==========================================
    // DATA LOADING (Only runs if logged in)
    // ==========================================
    if (user && loginMode === 'google') {
        const uid = user.uid;
        // Ensure UID is saved if it wasn't already
        localStorage.setItem("uid", uid);

        // Fetch Data from Cloud
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            // First time setup
            await setDoc(userRef, {
                transactions: [],
                monthlyIncomes: {}
            }, { merge: true });
        } else {
            // Sync cloud data to local storage
            const data = userDoc.data();
            localStorage.setItem("allTransactions", JSON.stringify(data.transactions || []));
            localStorage.setItem("monthlyIncomes", JSON.stringify(data.monthlyIncomes || {}));
        }

        // Notify the dashboard that data is fresh
        window.dispatchEvent(new Event("firestore-data-loaded"));
    }
});
