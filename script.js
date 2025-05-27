// Spelling Practice App - Clean Modern Version
// --- Configurable word list (for demo, use localStorage or hardcoded) ---
const defaultWords = ["want", "went", "what", "should", "could"];
function getWords() {
    return JSON.parse(localStorage.getItem('spellingWords') || JSON.stringify(defaultWords));
}
function setWords(words) {
    localStorage.setItem('spellingWords', JSON.stringify(words));
}

// --- Elements ---
const practiceSection = document.querySelector('.practice-card');
const speakButton = document.getElementById('speakButton');
const checkButton = document.getElementById('checkButton');
const resultMessage = document.getElementById('resultMessage');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const currentWordNumber = document.getElementById('currentWordNumber');
const totalWords = document.getElementById('totalWords');
const progressBar = document.getElementById('progressBar');
const letterHint = document.getElementById('letterHint');
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');

// --- State ---
let words = [];
let currentWordIndex = 0;
let feedbackTimeout;
let userAnswers = [];
let quizComplete = false;
let lastQuizComplete = false;
let letterInputs = [];
let hintUsed = [];
let userName = '';
let selectedVoice = null;

// --- Name Prompt ---
function promptUserName() {
    userName = prompt('Please enter your name:')?.trim() || 'unknown';
}
promptUserName();

// --- Voice Selection ---
function setBritishVoice() {
    const voices = speechSynthesis.getVoices();
    let britishFemale = voices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('female'));
    if (!britishFemale) britishFemale = voices.find(v => v.lang === 'en-GB');
    if (!britishFemale) britishFemale = voices.find(v => v.name.toLowerCase().includes('uk'));
    selectedVoice = britishFemale || voices[0];
}
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = setBritishVoice;
    setBritishVoice();
}
function speakWord(word) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.8;
    if (selectedVoice) utterance.voice = selectedVoice;
    speechSynthesis.speak(utterance);
}

// --- UI Update Functions ---
function updateLetterHint() {
    if (!words.length) {
        letterHint.innerHTML = '';
        return;
    }
    const wordLength = words[currentWordIndex].length;
    letterHint.innerHTML = '';
    letterInputs = [];
    for (let i = 0; i < wordLength; i++) {
        const box = document.createElement('input');
        box.type = 'text';
        box.maxLength = 1;
        box.className = 'letter-hint-box letter-input-box';
        box.dataset.index = i;
        box.autocomplete = 'off';
        box.style.textAlign = 'center';
        box.style.fontSize = '1.3em';
        box.style.width = '44px';
        box.style.height = '44px';
        box.addEventListener('input', function() {
            if (box.value.length === 1 && i < wordLength - 1) {
                letterInputs[i + 1].focus();
            }
        });
        box.addEventListener('click', function(e) {
            if (!box.disabled) return;
            if (box.value === words[currentWordIndex][i]) return;
            box.value = words[currentWordIndex][i];
            box.disabled = true;
            hintUsed[currentWordIndex] = true;
        });
        letterInputs.push(box);
        letterHint.appendChild(box);
    }
}
function updateDisplay() {
    if (words.length === 0) {
        practiceSection.innerHTML = '<p class="no-words">No words available. Please add words in the teacher dashboard.</p>';
        return;
    }
    currentWordNumber.textContent = currentWordIndex + 1;
    totalWords.textContent = words.length;
    resultMessage.innerHTML = '';
    resultMessage.className = 'result-message';
    updateLetterHint();
    if (progressBar) {
        const percent = ((currentWordIndex + 1) / words.length) * 100;
        progressBar.style.width = percent + '%';
    }
    prevButton.disabled = currentWordIndex === 0 || quizComplete;
    nextButton.disabled = currentWordIndex === words.length - 1 || quizComplete;
    letterInputs[0]?.focus();
}
function resetQuizState() {
    userAnswers = [];
    currentWordIndex = 0;
    quizComplete = false;
    hintUsed = [];
}
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function startNewRound() {
    words = getWords();
    if (words.length > 1) shuffleArray(words);
    resetQuizState();
    updateDisplay();
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

// --- Event Listeners ---
speakButton.addEventListener('click', () => {
    if (words.length > 0) speakWord(words[currentWordIndex]);
});
checkButton.addEventListener('click', () => {
    if (words.length === 0 || quizComplete) return;
    let userAnswer = letterInputs.map((box, idx) => box.value ? box.value.toLowerCase() : '').join('');
    const correctWord = words[currentWordIndex];
    if (!userAnswers[currentWordIndex]) {
        userAnswers[currentWordIndex] = { attempts: [], correct: false };
    }
    userAnswers[currentWordIndex].attempts.push(userAnswer);
    let isCorrect = userAnswer === correctWord;
    if (isCorrect) userAnswers[currentWordIndex].correct = true;
    if (isCorrect && userAnswers[currentWordIndex].correct) {
        resultMessage.innerHTML = '<span style="font-size:1.3em;">✅</span> Correct!';
        resultMessage.className = 'result-message correct';
        letterInputs.forEach(box => box.value = '');
        letterInputs.forEach(box => box.disabled = false);
        letterInputs[0].focus();
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            resultMessage.innerHTML = '';
            resultMessage.className = 'result-message';
            moveToNextWord();
            if (!quizComplete && words[currentWordIndex]) speakWord(words[currentWordIndex]);
        }, 2000);
    } else if (!isCorrect) {
        resultMessage.innerHTML = `<div style='color:#ef4444;font-weight:600;'>❌ Incorrect</div><div style='margin-top:6px;'>The correct spelling is: <b>${correctWord}</b><br>Your answer: <b style='color:#ef4444;'>${userAnswer}</b></div>`;
        resultMessage.className = 'result-message incorrect';
        letterInputs.forEach(box => box.value = '');
        letterInputs[0].focus();
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            resultMessage.innerHTML = '';
            resultMessage.className = 'result-message';
        }, 3000);
    }
});
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
// Enter key on last box triggers check
letterHint.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkButton.click();
});
// --- Modal/Feedback ---
function showModal(contentHtml) {
    modalBody.innerHTML = contentHtml;
    modalOverlay.style.display = 'flex';
}
function closeModal() {
    modalOverlay.style.display = 'none';
}
closeModalBtn.addEventListener('click', () => {
    closeModal();
    if (lastQuizComplete) {
        lastQuizComplete = false;
        setTimeout(() => {
            resetQuiz();
            setTimeout(() => {
                speakWord(words[0]);
            }, 200);
        }, 100);
    }
});
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});
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
}

// --- Load Words from Firestore ---
async function loadWordsFromFirestore() {
    try {
        const doc = await window.db.collection('spelling').doc('wordlist').get();
        if (doc.exists) {
            words = doc.data().words || [];
        } else {
            words = [];
        }
        resetQuizState();
        updateDisplay();
    } catch (error) {
        console.error('Error loading words:', error);
        words = [];
        updateDisplay();
    }
}

// Call loadWordsFromFirestore when the page loads
loadWordsFromFirestore();

// --- Init ---
startNewRound(); 