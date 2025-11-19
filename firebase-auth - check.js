// -------------------------
// Auth Check for All Pages
// -------------------------
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

// -------------------------
// PREVENT page from displaying early
// -------------------------
document.body.style.display = "none";

// -------------------------
// Redirect unauthenticated users
// -------------------------
const mode = localStorage.getItem("loginMode");

// Case 1: No login mode chosen yet → go to login
if (!mode) {
    window.location.href = "auth.html";
}

// Case 2: Guest mode → allow page immediately
if (mode === "guest") {
    document.body.style.display = "block";  // SHOW PAGE
    return;
}

// Case 3: Google login → Must check Firebase auth
if (mode === "google") {
    onAuthStateChanged(auth, async (user) => {

        if (!user) {
            localStorage.clear();
            window.location.href = "auth.html";
            return;
        }

        const uid = user.uid;

        // Load Firestore data
        const userDoc = await getDoc(doc(db, "users", uid));

        if (userDoc.exists()) {
            const data = userDoc.data();
            localStorage.setItem("allTransactions", JSON.stringify(data.transactions || []));
            localStorage.setItem("monthlyIncomes", JSON.stringify(data.monthlyIncomes || {}));
        } else {
            await setDoc(doc(db, "users", uid), {
                transactions: [],
                monthlyIncomes: {}
            });
        }

        // IMPORTANT: SHOW PAGE ONLY AFTER LOADING USER
        document.body.style.display = "block";
    });
}
