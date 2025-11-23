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

// --- 1. THEME INITIALIZATION (Default: Black/Dark) ---
(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Logic: Only remove dark mode if user EXPLICITLY set it to 'light'
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
    } else {
        document.body.classList.add('dark-theme');
    }
})();

// =========================================================================
// === DATA FETCHING LOGIC (THE FIX) =======================================
// =========================================================================
const auth = getAuth();
const db = getFirestore();

// Listen for login state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("✅ User detected:", user.uid);
        
        // Ensure we handle Guest vs Google login modes correctly
        const loginMode = localStorage.getItem('loginMode');
        
        // If we are logged in (Google or Guest), try to fetch data
        if(loginMode === 'google' || loginMode === 'guest') {
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    console.log("🔥 FIREBASE DATA FOUND!");
                    const data = docSnap.data();
                    
                    // 1. Force update Local Storage with Cloud Data
                    // We use || [] and || {} to ensure we don't crash if fields are missing
                    const transactionsFromDB = data.transactions || [];
                    const incomesFromDB = data.monthlyIncomes || {};

                    localStorage.setItem("allTransactions", JSON.stringify(transactionsFromDB));
                    localStorage.setItem("monthlyIncomes", JSON.stringify(incomesFromDB));
                    
                    // 2. Refresh the variables in memory
                    loadData();
                    
                    // 3. Force UI Update
                    updateDashboardDisplay();
                    
                    // 4. Update Charts if they are on screen
                    if (document.getElementById('incomeExpenseChart')) {
                        const initialTransactions = allTransactions.filter(t => t.date.startsWith(currentMonthKey));
                        const initialIncome = monthlyIncomes[currentMonthKey] || 0;
                        if(typeof renderAnalyticsCharts === 'function') {
                            renderAnalyticsCharts(initialTransactions, initialIncome);
                        }
                    }
                } else {
                    console.log("⚠️ User logged in, but no data found in Firestore (New user?).");
                }
            } catch (error) {
                console.error("❌ Error fetching data:", error);
            }
        }
    } else {
        console.log("User is signed out.");
    }
});


// =========================================================================
// === VOICE COMMANDS ======================================================
// =========================================================================
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
        console.log(`Voice Command: ${voiceInput}`);

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

            if (dateString.toLowerCase() === 'today') {
                dateString = getCurrentDate();
            }

            const formattedDate = formatDateToYYYYMMDD(dateString);

            if (!category || isNaN(amount) || amount <= 0 || !formattedDate) {
                alert('Invalid voice command format.');
                return;
            }

            allTransactions.push({ category, amount, date: formattedDate, type: transactionType });
            saveAndSync();

            const typeCapitalized = transactionType.charAt(0).toUpperCase() + transactionType.slice(1);
            alert(`${typeCapitalized} added successfully!`);
            updateDashboardDisplay();
        } else {
            alert('Command not recognized. Try "Add 100 food on today".');
        }
    };

    recognition.onerror = function (event) {
        alert(`Voice Error: ${event.error}`);
    };

} else {
    const btn = document.getElementById('voice-command-btn');
    if (btn) btn.addEventListener('click', () => alert('Speech recognition not supported.'));
}

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


// =========================================================================
// === DATA MANAGEMENT & UTILS =============================================
// =========================================================================
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

// === SYNC TO FIRESTORE ===
async function syncToFirestore() {
    const mode = localStorage.getItem("loginMode");
    const uid = localStorage.getItem("uid");
    
    // Safety check: ensure we have a UID before writing
    if (!uid) return;
    
    // Only write if we are in a valid online mode
    if (mode === "google" || mode === "guest") {
        const data = {
            transactions: JSON.parse(localStorage.getItem("allTransactions")) || [],
            monthlyIncomes: JSON.parse(localStorage.getItem("monthlyIncomes")) || {}
        };
        await setDoc(doc(db, "users", uid), data, { merge: true });
    }
}

async function saveAndSync() {
    localStorage.setItem("allTransactions", JSON.stringify(allTransactions));
    localStorage.setItem("monthlyIncomes", JSON.stringify(monthlyIncomes));
    await syncToFirestore();
}

// =========================================================================
// === DISPLAY & UI FUNCTIONS ==============================================
// =========================================================================

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

function generateColorPalette(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const hue = (i * 360 / numColors) % 360;
        colors.push(`hsl(${hue}, 80%, 60%)`);
    }
    return colors;
}


// =========================================================================
// === GLOBAL ACTIONS (Delete, Edit, PDF) ==================================
// =========================================================================

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

