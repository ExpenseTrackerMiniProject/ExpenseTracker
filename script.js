document.addEventListener('DOMContentLoaded', () => {
    // Global state - all transactions are stored here
    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

    // =========================================================================
    // === CORE LOGIC: DATA MANAGEMENT & DISPLAY =============================
    // =========================================================================
    
    /**
     * Determines which month to show data for. Defaults to the current month.
     * A value of 'all' means show all data.
     */
    function getMonthToShow() {
        const savedMonth = localStorage.getItem('selectedMonth');
        if (savedMonth) {
            return savedMonth;
        }
        // Default to the current month if nothing is saved
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Filters the global transactions array based on a month string (e.g., "2025-09").
     */
    function filterTransactionsByMonth(month) {
        if (!month || month === 'all') {
            return transactions; // Return all transactions
        }
        const [year, monthNum] = month.split('-');
        return transactions.filter(t => {
            // Slicing the date string is more reliable than new Date() for YYYY-MM-DD format
            return t.date.startsWith(`${year}-${monthNum}`);
        });
    }

    /**
     * This is the main function that updates the entire UI based on the selected month.
     */
    function updateUI() {
        const month = getMonthToShow();
        const dataForView = filterTransactionsByMonth(month);

        // Update the title that shows the current viewing period
        const viewTitle = document.getElementById('current-view-title');
        if (viewTitle) {
            if (month === 'all') {
                viewTitle.textContent = "Displaying: All Transactions";
            } else {
                const [year, monthNum] = month.split('-');
                const date = new Date(year, monthNum - 1);
                const monthName = date.toLocaleString('default', { month: 'long' });
                viewTitle.textContent = `Displaying: ${monthName} ${year}`;
            }
        }
        
        // Update components if they exist on the current page
        if (document.getElementById('transaction-list')) {
            updateDashboardDisplay(dataForView);
            displayTransactions(dataForView);
        }
        if (document.getElementById('incomeExpenseChart')) {
            renderAnalyticsCharts(dataForView);
        }
    }

    // =========================================================================
    // === DASHBOARD SPECIFIC FUNCTIONS ======================================
    // =========================================================================
    
    function updateDashboardDisplay(data) {
        const totalIncomeElem = document.getElementById('total-income');
        const totalExpensesElem = document.getElementById('total-expenses');
        const remainingBalanceElem = document.getElementById('remaining-balance');

        if (!totalIncomeElem) return;

        const monthlyIncome = data.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const monthlyExpenses = data.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        
        totalIncomeElem.textContent = monthlyIncome.toFixed(2);
        totalExpensesElem.textContent = monthlyExpenses.toFixed(2);
        remainingBalanceElem.textContent = (monthlyIncome - monthlyExpenses).toFixed(2);
    }

    function displayTransactions(data) {
        const transactionList = document.getElementById('transaction-list');
        transactionList.innerHTML = '';
        
        data.sort((a, b) => new Date(b.date) - new Date(a.date));

        data.forEach(transaction => {
            const li = document.createElement('li');
            if (transaction.type === 'income') {
                li.classList.add('income-transaction');
            }

            // Find the transaction's index in the original, unfiltered array for editing/deleting
            const originalIndex = transactions.findIndex(t => t === transaction);

            li.innerHTML = `
                <span>${transaction.category}: ₹${parseFloat(transaction.amount).toFixed(2)} on ${transaction.date}</span>
                <div class="button-container">
                    <button class="edit-button" onclick="editTransaction(${originalIndex})"><i class="fas fa-edit"></i></button>
                    <button class="delete-button" onclick="deleteTransaction(${originalIndex})"><i class="fas fa-trash-alt"></i></button>
                </div>`;
            transactionList.appendChild(li);
        });
    }
    
    // =========================================================================
    // === ANALYTICS SPECIFIC FUNCTIONS ======================================
    // =========================================================================
    let incomeExpenseChart, incomeCategoryChart, expenseCategoryChart;

    function renderAnalyticsCharts(data) {
        if (incomeExpenseChart) incomeExpenseChart.destroy();
        if (incomeCategoryChart) incomeCategoryChart.destroy();
        if (expenseCategoryChart) expenseCategoryChart.destroy();

        const monthlyIncome = data.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const monthlyExpenses = data.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        
        // --- Bar Chart ---
        const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
        incomeExpenseChart = new Chart(incomeExpenseCtx, {
            type: 'bar',
            data: {
                labels: ['Total Income', 'Total Expenses'],
                datasets: [{
                    label: 'Amount (₹)',
                    data: [monthlyIncome, monthlyExpenses],
                    backgroundColor: ['#28a745', '#dc3545'],
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // --- Income Pie Chart ---
        const incomeCtx = document.getElementById('incomeCategoryChart').getContext('2d');
        const incomeData = data.filter(t => t.type === 'income');
        const incomeCategories = [...new Set(incomeData.map(t => t.category))];
        const incomeCategoryData = incomeCategories.map(cat => 
            incomeData.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0)
        );
        incomeCategoryChart = new Chart(incomeCtx, {
            type: 'pie',
            data: {
                labels: incomeCategories,
                datasets: [{
                    label: 'Income by Category',
                    data: incomeCategoryData,
                    backgroundColor: generateColorPalette(incomeCategories.length, 'green'),
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // --- Expense Pie Chart ---
        const expenseCtx = document.getElementById('expenseCategoryChart').getContext('2d');
        const expenseData = data.filter(t => t.type === 'expense');
        const expenseCategories = [...new Set(expenseData.map(t => t.category))];
        const expenseCategoryData = expenseCategories.map(cat => 
            expenseData.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0)
        );
        expenseCategoryChart = new Chart(expenseCtx, {
            type: 'pie',
            data: {
                labels: expenseCategories,
                datasets: [{
                    label: 'Expenses by Category',
                    data: expenseCategoryData,
                    backgroundColor: generateColorPalette(expenseCategories.length, 'red'),
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // =========================================================================
    // === TRANSACTION MANAGEMENT (Add, Edit, Delete) ========================
    // =========================================================================
    
    // Make functions globally accessible for inline HTML onclick attributes
    window.editTransaction = function(index) {
        const transaction = transactions[index];
        const newCategory = prompt('Edit Category:', transaction.category);
        if (newCategory && newCategory.trim() !== '') {
            transactions[index].category = newCategory;
            localStorage.setItem('transactions', JSON.stringify(transactions));
            updateUI();
        }
    };

    window.deleteTransaction = function(index) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            transactions.splice(index, 1);
            localStorage.setItem('transactions', JSON.stringify(transactions));
            updateUI();
        }
    };
    
    // --- Add Expense Form ---
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const category = document.getElementById('category').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const date = document.getElementById('date').value;

            if (!category || isNaN(amount) || amount <= 0 || !date) return alert('Please fill out all fields correctly.');
            
            transactions.push({ category, amount, date, type: 'expense' });
            localStorage.setItem('transactions', JSON.stringify(transactions));
            alert('Expense added!');
            transactionForm.reset();
        });
    }

    // --- Add Income Form ---
    const addMoneyForm = document.getElementById('add-money-form');
    if (addMoneyForm) {
        addMoneyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const category = document.getElementById('add-money-category').value;
            const amount = parseFloat(document.getElementById('add-money-amount').value);
            const date = document.getElementById('add-money-date').value;

            if (!category || isNaN(amount) || amount <= 0 || !date) return alert('Please fill out all fields correctly.');
            
            transactions.push({ category, amount, date, type: 'income' });
            localStorage.setItem('transactions', JSON.stringify(transactions));
            alert('Income added!');
            addMoneyForm.reset();
        });
    }
    
    // =========================================================================
    // === EVENT LISTENERS & INITIALIZATION ==================================
    // =========================================================================

    // --- Universal Filter Handlers ---
    function setupFilterListeners(filterId, showAllId) {
        const monthFilter = document.getElementById(filterId);
        const showAllBtn = document.getElementById(showAllId);
        
        if (!monthFilter) return;

        monthFilter.value = getMonthToShow() === 'all' ? '' : getMonthToShow();

        monthFilter.addEventListener('change', function() {
            if (this.value) {
                localStorage.setItem('selectedMonth', this.value);
            } else {
                 // If filter is cleared, default to current month
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                localStorage.setItem('selectedMonth', `${year}-${month}`);
            }
            updateUI();
        });

        showAllBtn.addEventListener('click', function() {
            localStorage.setItem('selectedMonth', 'all');
            monthFilter.value = '';
            updateUI();
        });
    }

    setupFilterListeners('filter-date', 'show-all'); // For Dashboard
    setupFilterListeners('analytics-month-filter', 'analytics-show-all'); // For Analytics

    // --- Clear All Data Button ---
    const clearDataBtn = document.getElementById('clear-data');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function () {
            if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
                localStorage.removeItem('transactions');
                localStorage.removeItem('selectedMonth');
                transactions = [];
                updateUI();
                alert('All data cleared!');
            }
        });
    }

    // --- Theme Toggle ---
    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggleButton.querySelector('i').classList.replace('fa-moon', 'fa-sun');
        }
        themeToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            themeToggleButton.querySelector('i').classList.toggle('fa-sun', isDark);
            themeToggleButton.querySelector('i').classList.toggle('fa-moon', !isDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }
    
    // --- Utility Functions ---
    function generateColorPalette(numColors, baseColor) {
        const colors = [];
        let startHue = baseColor === 'green' ? 80 : 360; // Green tones vs Red/Blue tones
        for (let i = 0; i < numColors; i++) {
            const hue = (startHue + (i * 40)) % 360;
            const saturation = 50 + (i * 5);
            const lightness = 45;
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
        return colors;
    }

    // Initial call to render the page correctly on load
    updateUI();
});
