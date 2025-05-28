// Spelling Practice App - Enhanced Version with Word Sets Support
// --- Configurable word list (now supports word sets from teacher dashboard) ---
const defaultWords = ["want", "went", "what", "should", "could"];

// Word set selection variables
let availableWordSets = [];
let selectedWordSetId = null;
let userAssignmentId = null;

async function getWordsFromAssignment(userName) {
    try {
        console.log(`=== GETTING WORDS FOR USER: ${userName} ===`);
        
        // First, try to find if this user has a specific assignment
        const studentsSnapshot = await window.db.collection('students').where('name', '==', userName).get();
        
        if (!studentsSnapshot.empty) {
            const studentDoc = studentsSnapshot.docs[0];
            const studentData = studentDoc.data();
            const studentId = studentDoc.id;
            console.log(`Found student in database: ${studentId}`, studentData);
            
            // Check if this student has a specific assignment (highest priority)
            const assignmentsSnapshot = await window.db.collection('assignments').where('studentId', '==', studentId).get();
            
            if (!assignmentsSnapshot.empty) {
                const assignmentDoc = assignmentsSnapshot.docs[0];
                const wordSetId = assignmentDoc.data().wordSetId;
                userAssignmentId = wordSetId; // Store for panel display
                console.log(`Found specific assignment for student: wordSetId = ${wordSetId}`);
                
                // Get the word set
                const wordSetDoc = await window.db.collection('wordSets').doc(wordSetId).get();
                if (wordSetDoc.exists) {
                    console.log(`Using specific assignment for ${userName}: "${wordSetDoc.data().name}"`);
                    return {
                        words: wordSetDoc.data().words,
                        setId: wordSetId,
                        setName: wordSetDoc.data().name
                    };
                }
            }
            
            // No specific assignment - check for student's default word set (second priority)
            if (studentData.defaultWordSetId) {
                console.log(`No specific assignment, checking student's default word set: ${studentData.defaultWordSetId}`);
                const wordSetDoc = await window.db.collection('wordSets').doc(studentData.defaultWordSetId).get();
                if (wordSetDoc.exists) {
                    console.log(`Using student's default word set for ${userName}: "${wordSetDoc.data().name}"`);
                    return {
                        words: wordSetDoc.data().words,
                        setId: studentData.defaultWordSetId,
                        setName: wordSetDoc.data().name
                    };
                }
            }
            
            // No student default - check for class default word set (third priority)
            if (studentData.classId) {
                console.log(`No student default, checking class default for classId: ${studentData.classId}`);
                const classDoc = await window.db.collection('classes').doc(studentData.classId).get();
                if (classDoc.exists && classDoc.data().defaultWordSetId) {
                    const classDefaultWordSetId = classDoc.data().defaultWordSetId;
                    console.log(`Found class default word set: ${classDefaultWordSetId}`);
                    
                    const wordSetDoc = await window.db.collection('wordSets').doc(classDefaultWordSetId).get();
                    if (wordSetDoc.exists) {
                        console.log(`Using class default word set for ${userName}: "${wordSetDoc.data().name}"`);
                        return {
                            words: wordSetDoc.data().words,
                            setId: classDefaultWordSetId,
                            setName: wordSetDoc.data().name
                        };
                    }
                }
            }
            
            console.log(`No specific assignment or defaults found for student ${userName}`);
        } else {
            console.log(`Student ${userName} not found in database`);
        }
        
        // If no specific assignment or defaults, check if there are any word sets available
        console.log('No assignment or defaults found, checking for available word sets...');
        const wordSetsSnapshot = await window.db.collection('wordSets').get();
        
        if (!wordSetsSnapshot.empty) {
            // Use the first available word set instead of the potentially problematic active set
            const firstWordSet = wordSetsSnapshot.docs[0];
            const wordSetData = firstWordSet.data();
            console.log(`Using first available word set: "${wordSetData.name}"`);
            return {
                words: wordSetData.words,
                setId: firstWordSet.id,
                setName: wordSetData.name
            };
        }
        
        // If no word sets exist, try to get the active word set from the main wordlist
        console.log('No word sets found, checking main wordlist...');
        const doc = await window.db.collection('spelling').doc('wordlist').get();
        if (doc.exists && doc.data().activeSetId) {
            const wordSetDoc = await window.db.collection('wordSets').doc(doc.data().activeSetId).get();
            if (wordSetDoc.exists) {
                console.log(`Using active word set: "${wordSetDoc.data().name}"`);
                return {
                    words: wordSetDoc.data().words,
                    setId: doc.data().activeSetId,
                    setName: wordSetDoc.data().name
                };
            }
        }
        
        // Fallback to the old wordlist format
        if (doc.exists && doc.data().words) {
            console.log('Using legacy word list');
            return {
                words: doc.data().words,
                setId: null,
                setName: 'Legacy Set'
            };
        }
        
        // Final fallback to default words
        console.log('Using default words');
        return {
            words: defaultWords,
            setId: null,
            setName: 'Default Set'
        };
        
    } catch (error) {
        console.error('Error getting words from assignment:', error);
        return {
            words: defaultWords,
            setId: null,
            setName: 'Default Set'
        };
    }
}

