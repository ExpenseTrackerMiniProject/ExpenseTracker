document.addEventListener('DOMContentLoaded', () => {
    // ===============================================
    // STATE & DATA MANAGEMENT
    // ===============================================
    let currentView = 'current'; // 'current' or 'all'
    let allData = {};
    let currentMonthKey = getCurrentMonthKey();

    function loadData() {
        const oldTransactions = localStorage.getItem('transactions');
        const oldIncome = localStorage.getItem('monthlyIncome');
        const newAllData = localStorage.getItem('allExpenseData');

        if (newAllData) {
            allData = JSON.parse(newAllData);
        } else if (oldTransactions || oldIncome) {
            console.log("Migrating old data to new monthly format...");
            const transactions = JSON.parse(oldTransactions) || [];
            const monthlyIncome = parseFloat(oldIncome) || 0;
            const monthOfFirstTransaction = transactions.length > 0 ? transactions[0].date.substring(0, 7) : currentMonthKey;
            
            allData[monthOfFirstTransaction] = { monthlyIncome, transactions };
            
            localStorage.setItem('allExpenseData', JSON.stringify(allData));
            localStorage.removeItem('transactions');
            localStorage.removeItem('monthlyIncome');
            alert("Your data has been updated to the new monthly format!");
        }
        
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
    function initializeApp() {
        const pagePath = window.location.pathname;

        if (pagePath.includes('analytics.html')) {
            renderAnalyticsPage();
        } else if (pagePath.includes('add-transaction.html')) {
            // No main render, just setup listeners
        } else {
            renderDashboardPage();
        }
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
            
            const originalIndex = allData[currentMonthKey]?.transactions.findIndex(t => t === transaction);

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
            allData[currentMonthKey].transactions.push(transaction);
            saveData();
            // No need to re-render here, form pages will handle alerts/redirects
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
            allData[currentMonthKey].transactions[index].amount = newAmount;
            saveData();
            renderDashboardPage(); // Re-render the dashboard
        },
        deleteTransaction: (index) => {
            if (confirm('Are you sure you want to delete this transaction?')) {
                allData[currentMonthKey].transactions.splice(index, 1);
                saveData();
                renderDashboardPage(); // Re-render the dashboard
            }
        }
    };

    // ===============================================
    // EVENT LISTENERS
    // ===============================================
    if (document.getElementById('start-new-month')) {
        document.getElementById('start-new-month').addEventListener('click', () => {
            if (confirm('Are you sure you want to archive this month and start a new one?')) {
                const nextMonth = getNextMonthKey(currentMonthKey);
                if (!allData[nextMonth]) {
                    allData[nextMonth] = { monthlyIncome: 0, transactions: [] };
                }
                saveData();
                alert('Current month archived! The page will now reload for the new month: ' + nextMonth);
                window.location.reload();
            }
        });

        document.getElementById('toggle-view').addEventListener('click', () => {
            currentView = (currentView === 'current') ? 'all' : 'current';
            renderDashboardPage();
        });

        document.getElementById('monthly-income-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const income = parseFloat(document.getElementById('monthly-income').value);
            if (!isNaN(income) && income >= 0) {
                allData[currentMonthKey].monthlyIncome = income;
                saveData();
                renderDashboardPage();
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
    
    if (document.getElementById('filter-date')) {
        document.getElementById('reset-filters').setAttribute('id', 'dashboard-reset-filters'); // Avoid conflicts
        document.getElementById('dashboard-reset-filters').addEventListener('click', () => {
            document.getElementById('filter-date').value = '';
            document.querySelector('input[name="transaction-type"][value="all"]').checked = true;
            renderDashboardPage();
        });
        document.getElementById('filter-date').addEventListener('change', renderDashboardPage);
        document.querySelectorAll('input[name="transaction-type"]').forEach(radio => {
            radio.addEventListener('change', renderDashboardPage);
        });
    }

    // ===============================================
    // VOICE COMMANDS (INTEGRATED)
    // ===============================================
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    if (recognition && document.getElementById('voice-command-btn')) {
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
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
        
        document.getElementById('voice-command-btn').addEventListener('click', () => recognition.start());
    }
    
    // ===============================================
    // PDF & ANALYTICS (CONTEXT-AWARE)
    // ===============================================
    let incomeExpenseChart, expenseCategoryChart, incomeCategoryChart; // Make charts global for this script
    function renderCharts(income, transactions) {
        if (incomeExpenseChart) incomeExpenseChart.destroy();
        if (expenseCategoryChart) expenseCategoryChart.destroy();
        if (incomeCategoryChart) incomeCategoryChart.destroy();

        const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
        const expenseCategoryCtx = document.getElementById('expenseCategoryChart').getContext('2d');
        const incomeCategoryCtx = document.getElementById('incomeCategoryChart').getContext('2d');

        const totalCredit = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const totalDebit = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const netExpenses = totalDebit - totalCredit;
        
        incomeExpenseChart = new Chart(incomeExpenseCtx, {
            type: 'bar',
            data: {
                labels: ['Total Income', 'Net Expenses'],
                datasets: [{ label: 'Amount (₹)', data: [income, netExpenses], backgroundColor: ['#28a745', '#dc3545'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        const expenseData = transactions.filter(t => t.type === 'expense');
        const expenseChartContainer = document.getElementById('expenseCategoryChart').parentElement;
        if (expenseData.length === 0) {
            expenseChartContainer.innerHTML = '<p>No expense data for this period.</p>';
        } else {
            expenseChartContainer.innerHTML = '<canvas id="expenseCategoryChart"></canvas>';
            const newExpenseCtx = document.getElementById('expenseCategoryChart').getContext('2d');
            const expenseCategories = [...new Set(expenseData.map(t => t.category))];
            const expenseCategoryTotals = expenseCategories.map(cat => expenseData.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0));
            expenseCategoryChart = new Chart(newExpenseCtx, {
                type: 'pie', data: { labels: expenseCategories, datasets: [{ data: expenseCategoryTotals, backgroundColor: generateColorPalette(expenseCategories.length) }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        
        const incomeData = transactions.filter(t => t.type === 'income');
        const incomeChartContainer = document.getElementById('incomeCategoryChart').parentElement;
        if (incomeData.length === 0) {
            incomeChartContainer.innerHTML = '<p>No income data for this period.</p>';
        } else {
            incomeChartContainer.innerHTML = '<canvas id="incomeCategoryChart"></canvas>';
            const newIncomeCtx = document.getElementById('incomeCategoryChart').getContext('2d');
            const incomeCategories = [...new Set(incomeData.map(t => t.category))];
            const incomeCategoryTotals = incomeCategories.map(cat => incomeData.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0));
            incomeCategoryChart = new Chart(newIncomeCtx, {
                type: 'pie', data: { labels: incomeCategories, datasets: [{ data: incomeCategoryTotals, backgroundColor: generateColorPalette(incomeCategories.length).reverse() }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }
    
    function renderAnalyticsPage() {
        let transactionsToDisplay = [];
        let incomeToDisplay = 0;
        
        const currentMonthData = allData[currentMonthKey] || { monthlyIncome: 0, transactions: [] };
        incomeToDisplay = currentMonthData.monthlyIncome;
        transactionsToDisplay = currentMonthData.transactions;

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

        renderCharts(incomeToDisplay, transactionsToDisplay);
    }
    
    if (document.getElementById('download-pdf')) {
        document.getElementById('download-pdf').addEventListener('click', () => {
            let incomeForPdf = 0;
            let transactionsForPdf = [];
            let title = '';
            
            if (currentView === 'current') {
                const data = allData[currentMonthKey];
                incomeForPdf = data.monthlyIncome;
                transactionsForPdf = data.transactions;
                title = `Expense Report for ${currentMonthKey}`;
            } else {
                Object.values(allData).forEach(monthData => {
                    transactionsForPdf = transactionsForPdf.concat(monthData.transactions);
                    incomeForPdf += parseFloat(monthData.monthlyIncome);
                });
                title = 'All-Time Expense Report';
            }
            generatePDF(title, incomeForPdf, transactionsForPdf);
        });
    }

    function generatePDF(title, income, transactions) {
        alert('Your download is starting...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;
        doc.setFontSize(22);
        doc.text(title, 10, y);
        y += 15;

        const totalCredit = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const totalDebit = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const netExpenses = totalDebit - totalCredit;

        doc.setFontSize(16);
        doc.text(`Total Income / Budget: INR ${income.toFixed(2)}`, 10, y);
        y += 10;
        doc.text(`Net Expenses: INR ${netExpenses.toFixed(2)}`, 10, y);
        y += 10;
        doc.text(`Remaining Balance: INR ${(income - netExpenses).toFixed(2)}`, 10, y);
        y += 15;
        doc.autoTable({
            startY: y,
            head: [['Type', 'Category', 'Amount', 'Date']],
            body: transactions.map(t => [t.type.charAt(0).toUpperCase() + t.type.slice(1), t.category, `INR ${parseFloat(t.amount).toFixed(2)}`, t.date]),
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0] },
        });
        doc.save('expense-report.pdf');
    }

    // ===============================================
    // HELPER FUNCTIONS
    // ===============================================
    function applyFilters(transactions) {
        const filterDate = document.getElementById('filter-date')?.value;
        const filterTypeRadio = document.querySelector('input[name="transaction-type"]:checked');
        const filterType = filterTypeRadio ? filterTypeRadio.value : 'all';
        
        let filtered = [...transactions];
        if (filterDate) {
            filtered = filtered.filter(t => t.date.startsWith(filterDate));
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
        const date = new Date(year, month, 1); // Use month directly, Date handles overflow
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function formatDateToYYYYMMDD(dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function getCurrentDateAsString() {
        const today = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${monthNames[today.getMonth()]} ${today.getDate()} ${today.getFullYear()}`;
    }
    
    function generateColorPalette(numColors) {
        const colors = [];
        for (let i = 0; i < numColors; i++) {
            colors.push(`hsl(${(i * 360 / numColors) % 360}, 80%, 60%)`); 
        }
        return colors;
    }

    // ===============================================
    // APP INITIALIZATION
    // ===============================================
    loadData();
    initializeApp();
});