// =========================================================================
// === EVENT LISTENERS =====================================================
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // === THEME TOGGLE (Fixed: Default Dark) ===
    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        const themeIcon = themeToggleButton.querySelector('i');

        // Check current state from body class
        if (document.body.classList.contains('dark-theme')) {
            if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun'); // Show sun to switch to light
        } else {
            if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon'); // Show moon to switch to dark
        }

        themeToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');

            if (themeIcon) {
                if (isDark) themeIcon.classList.replace('fa-moon', 'fa-sun');
                else themeIcon.classList.replace('fa-sun', 'fa-moon');
            }
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // Link Account Logic
    const linkGoogleBtn = document.getElementById("link-google");
    if (linkGoogleBtn) {
        linkGoogleBtn.addEventListener("click", async () => {
            try {
                const provider = new GoogleAuthProvider();
                const result = await linkWithPopup(auth.currentUser, provider);
                localStorage.setItem("loginMode", "google");
                await syncToFirestore(); // Ensure current local data is pushed to the new account
                alert("Account linked! Data saved.");
                location.reload(); 
            } catch (e) {
                console.error(e);
                if(e.code === 'auth/credential-already-in-use') {
                    alert("This Google account is already in use. Please logout and sign in with Google.");
                } else {
                    alert("Error: " + e.message);
                }
            }
        });
    }

    // Logout Logic
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await signOut(auth);
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace("auth.html");
            } catch (err) {
                console.error("Logout failed:", err);
                localStorage.clear();
                window.location.href = "auth.html";
            }
        });
    }

    // Form Listeners
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
            if (isNaN(income) || income < 0) { alert('Invalid income'); return; }
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
            if (!category || isNaN(amount) || amount <= 0 || !date) { alert('Invalid fields'); return; }
            allTransactions.push({ category, amount, date, type: 'expense' });
            saveAndSync();
            alert('Expense added!');
            this.reset();
            updateDashboardDisplay();
        });
    }

    const addMoneyForm = document.getElementById('add-money-form');
    if (addMoneyForm) {
        addMoneyForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const category = document.getElementById('add-money-category').value;
            const amount = parseFloat(document.getElementById('add-money-amount').value);
            const date = document.getElementById('add-money-date').value;
            if (!category || isNaN(amount) || amount <= 0 || !date) { alert('Invalid fields'); return; }
            allTransactions.push({ category, amount, date, type: 'income' });
            saveAndSync();
            alert('Income added!');
            this.reset();
            updateDashboardDisplay();
        });
    }

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

    // Filter Buttons
    const showCurrentBtn = document.getElementById('show-current-month-data');
    if (showCurrentBtn) showCurrentBtn.addEventListener('click', function () { currentView.mode = 'month'; currentView.monthKey = currentMonthKey; if (document.getElementById('filter-date')) document.getElementById('filter-date').value = ''; updateDashboardDisplay(); });

    const showAllDataBtn = document.getElementById('show-all-data');
    if (showAllDataBtn) showAllDataBtn.addEventListener('click', function () { currentView.mode = 'all'; if (document.getElementById('filter-date')) document.getElementById('filter-date').value = ''; updateDashboardDisplay(); });

    const filterDateInput = document.getElementById('filter-date');
    if (filterDateInput) filterDateInput.addEventListener('change', function () { if (this.value) { currentView.mode = 'month'; currentView.monthKey = this.value; updateDashboardDisplay(); } });

    document.querySelectorAll('input[name="transaction-type"]').forEach(radio => radio.addEventListener('change', () => updateDashboardDisplay()));

    // === CLEAR DATA LOGIC (DB + LOCAL) ===
    const clearDataBtn = document.getElementById('clear-data');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', async function () {
            if (confirm('WARNING: This will delete ALL data from the Database and this device.\n\nClick OK to proceed.')) {
                
                const uid = localStorage.getItem('uid');
                
                // Try to wipe Firestore
                if (uid) {
                    try {
                        // We write empty arrays to the user's document
                        await setDoc(doc(db, "users", uid), {
                            transactions: [],
                            monthlyIncomes: {}
                        });
                        console.log("DB Cleared");
                    } catch (err) {
                        console.error("DB Clear Error:", err);
                        alert("Could not clear database (offline?), but clearing local data.");
                    }
                }

                localStorage.clear();
                sessionStorage.clear();
                alert('All data cleared.');
                // Add timestamp to force cache refresh
                window.location.href = window.location.pathname + '?t=' + new Date().getTime();
            }
        });
    }

    // PDF Logic
    const downloadPdfBtn = document.getElementById('download-pdf');
    const pdfModal = document.getElementById('pdf-modal');
    if (downloadPdfBtn && pdfModal) {
        const monthSelectionDiv = document.getElementById('pdf-month-selection');
        const selectAllCheckbox = document.getElementById('pdf-select-all');

        downloadPdfBtn.addEventListener('click', () => {
            monthSelectionDiv.innerHTML = '';
            selectAllCheckbox.checked = false;
            const availableMonths = [...new Set(allTransactions.map(t => t.date.substring(0, 7)))].sort().reverse();
            if (availableMonths.length === 0) { alert("No data for report."); return; }
            availableMonths.forEach(month => {
                const row = document.createElement('div');
                row.className = 'pdf-option-row';
                row.innerHTML = `<label><input type="checkbox" class="pdf-month-box" value="${month}"> ${month}</label>`;
                monthSelectionDiv.appendChild(row);
            });
            pdfModal.classList.add('show');
        });

        document.getElementById('cancel-pdf').addEventListener('click', () => pdfModal.classList.remove('show'));
        selectAllCheckbox.addEventListener('change', (e) => document.querySelectorAll('.pdf-month-box').forEach(box => box.checked = e.target.checked));
        document.getElementById('generate-pdf-btn').addEventListener('click', () => {
            const selectedMonths = [...document.querySelectorAll('.pdf-month-box:checked')].map(box => box.value);
            if (selectedMonths.length === 0) { alert('Select at least one month.'); return; }
            generatePdfReport(selectedMonths);
            pdfModal.classList.remove('show');
        });
    }

    // Analytics Init
    if (document.getElementById('incomeExpenseChart')) {
        let incomeExpenseChart, expenseCategoryChart, incomeCategoryChart;
        const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
        const expenseCategoryCtx = document.getElementById('expenseCategoryChart').getContext('2d');
        const incomeCategoryCtx = document.getElementById('incomeCategoryChart').getContext('2d');

        function renderAnalyticsCharts(dataToDisplay, incomeForView) {
            if (incomeExpenseChart) incomeExpenseChart.destroy();
            if (expenseCategoryChart) expenseCategoryChart.destroy();
            if (incomeCategoryChart) incomeCategoryChart.destroy();

            const totalCredit = dataToDisplay.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
            const totalDebit = dataToDisplay.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
            const netExpenses = totalDebit - totalCredit;

            incomeExpenseChart = new Chart(incomeExpenseCtx, {
                type: 'bar',
                data: { labels: ['Monthly Income', 'Net Expenses'], datasets: [{ label: 'Amount (₹)', data: [incomeForView || 0, netExpenses || 0], backgroundColor: ['#28a745', '#dc3545'] }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
            
            // Pie Charts Logic
            const drawPie = (ctx, data, type) => {
                const categories = [...new Set(data.map(t => t.category))];
                const totals = categories.map(cat => data.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0));
                return new Chart(ctx, { type: 'pie', data: { labels: categories, datasets: [{ label: type, data: totals, backgroundColor: generateColorPalette(categories.length) }] }, options: { responsive: true, maintainAspectRatio: false } });
            };

            const expenseData = dataToDisplay.filter(t => t.type === 'expense');
            const expenseContainer = document.getElementById('expenseCategoryChart').parentElement;
            if(expenseContainer.querySelector('.no-data-message')) expenseContainer.querySelector('.no-data-message').remove();
            
            if (expenseData.length > 0) {
                document.getElementById('expenseCategoryChart').style.display = 'block';
                expenseCategoryChart = drawPie(expenseCategoryCtx, expenseData, 'Expenses');
            } else {
                document.getElementById('expenseCategoryChart').style.display = 'none';
                expenseContainer.insertAdjacentHTML('beforeend', '<p class="no-data-message">No expense data</p>');
            }

            const incomeData = dataToDisplay.filter(t => t.type === 'income');
            const incomeContainer = document.getElementById('incomeCategoryChart').parentElement;
            if(incomeContainer.querySelector('.no-data-message')) incomeContainer.querySelector('.no-data-message').remove();

            if (incomeData.length > 0) {
                document.getElementById('incomeCategoryChart').style.display = 'block';
                incomeCategoryChart = drawPie(incomeCategoryCtx, incomeData, 'Income');
            } else {
                document.getElementById('incomeCategoryChart').style.display = 'none';
                incomeContainer.insertAdjacentHTML('beforeend', '<p class="no-data-message">No income data</p>');
            }
        }
        
        // Expose function globally for the Fetch logic to use
        window.renderAnalyticsCharts = renderAnalyticsCharts;

        const analyticsMonthFilter = document.getElementById('analytics-month-filter');
        if (analyticsMonthFilter) {
            analyticsMonthFilter.addEventListener('change', function () {
                const selectedMonth = this.value;
                if (selectedMonth) {
                    const filteredData = allTransactions.filter(t => t.date.startsWith(selectedMonth));
                    const incomeForMonth = monthlyIncomes[selectedMonth] || 0;
                    renderAnalyticsCharts(filteredData, incomeForMonth);
                } else {
                    const totalIncome = Object.values(monthlyIncomes).reduce((s, i) => s + i, 0);
                    renderAnalyticsCharts(allTransactions, totalIncome);
                }
            });
        }
        
        const analyticsShowAllBtn = document.getElementById('analytics-show-all');
        if (analyticsShowAllBtn) {
            analyticsShowAllBtn.addEventListener('click', function () {
                if (analyticsMonthFilter) analyticsMonthFilter.value = '';
                const totalIncome = Object.values(monthlyIncomes).reduce((s, i) => s + i, 0);
                renderAnalyticsCharts(allTransactions, totalIncome);
            });
        }

        const initialTransactions = allTransactions.filter(t => t.date.startsWith(currentMonthKey));
        const initialIncome = monthlyIncomes[currentMonthKey] || 0;
        renderAnalyticsCharts(initialTransactions, initialIncome);
    }
});
