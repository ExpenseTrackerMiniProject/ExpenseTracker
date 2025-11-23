import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

const currentPage = window.location.pathname;
const isAuthPage = currentPage.includes("auth.html");

onAuthStateChanged(auth, (user) => {
    const loginMode = localStorage.getItem("loginMode");
    
    // Valid if: User exists (Anonymous or Google) AND loginMode is set
    const isAuthenticated = user && (loginMode === 'google' || loginMode === 'guest');

    if (isAuthPage) {
        if (isAuthenticated) {
            // Already logged in? Go to dashboard
            window.location.replace("index.html"); 
        }
        return;
    }

    if (!isAuthPage) {
        if (!isAuthenticated) {
            // Not logged in? Go to login
            localStorage.clear(); 
            window.location.replace("auth.html");
        }
    }
});
