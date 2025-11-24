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

// --- 1. THEME INITIALIZATION ---
(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
    } else {
        document.body.classList.add('dark-theme');
    }
})();

// =========================================================================
// === DATA FETCHING LOGIC (Updated to sync Tutorial Status) ===============
// =========================================================================
const auth = getAuth();
const db = getFirestore();

onAuthStateChanged(auth, async (user) => {
    if (sessionStorage.getItem('isLinking') === 'true') return;

    if (user) {
        const loginMode = localStorage.getItem('loginMode');
        
        if(loginMode === 'google' || loginMode === 'guest') {
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const transactionsFromDB = data.transactions || [];
                    const incomesFromDB = data.monthlyIncomes || {};

                    localStorage.setItem("allTransactions", JSON.stringify(transactionsFromDB));
                    localStorage.setItem("monthlyIncomes", JSON.stringify(incomesFromDB));
                    
                    // --- NEW: SYNC TUTORIAL STATUS FROM CLOUD ---
                    if (data.tutorialComplete === true) {
                        localStorage.setItem('tutorialComplete', 'true');
                    }
                    // --------------------------------------------

                    loadData();
                    updateDashboardDisplay();
                    
                    if (document.getElementById('incomeExpenseChart')) {
                        const initialTransactions = allTransactions.filter(t => t.date.startsWith(currentMonthKey));
                        const initialIncome = monthlyIncomes[currentMonthKey] || 0;
                        if(typeof renderAnalyticsCharts === 'function') {
                            renderAnalyticsCharts(initialTransactions, initialIncome);
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        }
    }
});


// =========================================================================
// === VOICE COMMANDS ======================================================
// =========================================================================
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

window.startVoiceCommand = function() {
    if (!recognition) {
        alert("Speech recognition not supported.");
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
                alert('Invalid voice command format.');
                return;
            }

            allTransactions.push({ category, amount, date: formattedDate, type: transactionType });
            saveAndSync();
            alert(`${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} added successfully!`);
            updateDashboardDisplay();
        } else {
            alert('Command not recognized.');
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

async function syncToFirestore() {
    const mode = localStorage.getItem("loginMode");
    const uid = localStorage.getItem("uid");
    if (!uid) return;
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

    const subtotalText = document.getElementById('subtotal-display');
    const filterTypeElement = document.querySelector('input[name="transaction-type"]:checked');
    
    if (subtotalText && filterTypeElement) {
        const type = filterTypeElement.value;
        if (type === 'all') {
            subtotalText.style.display = 'none';
        } else if (type === 'income') {
            subtotalText.style.display = 'block';
            subtotalText.style.color = '#2ecc71'; 
            subtotalText.textContent = `Total Credit: ₹${totalCredit.toFixed(2)}`;
        } else if (type === 'expense') {
            subtotalText.style.display = 'block';
            subtotalText.style.color = '#e74c3c'; 
            subtotalText.textContent = `Total Debit: ₹${totalDebit.toFixed(2)}`;
        }
    }

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

    // Theme Toggle
    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        const themeIcon = themeToggleButton.querySelector('i');
        if (document.body.classList.contains('dark-theme')) {
            if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
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

    // Link Account
    const linkGoogleBtn = document.getElementById("link-google");
    if (linkGoogleBtn) {
        linkGoogleBtn.addEventListener("click", async () => {
            try {
                sessionStorage.setItem('isLinking', 'true');
                const currentData = {
                    transactions: JSON.parse(localStorage.getItem("allTransactions")) || [],
                    monthlyIncomes: JSON.parse(localStorage.getItem("monthlyIncomes")) || {}
                };
                const provider = new GoogleAuthProvider();
                const result = await linkWithPopup(auth.currentUser, provider);
                const user = result.user;
                localStorage.setItem("loginMode", "google");
                await setDoc(doc(db, "users", user.uid), currentData, { merge: true });
                alert("Account linked successfully!");
                sessionStorage.removeItem('isLinking');
                location.reload(); 
            } catch (e) {
                console.error(e);
                sessionStorage.removeItem('isLinking');
                if(e.code === 'auth/credential-already-in-use') {
                    alert("Google account already in use.");
                } else {
                    alert("Error: " + e.message);
                }
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            const loginMode = localStorage.getItem('loginMode');
            if (loginMode === 'guest') {
                if (!confirm("⚠️ WARNING: Guest data will be deleted on logout. Continue?")) {
                    return; 
                }
            }
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

    // Forms
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

    // Filters
    const showCurrentBtn = document.getElementById('show-current-month-data');
    if (showCurrentBtn) showCurrentBtn.addEventListener('click', function () { currentView.mode = 'month'; currentView.monthKey = currentMonthKey; if (document.getElementById('filter-date')) document.getElementById('filter-date').value = ''; updateDashboardDisplay(); });

    const showAllDataBtn = document.getElementById('show-all-data');
    if (showAllDataBtn) showAllDataBtn.addEventListener('click', function () { currentView.mode = 'all'; if (document.getElementById('filter-date')) document.getElementById('filter-date').value = ''; updateDashboardDisplay(); });

    const filterDateInput = document.getElementById('filter-date');
    if (filterDateInput) filterDateInput.addEventListener('change', function () { if (this.value) { currentView.mode = 'month'; currentView.monthKey = this.value; updateDashboardDisplay(); } });

    document.querySelectorAll('input[name="transaction-type"]').forEach(radio => radio.addEventListener('change', () => updateDashboardDisplay()));

    // Clear Data
    const clearDataBtn = document.getElementById('clear-data');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', async function () {
            if (confirm('WARNING: This will delete ALL data.\n\nClick OK to proceed.')) {
                const uid = localStorage.getItem('uid');
                if (uid) {
                    try {
                        await setDoc(doc(db, "users", uid), { transactions: [], monthlyIncomes: {} });
                    } catch (err) { console.error(err); }
                }
                localStorage.clear();
                sessionStorage.clear();
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

    // ============================================================
    // === USER ONBOARDING TUTORIAL SYSTEM (Walkthrough) ==========
    // ============================================================
    
    const tutorialData = [
        // --- INDEX PAGE ---
        {
            page: 'index.html',
            target: '#month-management',
            title: 'Welcome!',
            msg: 'This shows the currently active month for your financial tracking.',
            position: 'bottom'
        },
        {
            page: 'index.html',
            target: '#monthly-income',
            title: 'Income Input',
            msg: 'Enter your income here.',
            position: 'bottom'
        },
        {
            page: 'index.html',
            target: '#monthly-income-form button[type="submit"]',
            title: 'Update Budget',
            msg: 'Click this to update your income.',
            position: 'bottom'
        },
        {
            page: 'index.html',
            target: '#start-new-month',
            title: 'New Month',
            msg: 'Click here to archieve previous month data and start a fresh new month.',
            position: 'bottom'
        },
        {
            page: 'index.html',
            target: '#totals',
            title: 'Summary',
            msg: 'View your Total Income, Expenses, and Balance here.',
            position: 'top'
        },
        {
            page: 'index.html',
            target: '#clear-data',
            title: 'Reset',
            msg: 'Wipe all data (Caution!), This will clear all data permanently.',
            position: 'top'
        },
        {
            page: 'index.html',
            target: '#download-pdf',
            title: 'Export',
            msg: 'Download a PDF report of the selected month or all month.',
            position: 'top'
        },
        {
            page: 'index.html',
            target: '#show-current-month-data',
            title: 'Current View',
            msg: 'Show only this month\'s transactions.',
            position: 'top'
        },
        {
            page: 'index.html',
            target: '#show-all-data',
            title: 'All-Time View',
            msg: 'Show transaction data from all months.',
            position: 'top'
        },
        {
            page: 'index.html',
            target: '.filter-container',
            title: 'Filters',
            msg: 'Filter the list below by date or type (Credit/Debit).',
            position: 'top'
        },
        {
            page: 'index.html',
            target: '#transaction-container',
            title: 'History',
            msg: 'Your recent transactions appear here.',
            position: 'top'
        },
        {
            page: 'index.html',
            target: 'a[href="add-transaction.html"]', 
            title: 'Add Data',
            msg: 'Go to "Add Transaction" page.',
            action: 'click-link', 
            position: 'bottom'
        },

        // --- ADD TRANSACTION PAGE ---
        {
            page: 'add-transaction.html',
            target: '#transaction-form', // Highlights whole Debit Form
            title: 'Log Expense (Debit)',
            msg: 'Use this section to log money you spent. Enter Category, Amount, and Date.',
            position: 'bottom'
        },
        {
            page: 'add-transaction.html',
            target: '#add-money-form', // Highlights whole Credit Form
            title: 'Log Income (Credit)',
            msg: 'Use this section to log extra money received.',
            position: 'top'
        },
        {
            page: 'add-transaction.html',
            target: 'a[href="analytics.html"]',
            title: 'See Insights',
            msg: 'Go to Analytics page.',
            action: 'click-link',
            position: 'bottom'
        },

        // --- ANALYTICS PAGE ---
        {
            page: 'analytics.html',
            target: '.filter-controls',
            title: 'Date Filter',
            msg: 'Select a month to analyze past data. This updates income/expense totals too.',
            position: 'bottom'
        },
        {
            page: 'analytics.html',
            target: 'section:nth-of-type(2) .chart-container', // Specific Chart Container
            title: 'Overview Chart',
            msg: 'Bar chart comparing total Income vs total Expenses.',
            position: 'top'
        },
        {
            page: 'analytics.html',
            target: 'section:nth-of-type(3) .chart-container', 
            title: 'Expense Breakdown',
            msg: 'Pie chart showing where you spent your money.',
            position: 'top'
        },
        {
            page: 'analytics.html',
            target: 'section:nth-of-type(4) .chart-container', 
            title: 'Income Breakdown',
            msg: 'Pie chart showing your income sources.',
            position: 'top'
        },
        {
            page: 'analytics.html',
            target: 'header', 
            title: 'All Done!',
            msg: 'You are ready! Welcome to Expense Tracker.',
            position: 'bottom',
            isLast: true
        }
    ];

    function initTutorial() {
        if (localStorage.getItem('tutorialComplete') === 'true') return;

        let currentStepIndex = parseInt(localStorage.getItem('tutorialStep')) || 0;
        
        if (currentStepIndex >= tutorialData.length) {
            endTutorial();
            return;
        }

        const step = tutorialData[currentStepIndex];
        let currentPage = window.location.pathname.split("/").pop();
        if (!currentPage || currentPage === "") currentPage = "index.html";

        if (currentPage.includes(step.page)) {
             // 1000ms delay to wait for animations/DOM
             setTimeout(() => showStep(step, currentStepIndex), 1000);
        }
    }

    function showStep(step, index) {
        const targetEl = document.querySelector(step.target);
        
        if (!targetEl) {
            console.warn(`Tutorial target ${step.target} not found. Skipping.`);
            localStorage.setItem('tutorialStep', index + 1);
            initTutorial(); 
            return;
        }

        if (!document.getElementById('tutorial-spotlight')) {
            const spotlight = document.createElement('div');
            spotlight.id = 'tutorial-spotlight';
            document.body.appendChild(spotlight);

            const tooltip = document.createElement('div');
            tooltip.id = 'tutorial-tooltip';
            document.body.appendChild(tooltip);
        }

        const spotlight = document.getElementById('tutorial-spotlight');
        const tooltip = document.getElementById('tutorial-tooltip');

        const rect = targetEl.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        const padding = 5;

        spotlight.style.width = `${rect.width + (padding*2)}px`;
        spotlight.style.height = `${rect.height + (padding*2)}px`;
        spotlight.style.top = `${rect.top + scrollY - padding}px`;
        spotlight.style.left = `${rect.left + scrollX - padding}px`;

        let tooltipTop = rect.bottom + scrollY + 15;
        if (step.position === 'top' || (window.innerHeight - rect.bottom < 250)) {
            tooltipTop = rect.top + scrollY - 220; 
        }
        
        let tooltipLeft = rect.left + scrollX;
        if (tooltipLeft + 280 > window.innerWidth) {
            tooltipLeft = window.innerWidth - 300;
        }
        if (tooltipLeft < 10) tooltipLeft = 10;

        tooltip.style.top = `${tooltipTop}px`;
        tooltip.style.left = `${tooltipLeft}px`;

        let btnHtml = `<button class="tut-btn-next" onclick="nextTutorialStep()">Next</button>`;
        
        if (step.action === 'click-link') {
            btnHtml = `<span style="font-size:0.85em; color:#666; font-style:italic; display:block; margin-top:10px;">(Click the highlighted link to continue)</span>`;
            targetEl.onclick = function() {
                localStorage.setItem('tutorialStep', index + 1);
            };
        } else if (step.isLast) {
            btnHtml = `<button class="tut-btn-next" onclick="endTutorial()">Finish Tour</button>`;
        }

        tooltip.innerHTML = `
            <h3>${step.title}</h3>
            <p>${step.msg}</p>
            <div class="tutorial-footer">
                <button class="tut-btn-skip" onclick="endTutorial()">Skip Tour</button>
                ${btnHtml}
            </div>
        `;

        tooltip.classList.add('visible');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    window.nextTutorialStep = function() {
        const current = parseInt(localStorage.getItem('tutorialStep')) || 0;
        const next = current + 1;
        localStorage.setItem('tutorialStep', next);

        if (next >= tutorialData.length) {
            endTutorial();
            return;
        }

        const nextStepData = tutorialData[next];
        let currentPage = window.location.pathname.split("/").pop();
        if (!currentPage || currentPage === "") currentPage = "index.html";

        if (currentPage.includes(nextStepData.page)) {
            const spot = document.getElementById('tutorial-spotlight');
            const tool = document.getElementById('tutorial-tooltip');
            if(spot) spot.remove();
            if(tool) tool.remove();
            showStep(nextStepData, next);
        } else {
            window.location.href = nextStepData.page;
        }
    };

    window.endTutorial = async function() {
        localStorage.setItem('tutorialComplete', 'true');
        const spot = document.getElementById('tutorial-spotlight');
        const tool = document.getElementById('tutorial-tooltip');
        if(spot) spot.remove();
        if(tool) tool.remove();

        const uid = localStorage.getItem('uid');
        if(uid) {
             try {
                 await setDoc(doc(db, "users", uid), { tutorialComplete: true }, { merge: true });
             } catch(e) { console.error(e); }
        }
    };

    initTutorial();
});