// Load available word sets for the selection panel
async function loadAvailableWordSets() {
    try {
        const snapshot = await window.db.collection('wordSets').get();
        availableWordSets = [];
        snapshot.forEach(doc => {
            availableWordSets.push({ id: doc.id, ...doc.data() });
        });
        
        // Populate the word set select dropdown
        const wordSetSelect = document.getElementById('wordSetSelect');
        if (wordSetSelect) {
            wordSetSelect.innerHTML = '<option value="">Choose a word set...</option>';
            availableWordSets.forEach(set => {
                const option = document.createElement('option');
                option.value = set.id;
                option.textContent = `${set.name} (${set.words.length} words)`;
                wordSetSelect.appendChild(option);
            });
        }
        
        console.log('Loaded available word sets:', availableWordSets);
    } catch (error) {
        console.error('Error loading available word sets:', error);
    }
}

// Update the word set panel display
function updateWordSetPanel() {
    const assignmentName = document.getElementById('assignmentName');
    const currentSetName = document.getElementById('currentSetName');
    const currentSetCount = document.getElementById('currentSetCount');
    
    if (userAssignmentId) {
        const assignedSet = availableWordSets.find(set => set.id === userAssignmentId);
        if (assignedSet) {
            assignmentName.textContent = assignedSet.name;
        } else {
            assignmentName.textContent = 'No assignment found';
        }
    } else {
        assignmentName.textContent = 'No assignment found';
    }
    
    // Update current set info
    if (currentWordSetName) {
        currentSetName.textContent = currentWordSetName;
        currentSetCount.textContent = `${words.length} words`;
    }
}

// Handle word set selection changes
function setupWordSetPanel() {
    const panelToggle = document.getElementById('panelToggle');
    const wordSetPanel = document.getElementById('wordSetPanel');
    const mainContent = document.getElementById('mainContent');
    const useAssignment = document.getElementById('useAssignment');
    const useCustom = document.getElementById('useCustom');
    const wordSetSelect = document.getElementById('wordSetSelect');
    const applySelection = document.getElementById('applySelection');
    
    // Panel toggle functionality
    if (panelToggle) {
        panelToggle.addEventListener('click', () => {
            wordSetPanel.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
            panelToggle.textContent = wordSetPanel.classList.contains('collapsed') ? '▶' : '◀';
        });
    }
    
    // Radio button change handlers
    if (useAssignment) {
        useAssignment.addEventListener('change', () => {
            if (useAssignment.checked) {
                wordSetSelect.disabled = true;
                wordSetSelect.style.opacity = '0.5';
            }
        });
    }
    
    if (useCustom) {
        useCustom.addEventListener('change', () => {
            if (useCustom.checked) {
                wordSetSelect.disabled = false;
                wordSetSelect.style.opacity = '1';
            }
        });
    }
    
    // Apply selection button
    if (applySelection) {
        applySelection.addEventListener('click', async () => {
            await applyWordSetSelection();
        });
    }
}

