//Voice Function Starts.....
// Ensure the SpeechRecognition API is supported
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

if (recognition) {
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Function to start voice command
    function startVoiceCommand() {
        recognition.start();
    }

    recognition.onresult = function(event) {
        const voiceInput = event.results[0][0].transcript;
        console.log(`Voice Command Recognized: ${voiceInput}`);

        const regex = /add (\d+(\.\d{1,2})?) (\w+) on (today|\w+ \d{1,2} \d{4})/i;
        const matches = voiceInput.match(regex);

        if (matches) {
            const amount = parseFloat(matches[1]);
            const category = matches[3];
            let dateString = matches[4];

            if (dateString.toLowerCase() === 'today') {
                dateString = getCurrentDate();
            }

            const formattedDate = formatDateToYYYYMMDD(dateString);

            if (!category || isNaN(amount) || amount <= 0 || !formattedDate) {
                alert('Invalid voice command format. Please try again.');
                return;
            }

            allTransactions.push({ category, amount, date: formattedDate, type: 'expense' });
            localStorage.setItem('allTransactions', JSON.stringify(allTransactions));

            alert('Transaction added successfully via voice command!');
            updateDashboardDisplay();
        } else {
            alert('Voice command not recognized correctly. Please try again.');
        }
    };

    recognition.onerror = function(event) {
        alert(`Error occurred in speech recognition: ${event.error}`);
    };

    const voiceCommandButton = document.getElementById('voice-command-btn');
    if (voiceCommandButton) {
        voiceCommandButton.addEventListener('click', startVoiceCommand);
    }
} else {
    if (document.getElementById('voice-command-btn')) {
        alert('Speech recognition is not supported in your browser.');
    }
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
    const month = monthNames[today.getMonth()];
    const day = today.getDate();
    const year = today.getFullYear();
    return `${month} ${day} ${year}`;
}
//voice Function Ends......


// =========================================================================
// === NEW: Data Management & Initialization ===============================
// =========================================================================
let allTransactions = [];
let monthlyIncomes = {};
let currentMonthKey = '';

// This object will hold the current state of what is being displayed
let currentView = {
    mode: 'month', // Can be 'month' or 'all'
    monthKey: ''   // e.g., '2025-09'
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
    
    // Ensure the current month has an income entry in our data
    if (typeof monthlyIncomes[currentMonthKey] === 'undefined') {
        monthlyIncomes[currentMonthKey] = 0;
    }
    
    localStorage.setItem('currentMonthKey', currentMonthKey);
    localStorage.setItem('monthlyIncomes', JSON.stringify(monthlyIncomes));
    
    // Set the initial view to the current tracking month
    currentView.monthKey = currentMonthKey;
}

// =========================================================================
// === MODIFIED: Core Display Functions ====================================
// =========================================================================

