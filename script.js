import "./firebase-auth-check.js";
import { getFirestore, doc, setDoc, getDoc } 
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
    getAuth, 
    signOut, 
    GoogleAuthProvider, 
    linkWithPopup, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- 1. THEME INITIALIZATION (Must be at the very top) ---
// UPDATED: Defaults to Dark Mode (removes 'light-theme' if not explicitly light)
(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    // If 'light' is explicitly saved, use it. Otherwise, default to dark.
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
})();

// --- 2. DATA MANAGEMENT & INITIALIZATION ---
let allTransactions = [];
let monthlyIncomes = {};
let currentMonthKey = '';

let currentView = {
    mode: 'month',
    monthKey: ''
};

function getCurrentMonthKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function loadData() {
    allTransactions = JSON.parse(localStorage.getItem('allTransactions')) || [];
    monthlyIncomes = JSON.parse(localStorage.getItem('monthlyIncomes')) || {};
    currentMonthKey = localStorage.getItem('currentMonthKey') || getCurrentMonthKey();

    if (typeof monthlyIncomes[currentMonthKey] === 'undefined') {
        monthlyIncomes[currentMonthKey] = 0;
    }

    localStorage.setItem('currentMonthKey', currentMonthKey);
    currentView.monthKey = currentMonthKey;
}

// --- 3. FIRESTORE SYNC LOGIC ---
async function syncToFirestore() {
    const mode = localStorage.getItem("loginMode");
    const uid = localStorage.getItem("uid");
    if (mode !== "google" && mode !== "guest") return; 
    if (!uid) return;

    const db = getFirestore();
    const data = {
        transactions: JSON.parse(localStorage.getItem("allTransactions")) || [],
        monthlyIncomes: JSON.parse(localStorage.getItem("monthlyIncomes")) || {}
    };

    await setDoc(doc(db, "users", uid), data, { merge: true });
}

async function saveAndSync() {
    localStorage.setItem("allTransactions", JSON.stringify(allTransactions));
    localStorage.setItem("monthlyIncomes", JSON.stringify(monthlyIncomes));

    const loginMode = localStorage.getItem("loginMode");
    if (loginMode === "google" || loginMode === "guest") {
        await syncToFirestore();
    }
}

// --- 4. AUTOMATIC DATA FETCHING ---
async function checkAndFetchData() {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
        const loginMode = localStorage.getItem("loginMode");
        
        if (user && (loginMode === 'google' || loginMode === 'guest')) {
            const db = getFirestore();
            const docRef = doc(db, "users", user.uid);
            
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    if (data.transactions && data.transactions.length > 0) {
                        localStorage.setItem("allTransactions", JSON.stringify(data.transactions));
                    }
                    if (data.monthlyIncomes && Object.keys(data.monthlyIncomes).length > 0) {
                        localStorage.setItem("monthlyIncomes", JSON.stringify(data.monthlyIncomes));
                    }
                    
                    loadData();
                    updateDashboardDisplay();
                }
            } catch (error) {
                console.error("Auto-fetch failed:", error);
            }
        }
    });
}
checkAndFetchData();


// --- 5. VOICE RECOGNITION ---
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

window.startVoiceCommand = function() {
    if (!recognition) {
        alert("Speech recognition is not supported on this browser.");
        return;
    }
    recognition.start();
}

if (recognition) {
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
        const voiceInput = event.results[0][0].transcript.toLowerCase();
        
        const expenseRegex = /add (\d+(\.\d{1,2})?) ([\w\s]+) on (today|\w+ \d{1,2} \d{4})/i;
        const incomeRegex = /(credit|credited|deposit) (\d+(\.\d{1,2})?) ([\w\s]+) on (today|\w+ \d{1,2} \d{4})/i;

        let matches = null;
        let transactionType = '';

        if (voiceInput.match(expenseRegex)) {
            matches = voiceInput.match(expenseRegex);
            transactionType = 'expense';
        } else if (voiceInput.match(incomeRegex)) {
            matches = voiceInput.match(incomeRegex);
            transactionType = 'income';
        }

        if (matches) {
            const amount = parseFloat(matches[2] || matches[1]);
            const category = matches[3].trim();
            let dateString = matches[4];

            if (dateString.toLowerCase() === 'today') dateString = getCurrentDate();
            const formattedDate = formatDateToYYYYMMDD(dateString);

            if (!category || isNaN(amount) || amount <= 0 || !formattedDate) {
                alert('Invalid voice command format. Please try again.');
                return;
            }

            allTransactions.push({ category, amount, date: formattedDate, type: transactionType });
            saveAndSync();
            alert(`${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} added successfully via voice!`);
            updateDashboardDisplay();
        } else {
            alert('Command not recognized. Try "Add 100 food on today".');
        }
    };

    recognition.onerror = function (event) {
        alert(`Voice Error: ${event.error}`);
    };
}

