//Voice Function Starts.....
// Ensure the SpeechRecognition API is supported
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

if (recognition) {
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    function startVoiceCommand() {
        recognition.start();
    }

    recognition.onresult = function(event) {
        const voiceInput = event.results[0][0].transcript.toLowerCase();
        console.log(`Voice Command Recognized: ${voiceInput}`);

        // Regex for expenses (e.g., "add 250 food on today")
        const expenseRegex = /add (\d+(\.\d{1,2})?) ([\w\s]+) on (today|\w+ \d{1,2} \d{4})/i;
        // Regex for income (e.g., "credit 5000 salary on today")
        const incomeRegex = /credit (\d+(\.\d{1,2})?) ([\w\s]+) on (today|\w+ \d{1,2} \d{4})/i;

        const expenseMatches = voiceInput.match(expenseRegex);
        const incomeMatches = voiceInput.match(incomeRegex);

        let matches = null;
        let transactionType = '';

        if (expenseMatches) {
            matches = expenseMatches;
            transactionType = 'expense';
        } else if (incomeMatches) {
            matches = incomeMatches;
            transactionType = 'income';
        }

        if (matches) {
            const amount = parseFloat(matches[1]);
            const category = matches[3].trim();
            let dateString = matches[4];

            if (dateString.toLowerCase() === 'today') {
                dateString = getCurrentDate();
            }

            const formattedDate = formatDateToYYYYMMDD(dateString);

            if (!category || isNaN(amount) || amount <= 0 || !formattedDate) {
                alert('Invalid voice command format. Please try again.');
                return;
            }

            allTransactions.push({ category, amount, date: formattedDate, type: transactionType });
            localStorage.setItem('allTransactions', JSON.stringify(allTransactions));

            const typeCapitalized = transactionType.charAt(0).toUpperCase() + transactionType.slice(1);
            alert(`${typeCapitalized} transaction added successfully via voice command!`);
            updateDashboardDisplay();
        } else {
            alert('Command not recognized. Try "Add 100 food on today" or "Credit 5000 salary on today".');
        }
    };

    recognition.onerror = function(event) {
        alert(`Error occurred in speech recognition: ${event.error}`);
    };

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
// === Data Management & Initialization ====================================
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
    localStorage.setItem('monthlyIncomes', JSON.stringify(monthlyIncomes));
    
    currentView.monthKey = currentMonthKey;
}

// =========================================================================
// === Core Display Functions ==============================================
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
        if (transaction.type === 'income') {
            li.classList.add('income-transaction');
        } else if (transaction.type === 'expense') {
            li.classList.add('expense-transaction');
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

function generateColorPalette(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const hue = (i * 360 / numColors) % 360;
        colors.push(`hsl(${hue}, 80%, 60%)`);
    }
    return colors;
}