// Apply the selected word set
async function applyWordSetSelection() {
    const useAssignment = document.getElementById('useAssignment');
    const useCustom = document.getElementById('useCustom');
    const wordSetSelect = document.getElementById('wordSetSelect');
    
    try {
        let wordData;
        
        if (useAssignment.checked) {
            // Use assignment
            wordData = await getWordsFromAssignment(userName);
        } else if (useCustom.checked && wordSetSelect.value) {
            // Use custom selected word set
            const selectedSetId = wordSetSelect.value;
            const selectedSet = availableWordSets.find(set => set.id === selectedSetId);
            
            if (selectedSet) {
                wordData = {
                    words: selectedSet.words,
                    setId: selectedSet.id,
                    setName: selectedSet.name
                };
            } else {
                throw new Error('Selected word set not found');
            }
        } else {
            showNotification('Please select a word set option', 'error');
            return;
        }
        
        // Update the current words and UI
        words = [...wordData.words];
        currentWordSetId = wordData.setId;
        currentWordSetName = wordData.setName;
        selectedWordSetId = wordData.setId;
        
        // Shuffle words for new session
        if (words.length > 1) {
            shuffleArray(words);
        }
        
        // Reset quiz state and update display
        resetQuizState();
        updateDisplay();
        updateWordSetPanel();
        
        showNotification(`Switched to "${wordData.setName}" (${words.length} words)`, 'success');
        
        // Speak the first word
        setTimeout(() => {
            if (words.length > 0) speakWord(words[0]);
        }, 500);
        
    } catch (error) {
        console.error('Error applying word set selection:', error);
        showNotification('Error switching word set. Please try again.', 'error');
    }
}

function getWords() {
    return JSON.parse(localStorage.getItem('spellingWords') || JSON.stringify(defaultWords));
}

function setWords(words) {
    localStorage.setItem('spellingWords', JSON.stringify(words));
}

// --- Elements ---
const practiceSection = document.querySelector('.practice-card');
const speakButton = document.getElementById('speakButton');
const allWordsButton = document.getElementById('allWordsButton');
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
let currentWordSetId = null;
let currentWordSetName = '';

// --- Name Prompt ---
function promptUserName() {
    userName = prompt('Please enter your name:')?.trim() || 'unknown';
    localStorage.setItem('userName', userName);
}
promptUserName();

// --- Voice Selection ---
function setBritishVoice() {
    const voices = speechSynthesis.getVoices();
    // Prefer Google UK English voices for clarity
    let preferred = voices.find(v => v.name === 'Google UK English Female');
    if (!preferred) preferred = voices.find(v => v.name === 'Google UK English Male');
    // Fallback to any en-GB voice
    if (!preferred) preferred = voices.find(v => v.lang === 'en-GB');
    // Fallback to any voice with 'UK' in the name
    if (!preferred) preferred = voices.find(v => v.name.toLowerCase().includes('uk'));
    // Fallback to first available
    selectedVoice = preferred || voices[0];
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
    const word = words[currentWordIndex];
    const wordLength = word.length;
    letterHint.innerHTML = '';
    letterInputs = [];
    
    // Create container with responsive attributes
    const letterContainer = document.createElement('div');
    letterContainer.className = 'letter-hint-container';
    letterContainer.setAttribute('data-word-length', wordLength.toString());
    
    // Mark as long word if 13+ characters
    if (wordLength >= 13) {
        letterContainer.setAttribute('data-long-word', 'true');
    }
    
    // Mark as very long word if 20+ characters
    if (wordLength >= 20) {
        letterContainer.setAttribute('data-very-long-word', 'true');
    }
    
    for (let i = 0; i < wordLength; i++) {
        const box = document.createElement('input');
        box.type = 'text';
        box.maxLength = 1;
        box.className = 'letter-hint-box letter-input-box';
        box.dataset.index = i;
        box.autocomplete = 'off';
        box.style.textAlign = 'center';
        
        // Add event listeners
        box.addEventListener('input', function(e) {
            if (box.value.length === 1 && i < wordLength - 1) {
                letterInputs[i + 1].focus();
            } else if (box.value.length === 1 && i === wordLength - 1) {
                // Auto-check when last letter is entered
                setTimeout(() => {
                    checkSpelling();
                }, 100);
            }
        });
        
        box.addEventListener('keydown', function(e) {
            if (e.key === ' ') {
                e.preventDefault();
                box.value = word[i];
                box.disabled = true;
                hintUsed[currentWordIndex] = true;
                // Move focus to next box if available
                if (i < wordLength - 1) {
                    letterInputs[i + 1].focus();
                } else {
                    // Auto-check if this was the last letter
                    setTimeout(() => {
                        checkSpelling();
                    }, 100);
                }
            }
            
            // Handle backspace to move to previous box
            if (e.key === 'Backspace' && box.value === '' && i > 0) {
                letterInputs[i - 1].focus();
            }
            
            // Handle arrow keys for navigation
            if (e.key === 'ArrowLeft' && i > 0) {
                e.preventDefault();
                letterInputs[i - 1].focus();
            }
            if (e.key === 'ArrowRight' && i < wordLength - 1) {
                e.preventDefault();
                letterInputs[i + 1].focus();
            }
            
            // Handle Enter key to check spelling
            if (e.key === 'Enter') {
                e.preventDefault();
                checkSpelling();
            }
        });
        
        box.addEventListener('click', function(e) {
            if (!box.disabled) return;
            if (box.value === word[i]) return;
            box.value = word[i];
            box.disabled = true;
            hintUsed[currentWordIndex] = true;
        });
        
        letterInputs.push(box);
        letterContainer.appendChild(box);
    }
    
    letterHint.appendChild(letterContainer);
}

