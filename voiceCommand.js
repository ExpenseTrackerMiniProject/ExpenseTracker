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
            transactions.push({ category, amount, date: formattedDate });
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
    // Implement logic to refresh or update the dashboard based on the new transactions
    console.log('Updating dashboard with new transactions...');
}