// =========================================================================
// === Data Manipulation Functions =========================================
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
// === PDF Generation Logic (SIMPLIFIED) ===================================
// =========================================================================
function generatePdfReport(selectedMonths) {
    alert('Generating PDF report...');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let firstPage = true;

    for (const month of selectedMonths.sort()) {
        if (!firstPage) {
            doc.addPage();
        }

        const monthTransactions = allTransactions.filter(t => t.date.startsWith(month));
        const monthIncome = monthlyIncomes[month] || 0;
        const monthCredit = monthTransactions.filter(t => t.type === 'income').reduce((a, t) => a + parseFloat(t.amount), 0);
        const monthDebit = monthTransactions.filter(t => t.type === 'expense').reduce((a, t) => a + parseFloat(t.amount), 0);
        const monthNet = monthDebit - monthCredit;

        doc.setFontSize(18);
        doc.text(`Expense Report for ${month}`, 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Period Income / Budget: ₹${monthIncome.toFixed(2)}`, 15, 35);
        doc.text(`Net Expenses: ₹${monthNet.toFixed(2)}`, 15, 42);
        doc.text(`Remaining Balance: ₹${(monthIncome - monthNet).toFixed(2)}`, 15, 49);

        if (monthTransactions.length > 0) {
            doc.autoTable({
                startY: 60,
                head: [['Type', 'Category', 'Amount', 'Date']],
                body: monthTransactions.map(t => [t.type.charAt(0).toUpperCase() + t.type.slice(1), t.category, `₹${t.amount.toFixed(2)}`, t.date]),
            });
        } else {
            doc.text('No transactions were recorded for this period.', 15, 70);
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

    // Event Listeners for BOTH voice command buttons
    const expenseVoiceBtn = document.getElementById('voice-command-btn');
    if (expenseVoiceBtn) {
        expenseVoiceBtn.addEventListener('click', startVoiceCommand);
    }
    const incomeVoiceBtn = document.getElementById('voice-command-income-btn');
    if (incomeVoiceBtn) {
        incomeVoiceBtn.addEventListener('click', startVoiceCommand);
    }
    
    const monthlyIncomeForm = document.getElementById('monthly-income-form');
    if (monthlyIncomeForm) {
        document.getElementById('monthly-income').value = monthlyIncomes[currentMonthKey] || '';
        document.getElementById('current-month-display').textContent = `Tracking Period: ${currentMonthKey}`;
        
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

    const showCurrentBtn = document.getElementById('show-current-month-data');
    if(showCurrentBtn) {
        showCurrentBtn.addEventListener('click', function() {
            currentView.mode = 'month';
            currentView.monthKey = currentMonthKey;
            if(document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
            updateDashboardDisplay();
        });
    }
    
    const showAllDataBtn = document.getElementById('show-all-data');
    if(showAllDataBtn) {
        showAllDataBtn.addEventListener('click', function() {
            currentView.mode = 'all';
            if(document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
            updateDashboardDisplay();
        });
    }

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

    const clearDataBtn = document.getElementById('clear-data');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear ALL data for ALL periods? This cannot be undone.')) {
                localStorage.clear();
                alert('All data has been cleared!');
                window.location.reload();
            }
        });
    }

    const downloadPdfBtn = document.getElementById('download-pdf');
    const pdfModal = document.getElementById('pdf-modal');
    if (downloadPdfBtn && pdfModal) {
        const monthSelectionDiv = document.getElementById('pdf-month-selection');
        const selectAllCheckbox = document.getElementById('pdf-select-all');

        downloadPdfBtn.addEventListener('click', () => {
            monthSelectionDiv.innerHTML = '';
            selectAllCheckbox.checked = false;
            const availableMonths = [...new Set(allTransactions.map(t => t.date.substring(0, 7)))].sort().reverse();
            if (availableMonths.length === 0) {
                alert("No data available to generate a report.");
                return;
            }
            availableMonths.forEach(month => {
                const row = document.createElement('div');
                row.className = 'pdf-option-row';
                row.innerHTML = `<label><input type="checkbox" class="pdf-month-box" value="${month}"> ${month}</label>`;
                monthSelectionDiv.appendChild(row);
            });
            pdfModal.classList.add('show');
        });

        document.getElementById('cancel-pdf').addEventListener('click', () => {
            pdfModal.classList.remove('show');
        });

        selectAllCheckbox.addEventListener('change', (e) => {
            document.querySelectorAll('.pdf-month-box').forEach(box => box.checked = e.target.checked);
        });

        document.getElementById('generate-pdf-btn').addEventListener('click', () => {
            const selectedMonths = [...document.querySelectorAll('.pdf-month-box:checked')].map(box => box.value);
            if (selectedMonths.length === 0) {
                alert('Please select at least one month to include in the report.');
                return;
            }
            generatePdfReport(selectedMonths);
            pdfModal.classList.remove('show');
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

            incomeExpenseChart = new Chart(incomeExpenseCtx, {
                type: 'bar',
                data: { labels: ['Period Income', 'Net Expenses'], datasets: [{ label: 'Amount (₹)', data: [incomeForView || 0, netExpenses || 0], backgroundColor: ['#28a745', '#dc3545'] }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });

            const expenseData = dataToDisplay.filter(t => t.type === 'expense');
            const expenseChartContainer = document.getElementById('expenseCategoryChart').parentElement;
            let existingMsg = expenseChartContainer.querySelector('.no-data-message');
            if(existingMsg) existingMsg.remove();
            
            if (expenseData.length === 0) {
                document.getElementById('expenseCategoryChart').style.display = 'none';
                const noDataMessage = document.createElement('p');
                noDataMessage.textContent = 'No expense data for this period.';
                noDataMessage.className = 'no-data-message';
                expenseChartContainer.appendChild(noDataMessage);
            } else {
                document.getElementById('expenseCategoryChart').style.display = 'block';
                const expenseCategories = [...new Set(expenseData.map(t => t.category))];
                const expenseCategoryTotals = expenseCategories.map(cat => expenseData.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0));
                expenseCategoryChart = new Chart(expenseCategoryCtx, { type: 'pie', data: { labels: expenseCategories, datasets: [{ label: 'Expenses by Category', data: expenseCategoryTotals, backgroundColor: generateColorPalette(expenseCategories.length) }] }, options: { responsive: true, maintainAspectRatio: false } });
            }

            const incomeData = dataToDisplay.filter(t => t.type === 'income');
            const incomeChartContainer = document.getElementById('incomeCategoryChart').parentElement;
            existingMsg = incomeChartContainer.querySelector('.no-data-message');
            if(existingMsg) existingMsg.remove();

            if (incomeData.length === 0) {
                document.getElementById('incomeCategoryChart').style.display = 'none';
                const noDataMessage = document.createElement('p');
                noDataMessage.textContent = 'No income data for this period.';
                noDataMessage.className = 'no-data-message';
                incomeChartContainer.appendChild(noDataMessage);
            } else {
                document.getElementById('incomeCategoryChart').style.display = 'block';
                const incomeCategories = [...new Set(incomeData.map(t => t.category))];
                const incomeCategoryTotals = incomeCategories.map(cat => incomeData.filter(t => t.category === cat).reduce((acc, t) => acc + parseFloat(t.amount), 0));
                incomeCategoryChart = new Chart(incomeCategoryCtx, { type: 'pie', data: { labels: incomeCategories, datasets: [{ label: 'Income by Category', data: incomeCategoryTotals, backgroundColor: generateColorPalette(incomeCategories.length).reverse() }] }, options: { responsive: true, maintainAspectRatio: false } });
            }
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
        
        const initialTransactions = allTransactions.filter(t => t.date.startsWith(currentMonthKey));
        const initialIncome = monthlyIncomes[currentMonthKey] || 0;
        renderAnalyticsCharts(initialTransactions, initialIncome);
    }

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

    updateDashboardDisplay();
});