function updateDisplay() {
    if (words.length === 0) {
        practiceSection.innerHTML = '<p class="no-words">No words available. Please check with your teacher.</p>';
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
    console.log('Shuffling array - before:', [...array]);
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    console.log('Shuffling array - after:', [...array]);
}

function startNewRound() {
    // Don't use getWords() which gets from localStorage
    // Instead, just shuffle the existing Firebase words
    if (words.length > 1) shuffleArray(words);
    resetQuizState();
    updateDisplay();
}

async function resetQuiz() {
    // Reload words from Firebase and shuffle them for new round
    console.log('=== RESET QUIZ CALLED ===');
    console.log('Current words before reset:', words);
    console.log('Resetting quiz - reloading words from assignment...');
    try {
        let wordData;
        
        // Check if user has made a custom selection
        if (selectedWordSetId && selectedWordSetId !== userAssignmentId) {
            // Use the custom selected word set
            const selectedSet = availableWordSets.find(set => set.id === selectedWordSetId);
            if (selectedSet) {
                wordData = {
                    words: selectedSet.words,
                    setId: selectedSet.id,
                    setName: selectedSet.name
                };
            } else {
                // Fallback to assignment
                wordData = await getWordsFromAssignment(userName);
            }
        } else {
            // Use assignment or default
            wordData = await getWordsFromAssignment(userName);
        }
        
        words = [...wordData.words]; // Create a copy
        currentWordSetId = wordData.setId;
        currentWordSetName = wordData.setName;
        
        console.log('Reloaded words for new round:', words);
        console.log('Word set:', currentWordSetName);
        console.log('Number of words reloaded:', words.length);
        
        // Shuffle words for new round
        if (words.length > 1) shuffleArray(words);
        console.log('Shuffled words for new round:', words);
    } catch (error) {
        console.error('Error reloading words for new round:', error);
        console.log('Using fallback - keeping current words');
        // Fallback to current words if Firebase fails
        if (words.length > 1) shuffleArray(words);
    }
    
    resetQuizState();
    updateDisplay();
    updateWordSetPanel();
    console.log('=== RESET QUIZ COMPLETE ===');
    console.log('Final words after reset:', words);
    console.log('Final word count:', words.length);
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

// --- Spelling Check Function ---
function checkSpelling() {
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
        letterInputs.forEach(box => box.disabled = false);
        letterInputs[0].focus();
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            resultMessage.innerHTML = '';
            resultMessage.className = 'result-message';
        }, 3000);
    }
}

// --- Event Listeners ---
speakButton.addEventListener('click', () => {
    if (words.length > 0) speakWord(words[currentWordIndex]);
});

allWordsButton.addEventListener('click', showAllWords);

// Remove the old check button event listener since the button is now hidden
// checkButton.addEventListener('click', () => {
//     checkSpelling();
// });

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

// Enter key on letter hint area triggers check (backup)
letterHint.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        checkSpelling();
    }
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
        setTimeout(async () => {
            await resetQuiz();
            setTimeout(() => {
                if (words.length > 0) speakWord(words[0]);
            }, 200);
        }, 100);
    }
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

