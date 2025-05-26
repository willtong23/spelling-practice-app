// Get all the elements we need
const wordInput = document.getElementById('wordInput');
const startButton = document.getElementById('startButton');
const practiceSection = document.querySelector('.practice-section');
const speakButton = document.getElementById('speakButton');
const answerInput = document.getElementById('answerInput');
const checkButton = document.getElementById('checkButton');
const resultMessage = document.querySelector('.result-message');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const currentWordNumber = document.getElementById('currentWordNumber');
const totalWords = document.getElementById('totalWords');

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
    speakWord(words[currentWordIndex]);
    
    // Update navigation buttons
    prevButton.disabled = currentWordIndex === 0;
    nextButton.disabled = currentWordIndex === words.length - 1;
}

// Load words from JSON file
async function loadWords() {
    try {
        const response = await fetch('words.json');
        const data = await response.json();
        words = data.words || [];
        updateDisplay();
    } catch (error) {
        console.error('Error loading words:', error);
        practiceSection.innerHTML = '<p class="no-words">Error loading words. Please try again later.</p>';
    }
}

// Start practice when the start button is clicked
startButton.addEventListener('click', () => {
    const inputWords = wordInput.value.trim().toLowerCase();
    if (inputWords) {
        // Split the input by commas and clean up each word
        words = inputWords.split(',').map(word => word.trim()).filter(word => word.length > 0);
        if (words.length > 0) {
            currentWordIndex = 0;
            practiceSection.style.display = 'block';
            wordInput.value = '';
            updateDisplay();
        }
    }
});

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
        resultMessage.textContent = 'Correct! 🎉';
        resultMessage.className = 'result-message correct';
    } else {
        resultMessage.textContent = `Incorrect. The correct spelling is: ${words[currentWordIndex]}`;
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