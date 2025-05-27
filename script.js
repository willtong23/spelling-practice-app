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
const letterHint = document.getElementById('letterHint');
const allWordsBtn = document.getElementById('allWordsBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');

let words = [];
let currentWordIndex = 0;
let feedbackTimeout;
let userAnswers = [];
let quizComplete = false;

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
    resultMessage.innerHTML = '';
    resultMessage.className = 'result-message';
    speakWord(words[currentWordIndex]);
    updateLetterHint();
    
    // Update progress bar
    if (progressBar) {
        const percent = ((currentWordIndex + 1) / words.length) * 100;
        progressBar.style.width = percent + '%';
    }
    
    // Update navigation buttons
    prevButton.disabled = currentWordIndex === 0 || quizComplete;
    nextButton.disabled = currentWordIndex === words.length - 1 || quizComplete;
    // Focus input for user
    answerInput.focus();
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
    if (words.length === 0 || quizComplete) return;
    const userAnswer = answerInput.value.trim().toLowerCase();
    const correctWord = words[currentWordIndex];
    let isCorrect = userAnswer === correctWord;
    userAnswers[currentWordIndex] = { answer: userAnswer, correct: isCorrect };
    if (isCorrect) {
        resultMessage.innerHTML = '<span style="font-size:1.3em;">✅</span> Correct!';
        resultMessage.className = 'result-message correct';
        answerInput.value = '';
        answerInput.blur();
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            resultMessage.innerHTML = '';
            resultMessage.className = 'result-message';
            moveToNextWord();
            if (!quizComplete && words[currentWordIndex]) {
                speakWord(words[currentWordIndex]);
            }
        }, 2000);
    } else {
        resultMessage.innerHTML = `<span style="font-size:1.3em;">❌</span> Incorrect. The correct spelling is: <b>${correctWord}</b><br>Your answer: <b style='color:#ef4444;'>${userAnswer}</b>`;
        resultMessage.className = 'result-message incorrect';
        answerInput.value = '';
        answerInput.focus();
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            resultMessage.innerHTML = '';
            resultMessage.className = 'result-message';
        }, 3000);
    }
});

// Navigation buttons
prevButton.addEventListener('click', () => {
    if (currentWordIndex > 0 && !quizComplete) {
        currentWordIndex--;
        updateDisplay();
    }
});

nextButton.addEventListener('click', () => {
    if (currentWordIndex < words.length - 1 && !quizComplete) {
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

function updateLetterHint() {
    if (!words.length) {
        letterHint.innerHTML = '';
        return;
    }
    const wordLength = words[currentWordIndex].length;
    letterHint.innerHTML = '';
    for (let i = 0; i < wordLength; i++) {
        const box = document.createElement('div');
        box.className = 'letter-hint-box';
        letterHint.appendChild(box);
    }
}

function showModal(contentHtml) {
    modalBody.innerHTML = contentHtml;
    modalOverlay.style.display = 'flex';
}

function closeModal() {
    modalOverlay.style.display = 'none';
}

allWordsBtn.addEventListener('click', () => {
    if (!words.length) return;
    showModal('<h2>All Words</h2><ul style="list-style:none;padding:0;">' + words.map(w => `<li style='font-size:1.2em;margin:8px 0;'>${w}</li>`).join('') + '</ul>');
});

closeModalBtn.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

function showEndOfQuizFeedback() {
    let html = '<h2>Quiz Complete!</h2><ul style="text-align:left;max-width:350px;margin:0 auto;">';
    for (let i = 0; i < words.length; i++) {
        const correct = userAnswers[i]?.correct;
        const user = userAnswers[i]?.answer || '';
        html += `<li style='margin:10px 0;'><b>${i+1}. ${words[i]}</b>: `;
        if (correct) {
            html += "<span style='color:#22c55e;font-weight:600;'>Correct</span>";
        } else {
            html += `<span style='color:#ef4444;font-weight:600;'>Incorrect</span> <br><span style='color:#888;'>Your answer: <b>${user}</b></span>`;
        }
        html += '</li>';
    }
    html += '</ul>';
    showModal(html);
}

function resetQuiz() {
    userAnswers = [];
    currentWordIndex = 0;
    quizComplete = false;
    updateDisplay();
}

function moveToNextWord() {
    if (currentWordIndex < words.length - 1) {
        currentWordIndex++;
        updateDisplay();
    } else {
        quizComplete = true;
        showEndOfQuizFeedback();
    }
}

// On page load, reset quiz state
loadWords();
resetQuiz(); 