function showEndOfQuizFeedback() {
    let allPerfectFirstTry = true;
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const attempts = entry.attempts || [];
        const correctWord = words[i];
        
        // Check if first attempt was correct
        const firstTryCorrect = attempts.length > 0 && attempts[0] === correctWord;
        if (!firstTryCorrect) {
            allPerfectFirstTry = false;
            break;
        }
    }
    
    let html = '<h2 style="margin-bottom:18px;">Quiz Complete!</h2>';
    
    // Show which word set was used
    if (currentWordSetName) {
        html += `<div style="color:#64748b;font-size:0.9rem;margin-bottom:12px;">Word Set: <strong>${currentWordSetName}</strong></div>`;
    }
    
    if (allPerfectFirstTry) {
        html += '<div style="color:#22c55e;font-size:1.3em;font-weight:700;margin-bottom:18px;background:#e7fbe9;padding:10px 0;border-radius:8px;">🎉 Perfect! You got everything correct on the first try!</div>';
    }
    
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:separate;border-spacing:0 8px;">';
    html += '<tr><th style="text-align:left;padding:4px 8px;">Word</th><th style="text-align:center;padding:4px 8px;">First Try</th><th style="text-align:left;padding:4px 8px;">All Attempts</th></tr>';
    
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const attempts = entry.attempts || [];
        const correctWord = words[i];
        
        // Check if first attempt was correct
        const firstTryCorrect = attempts.length > 0 && attempts[0] === correctWord;
        const eventuallyCorrect = attempts.includes(correctWord);
        
        html += `<tr style="background:#f8fafc;"><td style="font-weight:bold;padding:4px 8px;">${words[i]}</td><td style="text-align:center;padding:4px 8px;">`;
        
        // Show first try result
        if (firstTryCorrect) {
            html += `<span style='font-size:1.5em;color:#22c55e;'>✅</span>`;
        } else {
            html += `<span style='font-size:1.5em;color:#ef4444;'>❌</span>`;
        }
        
        // Add hint indicator
        if (hintUsed[i]) {
            html += `<span style='color:#fbbf24;font-weight:700;font-size:1.2em;margin-left:6px;' title='Hint used'>H</span>`;
        }
        
        html += `</td><td style="color:#888;padding:4px 8px;">`;
        
        // Show all attempts
        if (attempts.length > 0) {
            const attemptsList = attempts.map((attempt, idx) => {
                if (attempt === correctWord) {
                    return `<span style="color:#22c55e;font-weight:600;">${attempt}</span>`;
                } else {
                    return `<span style="color:#ef4444;">${attempt}</span>`;
                }
            }).join(' → ');
            html += attemptsList;
            
            // Add status if eventually correct but not first try
            if (!firstTryCorrect && eventuallyCorrect) {
                html += ` <span style="color:#f59e0b;font-size:0.8em;">(eventually correct)</span>`;
            }
        } else {
            html += 'No attempts';
        }
        
        html += '</td></tr>';
    }
    html += '</table></div>';
    
    // Calculate and show first-try score
    const firstTryCorrectCount = words.filter((word, i) => {
        const attempts = (userAnswers[i] || {}).attempts || [];
        return attempts.length > 0 && attempts[0] === word;
    }).length;
    
    const firstTryScore = Math.round((firstTryCorrectCount / words.length) * 100);
    
    html += `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;">
        <strong>First-Try Score: ${firstTryScore}% (${firstTryCorrectCount}/${words.length})</strong>
    </div>`;
    
    showModal(html);
    lastQuizComplete = true;
    
    // Save quiz results to Firebase
    console.log('About to call saveQuizResults...');
    console.log('Current userAnswers:', userAnswers);
    console.log('Current hintUsed:', hintUsed);
    console.log('Current words:', words);
    saveQuizResults();
}

// --- Load Words from Firestore ---
async function loadWordsFromFirestore() {
    console.log('Loading words from Firestore...');
    try {
        const wordData = await getWordsFromAssignment(userName);
        words = [...wordData.words]; // Create a copy
        currentWordSetId = wordData.setId;
        currentWordSetName = wordData.setName;
        
        console.log('Loaded words from Firebase:', words);
        console.log('Word set:', currentWordSetName);
        
        // Always shuffle words on every page load/refresh
        if (words.length > 1) {
            shuffleArray(words);
            console.log('Shuffled words for this session:', words);
        }
        
        resetQuizState();
        updateDisplay();
        updateWordSetPanel();
    } catch (error) {
        console.error('Error loading words from Firebase:', error);
        words = ["want", "went", "what", "should", "could"];
        currentWordSetId = null;
        currentWordSetName = 'Default Set';
        if (words.length > 1) {
            shuffleArray(words);
            console.log('Shuffled fallback words:', words);
        }
        resetQuizState();
        updateDisplay();
        updateWordSetPanel();
    }
}