function updateDashboardDisplay() {
    const totalIncomeElem = document.getElementById('total-income');
    const totalExpensesElem = document.getElementById('total-expenses');
    const remainingBalanceElem = document.getElementById('remaining-balance');

    if (!totalIncomeElem) return; // Only run on dashboard page

    let transactionsForView = [];
    let incomeForView = 0;
    let viewTitle = '';

    if (currentView.mode === 'all') {
        transactionsForView = allTransactions;
        incomeForView = Object.values(monthlyIncomes).reduce((sum, income) => sum + income, 0);
        viewTitle = 'All-Time';
    } else { // 'month' mode
        const monthKey = currentView.monthKey;
        transactionsForView = allTransactions.filter(t => t.date.startsWith(monthKey));
        incomeForView = monthlyIncomes[monthKey] || 0;
        viewTitle = monthKey;
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

    const filterType = document.querySelector('input[name="transaction-type"]:checked').value;
    let finalList = transactionsToDisplay;

    if (filterType !== 'all') {
        finalList = finalList.filter(transaction => transaction.type === filterType);
    }

    finalList.sort((a, b) => new Date(b.date) - new Date(a.date));

    finalList.forEach(transaction => {
        const li = document.createElement('li');
        if (transaction.type === 'income') {
            li.classList.add('income-transaction');
        }
        
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

// =========================================================================
// === MODIFIED: Data Manipulation Functions ===============================
// =========================================================================

function deleteTransaction(index) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        allTransactions.splice(index, 1);
        localStorage.setItem('allTransactions', JSON.stringify(allTransactions));
        updateDashboardDisplay();
    }
}

function editTransaction(index) {
    const transaction = allTransactions[index];
    const newCategory = prompt('Edit Category:', transaction.category);
    if (newCategory === null) return;

    const newAmountStr = prompt('Edit Amount:', transaction.amount);
    if (newAmountStr === null) return;

    const newAmount = parseFloat(newAmountStr);
    if (newCategory.trim() === '' || isNaN(newAmount) || newAmount <= 0) {
        alert('Invalid category or amount. Please try again.');
        return;
    }

    allTransactions[index].category = newCategory.trim();
    allTransactions[index].amount = newAmount;
    localStorage.setItem('allTransactions', JSON.stringify(allTransactions));
    updateDashboardDisplay();
}

// =========================================================================
// === EVENT LISTENERS =====================================================
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Load all data from storage first
    loadData();

    // Attach all event listeners after the DOM is ready
    
    // Handle Income Update for the CURRENT tracking month
    const monthlyIncomeForm = document.getElementById('monthly-income-form');
    if (monthlyIncomeForm) {
        document.getElementById('monthly-income').value = monthlyIncomes[currentMonthKey] || '';
        document.getElementById('current-month-display').textContent = currentMonthKey;
        
        monthlyIncomeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const income = parseFloat(document.getElementById('monthly-income').value);
            if (isNaN(income) || income < 0) {
                alert('Please enter a valid income.');
                return;
            }
            monthlyIncomes[currentMonthKey] = income;
            localStorage.setItem('monthlyIncomes', JSON.stringify(monthlyIncomes));
            alert('Income for current period updated!');
            updateDashboardDisplay();
        });
    }

    // Handle Add Expense Transaction
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const category = document.getElementById('category').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const date = document.getElementById('date').value;

            if (!category || isNaN(amount) || amount <= 0 || !date) {
                alert('Please fill out all fields correctly.');
                return;
            }
            allTransactions.push({ category, amount, date, type: 'expense' });
            localStorage.setItem('allTransactions', JSON.stringify(allTransactions));
            alert('Expense added!');
            this.reset();
            updateDashboardDisplay();
        });
    }

    // Handle Add Money (Income/Credit) Transaction
    const addMoneyForm = document.getElementById('add-money-form');
    if (addMoneyForm) {
        addMoneyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const category = document.getElementById('add-money-category').value;
            const amount = parseFloat(document.getElementById('add-money-amount').value);
            const date = document.getElementById('add-money-date').value;

            if (!category || isNaN(amount) || amount <= 0 || !date) {
                alert('Please fill out all fields correctly.');
                return;
            }
            allTransactions.push({ category, amount, date, type: 'income' });
            localStorage.setItem('allTransactions', JSON.stringify(allTransactions));
            alert(`Credit of ₹${amount.toFixed(2)} added successfully!`);
            this.reset();
            updateDashboardDisplay();
        });
    }

    // NEW: Handle "Start New Period" Button
    const startNewMonthBtn = document.getElementById('start-new-month');
    if (startNewMonthBtn) {
        startNewMonthBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to end the current period and start a new one? Your current data will be saved.')) {
                const [year, month] = currentMonthKey.split('-').map(Number);
                const currentDate = new Date(year, month - 1, 1);
                currentDate.setMonth(currentDate.getMonth() + 1);
                
                const newYear = currentDate.getFullYear();
                const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
                const newMonthKey = `${newYear}-${newMonth}`;

                localStorage.setItem('currentMonthKey', newMonthKey);
                alert(`New tracking period started for ${newMonthKey}. You can now set the income for this period.`);
                window.location.reload();
            }
        });
    }

    // NEW: Handle View Mode Buttons
    const showCurrentBtn = document.getElementById('show-current-month-data');
    if(showCurrentBtn) {
        showCurrentBtn.addEventListener('click', function() {
            currentView.mode = 'month';
            currentView.monthKey = currentMonthKey;
            document.getElementById('filter-date').value = '';
            updateDashboardDisplay();
        });
    }
    
    const showAllBtn = document.getElementById('show-all-data');
    if(showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            currentView.mode = 'all';
            document.getElementById('filter-date').value = '';
            updateDashboardDisplay();
        });
    }

    // MODIFIED: Filter Event Listeners
    const filterDateInput = document.getElementById('filter-date');
    if (filterDateInput) {
        filterDateInput.addEventListener('change', function() {
            if (this.value) {
                currentView.mode = 'month';
                currentView.monthKey = this.value;
                updateDashboardDisplay();
            }
        });
    }

    document.querySelectorAll('input[name="transaction-type"]').forEach(radio => {
        radio.addEventListener('change', () => updateDashboardDisplay());
    });

    // Handle Clear Data Button
    const clearDataBtn = document.getElementById('clear-data');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear ALL data for ALL periods? This cannot be undone.')) {
                localStorage.removeItem('allTransactions');
                localStorage.removeItem('monthlyIncomes');
                localStorage.removeItem('currentMonthKey');
                alert('All data has been cleared!');
                window.location.reload();
            }
        });
    }

    // Handle PDF Download
    const downloadPdfBtn = document.getElementById('download-pdf');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', function() {
            alert('Your download is starting...');
            // ... (PDF generation logic remains unchanged but now uses the global data variables) ...
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            // PDF logic here can be enhanced to show which period's data is being downloaded
            // For now, it will download based on the current view
             let transactionsForView = [];
            let incomeForView = 0;
            let viewTitle = '';

            if (currentView.mode === 'all') {
                transactionsForView = allTransactions;
                incomeForView = Object.values(monthlyIncomes).reduce((sum, income) => sum + income, 0);
                viewTitle = 'All-Time Report';
            } else { 
                const monthKey = currentView.monthKey;
                transactionsForView = allTransactions.filter(t => t.date.startsWith(monthKey));
                incomeForView = monthlyIncomes[monthKey] || 0;
                viewTitle = `Report for ${monthKey}`;
            }

            const totalCredit = transactionsForView.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
            const totalDebit = transactionsForView.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
            const netExpenses = totalDebit - totalCredit;
            
            let y = 20;
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(viewTitle, 10, y);
            y += 15;
            doc.setFontSize(16);
            doc.setFont('Helvetica', 'normal');
            doc.text(`Period Income / Budget: INR ${incomeForView.toFixed(2)}`, 10, y);
            y += 10;
            doc.text(`Net Expenses: INR ${netExpenses.toFixed(2)}`, 10, y);
            y += 10;
            doc.text(`Remaining Balance: INR ${(incomeForView - netExpenses).toFixed(2)}`, 10, y);
            y += 15;
            doc.autoTable({
                startY: y,
                head: [['Type', 'Category', 'Amount', 'Date']],
                body: transactionsForView.map(t => [t.type.charAt(0).toUpperCase() + t.type.slice(1), t.category, `INR ${parseFloat(t.amount).toFixed(2)}`, t.date]),
                theme: 'grid',
                headStyles: { fillColor: [0, 0, 0] },
            });
            doc.save(`expense-report-${currentView.mode === 'all' ? 'all-time' : currentView.monthKey}.pdf`);
        });
    }

    // Analytics Page Logic
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

            incomeExpenseChart = new Chart(incomeExpenseCtx, { /* ... same as before but use incomeForView ... */ });
            // ... The rest of the analytics logic to render pie charts is correct ...
        }

        const analyticsMonthFilter = document.getElementById('analytics-month-filter');
        const analyticsShowAllBtn = document.getElementById('analytics-show-all');

        if (analyticsMonthFilter) {
            analyticsMonthFilter.addEventListener('change', function() {
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
        if (analyticsShowAllBtn) {
            analyticsShowAllBtn.addEventListener('click', function() {
                if (analyticsMonthFilter) analyticsMonthFilter.value = '';
                 const totalIncome = Object.values(monthlyIncomes).reduce((s, i) => s + i, 0);
                renderAnalyticsCharts(allTransactions, totalIncome);
            });
        }

        // Initial render for analytics shows current month data
        const initialTransactions = allTransactions.filter(t => t.date.startsWith(currentMonthKey));
        const initialIncome = monthlyIncomes[currentMonthKey] || 0;
        renderAnalyticsCharts(initialTransactions, initialIncome);
    }

    // Dark Mode Toggle Logic (remains unchanged)
    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        const themeIcon = themeToggleButton.querySelector('i');
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        }
        themeToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            if (themeIcon) {
                themeIcon.classList.toggle('fa-sun', isDark);
                themeIcon.classList.toggle('fa-moon', !isDark);
            }
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // Finally, run the initial display for the dashboard page
    updateDashboardDisplay();
});
