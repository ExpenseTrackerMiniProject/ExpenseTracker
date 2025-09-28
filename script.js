document.addEventListener('DOMContentLoaded', () => {
    // ===============================================
    // STATE & DATA MANAGEMENT
    // ===============================================
    let currentView = 'current'; // 'current' or 'all'
    let allData = {};
    let currentMonthKey = getCurrentMonthKey();

    // Wrapper for all data access to handle migration from old format
    function loadData() {
        const oldTransactions = localStorage.getItem('transactions');
        const oldIncome = localStorage.getItem('monthlyIncome');
        const newAllData = localStorage.getItem('allExpenseData');

        if (newAllData) {
            allData = JSON.parse(newAllData);
        } else if (oldTransactions || oldIncome) {
            // Migrate old data to the new monthly format
            console.log("Migrating old data to new format...");
            const transactions = JSON.parse(oldTransactions) || [];
            const monthlyIncome = parseFloat(oldIncome) || 0;
            const monthOfFirstTransaction = transactions.length > 0 ? transactions[0].date.substring(0, 7) : currentMonthKey;
            
            allData[monthOfFirstTransaction] = { monthlyIncome, transactions };
            
            localStorage.setItem('allExpenseData', JSON.stringify(allData));
            localStorage.removeItem('transactions');
            localStorage.removeItem('monthlyIncome');
            alert("Your data has been updated to the new monthly format!");
        }
        
        // Ensure data for the current month exists
        if (!allData[currentMonthKey]) {
            allData[currentMonthKey] = { monthlyIncome: 0, transactions: [] };
        }
    }

    function saveData() {
        localStorage.setItem('allExpenseData', JSON.stringify(allData));
    }


    // ===============================================
    // CORE RENDERING FUNCTIONS
    // ===============================================
    function initializeDashboard() {
        const pagePath = window.location.pathname;

        if (pagePath.endsWith('index.html') || pagePath.endsWith('/')) {
            renderDashboardPage();
        } else if (pagePath.endsWith('analytics.html')) {
            renderAnalyticsPage();
        }
        // Add/Edit pages do not need initial rendering beyond their own event listeners
    }

    function renderDashboardPage() {
        const viewTitle = document.getElementById('view-title');
        const toggleViewBtn = document.getElementById('toggle-view');
        const monthlyIncomeForm = document.getElementById('monthly-income-form');
        const startNewMonthBtn = document.getElementById('start-new-month');

        let incomeToDisplay = 0;
        let transactionsToDisplay = [];

        if (currentView === 'current') {
            viewTitle.textContent = 'Current Month (' + currentMonthKey + ')';
            toggleViewBtn.textContent = 'View All-Time';
            monthlyIncomeForm.style.display = 'block';
            startNewMonthBtn.style.display = 'inline-block';
            
            const currentMonthData = allData[currentMonthKey] || { monthlyIncome: 0, transactions: [] };
            incomeToDisplay = currentMonthData.monthlyIncome;
            transactionsToDisplay = currentMonthData.transactions;
            
        } else { // 'all' view
            viewTitle.textContent = 'All-Time Data';
            toggleViewBtn.textContent = 'View Current Month';
            monthlyIncomeForm.style.display = 'none';
            startNewMonthBtn.style.display = 'none';

            Object.values(allData).forEach(monthData => {
                transactionsToDisplay = transactionsToDisplay.concat(monthData.transactions);
                incomeToDisplay += parseFloat(monthData.monthlyIncome);
            });
        }
        
        updateDashboardSummary(incomeToDisplay, transactionsToDisplay);
        displayTransactionList(transactionsToDisplay, currentView);
    }
    
    function updateDashboardSummary(income, transactions) {
        const totalIncomeElem = document.getElementById('total-income');
        const totalExpensesElem = document.getElementById('total-expenses');
        const remainingBalanceElem = document.getElementById('remaining-balance');

        const totalCredit = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const totalDebit = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const netExpenses = totalDebit - totalCredit;

        totalIncomeElem.textContent = income.toFixed(2);
        totalExpensesElem.textContent = netExpenses.toFixed(2);
        remainingBalanceElem.textContent = (income - netExpenses).toFixed(2);
    }

    function displayTransactionList(transactions, viewMode) {
        const transactionList = document.getElementById('transaction-list');
        if (!transactionList) return;
        transactionList.innerHTML = '';

        let filtered = applyFilters(transactions);
        
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(transaction => {
            const li = document.createElement('li');
            li.classList.toggle('income-transaction', transaction.type === 'income');
            
            const originalIndex = allData[currentMonthKey].transactions.findIndex(t => t === transaction);

            let buttonsHtml = (viewMode === 'current' && originalIndex > -1) ? `
                <div class="button-container">
                    <button class="edit-button" onclick="window.app.editTransaction(${originalIndex})"><i class="fas fa-edit"></i></button>
                    <button class="delete-button" onclick="window.app.deleteTransaction(${originalIndex})"><i class="fas fa-trash-alt"></i></button>
                </div>` : '';

            li.innerHTML = `<span>${transaction.category}: ₹${parseFloat(transaction.amount).toFixed(2)} on ${transaction.date}</span> ${buttonsHtml}`;
            transactionList.appendChild(li);
        });
    }

    // ===============================================
    // DATA MODIFICATION (WRAPPED FOR GLOBAL ACCESS)
    // ===============================================
    window.app = {
        addTransaction: (transaction) => {
            if (currentView === 'all') {
                alert('Cannot add transactions in "All-Time" view. Please switch to "Current Month" view.');
                return;
            }
            allData[currentMonthKey].transactions.push(transaction);
            saveData();
            initializeDashboard();
        },
        editTransaction: (index) => {
            const transaction = allData[currentMonthKey].transactions[index];
            const newCategory = prompt('Edit Category:', transaction.category);
            if (newCategory === null) return;

            const newAmountStr = prompt('Edit Amount:', transaction.amount);
            if (newAmountStr === null) return;
            
            const newAmount = parseFloat(newAmountStr);
            if (newCategory.trim() === '' || isNaN(newAmount) || newAmount <= 0) {
                alert('Invalid category or amount.'); return;
            }

            allData[currentMonthKey].transactions[index].category = newCategory.trim();
            allData[currentMonthKey].transactions[index].amount = parseFloat(newAmount);
            saveData();
            initializeDashboard();
        },
        deleteTransaction: (index) => {
            if (confirm('Are you sure you want to delete this transaction?')) {
                allData[currentMonthKey].transactions.splice(index, 1);
                saveData();
                initializeDashboard();
            }
        }
    };

    // ===============================================
    // EVENT LISTENERS
    // ===============================================

    // --- Main Page Buttons ---
    if (document.getElementById('start-new-month')) {
        document.getElementById('start-new-month').addEventListener('click', () => {
            if (confirm('Are you sure you want to archive this month and start a new one?')) {
                const nextMonth = getNextMonthKey(currentMonthKey);
                if (!allData[nextMonth]) {
                    allData[nextMonth] = { monthlyIncome: 0, transactions: [] };
                }
                saveData();
                alert('Current month archived. You are now in month: ' + nextMonth + '. Please reload the page to continue.');
                window.location.reload();
            }
        });

        document.getElementById('toggle-view').addEventListener('click', () => {
            currentView = (currentView === 'current') ? 'all' : 'current';
            initializeDashboard();
        });

        document.getElementById('monthly-income-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const income = parseFloat(document.getElementById('monthly-income').value);
            if (!isNaN(income) && income >= 0) {
                allData[currentMonthKey].monthlyIncome = income;
                saveData();
                initializeDashboard();
            } else {
                alert('Please enter a valid income.');
            }
        });

        document.getElementById('clear-data').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear ALL data from ALL months? This cannot be undone.')) {
                allData = {};
                localStorage.removeItem('allExpenseData');
                window.location.reload();
            }
        });
    }

    // --- Add/Edit Page Forms ---
    if (document.getElementById('transaction-form')) {
        document.getElementById('transaction-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const category = document.getElementById('category').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const date = document.getElementById('date').value;
            if (category && !isNaN(amount) && amount > 0 && date) {
                window.app.addTransaction({ category, amount, date, type: 'expense' });
                alert('Expense Added!');
                e.target.reset();
            } else {
                alert('Please fill out all fields correctly.');
            }
        });
    }

    if (document.getElementById('add-money-form')) {
        document.getElementById('add-money-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const category = document.getElementById('add-money-category').value;
            const amount = parseFloat(document.getElementById('add-money-amount').value);
            const date = document.getElementById('add-money-date').value;
            if (category && !isNaN(amount) && amount > 0 && date) {
                window.app.addTransaction({ category, amount, date, type: 'income' });
                alert('Income Added!');
                e.target.reset();
            } else {
                alert('Please fill out all fields correctly.');
            }
        });
    }
    
    // --- Filter Listeners ---
    if (document.getElementById('filter-date')) {
        document.getElementById('filter-date').addEventListener('change', initializeDashboard);
        document.querySelectorAll('input[name="transaction-type"]').forEach(radio => {
            radio.addEventListener('change', initializeDashboard);
        });
        document.getElementById('reset-filters').addEventListener('click', () => {
            document.getElementById('filter-date').value = '';
            document.querySelector('input[name="transaction-type"][value="all"]').checked = true;
            initializeDashboard();
        });
    }

    // ===============================================
    // VOICE COMMANDS (INTEGRATED)
    // ===============================================
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    if (recognition) {
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        recognition.onresult = function(event) {
            const voiceInput = event.results[0][0].transcript;
            const regex = /add (\d+(\.\d{1,2})?) (\w+) on (today|\w+ \d{1,2} \d{4})/i;
            const matches = voiceInput.match(regex);
            if (matches) {
                const amount = parseFloat(matches[1]);
                const category = matches[3];
                let dateString = matches[4];
                if (dateString.toLowerCase() === 'today') dateString = getCurrentDateAsString();
                
                const formattedDate = formatDateToYYYYMMDD(dateString);
                if (category && !isNaN(amount) && amount > 0 && formattedDate) {
                    window.app.addTransaction({ category, amount, date: formattedDate, type: 'expense' });
                    alert('Transaction added via voice!');
                } else {
                    alert('Invalid voice command format.');
                }
            } else {
                alert('Voice command not recognized.');
            }
        };
        recognition.onerror = (event) => alert(`Speech recognition error: ${event.error}`);
        
        const voiceBtn = document.getElementById('voice-command-btn');
        if (voiceBtn) voiceBtn.addEventListener('click', () => recognition.start());
    }
    
    // ===============================================
    // PDF & ANALYTICS (CONTEXT-AWARE)
    // ===============================================
    function renderAnalyticsPage() {
        // This function will now be responsible for all logic on the analytics page
        let transactionsToDisplay = [];
        let incomeToDisplay = 0;
        
        // Use the same logic to get data: default to current month for analytics
        const currentMonthData = allData[currentMonthKey] || { monthlyIncome: 0, transactions: [] };
        incomeToDisplay = currentMonthData.monthlyIncome;
        transactionsToDisplay = currentMonthData.transactions;

        // Populate month filter and allow changing the data source
        const monthFilter = document.getElementById('analytics-month-filter');
        Object.keys(allData).sort().reverse().forEach(monthKey => {
            const option = document.createElement('option');
            option.value = monthKey;
            option.textContent = monthKey;
            if (monthKey === currentMonthKey) option.selected = true;
            monthFilter.appendChild(option);
        });
        
        monthFilter.addEventListener('change', () => {
            const selectedMonth = monthFilter.value;
            const data = allData[selectedMonth];
            renderCharts(data.monthlyIncome, data.transactions);
        });
        
        document.getElementById('analytics-show-all').addEventListener('click', () => {
            monthFilter.value = "";
             let allTransactions = [];
            let totalIncome = 0;
            Object.values(allData).forEach(monthData => {
                allTransactions = allTransactions.concat(monthData.transactions);
                totalIncome += parseFloat(monthData.monthlyIncome);
            });
            renderCharts(totalIncome, allTransactions);
        });

        renderCharts(incomeToDisplay, transactionsToDisplay); // Initial render
    }
    
    let incomeExpenseChart, expenseCategoryChart, incomeCategoryChart;
    function renderCharts(income, transactions) {
        if (incomeExpenseChart) incomeExpenseChart.destroy();
        if (expenseCategoryChart) expenseCategoryChart.destroy();
        if (incomeCategoryChart) incomeCategoryChart.destroy();

        const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
        const expenseCategoryCtx = document.getElementById('expenseCategoryChart').getContext('2d');
        const incomeCategoryCtx = document.getElementById('incomeCategoryChart').getContext('2d');

        const totalCredit = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const totalDebit = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const netExpenses = totalDebit - totalCredit;

        incomeExpenseChart = new Chart(incomeExpenseCtx, { /* ... chart config ... */ });
        // ... (rest of the detailed chart rendering logic, which remains the same)
    }

    if (document.getElementById('download-pdf')) {
        document.getElementById('download-pdf').addEventListener('click', () => {
            // PDF will be generated based on the current view (current month or all-time)
            let incomeForPdf = 0;
            let transactionsForPdf = [];
            
            if (currentView === 'current') {
                const data = allData[currentMonthKey];
                incomeForPdf = data.monthlyIncome;
                transactionsForPdf = data.transactions;
            } else {
                Object.values(allData).forEach(monthData => {
                    transactionsForPdf = transactionsForPdf.concat(monthData.transactions);
                    incomeForPdf += parseFloat(monthData.monthlyIncome);
                });
            }
            generatePDF(incomeForPdf, transactionsForPdf);
        });
    }

    function generatePDF(income, transactions) {
        // ... (all existing PDF generation logic goes here, using the passed income and transactions)
        alert('PDF generation started...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        // ...
    }


    // ===============================================
    // HELPER FUNCTIONS
    // ===============================================
    function applyFilters(transactions) {
        const filterDate = document.getElementById('filter-date').value;
        const filterType = document.querySelector('input[name="transaction-type"]:checked').value;
        let filtered = [...transactions];
        if (filterDate) {
            const [year, month] = filterDate.split('-');
            filtered = filtered.filter(t => t.date.startsWith(`${year}-${month}`));
        }
        if (filterType !== 'all') {
            filtered = filtered.filter(t => t.type === filterType);
        }
        return filtered;
    }

    function getCurrentMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function getNextMonthKey(key) {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() + 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function formatDateToYYYYMMDD(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getCurrentDateAsString() {
        const today = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${monthNames[today.getMonth()]} ${today.getDate()} ${today.getFullYear()}`;
    }
    
    // Initial Load
    loadData();
    initializeDashboard();
});
