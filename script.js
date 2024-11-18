
// Initialize localStorage
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let monthlyIncome = parseFloat(localStorage.getItem('monthlyIncome')) || 0;

// Function to update the dashboard
function updateDashboard() {
    const totalIncomeElem = document.getElementById('total-income');
    const totalExpensesElem = document.getElementById('total-expenses');
    const remainingBalanceElem = document.getElementById('remaining-balance');

    // Check if the dashboard elements exist before updating
    if (!totalIncomeElem || !totalExpensesElem || !remainingBalanceElem) return;

    let totalExpenses = transactions.reduce((acc, transaction) => acc + parseFloat(transaction.amount), 0);

    totalIncomeElem.textContent = monthlyIncome.toFixed(2); // Ensure to format the income
    totalExpensesElem.textContent = totalExpenses.toFixed(2); // Format expenses
    remainingBalanceElem.textContent = (monthlyIncome - totalExpenses).toFixed(2);

    displayTransactions();
}

// Function to display transactions with scrolling enabled
function displayTransactions(filterDate = null) {
    const transactionList = document.getElementById('transaction-list');
    transactionList.innerHTML = '';

    let filteredTransactions = transactions;

    if (filterDate) {
        const [year, month] = filterDate.split('-');
        filteredTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getFullYear() === parseInt(year) && transactionDate.getMonth() === parseInt(month) - 1;
        });
    }

    filteredTransactions.forEach((transaction, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${transaction.category}: ₹${transaction.amount} on ${transaction.date}</span>
            <div class="button-container">
            <button class="edit-button" onclick="editTransaction(${index})">
                <i class="fas fa-edit"></i> <!-- Edit icon inside button -->
            </button>

            <button class="delete-button" onclick="deleteTransaction(${index})">
                <i class="fas fa-trash-alt"></i> <!-- Trash icon inside button -->
            </button>
        </div>
    `;
        transactionList.appendChild(li);
    });
}

// Function to delete a transaction
function deleteTransaction(index) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        transactions.splice(index, 1);
        localStorage.setItem('transactions', JSON.stringify(transactions));
        updateDashboard();
    }
}

function editTransaction(index) {
    // Get the transaction to be edited
    const transaction = transactions[index];

    // Only prompt the user to edit the category
    const categoryInput = prompt('Edit Category:', transaction.category);

    // Validate the input
    if (categoryInput && categoryInput !== transaction.category) {
        // Update the transaction with the new category value
        transactions[index].category = categoryInput;

        // Save the updated transactions array to localStorage
        localStorage.setItem('transactions', JSON.stringify(transactions));

        // Update the dashboard with new transaction data
        updateDashboard();
    } else if (categoryInput === null) {
        // If user cancels the prompt, don't do anything
        return;
    } else {
        alert('Please provide a valid category.');
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
        updateDashboard();
    });
}

// Handle Add Transaction (Add Transaction Page)
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

        transactions.push({ category, amount, date });
        localStorage.setItem('transactions', JSON.stringify(transactions));

        alert('Transaction added!');
        document.getElementById('transaction-form').reset();

        // Only update dashboard if we are on the dashboard page
        if (document.getElementById('total-income')) {
            updateDashboard();
        }
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

            updateDashboard();
            alert('Data cleared!');
        }
    });
}

// Handle Download PDF (Dashboard Page)
if (document.getElementById('download-pdf')) {
    document.getElementById('download-pdf').addEventListener('click', function () {
        // Notify user that download is starting
        alert('Your download is starting...');

        // Check if jsPDF and autoTable are loaded
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jsPDF is not loaded.');
            return;
        }

        // Create a new PDF document
        const doc = new jsPDF();
        let y = 20; // Start Y position

        // Title
        doc.setFontSize(22);
        doc.setFont('Helvetica', 'bold');
        doc.text('Expense Tracker Report', 10, y);
        y += 15;

        // Monthly Income
        const formattedIncome = `₹ ${monthlyIncome.toFixed(2)}`; // Space added after currency symbol
        doc.setFontSize(16);
        doc.setFont('Helvetica', 'normal');
        doc.text(`Monthly Income: ${formattedIncome}`, 10, y);
        y += 10;

        // Total Expenses
        const totalExpenses = transactions.reduce((acc, t) => acc + parseFloat(t.amount), 0);
        const formattedExpenses = `₹ ${totalExpenses.toFixed(2)}`; // Space added after currency symbol
        doc.text(`Total Expenses: ${formattedExpenses}`, 10, y);
        y += 10;

        // Remaining Balance
        const remainingBalance = (monthlyIncome - totalExpenses).toFixed(2);
        const formattedBalance = `₹ ${remainingBalance}`; // Space added after currency symbol
        doc.text(`Remaining Balance: ${formattedBalance}`, 10, y);
        y += 15;

        // Transactions Table
        doc.autoTable({
            startY: y,
            head: [['Category', 'Amount', 'Date']],
            body: transactions.map(t => [
                t.category,
                `₹ ${parseFloat(t.amount).toFixed(2)}`, // Space added after currency symbol
                t.date
            ]),
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0] }, // Black header background
            styles: { fontSize: 12, cellPadding: 5 },
            margin: { top: 10 },
            didDrawPage: function (data) {
                doc.setFontSize(10);
                doc.text('Page ' + data.pageNumber, 10, doc.internal.pageSize.height - 10);
            }
        });

        // Save the document
        doc.save('expense-report.pdf');
    });
}


// Initial Dashboard Load
if (document.getElementById('total-income')) {
    updateDashboard();
}

// Analytics Setup using Chart.js
if (document.getElementById('incomeExpenseChart') && document.getElementById('expenseCategoryChart')) {
    const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
    const expenseCategoryCtx = document.getElementById('expenseCategoryChart').getContext('2d');

    // Chart for Income vs Expenses
    const incomeExpenseChart = new Chart(incomeExpenseCtx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
                label: 'Amount (₹)',
                data: [monthlyIncome, transactions.reduce((acc, t) => acc + parseFloat(t.amount), 0)],
                backgroundColor: ['#007bff', '#dc3545'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Chart for Expense Categories
    const categories = transactions.map(t => t.category);
    const uniqueCategories = [...new Set(categories)];
    const categoryData = uniqueCategories.map(cat => transactions.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0));

    const expenseCategoryChart = new Chart(expenseCategoryCtx, {
        type: 'pie',
        data: {
            labels: uniqueCategories,
            datasets: [{
                label: 'Expenses by Category',
                data: categoryData,
                backgroundColor: ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });

}

// Dark Mode Toggle Logic
// Toggle between dark and light themes
const themeToggleButton = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// Check and apply saved theme on load
document.body.classList.toggle('dark-theme', localStorage.getItem('theme') === 'dark');
themeIcon.classList.toggle('fa-sun', document.body.classList.contains('dark-theme'));
themeIcon.classList.toggle('fa-moon', !document.body.classList.contains('dark-theme'));

themeToggleButton.addEventListener('click', () => {
    // Toggle theme class on the body
    document.body.classList.toggle('dark-theme');

    // Switch icon between sun and moon
    themeIcon.classList.toggle('fa-sun');
    themeIcon.classList.toggle('fa-moon');

    // Save theme to localStorage
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
});

