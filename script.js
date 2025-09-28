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

            let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
            transactions.push({ category, amount, date: formattedDate, type: 'expense' });
            localStorage.setItem('transactions', JSON.stringify(transactions));

            alert('Transaction added successfully via voice command!');
            updateDashboardDisplay(); // Changed to prevent page reload
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
    alert('Speech recognition is not supported in your browser.');
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

// Initialize localStorage
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let monthlyIncome = parseFloat(localStorage.getItem('monthlyIncome')) || 0;

// =========================================================================
// === CORRECTED FUNCTION ==================================================
// =========================================================================
// Function to update the dashboard display
function updateDashboardDisplay() {
    const totalIncomeElem = document.getElementById('total-income');
    const totalExpensesElem = document.getElementById('total-expenses');
    const remainingBalanceElem = document.getElementById('remaining-balance');

    if (!totalIncomeElem || !totalExpensesElem || !remainingBalanceElem) return;

    // Calculate total of all credits (refunds, etc.)
    const totalCredit = transactions
        .filter(t => t.type === 'income')
        .reduce((acc, transaction) => acc + parseFloat(transaction.amount), 0);

    // Calculate total of all debits (expenses)
    const totalDebit = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, transaction) => acc + parseFloat(transaction.amount), 0);

    // Net expenses are the debits minus the credits
    const netExpenses = totalDebit - totalCredit;

    totalIncomeElem.textContent = monthlyIncome.toFixed(2);
    totalExpensesElem.textContent = netExpenses.toFixed(2);
    remainingBalanceElem.textContent = (monthlyIncome - netExpenses).toFixed(2);

    // Refresh the transaction list if it's on the page
    if (document.getElementById('transaction-list')) {
         displayTransactions();
    }
}

function displayTransactions(filterDate = null) {
    const transactionList = document.getElementById('transaction-list');
    if (!transactionList) return;
    transactionList.innerHTML = '';

    let currentTransactions = JSON.parse(localStorage.getItem('transactions')) || [];
    let filteredTransactions = currentTransactions;

    if (filterDate) {
        const [year, month] = filterDate.split('-');
        filteredTransactions = currentTransactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getFullYear() === parseInt(year) && transactionDate.getMonth() === parseInt(month) - 1;
        });
    }

    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTransactions.forEach(transaction => {
        const li = document.createElement('li');
        if (transaction.type === 'income') {
            li.classList.add('income-transaction');
        }
        const originalTransaction = findOriginalTransaction(transaction);
        const originalIndex = transactions.indexOf(originalTransaction);

        li.innerHTML = `
            <span>${transaction.category}: ₹${parseFloat(transaction.amount).toFixed(2)} on ${transaction.date}</span>
            <div class="button-container">
            <button class="edit-button" onclick="editTransaction(${originalIndex})"><i class="fas fa-edit"></i></button>
            <button class="delete-button" onclick="deleteTransaction(${originalIndex})"><i class="fas fa-trash-alt"></i></button>
            </div>`;
        transactionList.appendChild(li);
    });
}

function findOriginalTransaction(transactionToFind) {
    return transactions.find(t =>
        t.date === transactionToFind.date &&
        t.amount == transactionToFind.amount &&
        t.category === transactionToFind.category &&
        t.type === transactionToFind.type
    );
}

// =========================================================================
// === CORRECTED FUNCTION ==================================================
// =========================================================================
function deleteTransaction(index) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        // REMOVED the logic that incorrectly changed the 'monthlyIncome'
        transactions.splice(index, 1);
        localStorage.setItem('transactions', JSON.stringify(transactions));
        updateDashboardDisplay();
    }
}

function editTransaction(index) {
    const transaction = transactions[index];
    if (transaction.type === 'income') {
        alert("Income categories cannot be edited, only deleted.");
        return;
    }
    const categoryInput = prompt('Edit Category:', transaction.category);
    if (categoryInput && categoryInput.trim() !== '') {
        transactions[index].category = categoryInput;
        localStorage.setItem('transactions', JSON.stringify(transactions));
        updateDashboardDisplay();
    }
}

// Handle Income Update (This is the ONLY place that should change the 'Total Income' field)
if (document.getElementById('monthly-income-form')) {
    document.getElementById('monthly-income-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const income = parseFloat(document.getElementById('monthly-income').value);
        if (isNaN(income) || income < 0) { // Allow 0
            alert('Please enter a valid income.');
            return;
        }
        monthlyIncome = income;
        localStorage.setItem('monthlyIncome', monthlyIncome);
        alert('Total Income/Budget updated!');
        updateDashboardDisplay();
    });
}

// Handle Add Expense Transaction
if (document.getElementById('transaction-form')) {
    document.getElementById('transaction-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const category = document.getElementById('category').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const date = document.getElementById('date').value;

        if (!category || isNaN(amount) || amount <= 0 || !date) {
            alert('Please fill out all fields correctly.');
            return;
        }
        transactions.push({ category, amount, date, type: 'expense' });
        localStorage.setItem('transactions', JSON.stringify(transactions));
        alert('Expense added!');
        document.getElementById('transaction-form').reset();
        updateDashboardDisplay();
    });
}

