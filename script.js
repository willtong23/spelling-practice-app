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

// User name input logic
const userNameSection = document.getElementById('userNameSection');
const userNameInput = document.getElementById('userNameInput');
const startQuizBtn = document.getElementById('startQuizBtn');
const quizContent = document.getElementById('quizContent');

let words = [];
let currentWordIndex = 0;
let feedbackTimeout;
let userAnswers = [];
let quizComplete = false;
let lastQuizComplete = false;
let originalWords = [];
let selectedVoice = null;
let hintUsed = [];
let userName = '';

function setBritishVoice() {
    const voices = speechSynthesis.getVoices();
    // Prefer female British voices
    let britishFemale = voices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('female'));
    if (!britishFemale) {
        // Fallback: any British English voice
        britishFemale = voices.find(v => v.lang === 'en-GB');
    }
    if (!britishFemale) {
        // Fallback: any voice with 'UK' in the name
        britishFemale = voices.find(v => v.name.toLowerCase().includes('uk'));
    }
    selectedVoice = britishFemale || voices[0];
}

// Set the voice when voices are loaded
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = setBritishVoice;
    setBritishVoice();
}

// Function to speak the word
function speakWord(word) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.8; // Slightly slower speed for better clarity
    if (selectedVoice) utterance.voice = selectedVoice;
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
            originalWords = doc.data().words || [];
            startNewRound();
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
    // Track all attempts for each word
    if (!userAnswers[currentWordIndex]) {
        userAnswers[currentWordIndex] = { attempts: [], correct: false };
    }
    userAnswers[currentWordIndex].attempts.push(userAnswer);
    let isCorrect = userAnswer === correctWord;
    if (isCorrect) {
        userAnswers[currentWordIndex].correct = true;
    }
    if (isCorrect && userAnswers[currentWordIndex].correct) {
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
    } else if (!isCorrect) {
        // Show a new red Incorrect message for this attempt
        resultMessage.innerHTML = `<div style='color:#ef4444;font-weight:600;'>❌ Incorrect</div><div style='margin-top:6px;'>The correct spelling is: <b>${correctWord}</b><br>Your answer: <b style='color:#ef4444;'>${userAnswer}</b></div>`;
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
        box.dataset.index = i;
        box.addEventListener('click', function() {
            // Show the correct letter as a hint
            box.textContent = words[currentWordIndex][i];
            // Mark that a hint was used for this word
            hintUsed[currentWordIndex] = true;
        });
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

closeModalBtn.addEventListener('click', () => {
    closeModal();
    if (lastQuizComplete) {
        lastQuizComplete = false;
        setTimeout(() => {
            resetQuiz();
            // Ensure the first word and sound are in sync
            setTimeout(() => {
                speakWord(words[0]);
            }, 200);
        }, 100);
    }
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

async function saveQuizResultToFirebase() {
    const result = {
        user: userName,
        date: new Date().toISOString(),
        words: words.map((word, i) => ({
            word,
            attempts: userAnswers[i]?.attempts || [],
            correct: userAnswers[i]?.correct || false,
            hint: !!hintUsed[i]
        }))
    };
    try {
        await db.collection('results').add(result);
    } catch (e) {
        console.error('Error saving result to Firebase:', e);
    }
}

function showEndOfQuizFeedback() {
    let allPerfect = true;
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const correctWord = words[i];
        const wrongAttempts = (entry.attempts || []).filter(a => a !== correctWord);
        if (wrongAttempts.length > 0 || !entry.correct) {
            allPerfect = false;
            break;
        }
    }
    let html = '<h2 style="margin-bottom:18px;">Quiz Complete!</h2>';
    if (allPerfect) {
        html += '<div style="color:#22c55e;font-size:1.3em;font-weight:700;margin-bottom:18px;background:#e7fbe9;padding:10px 0;border-radius:8px;">🎉 Congratulations! You got everything correct on the first try!</div>';
    }
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:separate;border-spacing:0 8px;">';
    html += '<tr><th style="text-align:left;padding:4px 8px;">Word</th><th style="text-align:center;padding:4px 8px;">Result</th><th style="text-align:left;padding:4px 8px;">Wrong attempts</th></tr>';
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const correct = entry.correct;
        const attempts = entry.attempts || [];
        const correctWord = words[i];
        const wrongAttempts = attempts.filter(a => a !== correctWord);
        const correctAttempts = attempts.some(a => a === correctWord) ? 1 : 0;
        html += `<tr style="background:#f8fafc;"><td style="font-weight:bold;padding:4px 8px;">${words[i]}</td><td style="text-align:center;padding:4px 8px;">`;
        // Show ticks and crosses
        if (correctAttempts) {
            html += `<span style='font-size:1.5em;vertical-align:middle;font-family: "Apple Color Emoji", "Segoe UI Emoji", "NotoColorEmoji", "Noto Color Emoji", "Segoe UI Symbol", "Android Emoji", emoji, sans-serif;'>`;
            for (let t = 0; t < correctAttempts; t++) html += '✅';
            html += `</span>`;
        }
        if (wrongAttempts.length) {
            html += `<span style='font-size:1.5em;vertical-align:middle;font-family: "Apple Color Emoji", "Segoe UI Emoji", "NotoColorEmoji", "Noto Color Emoji", "Segoe UI Symbol", "Android Emoji", emoji, sans-serif; color:#ef4444;'>`;
            for (let x = 0; x < wrongAttempts.length; x++) html += '❌';
            html += `</span>`;
        }
        // Show 'H' if hint was used
        if (hintUsed[i]) {
            html += `<span style='color:#fbbf24;font-weight:700;font-size:1.2em;margin-left:6px;' title='Hint used'>H</span>`;
        }
        html += `</td><td style="color:#888;padding:4px 8px;">`;
        if (wrongAttempts.length) {
            html += `<b>${wrongAttempts.join(', ')}</b>`;
        } else {
            html += '-';
        }
        html += '</td></tr>';
    }
    html += '</table></div>';
    showModal(html);
    lastQuizComplete = true;
    saveQuizResultToFirebase();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function startNewRound() {
    words = [...originalWords];
    if (words.length > 1) {
        shuffleArray(words);
    }
    resetQuizState();
    updateDisplay();
}

function resetQuizState() {
    userAnswers = [];
    currentWordIndex = 0;
    quizComplete = false;
    hintUsed = [];
}

function resetQuiz() {
    startNewRound();
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

function promptUserName() {
    userName = prompt('Please enter your name:')?.trim() || 'unknown';
}

function startQuiz() {
    console.log('Start clicked');
    userName = userNameInput.value.trim() || 'unknown';
    userNameSection.style.display = 'none';
    quizContent.style.display = '';
    loadWords();
    resetQuiz();
}

if (userNameSection && startQuizBtn && userNameInput && quizContent) {
    quizContent.style.display = 'none';
    userNameSection.style.display = '';
    startQuizBtn.addEventListener('click', startQuiz);
    userNameInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') startQuiz();
    });
} 