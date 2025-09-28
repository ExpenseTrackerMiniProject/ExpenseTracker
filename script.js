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

        // Regex pattern to capture the transaction format, including "today"
        const regex = /add (\d+(\.\d{1,2})?) (\w+) on (today|\w+ \d{1,2} \d{4})/i;
        const matches = voiceInput.match(regex);

        if (matches) {
            const amount = parseFloat(matches[1]);
            const category = matches[3];
            let dateString = matches[4];

            console.log(`Amount: ${amount}, Category: ${category}, Date: ${dateString}`);

            // If the date is "today", replace it with the actual current date
            if (dateString.toLowerCase() === 'today') {
                dateString = getCurrentDate();
            }

            // Format the date to YYYY-MM-DD (numeric format)
            const formattedDate = formatDateToYYYYMMDD(dateString);

            // Validate the data
            if (!category || isNaN(amount) || amount <= 0 || !formattedDate) {
                alert('Invalid voice command format. Please try again.');
                return;
            }

            // Store the transaction (you may want to store this in localStorage or an array)
            let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
            // MODIFIED: Added type property
            transactions.push({ category, amount, date: formattedDate, type: 'expense' });
            localStorage.setItem('transactions', JSON.stringify(transactions));

            // Notify the user and update the dashboard
            alert('Transaction added successfully via voice command!');
            updateDashboard();
        } else {
            alert('Voice command not recognized correctly. Please try again.');
        }
    };

    recognition.onerror = function(event) {
        alert(`Error occurred in speech recognition: ${event.error}`);
    };

    // Add an event listener to the button
    const voiceCommandButton = document.getElementById('voice-command-btn');
    if (voiceCommandButton) {
        voiceCommandButton.addEventListener('click', startVoiceCommand);
    }
} else {
    alert('Speech recognition is not supported in your browser.');
}

// Function to format date to YYYY-MM-DD
function formatDateToYYYYMMDD(dateString) {
    const dateParts = dateString.split(' '); // Split by space (e.g., "October 12 2024")
    
    // Month names to numbers
    const monthNames = {
        "January": "01", "February": "02", "March": "03", "April": "04",
        "May": "05", "June": "06", "July": "07", "August": "08", "September": "09",
        "October": "10", "November": "11", "December": "12"
    };

    const month = monthNames[dateParts[0]];
    const day = String(dateParts[1]).padStart(2, '0'); // Ensure day is 2 digits
    const year = dateParts[2];

    return `${year}-${month}-${day}`;
}

// Function to get the current date in "Month Day Year" format (e.g., "October 12 2024")
function getCurrentDate() {
    const today = new Date();
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const month = monthNames[today.getMonth()];
    const day = today.getDate();
    const year = today.getFullYear();

    return `${month} ${day} ${year}`;
}

// Function to update the dashboard (optional)
function updateDashboard() {
    console.log('Updating dashboard with new transactions...');
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
        window.location.reload();
    }
}
//voice Function Ends......



// Initialize localStorage
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let monthlyIncome = parseFloat(localStorage.getItem('monthlyIncome')) || 0;

// Function to update the dashboard display
function updateDashboardDisplay() {
    const totalIncomeElem = document.getElementById('total-income');
    const totalExpensesElem = document.getElementById('total-expenses');
    const remainingBalanceElem = document.getElementById('remaining-balance');

    if (!totalIncomeElem || !totalExpensesElem || !remainingBalanceElem) return;

    // Expenses are now only transactions of type 'expense'
    let totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, transaction) => acc + parseFloat(transaction.amount), 0);

    totalIncomeElem.textContent = monthlyIncome.toFixed(2);
    totalExpensesElem.textContent = totalExpenses.toFixed(2);
    remainingBalanceElem.textContent = (monthlyIncome - totalExpenses).toFixed(2);

    displayTransactions();
}