// =========================================================================
// === CORRECTED FUNCTION ==================================================
// =========================================================================
// Handle Add Money (Income/Credit) Transaction
if (document.getElementById('add-money-form')) {
    document.getElementById('add-money-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const category = document.getElementById('add-money-category').value;
        const amount = parseFloat(document.getElementById('add-money-amount').value);
        const date = document.getElementById('add-money-date').value;

        if (!category || isNaN(amount) || amount <= 0 || !date) {
            alert('Please fill out all fields correctly.');
            return;
        }

        // REMOVED the lines that incorrectly updated the total income. This was the bug.
        // monthlyIncome += amount;
        // localStorage.setItem('monthlyIncome', monthlyIncome);

        transactions.push({ category: category, amount: amount, date: date, type: 'income' });
        localStorage.setItem('transactions', JSON.stringify(transactions));
        alert(`Credit of ₹${amount.toFixed(2)} added successfully!`);
        document.getElementById('add-money-form').reset();
        updateDashboardDisplay();
    });
}

// Other event handlers
if (document.getElementById('filter-date')) {
    document.getElementById('filter-date').addEventListener('change', function() {
        displayTransactions(this.value);
    });
}
if (document.getElementById('show-all')) {
    document.getElementById('show-all').addEventListener('click', function() {
        displayTransactions();
    });
}
if (document.getElementById('clear-data')) {
    document.getElementById('clear-data').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all data?')) {
            localStorage.removeItem('transactions');
            localStorage.removeItem('monthlyIncome');
            transactions = [];
            monthlyIncome = 0;
            updateDashboardDisplay();
            alert('Data cleared!');
        }
    });
}
if (document.getElementById('download-pdf')) {
    document.getElementById('download-pdf').addEventListener('click', function() {
        alert('Your download is starting...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Expense Tracker Report', 10, y);
        y += 15;
        
        const totalCredit = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const totalDebit = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const netExpenses = totalDebit - totalCredit;

        doc.setFontSize(16);
        doc.setFont('Helvetica', 'normal');
        doc.text(`Total Income / Budget: INR ${monthlyIncome.toFixed(2)}`, 10, y);
        y += 10;
        doc.text(`Total Expenses: INR ${netExpenses.toFixed(2)}`, 10, y);
        y += 10;
        doc.text(`Remaining Balance: INR ${(monthlyIncome - netExpenses).toFixed(2)}`, 10, y);
        y += 15;
        doc.autoTable({
            startY: y,
            head: [['Type', 'Category', 'Amount', 'Date']],
            body: transactions.map(t => [t.type.charAt(0).toUpperCase() + t.type.slice(1), t.category, `INR ${parseFloat(t.amount).toFixed(2)}`, t.date]),
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0] },
            styles: { fontSize: 12, cellPadding: 5 },
            margin: { top: 10 },
        });
        doc.save('expense-report.pdf');
    });
}

// Initial Dashboard Load
if (document.getElementById('total-income')) {
    updateDashboardDisplay();
}

function generateColorPalette(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const hue = (i * 360 / numColors) % 360;
        colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
}

// Analytics Page Logic
if (document.getElementById('incomeExpenseChart') && document.getElementById('expenseCategoryChart')) {
    let incomeExpenseChart, expenseCategoryChart;
    const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
    const expenseCategoryCtx = document.getElementById('expenseCategoryChart').getContext('2d');

    function renderAnalyticsCharts(dataToDisplay) {
        if (incomeExpenseChart) incomeExpenseChart.destroy();
        if (expenseCategoryChart) expenseCategoryChart.destroy();
        
        const totalCredit = dataToDisplay.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const totalDebit = dataToDisplay.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const netExpenses = totalDebit - totalCredit;

        incomeExpenseChart = new Chart(incomeExpenseCtx, {
            type: 'bar',
            data: {
                labels: ['Total Income', 'Total Expenses'],
                datasets: [{ label: 'Amount (₹)', data: [monthlyIncome, netExpenses], backgroundColor: ['#28a745', '#dc3545'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
        
        const expenseData = dataToDisplay.filter(t => t.type === 'expense');
        const categories = [...new Set(expenseData.map(t => t.category))];
        const categoryData = categories.map(cat => expenseData.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0));
        
        expenseCategoryChart = new Chart(expenseCategoryCtx, {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{ label: 'Expenses by Category', data: categoryData, backgroundColor: generateColorPalette(categories.length) }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const monthFilter = document.getElementById('analytics-month-filter');
    const showAllBtn = document.getElementById('analytics-show-all');
    if (monthFilter) {
        monthFilter.addEventListener('change', function() {
            const selectedMonth = this.value;
            if (selectedMonth) {
                const [year, month] = selectedMonth.split('-');
                const filteredData = transactions.filter(t => {
                    const transactionDate = new Date(t.date);
                    return transactionDate.getFullYear() === parseInt(year) && transactionDate.getMonth() === parseInt(month) - 1;
                });
                renderAnalyticsCharts(filteredData);
            } else {
                renderAnalyticsCharts(transactions);
            }
        });
    }
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            if(monthFilter) monthFilter.value = '';
            renderAnalyticsCharts(transactions);
        });
    }
    
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            transactions = JSON.parse(localStorage.getItem('transactions')) || [];
            monthlyIncome = parseFloat(localStorage.getItem('monthlyIncome')) || 0;
            if(monthFilter) monthFilter.value = '';
            renderAnalyticsCharts(transactions);
        }
    });
    
    renderAnalyticsCharts(transactions);
}

// Dark Mode Toggle Logic
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