// --- Helper Functions ---
function formatDateToYYYYMMDD(dateString) {
    const dateParts = dateString.split(' ');
    const monthNames = { "January": "01", "February": "02", "March": "03", "April": "04", "May": "05", "June": "06", "July": "07", "August": "08", "September": "09", "October": "10", "November": "11", "December": "12" };
    const month = monthNames[dateParts[0]];
    const day = String(dateParts[1]).padStart(2, '0');
    const year = dateParts[2];
    return `${year}-${month}-${day}`;
}

function getCurrentDate() {
    const today = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[today.getMonth()]} ${today.getDate()} ${today.getFullYear()}`;
}

// --- 6. DISPLAY FUNCTIONS ---
function updateDashboardDisplay() {
    const totalIncomeElem = document.getElementById('total-income');
    if (!totalIncomeElem) return;

    const totalExpensesElem = document.getElementById('total-expenses');
    const remainingBalanceElem = document.getElementById('remaining-balance');

    let transactionsForView = [];
    let incomeForView = 0;

    if (currentView.mode === 'all') {
        transactionsForView = allTransactions;
        incomeForView = Object.values(monthlyIncomes).reduce((sum, income) => sum + income, 0);
    } else {
        const monthKey = currentView.monthKey;
        transactionsForView = allTransactions.filter(t => t.date.startsWith(monthKey));
        incomeForView = monthlyIncomes[monthKey] || 0;
    }

    const totalCredit = transactionsForView.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
    const totalDebit = transactionsForView.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
    const netExpenses = totalDebit - totalCredit;

    totalIncomeElem.textContent = incomeForView.toFixed(2);
    totalExpensesElem.textContent = netExpenses.toFixed(2);
    remainingBalanceElem.textContent = (incomeForView - netExpenses).toFixed(2);

    if (document.getElementById('transaction-list')) {
        displayTransactions(transactionsForView);
    }
}

function displayTransactions(transactionsToDisplay) {
    const transactionList = document.getElementById('transaction-list');
    if (!transactionList) return;
    transactionList.innerHTML = '';

    const filterTypeElement = document.querySelector('input[name="transaction-type"]:checked');
    if (!filterTypeElement) return;
    const filterType = filterTypeElement.value;

    let finalList = transactionsToDisplay;
    if (filterType !== 'all') {
        finalList = finalList.filter(transaction => transaction.type === filterType);
    }

    finalList.sort((a, b) => new Date(b.date) - new Date(a.date));

    finalList.forEach(transaction => {
        const li = document.createElement('li');
        li.classList.add(transaction.type === 'income' ? 'income-transaction' : 'expense-transaction');
        const originalIndex = findOriginalTransactionIndex(transaction);

        li.innerHTML = `
            <span>${transaction.category}: ₹${parseFloat(transaction.amount).toFixed(2)} on ${transaction.date}</span>
            <div class="button-container">
                <button class="edit-button" onclick="editTransaction(${originalIndex})"><i class="fas fa-edit"></i></button>
                <button class="delete-button" onclick="deleteTransaction(${originalIndex})"><i class="fas fa-trash-alt"></i></button>
            </div>`;
        transactionList.appendChild(li);
    });
}

function findOriginalTransactionIndex(transactionToFind) {
    return allTransactions.findIndex(t => 
        t.date === transactionToFind.date && 
        t.amount == transactionToFind.amount && 
        t.category === transactionToFind.category &&
        t.type === transactionToFind.type
    );
}

// --- GLOBAL HELPERS ---
window.deleteTransaction = function(index) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        allTransactions.splice(index, 1);
        saveAndSync();
        updateDashboardDisplay();
    }
}

window.editTransaction = function(index) {
    const transaction = allTransactions[index];
    const newCategory = prompt('Edit Category:', transaction.category);
    if (newCategory === null) return;
    const newAmountStr = prompt('Edit Amount:', transaction.amount);
    if (newAmountStr === null) return;
    const newAmount = parseFloat(newAmountStr);

    if (newCategory.trim() === '' || isNaN(newAmount) || newAmount <= 0) {
        alert('Invalid input.');
        return;
    }

    allTransactions[index].category = newCategory.trim();
    allTransactions[index].amount = newAmount;
    saveAndSync();
    updateDashboardDisplay();
}

function generatePdfReport(selectedMonths) {
    alert('Generating PDF report...');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let firstPage = true;

    for (const month of selectedMonths.sort()) {
        if (!firstPage) doc.addPage();
        const monthTransactions = allTransactions.filter(t => t.date.startsWith(month));
        const monthIncome = monthlyIncomes[month] || 0;
        const monthCredit = monthTransactions.filter(t => t.type === 'income').reduce((a, t) => a + parseFloat(t.amount), 0);
        const monthDebit = monthTransactions.filter(t => t.type === 'expense').reduce((a, t) => a + parseFloat(t.amount), 0);
        const monthNet = monthDebit - monthCredit;

        doc.setFontSize(18);
        doc.text(`Expense Report for ${month}`, 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Monthly Income: ₹${monthIncome.toFixed(2)}`, 15, 35);
        doc.text(`Net Expenses: ₹${monthNet.toFixed(2)}`, 15, 42);
        doc.text(`Balance: ₹${(monthIncome - monthNet).toFixed(2)}`, 15, 49);

        if (monthTransactions.length > 0) {
            doc.autoTable({
                startY: 60,
                head: [['Type', 'Category', 'Amount', 'Date']],
                body: monthTransactions.map(t => [t.type.charAt(0).toUpperCase() + t.type.slice(1), t.category, `₹${t.amount.toFixed(2)}`, t.date]),
            });
        } else {
            doc.text('No transactions recorded.', 15, 70);
        }
        firstPage = false;
    }
    doc.save(`expense-report.pdf`);
}