// Function to display transactions with scrolling enabled
function displayTransactions(filterDate = null) {
    const transactionList = document.getElementById('transaction-list');
    if (!transactionList) return;
    transactionList.innerHTML = '';

    let filteredTransactions = transactions;

    if (filterDate) {
        const [year, month] = filterDate.split('-');
        filteredTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getFullYear() === parseInt(year) && transactionDate.getMonth() === parseInt(month) - 1;
        });
    }

    // Sort transactions by date so income and expenses are chronological
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTransactions.forEach((transaction, index) => {
        const li = document.createElement('li');
        
        // MODIFIED: Add a class if the transaction is of type 'income'
        if (transaction.type === 'income') {
            li.classList.add('income-transaction');
        }

        li.innerHTML = `
            <span>${transaction.category}: ₹${transaction.amount.toFixed(2)} on ${transaction.date}</span>
            <div class="button-container">
            <button class="edit-button" onclick="editTransaction(${index})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-button" onclick="deleteTransaction(${index})">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
        transactionList.appendChild(li);
    });
}

// Function to delete a transaction
function deleteTransaction(index) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        // Find the actual index in the global transactions array
        const transactionToDelete = transactions.find(t => t.date === transactions[index].date && t.amount === transactions[index].amount);
        const globalIndex = transactions.indexOf(transactionToDelete);

        // If it was an income transaction, we must also reduce the total income
        if (transactions[globalIndex].type === 'income') {
            monthlyIncome -= transactions[globalIndex].amount;
            localStorage.setItem('monthlyIncome', monthlyIncome);
        }

        transactions.splice(globalIndex, 1);
        localStorage.setItem('transactions', JSON.stringify(transactions));
        updateDashboardDisplay();
    }
}

function editTransaction(index) {
    const transaction = transactions[index];

    // Prevent editing of 'Income' category
    if (transaction.type === 'income') {
        alert("Income transactions cannot be edited, only deleted.");
        return;
    }

    const categoryInput = prompt('Edit Category:', transaction.category);

    if (categoryInput && categoryInput.trim() !== '') {
        transactions[index].category = categoryInput;
        localStorage.setItem('transactions', JSON.stringify(transactions));
        updateDashboardDisplay();
    }
}



// Handle Income Update (Dashboard Page)
if (document.getElementById('monthly-income-form')) {
    document.getElementById('monthly-income-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const income = parseFloat(document.getElementById('monthly-income').value);
        if (isNaN(income) || income <= 0) {
            alert('Please enter a valid income.');
            return;
        }
        monthlyIncome = income;
        localStorage.setItem('monthlyIncome', monthlyIncome);
        alert('Income updated!');
        updateDashboardDisplay();
    });
}

// Handle Add Expense Transaction (Add Transaction Page)
if (document.getElementById('transaction-form')) {
    document.getElementById('transaction-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const category = document.getElementById('category').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const date = document.getElementById('date').value;

        if (!category || isNaN(amount) || amount <= 0 || !date) {
            alert('Please fill out all fields correctly.');
            return;
        }

        // MODIFIED: Added type property
        transactions.push({ category, amount, date, type: 'expense' });
        localStorage.setItem('transactions', JSON.stringify(transactions));

        alert('Expense added!');
        document.getElementById('transaction-form').reset();
    });
}

// NEW: Handle Add Money (Income) Transaction
if (document.getElementById('add-money-form')) {
    document.getElementById('add-money-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const amountInput = document.getElementById('add-money-amount');
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount to add.');
            return;
        }

        // 1. Add amount to the total income
        monthlyIncome += amount;
        localStorage.setItem('monthlyIncome', monthlyIncome);

        // 2. Create a transaction record for this income
        const today = new Date().toISOString().slice(0, 10); // Format as YYYY-MM-DD
        transactions.push({
            category: 'Income',
            amount: amount,
            date: today,
            type: 'income' // Mark this as an income transaction
        });
        localStorage.setItem('transactions', JSON.stringify(transactions));

        alert(`₹${amount.toFixed(2)} added to your balance successfully!`);
        document.getElementById('add-money-form').reset();
    });
}

// Handle Filter Transactions (Dashboard Page)
if (document.getElementById('filter-date')) {
    document.getElementById('filter-date').addEventListener('change', function () {
        const filterDate = this.value;
        displayTransactions(filterDate);
    });
}

// Handle Show All Transactions (Dashboard Page)
if (document.getElementById('show-all')) {
    document.getElementById('show-all').addEventListener('click', function () {
        displayTransactions();
    });
}

// Handle Clear Data (Dashboard Page)
if (document.getElementById('clear-data')) {
    document.getElementById('clear-data').addEventListener('click', function () {
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

// Handle Download PDF (Dashboard Page)
if (document.getElementById('download-pdf')) {
    document.getElementById('download-pdf').addEventListener('click', function () {
        alert('Your download is starting...');
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jsPDF is not loaded.');
            return;
        }
        const doc = new jsPDF();
        let y = 20;
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Expense Tracker Report', 10, y);
        y += 15;
        const totalExpenses = transactions.filter(t=>t.type==='expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const formattedIncome = `INR ${monthlyIncome.toFixed(2)}`;
        doc.setFontSize(16);
        doc.setFont('Helvetica', 'normal');
        doc.text(`Total Income: ${formattedIncome}`, 10, y);
        y += 10;
        const formattedExpenses = `INR ${totalExpenses.toFixed(2)}`;
        doc.text(`Total Expenses: ${formattedExpenses}`, 10, y);
        y += 10;
        const remainingBalance = (monthlyIncome - totalExpenses).toFixed(2);
        const formattedBalance = `INR ${remainingBalance}`;
        doc.text(`Remaining Balance: ${formattedBalance}`, 10, y);
        y += 15;
        doc.autoTable({
            startY: y,
            head: [['Type', 'Category', 'Amount', 'Date']],
            body: transactions.map(t => [
                t.type.charAt(0).toUpperCase() + t.type.slice(1), // Capitalize type
                t.category,
                `INR ${parseFloat(t.amount).toFixed(2)}`,
                t.date
            ]),
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
    
    let incomeExpenseChart;
    let expenseCategoryChart;

    const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
    const expenseCategoryCtx = document.getElementById('expenseCategoryChart').getContext('2d');

    function renderAnalyticsCharts(dataToDisplay) {
        if (incomeExpenseChart) incomeExpenseChart.destroy();
        if (expenseCategoryChart) expenseCategoryChart.destroy();

        const totalExpenses = dataToDisplay.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.amount), 0);
        
        incomeExpenseChart = new Chart(incomeExpenseCtx, {
            type: 'bar',
            data: {
                labels: ['Total Income', 'Total Expenses'],
                datasets: [{
                    label: 'Amount (₹)',
                    data: [monthlyIncome, totalExpenses],
                    backgroundColor: ['#28a745', '#dc3545'],
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // Pie chart should only show expenses
        const expenseData = dataToDisplay.filter(t => t.type === 'expense');
        const categories = expenseData.map(t => t.category);
        const uniqueCategories = [...new Set(categories)];
        const categoryData = uniqueCategories.map(cat => 
            expenseData.filter(t => t.category === cat)
                       .reduce((acc, t) => acc + parseFloat(t.amount), 0)
        );
        const dynamicColors = generateColorPalette(uniqueCategories.length);

        expenseCategoryChart = new Chart(expenseCategoryCtx, {
            type: 'pie',
            data: {
                labels: uniqueCategories,
                datasets: [{
                    label: 'Expenses by Category',
                    data: categoryData,
                    backgroundColor: dynamicColors,
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const monthFilter = document.getElementById('analytics-month-filter');
    const showAllBtn = document.getElementById('analytics-show-all');

    monthFilter.addEventListener('change', function() {
        const selectedMonth = this.value;
        if (selectedMonth) {
            const [year, month] = selectedMonth.split('-');
            const filteredData = transactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate.getFullYear() === parseInt(year) && 
                       transactionDate.getMonth() === parseInt(month) - 1;
            });
            renderAnalyticsCharts(filteredData);
        } else {
            renderAnalyticsCharts(transactions);
        }
    });

    showAllBtn.addEventListener('click', function() {
        monthFilter.value = '';
        renderAnalyticsCharts(transactions);
    });
    
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            console.log("Page loaded from cache. Refreshing data.");
            transactions = JSON.parse(localStorage.getItem('transactions')) || [];
            monthlyIncome = parseFloat(localStorage.getItem('monthlyIncome')) || 0;
            monthFilter.value = '';
            renderAnalyticsCharts(transactions);
        }
    });

    renderAnalyticsCharts(transactions);
}


// Dark Mode Toggle Logic
const themeToggleButton = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if(themeIcon) {
       themeIcon.classList.remove('fa-moon');
       themeIcon.classList.add('fa-sun');
    }
}

if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        themeIcon.classList.toggle('fa-sun');
        themeIcon.classList.toggle('fa-moon');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });
}
