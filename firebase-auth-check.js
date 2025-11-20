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
// Redirect unauthenticated users
// -------------------------
const mode = localStorage.getItem("loginMode");

if (!mode) {
    window.location.href = "auth.html";
}

// -------------------------
// Load Firestore Data
// -------------------------
if (mode === "google") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            localStorage.clear();
            window.location.href = "auth.html";
            return;
        }

        const uid = user.uid;
        localStorage.setItem("uid", uid);

        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            await setDoc(userRef, {
                transactions: [],
                monthlyIncomes: {}
            }, { merge: true });
        } else {
            const data = userDoc.data();

            localStorage.setItem("allTransactions", JSON.stringify(data.transactions || []));
            localStorage.setItem("monthlyIncomes", JSON.stringify(data.monthlyIncomes || {}));
        }

        // Notify script.js that Firestore data is ready
        window.dispatchEvent(new Event("firestore-data-loaded"));
    });
}