// --- 7. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // === THEME TOGGLE (UPDATED LOGIC) ===
    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        const themeIcon = themeToggleButton.querySelector('i');
        // Check for Light theme class instead of Dark
        if (document.body.classList.contains('light-theme')) {
            if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
        } else {
            // Default is Dark, so show Sun icon (to switch to light)
            if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        }

        themeToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            
            if (themeIcon) {
                if (isLight) themeIcon.classList.replace('fa-sun', 'fa-moon');
                else themeIcon.classList.replace('fa-moon', 'fa-sun');
            }
            
            // Save preference
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        });
    }

    // === LINK ACCOUNT LOGIC ===
    const linkGoogleBtn = document.getElementById("link-google");
    if (linkGoogleBtn) {
        const loginMode = localStorage.getItem('loginMode');
        
        if (loginMode === 'guest') {
            linkGoogleBtn.style.display = 'inline-block';
        } else {
            linkGoogleBtn.style.display = 'none';
        }

        linkGoogleBtn.addEventListener("click", async () => {
            const auth = getAuth();
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            try {
                const result = await linkWithPopup(auth.currentUser, provider);
                localStorage.setItem("loginMode", "google");
                await syncToFirestore();
                alert("Account successfully linked!");
                location.reload();
            } catch (e) {
                console.error("Link Error:", e);
                if (e.code === 'auth/credential-already-in-use') {
                    alert("This Google account is already linked to another user.");
                } else {
                    alert("Could not link account: " + e.message);
                }
            }
        });
    }

    // === LOGOUT LOGIC ===
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            const auth = getAuth();
            try {
                await signOut(auth);
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace("auth.html");
            } catch (err) {
                console.error(err);
                localStorage.clear();
                window.location.href = "auth.html";
            }
        });
    }

    // Event listeners for forms and buttons...
    const expenseVoiceBtn = document.getElementById('voice-command-btn');
    if (expenseVoiceBtn) expenseVoiceBtn.addEventListener('click', window.startVoiceCommand);
    
    const incomeVoiceBtn = document.getElementById('voice-command-income-btn');
    if (incomeVoiceBtn) incomeVoiceBtn.addEventListener('click', window.startVoiceCommand);

    const monthlyIncomeForm = document.getElementById('monthly-income-form');
    if (monthlyIncomeForm) {
        document.getElementById('monthly-income').value = monthlyIncomes[currentMonthKey] || '';
        document.getElementById('current-month-display').textContent = currentMonthKey;
        monthlyIncomeForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const income = parseFloat(document.getElementById('monthly-income').value);
            if (isNaN(income) || income < 0) { alert('Invalid income.'); return; }
            monthlyIncomes[currentMonthKey] = income;
            saveAndSync();
            alert('Income updated!');
            updateDashboardDisplay();
        });
    }

    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const category = document.getElementById('category').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const date = document.getElementById('date').value;
            if (!category || isNaN(amount) || amount <= 0 || !date) { alert('Invalid fields.'); return; }
            allTransactions.push({ category, amount, date, type: 'expense' });
            saveAndSync();
            alert('Expense added!');
            this.reset();
            updateDashboardDisplay();
        });
    }
    
    // Add money form logic would go here if present in HTML...

    const startNewMonthBtn = document.getElementById('start-new-month');
    if (startNewMonthBtn) {
        startNewMonthBtn.addEventListener('click', function () {
            if (confirm('Start new month?')) {
                const [year, month] = currentMonthKey.split('-').map(Number);
                const currentDate = new Date(year, month - 1, 1);
                currentDate.setMonth(currentDate.getMonth() + 1);
                const newMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                localStorage.setItem('currentMonthKey', newMonthKey);
                alert(`New month: ${newMonthKey}`);
                window.location.reload();
            }
        });
    }

    const showCurrentBtn = document.getElementById('show-current-month-data');
    if (showCurrentBtn) showCurrentBtn.addEventListener('click', () => { currentView.mode = 'month'; currentView.monthKey = currentMonthKey; updateDashboardDisplay(); });

    const showAllDataBtn = document.getElementById('show-all-data');
    if (showAllDataBtn) showAllDataBtn.addEventListener('click', () => { currentView.mode = 'all'; updateDashboardDisplay(); });

    const filterDateInput = document.getElementById('filter-date');
    if (filterDateInput) filterDateInput.addEventListener('change', function () { if (this.value) { currentView.mode = 'month'; currentView.monthKey = this.value; updateDashboardDisplay(); } });

    document.querySelectorAll('input[name="transaction-type"]').forEach(radio => radio.addEventListener('change', () => updateDashboardDisplay()));

    // === UPDATED: CLEAR DATA LOGIC ===
    const clearDataBtn = document.getElementById('clear-data');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', async () => {
            if (confirm('WARNING: This will delete ALL your data from the Database (if logged in) and clear this browser cache.\n\nThis cannot be undone.\n\nClick OK to permanently delete everything.')) {
                
                const uid = localStorage.getItem('uid');
                const loginMode = localStorage.getItem('loginMode');
                
                // 1. Wipe Cloud DB if user is logged in
                if (uid && (loginMode === 'google' || loginMode === 'guest')) {
                    try {
                        const db = getFirestore();
                        // Overwrite user doc with empty arrays
                        await setDoc(doc(db, "users", uid), {
                            transactions: [],
                            monthlyIncomes: {}
                        });
                        console.log("Database cleared for user:", uid);
                    } catch (err) {
                        console.error("Error wiping database:", err);
                        alert("Could not reach database, but clearing local data.");
                    }
                }

                // 2. Clear Local Storage
                localStorage.clear();
                sessionStorage.clear();

                // 3. Force Reload to clear memory/cache
                alert('All data cleared successfully.');
                
                // Add timestamp to force bypass cache on reload
                window.location.href = window.location.pathname + '?t=' + new Date().getTime();
            }
        });
    }

    // PDF Logic
    const downloadPdfBtn = document.getElementById('download-pdf');
    const pdfModal = document.getElementById('pdf-modal');
    if (downloadPdfBtn && pdfModal) {
        const monthSelectionDiv = document.getElementById('pdf-month-selection');
        downloadPdfBtn.addEventListener('click', () => {
            monthSelectionDiv.innerHTML = '';
            const availableMonths = [...new Set(allTransactions.map(t => t.date.substring(0, 7)))].sort().reverse();
            availableMonths.forEach(month => {
                const row = document.createElement('div');
                row.innerHTML = `<label><input type="checkbox" class="pdf-month-box" value="${month}"> ${month}</label>`;
                monthSelectionDiv.appendChild(row);
            });
            pdfModal.classList.add('show');
        });
        document.getElementById('cancel-pdf').addEventListener('click', () => pdfModal.classList.remove('show'));
        document.getElementById('generate-pdf-btn').addEventListener('click', () => {
            const selectedMonths = [...document.querySelectorAll('.pdf-month-box:checked')].map(box => box.value);
            generatePdfReport(selectedMonths);
            pdfModal.classList.remove('show');
        });
    }

    // Charts Init
    if (document.getElementById('incomeExpenseChart')) {
        const initialTransactions = allTransactions.filter(t => t.date.startsWith(currentMonthKey));
        const initialIncome = monthlyIncomes[currentMonthKey] || 0;
        // Make sure renderAnalyticsCharts is available globally or imported if it's in another file
        if (typeof renderAnalyticsCharts === 'function') {
            renderAnalyticsCharts(initialTransactions, initialIncome);
        }
    }
});
