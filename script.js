// Get all the elements we need
const practiceSection = document.querySelector('.practice-section');
const speakButton = document.getElementById('speakButton');
const answerInput = document.getElementById('answerInput');
const checkButton = document.getElementById('checkButton');
const resultMessage = document.querySelector('.result-message');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const currentWordNumber = document.getElementById('currentWordNumber');
const totalWords = document.getElementById('totalWords');
const progressBar = document.getElementById('progressBar');

let words = [];
let currentWordIndex = 0;

// Function to speak the word
function speakWord(word) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.8; // Slightly slower speed for better clarity
    speechSynthesis.speak(utterance);
}

// Function to update the display
function updateDisplay() {
    if (words.length === 0) {
        practiceSection.innerHTML = '<p class="no-words">No words available. Please add words in the admin page.</p>';
        return;
    }

    currentWordNumber.textContent = currentWordIndex + 1;
    totalWords.textContent = words.length;
    answerInput.value = '';
    resultMessage.textContent = '';
    resultMessage.className = 'result-message';
    speakWord(words[currentWordIndex]);
    
    // Update progress bar
    if (progressBar) {
        const percent = ((currentWordIndex + 1) / words.length) * 100;
        progressBar.style.width = percent + '%';
    }
    
    // Update navigation buttons
    prevButton.disabled = currentWordIndex === 0;
    nextButton.disabled = currentWordIndex === words.length - 1;
}

// Load words from Firestore
async function loadWords() {
    try {
        const doc = await db.collection('spelling').doc('wordlist').get();
        if (doc.exists) {
            words = doc.data().words || [];
            updateDisplay();
        } else {
            practiceSection.innerHTML = '<p>No words found. Please add words in the admin page.</p>';
        }
    } catch (error) {
        practiceSection.innerHTML = '<p>Error loading words from Firebase.</p>';
        console.error(error);
    }
}

// Speak the word when the speak button is clicked
speakButton.addEventListener('click', () => {
    if (words.length > 0) {
        speakWord(words[currentWordIndex]);
    }
});

// Check the answer when the check button is clicked
checkButton.addEventListener('click', () => {
    if (words.length === 0) return;
    
    const userAnswer = answerInput.value.trim().toLowerCase();
    
    if (userAnswer === words[currentWordIndex]) {
        resultMessage.innerHTML = '<span style="font-size:1.3em;">✅</span> Correct!';
        resultMessage.className = 'result-message correct';
    } else {
        resultMessage.innerHTML = '<span style="font-size:1.3em;">❌</span> Incorrect. The correct spelling is: <b>' + words[currentWordIndex] + '</b>';
        resultMessage.className = 'result-message incorrect';
    }
});

// Navigation buttons
prevButton.addEventListener('click', () => {
    if (currentWordIndex > 0) {
        currentWordIndex--;
        updateDisplay();
    }
});

nextButton.addEventListener('click', () => {
    if (currentWordIndex < words.length - 1) {
        currentWordIndex++;
        updateDisplay();
    }
});

// Allow checking answer when Enter key is pressed
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        checkButton.click();
    }
});

// Load words when the page loads
loadWords(); 