// Save quiz results to Firebase
async function saveQuizResults() {
    console.log('Saving quiz results...');
    console.log('Raw data - words:', words);
    console.log('Raw data - userAnswers:', userAnswers);
    console.log('Raw data - hintUsed:', hintUsed);
    
    try {
        // Transform data to match teacher dashboard expectations
        const wordsData = words.map((word, index) => {
            const userAnswer = userAnswers[index] || { attempts: [], correct: false };
            const attempts = userAnswer.attempts || [];
            
            // A word is only correct if the FIRST attempt was correct
            const firstAttemptCorrect = attempts.length > 0 && attempts[0] === word;
            
            const wordObj = {
                word: word,
                correct: firstAttemptCorrect, // Only true if first attempt was correct
                attempts: attempts,
                hint: hintUsed[index] || false,
                firstTryCorrect: firstAttemptCorrect // Explicit field for first-try scoring
            };
            console.log(`Word ${index}:`, wordObj);
            return wordObj;
        });
        
        const now = new Date();
        const quizData = {
            user: userName,  // Changed from userName to user
            date: now.toISOString(), // Use ISO string for consistent parsing
            words: wordsData,  // Changed to array of word objects
            wordSetId: currentWordSetId, // Include word set ID for tracking
            wordSetName: currentWordSetName, // Include word set name for display
            timestamp: now, // Firebase timestamp for server-side operations
            completedAt: now // Additional timestamp for completion tracking
        };
        
        console.log('Final quiz data to save:', JSON.stringify(quizData, null, 2));
        const docRef = await window.db.collection('results').add(quizData);
        console.log('Quiz results saved successfully with ID:', docRef.id);
        
        // Show a brief success message to the user
        showNotification('Quiz results saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving quiz results:', error);
        showNotification('Error saving quiz results. Please try again.', 'error');
    }
}

// Add a simple notification function for the student app
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        transition: all 0.3s ease;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 2000); // Shorter duration for student app
}

// Show all words in a modal
function showAllWords() {
    // Use the words array that was loaded from Firebase, not localStorage
    const allWords = words.length > 0 ? words : ["want", "went", "what", "should", "could"];
    console.log('showAllWords - current words array:', words);
    console.log('showAllWords - displaying words:', allWords);
    if (allWords.length === 0) {
        showModal('<h2>No Words Available</h2><p>Please check with your teacher for word assignments.</p>');
        return;
    }
    
    let html = '<h2 style="margin-bottom:18px;">All Words</h2>';
    
    // Show which word set is being used
    if (currentWordSetName) {
        html += `<div style="color:#64748b;font-size:0.9rem;margin-bottom:16px;">Word Set: <strong>${currentWordSetName}</strong></div>`;
    }
    
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;max-width:400px;">';
    
    allWords.forEach((word, index) => {
        html += `<div style="background:#f8fafc;border:2px solid #e0e7ef;border-radius:8px;padding:12px;text-align:center;font-weight:600;color:#2563eb;">${word}</div>`;
    });
    
    html += '</div>';
    html += `<p style="margin-top:16px;color:#666;font-size:0.9rem;">Total: ${allWords.length} words</p>`;
    showModal(html);
}

// --- Init ---
// Check if Firebase is available and load words accordingly
function initializeApp() {
    console.log('Initializing app...');
    console.log('window.db available:', !!window.db);
    console.log('firebase available:', typeof firebase !== 'undefined');
    
    if (window.db) {
        console.log('Firebase is available, loading from Firestore');
        // Load available word sets first, then load words
        loadAvailableWordSets().then(() => {
            loadWordsFromFirestore();
        });
        
        // Setup word set panel
        setupWordSetPanel();
    } else {
        console.log('Firebase not available, using default words');
        words = ["want", "went", "what", "should", "could"];
        currentWordSetId = null;
        currentWordSetName = 'Default Set';
        resetQuizState();
        updateDisplay();
        updateWordSetPanel();
    }
}

// Wait for Firebase to load, then initialize
if (typeof firebase !== 'undefined' && window.db) {
    initializeApp();
} else {
    // Wait a bit for Firebase to load
    setTimeout(() => {
        initializeApp();
    }, 1000);
} 