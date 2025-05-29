// Spelling Practice App - Enhanced Version with Word Sets Support
// --- Configurable word list (now supports word sets from teacher dashboard) ---
const defaultWords = ["want", "went", "what", "should", "could"];

// Word set selection variables
let availableWordSets = [];
let selectedWordSetId = null;
let userAssignmentId = null;

// Variables for individual word practice
let isIndividualWordPractice = false;
let originalPracticeState = null;

async function getWordsFromAssignment(userName) {
    try {
        console.log(`=== GETTING WORDS FOR USER: ${userName} ===`);
        
        // Normalize the username for better matching
        const normalizedUserName = userName.trim().toLowerCase();
        console.log(`Normalized username: "${normalizedUserName}"`);
        
        // First, try to find if this user has a specific assignment
        const studentsSnapshot = await window.db.collection('students').get();
        let studentDoc = null;
        let studentData = null;
        let studentId = null;
        
        // Find student with case-insensitive matching
        studentsSnapshot.forEach(doc => {
            const docData = doc.data();
            if (docData.name && docData.name.trim().toLowerCase() === normalizedUserName) {
                studentDoc = doc;
                studentData = docData;
                studentId = doc.id;
            }
        });
        
        if (studentDoc) {
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
                if (wordSetDoc.exists && wordSetDoc.data().words && wordSetDoc.data().words.length > 0) {
                    console.log(`Using specific assignment for ${userName}: "${wordSetDoc.data().name}"`);
                    return {
                        words: wordSetDoc.data().words,
                        setId: wordSetId,
                        setName: wordSetDoc.data().name
                    };
                } else {
                    console.log(`Assignment word set ${wordSetId} is empty or invalid, checking alternatives...`);
                }
            }
            
            // No specific assignment - check for student's default word set (second priority)
            if (studentData.defaultWordSetId) {
                console.log(`No specific assignment, checking student's default word set: ${studentData.defaultWordSetId}`);
                const wordSetDoc = await window.db.collection('wordSets').doc(studentData.defaultWordSetId).get();
                if (wordSetDoc.exists && wordSetDoc.data().words && wordSetDoc.data().words.length > 0) {
                    console.log(`Using student's default word set for ${userName}: "${wordSetDoc.data().name}"`);
                    return {
                        words: wordSetDoc.data().words,
                        setId: studentData.defaultWordSetId,
                        setName: wordSetDoc.data().name
                    };
                } else {
                    console.log(`Student's default word set ${studentData.defaultWordSetId} is empty or invalid, checking alternatives...`);
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
                    if (wordSetDoc.exists && wordSetDoc.data().words && wordSetDoc.data().words.length > 0) {
                        console.log(`Using class default word set for ${userName}: "${wordSetDoc.data().name}"`);
                        return {
                            words: wordSetDoc.data().words,
                            setId: classDefaultWordSetId,
                            setName: wordSetDoc.data().name
                        };
                    } else {
                        console.log(`Class default word set ${classDefaultWordSetId} is empty or invalid, checking alternatives...`);
                    }
                }
            }
            
            console.log(`No specific assignment or defaults found for student ${userName}`);
        } else {
            console.log(`Student ${userName} not found in database`);
        }
        
        // If no specific assignment or defaults, find the best available word set
        console.log('No assignment or defaults found, checking for available word sets...');
        const wordSetsSnapshot = await window.db.collection('wordSets').get();
        
        if (!wordSetsSnapshot.empty) {
            // Filter out empty or invalid word sets and find the best one
            const validWordSets = [];
            wordSetsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.words && Array.isArray(data.words) && data.words.length > 0) {
                    // Avoid test sets with single letters
                    const hasValidWords = data.words.some(word => word.length > 1);
                    if (hasValidWords) {
                        validWordSets.push({ id: doc.id, ...data });
                    }
                }
            });
            
            if (validWordSets.length > 0) {
                // Prefer word sets with "basic" or "default" in the name, otherwise use the first valid one
                const preferredSet = validWordSets.find(set => 
                    set.name.toLowerCase().includes('basic') || 
                    set.name.toLowerCase().includes('default')
                ) || validWordSets[0];
                
                console.log(`Using available word set: "${preferredSet.name}"`);
                return {
                    words: preferredSet.words,
                    setId: preferredSet.id,
                    setName: preferredSet.name
                };
            }
        }
        
        // If no word sets exist, try to get the active word set from the main wordlist
        console.log('No valid word sets found, checking main wordlist...');
        const doc = await window.db.collection('spelling').doc('wordlist').get();
        if (doc.exists && doc.data().activeSetId) {
            const wordSetDoc = await window.db.collection('wordSets').doc(doc.data().activeSetId).get();
            if (wordSetDoc.exists && wordSetDoc.data().words && wordSetDoc.data().words.length > 0) {
                console.log(`Using active word set: "${wordSetDoc.data().name}"`);
                return {
                    words: wordSetDoc.data().words,
                    setId: doc.data().activeSetId,
                    setName: wordSetDoc.data().name
                };
            }
        }
        
        // Fallback to the old wordlist format
        if (doc.exists && doc.data().words && doc.data().words.length > 0) {
            console.log('Using legacy word list');
            return {
                words: doc.data().words,
                setId: null,
                setName: 'Legacy Set'
            };
        }
        
        // Final fallback to default words
        console.log('Using default words as final fallback');
        return {
            words: defaultWords,
            setId: null,
            setName: 'Default Set'
        };
        
    } catch (error) {
        console.error('Error getting words from assignment:', error);
        console.log('Error occurred, using default words');
        return {
            words: defaultWords,
            setId: null,
            setName: 'Default Set'
        };
    }
}

// Load available word sets for the selection panel (only assigned sets)
async function loadAvailableWordSets() {
    try {
        console.log(`Loading assigned word sets for user: ${userName}`);
        availableWordSets = [];
        
        // First, try to find if this user has assignments
        const studentsSnapshot = await window.db.collection('students').where('name', '==', userName).get();
        
        if (!studentsSnapshot.empty) {
            const studentDoc = studentsSnapshot.docs[0];
            const studentData = studentDoc.data();
            const studentId = studentDoc.id;
            
            // Get individual assignments
            const assignmentsSnapshot = await window.db.collection('assignments').where('studentId', '==', studentId).get();
            const assignedWordSetIds = new Set();
            
            assignmentsSnapshot.forEach(doc => {
                assignedWordSetIds.add(doc.data().wordSetId);
            });
            
            // Add student's default word set if exists
            if (studentData.defaultWordSetId) {
                assignedWordSetIds.add(studentData.defaultWordSetId);
            }
            
            // Add class default word set if exists
            if (studentData.classId) {
                const classDoc = await window.db.collection('classes').doc(studentData.classId).get();
                if (classDoc.exists && classDoc.data().defaultWordSetId) {
                    assignedWordSetIds.add(classDoc.data().defaultWordSetId);
                }
            }
            
            // Load only the assigned word sets
            if (assignedWordSetIds.size > 0) {
                for (const wordSetId of assignedWordSetIds) {
                    try {
                        const wordSetDoc = await window.db.collection('wordSets').doc(wordSetId).get();
                        if (wordSetDoc.exists) {
                            availableWordSets.push({ id: wordSetDoc.id, ...wordSetDoc.data() });
                        }
                    } catch (error) {
                        console.error(`Error loading word set ${wordSetId}:`, error);
                    }
                }
            }
            
            console.log(`Found ${availableWordSets.length} assigned word sets for ${userName}`);
        } else {
            console.log(`Student ${userName} not found in database - no assigned word sets`);
        }
        
        // Populate the word set select dropdown with only assigned sets
        const wordSetSelect = document.getElementById('wordSetSelect');
        if (wordSetSelect) {
            wordSetSelect.innerHTML = '<option value="">Choose a word set...</option>';
            
            if (availableWordSets.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No word sets assigned';
                option.disabled = true;
                wordSetSelect.appendChild(option);
            } else {
                availableWordSets.forEach(set => {
                    const option = document.createElement('option');
                    option.value = set.id;
                    option.textContent = `${set.name} (${set.words.length} words)`;
                    wordSetSelect.appendChild(option);
                });
            }
        }
        
        console.log('Loaded assigned word sets:', availableWordSets);
    } catch (error) {
        console.error('Error loading assigned word sets:', error);
        availableWordSets = [];
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
            // Use custom selected word set - but only if it's in the assigned sets
            const selectedSetId = wordSetSelect.value;
            const selectedSet = availableWordSets.find(set => set.id === selectedSetId);
            
            if (!selectedSet) {
                showNotification('Selected word set is not assigned to you', 'error');
                return;
            }
            
            // Double-check that this word set is actually assigned to the student
            const isAssigned = await verifyWordSetAssignment(userName, selectedSetId);
            if (!isAssigned) {
                showNotification('You do not have permission to access this word set', 'error');
                return;
            }
            
            wordData = {
                words: selectedSet.words,
                setId: selectedSet.id,
                setName: selectedSet.name
            };
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
        updatePracticeModeUI();
        
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

// Verify that a word set is actually assigned to the student
async function verifyWordSetAssignment(userName, wordSetId) {
    try {
        const studentsSnapshot = await window.db.collection('students').where('name', '==', userName).get();
        
        if (studentsSnapshot.empty) {
            return false;
        }
        
        const studentDoc = studentsSnapshot.docs[0];
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        
        // Check individual assignments
        const assignmentsSnapshot = await window.db.collection('assignments').where('studentId', '==', studentId).get();
        for (const doc of assignmentsSnapshot.docs) {
            if (doc.data().wordSetId === wordSetId) {
                return true;
            }
        }
        
        // Check student's default word set
        if (studentData.defaultWordSetId === wordSetId) {
            return true;
        }
        
        // Check class default word set
        if (studentData.classId) {
            const classDoc = await window.db.collection('classes').doc(studentData.classId).get();
            if (classDoc.exists && classDoc.data().defaultWordSetId === wordSetId) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error verifying word set assignment:', error);
        return false;
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
const hintButton = document.getElementById('hintButton');
const alphabetsButton = document.getElementById('alphabetsButton');
const alphabetKeyboard = document.getElementById('alphabetKeyboard');
const exitPracticeButton = document.getElementById('exitPracticeButton');
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
let isPracticeMode = false;
let practiceWords = [];
let originalWords = [];
let practiceResults = [];
let isAlphabetKeyboardVisible = false;
let currentFocusedLetterBox = null;
let isCheckingSpelling = false; // Prevent double-checking

// --- Name Prompt ---
function promptUserName() {
    // Always require sign-in - no auto-login on refresh
    console.log('=== AUTHENTICATION REQUIRED ===');
    console.log('Browser refresh detected - requiring fresh sign-in');
    console.log('=== END DEBUG ===');
    
    // Clear any stored authentication data
    localStorage.removeItem('userName');
    localStorage.removeItem('userAuthenticated');
    
    // Always show the sign-in modal
    console.log('Showing sign-in modal...');
    setTimeout(() => {
        showNameModal();
    }, 300); // Small delay to ensure DOM is fully ready
}

function showNameModal() {
    const nameModal = document.getElementById('nameModal');
    const nameInput = document.getElementById('studentNameInput');
    const passwordInput = document.getElementById('studentPasswordInput');
    const submitBtn = document.getElementById('submitNameBtn');
    const cancelBtn = document.getElementById('cancelNameBtn');
    const clearBtn = document.getElementById('clearNameBtn');
    const togglePasswordBtn = document.getElementById('toggleStudentPasswordVisibility');
    const errorDiv = document.getElementById('nameError');
    
    if (!nameModal || !nameInput || !passwordInput || !submitBtn) return;
    
    // Reset modal state
    nameInput.value = '';
    passwordInput.value = '';
    errorDiv.style.display = 'none';
    submitBtn.classList.remove('loading');
    nameModal.classList.remove('success');
    
    // Show modal
    nameModal.style.display = 'flex';
    
    // Focus on name input after animation
    setTimeout(() => {
        nameInput.focus();
    }, 300);
    
    // Handle input events
    nameInput.addEventListener('input', function() {
        errorDiv.style.display = 'none';
        submitBtn.classList.remove('loading');
    });
    
    passwordInput.addEventListener('input', function() {
        errorDiv.style.display = 'none';
        submitBtn.classList.remove('loading');
    });
    
    // Handle Enter key on both inputs
    nameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInput.focus(); // Move to password field
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideNameModal();
        }
    });
    
    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNameSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideNameModal();
        }
    });
    
    // Handle clear button
    clearBtn.addEventListener('click', function() {
        nameInput.value = '';
        passwordInput.value = '';
        nameInput.focus();
    });
    
    // Handle password visibility toggle
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const icon = togglePasswordBtn.querySelector('.password-toggle-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                icon.textContent = '👁️';
            }
        });
    }
    
    // Handle submit button
    submitBtn.addEventListener('click', handleNameSubmit);
    
    // Handle cancel button - no default user, just close
    cancelBtn.addEventListener('click', function() {
        hideNameModal();
        showNotification('Sign-in cancelled. Please refresh to try again.', 'info');
    });
    
    // Handle click outside modal - no default user, just close
    nameModal.addEventListener('click', function(e) {
        if (e.target === nameModal) {
            hideNameModal();
            showNotification('Sign-in cancelled. Please refresh to try again.', 'info');
        }
    });
    
    async function handleNameSubmit() {
        const name = nameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!name || name.length < 1) {
            showNameError('Please enter your name.');
            return;
        }
        
        if (!password || password.length < 1) {
            showNameError('Please enter your password.');
            return;
        }
        
        if (name.length > 50) {
            showNameError('Name is too long. Please use 50 characters or less.');
            return;
        }
        
        // Check password
        if (password !== '123456') {
            showNameError('Incorrect password. Please try again.');
            return;
        }
        
        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Verifying...';
        
        try {
            // Verify name exists in database
            const isValidUser = await verifyUserInDatabase(name);
            
            if (!isValidUser) {
                showNameError('Name not found in records. Please check with your teacher.');
                submitBtn.classList.remove('loading');
                submitBtn.textContent = 'Sign In';
                return;
            }
            
            // Success - user authenticated
            showNameSuccess();
            
            setTimeout(() => {
                userName = name;
                localStorage.setItem('userName', userName);
                localStorage.setItem('userAuthenticated', 'true');
                hideNameModal();
                
                // Initialize the app after successful authentication
                initializeApp();
            }, 800);
            
        } catch (error) {
            console.error('Error verifying user:', error);
            showNameError('Error connecting to server. Please try again.');
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Sign In';
        }
    }
    
    function showNameError(message) {
        const errorText = errorDiv.querySelector('.error-text');
        if (errorText) {
            errorText.textContent = message;
        }
        errorDiv.style.display = 'flex';
        nameInput.classList.add('error');
        passwordInput.classList.add('error');
        nameModal.classList.add('shake');
        
        setTimeout(() => {
            nameModal.classList.remove('shake');
            nameInput.classList.remove('error');
            passwordInput.classList.remove('error');
        }, 500);
        
        nameInput.focus();
    }
    
    function showNameSuccess() {
        nameModal.classList.add('success');
        submitBtn.textContent = '✓ Welcome!';
        submitBtn.classList.remove('loading');
        errorDiv.style.display = 'none';
    }
}

function hideNameModal() {
    const nameModal = document.getElementById('nameModal');
    if (nameModal) {
        nameModal.style.display = 'none';
        nameModal.classList.remove('success', 'shake');
    }
}

// Verify if user exists in the database
async function verifyUserInDatabase(userName) {
    try {
        console.log(`Verifying user "${userName}" in database...`);
        
        // Normalize the username for better matching
        const normalizedUserName = userName.trim().toLowerCase();
        
        // Check if user exists in students collection
        const studentsSnapshot = await window.db.collection('students').get();
        let userExists = false;
        
        studentsSnapshot.forEach(doc => {
            const docData = doc.data();
            if (docData.name && docData.name.trim().toLowerCase() === normalizedUserName) {
                userExists = true;
                console.log(`User "${userName}" found in database`);
            }
        });
        
        if (!userExists) {
            console.log(`User "${userName}" not found in database`);
        }
        
        return userExists;
        
    } catch (error) {
        console.error('Error verifying user in database:', error);
        throw error;
    }
}

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

// Play encouragement sound for incorrect answers
function playEncouragementSound() {
    try {
        // Create a simple encouraging tone using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a gentle, encouraging tone sequence
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A note
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime + 0.1); // C note
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.2); // E note
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        // Fallback: just log if audio context fails
        console.log('Encouragement sound not available');
    }
}

// Play success sound for correct answers
function playSuccessSound() {
    try {
        // Create a celebratory tone using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a happy, celebratory tone sequence (major chord progression)
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C note
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E note
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G note
        oscillator.frequency.setValueAtTime(1047, audioContext.currentTime + 0.3); // High C note
        
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // Fallback: just log if audio context fails
        console.log('Success sound not available');
    }
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
            // Prevent processing if quiz is complete or word has changed
            if (quizComplete || !words[currentWordIndex]) return;
            
            // Ensure only single character and convert to lowercase for consistency
            if (box.value.length > 1) {
                box.value = box.value.charAt(0).toLowerCase();
            } else if (box.value.length === 1) {
                box.value = box.value.toLowerCase();
            }
            
            if (box.value.length === 1 && i < wordLength - 1) {
                // Move to next box
                if (letterInputs[i + 1]) {
                    letterInputs[i + 1].focus();
                }
            } else if (box.value.length === 1 && i === wordLength - 1) {
                // Auto-check when last letter is entered
                setTimeout(() => {
                    if (!quizComplete && words[currentWordIndex]) {
                        checkSpelling();
                    }
                }, 100);
            }
        });
        
        box.addEventListener('keydown', function(e) {
            // Prevent processing if quiz is complete
            if (quizComplete) return;
            
            if (e.key === ' ') {
                e.preventDefault();
                if (words[currentWordIndex] && words[currentWordIndex][i]) {
                    box.value = words[currentWordIndex][i];
                    box.disabled = true;
                    
                    // Track which letter position was hinted
                    if (!hintUsed[currentWordIndex]) {
                        hintUsed[currentWordIndex] = [];
                    }
                    if (!hintUsed[currentWordIndex].includes(i)) {
                        hintUsed[currentWordIndex].push(i);
                    }
                    
                    // Move focus to next box if available
                    if (i < wordLength - 1 && letterInputs[i + 1]) {
                        letterInputs[i + 1].focus();
                    } else {
                        // Auto-check if this was the last letter
                        setTimeout(() => {
                            if (!quizComplete && words[currentWordIndex]) {
                                checkSpelling();
                            }
                        }, 100);
                    }
                }
            }
            
            // Enhanced backspace and delete handling for better user experience
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault(); // Prevent default behavior
                
                if (box.value !== '') {
                    // Clear current box if it has content
                    box.value = '';
                    box.disabled = false; // Re-enable if it was disabled from hint
                } else if (e.key === 'Backspace' && i > 0) {
                    // If current box is empty and backspace pressed, move to previous box and clear it
                    if (letterInputs[i - 1]) {
                        letterInputs[i - 1].value = '';
                        letterInputs[i - 1].disabled = false; // Re-enable if it was disabled from hint
                        letterInputs[i - 1].focus();
                    }
                }
            }
            
            // Handle arrow keys for navigation
            if (e.key === 'ArrowLeft' && i > 0) {
                e.preventDefault();
                if (letterInputs[i - 1]) {
                    letterInputs[i - 1].focus();
                }
            }
            if (e.key === 'ArrowRight' && i < wordLength - 1) {
                e.preventDefault();
                if (letterInputs[i + 1]) {
                    letterInputs[i + 1].focus();
                }
            }
            
            // Handle Enter key to check spelling
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!quizComplete && words[currentWordIndex]) {
                    checkSpelling();
                }
            }
        });
        
        box.addEventListener('click', function(e) {
            if (!box.disabled) return;
            if (words[currentWordIndex] && box.value === words[currentWordIndex][i]) return;
            if (words[currentWordIndex] && words[currentWordIndex][i]) {
                box.value = words[currentWordIndex][i];
                box.disabled = true;
                
                // Track which letter position was hinted (same as spacebar logic)
                if (!hintUsed[currentWordIndex]) {
                    hintUsed[currentWordIndex] = [];
                }
                if (!hintUsed[currentWordIndex].includes(i)) {
                    hintUsed[currentWordIndex].push(i);
                }
            }
        });
        
        // Track focus for virtual keyboard
        box.addEventListener('focus', function(e) {
            currentFocusedLetterBox = box;
        });
        
        // Add double-click to clear any letter box (even hint letters)
        box.addEventListener('dblclick', function(e) {
            e.preventDefault();
            box.value = '';
            box.disabled = false;
            box.focus();
        });
        
        // Add right-click context menu to clear letter
        box.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            box.value = '';
            box.disabled = false;
            box.focus();
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

    // Stop voice input when changing words
    if (isVoiceInputActive) {
        stopVoiceInput();
    }

    // Reset double-check prevention flag when navigating
    isCheckingSpelling = false;

    // Ensure currentWordIndex is within bounds
    if (currentWordIndex < 0) currentWordIndex = 0;
    if (currentWordIndex >= words.length) currentWordIndex = words.length - 1;
    
    currentWordNumber.textContent = currentWordIndex + 1;
    totalWords.textContent = words.length;
    resultMessage.innerHTML = '';
    resultMessage.className = 'result-message';
    updateLetterHint();
    
    // Update results panel
    updateResultsPanel();
    
    if (progressBar) {
        const percent = ((currentWordIndex + 1) / words.length) * 100;
        progressBar.style.width = percent + '%';
    }
    
    // Update navigation buttons with proper state
    prevButton.disabled = currentWordIndex === 0 || quizComplete;
    nextButton.disabled = currentWordIndex === words.length - 1 || quizComplete;
    
    // Ensure proper focus after a short delay to allow DOM updates
    setTimeout(() => {
        if (letterInputs && letterInputs.length > 0 && letterInputs[0]) {
            letterInputs[0].focus();
        }
    }, 50);
}

function resetQuizState() {
    userAnswers = [];
    hintUsed = [];
    currentWordIndex = 0;
    quizComplete = false;
    lastQuizComplete = false;
    isCheckingSpelling = false; // Reset double-check prevention flag
    
    // Start time tracking
    window.quizStartTime = new Date();
    
    // Stop voice input when resetting quiz
    if (isVoiceInputActive) {
        stopVoiceInput();
    }
    
    for (let i = 0; i < words.length; i++) {
        userAnswers[i] = { attempts: [], correct: false };
        hintUsed[i] = []; // Change to array to track individual letter positions
    }
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
    updatePracticeModeUI();
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
    
    // Prevent double-checking
    if (isCheckingSpelling) {
        console.log('Already checking spelling, skipping...');
        return;
    }
    isCheckingSpelling = true;
    
    let userAnswer = letterInputs.map((box, idx) => box.value ? box.value.toLowerCase() : '').join('');
    const correctWord = words[currentWordIndex];
    
    console.log('=== CHECKING SPELLING ===');
    console.log('User answer:', userAnswer);
    console.log('Correct word:', correctWord);
    console.log('Letter inputs values:', letterInputs.map(box => box.value));
    
    if (!userAnswers[currentWordIndex]) {
        userAnswers[currentWordIndex] = { attempts: [], correct: false };
    }
    userAnswers[currentWordIndex].attempts.push(userAnswer);
    
    let isCorrect = userAnswer === correctWord;
    if (isCorrect) userAnswers[currentWordIndex].correct = true;
    
    console.log('Is correct:', isCorrect);
    console.log('=== END CHECKING SPELLING ===');
    
    // Check if hints were used for this word
    const usedHintsForThisWord = Array.isArray(hintUsed[currentWordIndex]) ? hintUsed[currentWordIndex].length > 0 : hintUsed[currentWordIndex];
    
    if (isCorrect && userAnswers[currentWordIndex].correct) {
        // Check if this word was completed without hints
        const isCorrectWithoutHints = !usedHintsForThisWord;
        
        // Play success sound for correct answers
        setTimeout(() => {
            playSuccessSound();
        }, 100);
        
        // Add to results panel
        addResultToPanel(currentWordIndex, true, userAnswer, usedHintsForThisWord);
        
        // Trigger celebration animation
        triggerCelebrationAnimation(isCorrectWithoutHints);
        
        resultMessage.innerHTML = '<span style="font-size:1.3em;">✅</span> Correct!';
        resultMessage.className = 'result-message correct';
        letterInputs.forEach(box => box.value = '');
        letterInputs.forEach(box => box.disabled = false);
        letterInputs[0].focus();
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            resultMessage.innerHTML = '';
            resultMessage.className = 'result-message';
            isCheckingSpelling = false; // Reset flag
            moveToNextWord();
            if (!quizComplete && words[currentWordIndex]) speakWord(words[currentWordIndex]);
        }, 2000);
    } else if (!isCorrect) {
        // Play encouragement sound for incorrect answers
        setTimeout(() => {
            playEncouragementSound();
        }, 200);
        
        // Add to results panel
        addResultToPanel(currentWordIndex, false, userAnswer, usedHintsForThisWord);
        
        // Don't show the correct answer to prevent cheating - just show it's wrong
        resultMessage.innerHTML = `<div style='color:#ef4444;font-weight:600;'>❌ Incorrect</div><div style='margin-top:6px;'>Your answer: <b style='color:#ef4444;'>${userAnswer}</b><br><small style='color:#6b7280;'>Try again or use hints (press SPACE on letter boxes)</small></div>`;
        resultMessage.className = 'result-message incorrect';
        letterInputs.forEach(box => box.value = '');
        letterInputs.forEach(box => box.disabled = false);
        letterInputs[0].focus();
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            resultMessage.innerHTML = '';
            resultMessage.className = 'result-message';
            isCheckingSpelling = false; // Reset flag
        }, 3000);
    }
}

// --- Event Listeners ---
speakButton.addEventListener('click', () => {
    if (words.length > 0) speakWord(words[currentWordIndex]);
});

allWordsButton.addEventListener('click', showAllWords);

// Hint button to show hint instruction
if (hintButton) {
    hintButton.addEventListener('click', () => {
        let message = 'Press SPACE on any letter box to reveal that letter';
        
        // Add voice input instructions if available
        if (recognition) {
            message += '\n\nOr use 🎤 Voice Input:\n• Click the Voice Input button\n• Speak letters clearly one by one\n• Say "bee" for B, "see" for C, etc.';
        }
        
        showNotification(message, 'info');
    });
}


// Exit Practice button to return to main quiz
if (exitPracticeButton) {
    exitPracticeButton.addEventListener('click', () => {
        if (isIndividualWordPractice) {
            exitIndividualWordPractice();
        } else {
            exitPracticeMode();
        }
    });
}

// Alphabets button to show/hide virtual keyboard
if (alphabetsButton) {
    alphabetsButton.addEventListener('click', () => {
        toggleAlphabetKeyboard();
    });
} else {
    console.log('alphabetsButton not found!');
}

// Note: Voice Input button event listener is set up in DOMContentLoaded event

// Function to clear all letter boxes

prevButton.addEventListener('click', () => {
    if (currentWordIndex > 0 && !quizComplete && words.length > 0) {
        currentWordIndex--;
        console.log(`Navigating to previous word: ${currentWordIndex + 1}/${words.length}`);
        updateDisplay();
        // Speak the new word after a short delay
        setTimeout(() => {
            if (words[currentWordIndex]) {
                speakWord(words[currentWordIndex]);
            }
        }, 200);
    }
});

nextButton.addEventListener('click', () => {
    if (currentWordIndex < words.length - 1 && !quizComplete && words.length > 0) {
        currentWordIndex++;
        console.log(`Navigating to next word: ${currentWordIndex + 1}/${words.length}`);
        updateDisplay();
        // Speak the new word after a short delay
        setTimeout(() => {
            if (words[currentWordIndex]) {
                speakWord(words[currentWordIndex]);
            }
        }, 200);
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
        if (isPracticeMode) {
            // After practice mode, check if there are still words that need practice
            setTimeout(() => {
                checkForContinuedPractice();
            }, 100);
        } else {
            // After main quiz, start new round
            setTimeout(async () => {
                await resetQuiz();
                setTimeout(() => {
                    if (words.length > 0) speakWord(words[0]);
                }, 200);
            }, 100);
        }
    }
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

function showEndOfQuizFeedback() {
    let allPerfectFirstTry = true;
    let wordsNeedingPractice = [];
    
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const attempts = entry.attempts || [];
        const correctWord = words[i];
        
        // Check if first attempt was correct
        const firstTryCorrect = attempts.length > 0 && attempts[0] === correctWord;
        if (!firstTryCorrect || (Array.isArray(hintUsed[i]) ? hintUsed[i].length > 0 : hintUsed[i])) {
            allPerfectFirstTry = false;
            // Add to practice list if wrong or hint used
            wordsNeedingPractice.push({
                word: correctWord,
                index: i,
                usedHint: Array.isArray(hintUsed[i]) ? hintUsed[i].length > 0 : hintUsed[i],
                gotWrong: !firstTryCorrect
            });
        }
    }
    
    let html = '<h2 style="margin-bottom:18px;">Quiz Complete!</h2>';
    
    // Show which word set was used
    if (currentWordSetName && !isPracticeMode) {
        html += `<div style="color:#64748b;font-size:0.9rem;margin-bottom:12px;">Word Set: <strong>${currentWordSetName}</strong></div>`;
    } else if (isPracticeMode) {
        html += `<div style="color:#f59e0b;font-size:0.9rem;margin-bottom:12px;">📚 <strong>Practice Mode Complete!</strong></div>`;
    }
    
    if (allPerfectFirstTry && !isPracticeMode) {
        // Trigger perfect quiz celebration animation
        triggerPerfectQuizCelebration();
        
        html += '<div style="color:#22c55e;font-size:1.3em;font-weight:700;margin-bottom:18px;background:#e7fbe9;padding:10px 0;border-radius:8px;">🎉 Perfect! You got everything correct on the first try!</div>';
    } else if (isPracticeMode) {
        html += '<div style="color:#3b82f6;font-size:1.2em;font-weight:700;margin-bottom:18px;background:#dbeafe;padding:10px 0;border-radius:8px;">🎯 Practice Session Complete!</div>';
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
        
        // Anti-cheating: Hide word if never answered correctly
        let displayWord;
        if (eventuallyCorrect) {
            displayWord = correctWord; // Show word if they got it right eventually
        } else {
            displayWord = '□'.repeat(correctWord.length); // Hide word if never correct
        }
        
        html += `<tr style="background:#f8fafc;"><td style="font-weight:bold;padding:4px 8px;"><span class="${eventuallyCorrect ? '' : 'letter-boxes-quiz'}">${displayWord}</span></td><td style="text-align:center;padding:4px 8px;">`;
        
        // Show first try result
        if (firstTryCorrect) {
            html += `<span style='font-size:1.5em;color:#22c55e;'>✅</span>`;
        } else {
            html += `<span style='font-size:1.5em;color:#ef4444;'>❌</span>`;
        }
        
        // Add hint indicator
        if (Array.isArray(hintUsed[i]) ? hintUsed[i].length > 0 : hintUsed[i]) {
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
    
    // Calculate and show first-try score (only for main quiz, not practice)
    if (!isPracticeMode) {
        const firstTryCorrectCount = words.filter((word, i) => {
            const attempts = (userAnswers[i] || {}).attempts || [];
            return attempts.length > 0 && attempts[0] === word;
        }).length;
        
        const firstTryScore = Math.round((firstTryCorrectCount / words.length) * 100);
        
        html += `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;">
            <strong>First-Try Score: ${firstTryScore}% (${firstTryCorrectCount}/${words.length})</strong>
        </div>`;
    }
    
    // Show practice option if there are words that need practice (only for main quiz)
    if (!isPracticeMode && wordsNeedingPractice.length > 0) {
        html += `<div style="margin-top:20px;padding:16px;background:#fff3cd;border:2px solid #ffc107;border-radius:12px;">
            <h3 style="margin:0 0 12px 0;color:#856404;">🎯 Practice Opportunity!</h3>
            <p style="margin:0 0 12px 0;color:#856404;">You have <strong>${wordsNeedingPractice.length} word${wordsNeedingPractice.length > 1 ? 's' : ''}</strong> that could use more practice:</p>
            <div style="margin:8px 0;font-weight:600;color:#856404;">`;
        
        wordsNeedingPractice.forEach((item, index) => {
            const reason = item.usedHint && item.gotWrong ? 'hint + wrong' : 
                         item.usedHint ? 'used hint' : 'got wrong';
            // Hide words that need practice to prevent cheating
            const hiddenWord = '□'.repeat(item.word.length);
            html += `<span class="letter-boxes-quiz">${hiddenWord}</span> (${reason})`;
            if (index < wordsNeedingPractice.length - 1) html += ', ';
        });
        
        html += `</div>
            <button onclick="startPracticeMode()" style="background:#ffc107;color:#856404;border:none;padding:12px 24px;border-radius:8px;font-weight:600;cursor:pointer;margin-top:8px;">
                🎯 Practice These Words
            </button>
            <p style="margin:8px 0 0 0;font-size:0.85em;color:#856404;font-style:italic;">Practice sessions don't affect your quiz records</p>
        </div>`;
    }
    
    showModal(html);
    lastQuizComplete = true;
    
    // Save quiz results to Firebase (only for main quiz, not practice)
    if (!isPracticeMode) {
        console.log('About to call saveQuizResults...');
        console.log('Current userAnswers:', userAnswers);
        console.log('Current hintUsed:', hintUsed);
        console.log('Current words:', words);
        saveQuizResults();
    } else {
        console.log('Practice mode complete - not saving results to Firebase');
    }
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
        updatePracticeModeUI();
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
        updatePracticeModeUI();
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
                hint: Array.isArray(hintUsed[index]) ? hintUsed[index].length > 0 : hintUsed[index] || false,
                hintLetters: Array.isArray(hintUsed[index]) ? hintUsed[index] : [], // Track which letters were hinted
                firstTryCorrect: firstAttemptCorrect // Explicit field for first-try scoring
            };
            console.log(`Word ${index}:`, wordObj);
            return wordObj;
        });
        
        const now = new Date();
        
        // Calculate total time if we have a start time
        let totalTimeSeconds = 0;
        if (window.quizStartTime) {
            totalTimeSeconds = Math.round((now - window.quizStartTime) / 1000);
        }
        
        const quizData = {
            user: userName,  // Changed from userName to user
            date: now.toISOString(), // Use ISO string for consistent parsing
            words: wordsData,  // Changed to array of word objects
            wordSetId: currentWordSetId, // Include word set ID for tracking
            wordSetName: currentWordSetName, // Include word set name for display
            timestamp: now, // Firebase timestamp for server-side operations
            completedAt: now, // Additional timestamp for completion tracking
            totalTimeSeconds: totalTimeSeconds // Add total time in seconds
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
    
    let html = '<h2 style="margin-bottom:18px;">📋 Wordlist</h2>';
    
    // Show which word set is being used
    if (currentWordSetName) {
        html += `<div style="color:#64748b;font-size:0.9rem;margin-bottom:16px;">Word Set: <strong>${currentWordSetName}</strong></div>`;
    }
    
    // Add instruction for clicking words
    html += '<div style="color:#3b82f6;font-size:0.9rem;margin-bottom:16px;font-style:italic;">💡 Click on any word to practice it individually!</div>';
    
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;max-width:400px;">';
    
    allWords.forEach((word, index) => {
        html += `<div class="word-item" onclick="practiceIndividualWord('${word}')" style="background:#f8fafc;border:2px solid #e0e7ef;border-radius:8px;padding:12px;text-align:center;font-weight:600;color:#2563eb;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='#dbeafe'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='#f8fafc'; this.style.transform='scale(1)'">${word}</div>`;
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

// Initialize the app - first prompt for name, then start
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking for user name...');
    
    // Set up results toggle button event listener
    const resultsToggleButton = document.getElementById('resultsToggleButton');
    if (resultsToggleButton) {
        resultsToggleButton.addEventListener('click', toggleResultsPanel);
        console.log('Results toggle button event listener added');
    } else {
        console.log('Results toggle button not found');
    }
    
    // Set up sign out button event listener
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function() {
            // Immediate sign out without confirmation
            localStorage.clear();
            showNotification('🚪 Signed out successfully! Reloading...', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        });
        console.log('Sign out button event listener added');
    } else {
        console.log('Sign out button not found');
    }
    
    // Always require fresh sign-in on page load
    console.log('DOM loaded, requiring fresh authentication...');
    
    // Always prompt for authentication - no auto-login
    promptUserName();
});


// Password protection for teacher dashboard
document.addEventListener('DOMContentLoaded', function() {
    const teacherLink = document.querySelector('.teacher-link');
    const passwordModal = document.getElementById('passwordModal');
    const teacherPasswordInput = document.getElementById('teacherPasswordInput');
    const togglePasswordVisibility = document.getElementById('togglePasswordVisibility');
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    const submitPasswordBtn = document.getElementById('submitPasswordBtn');
    const passwordError = document.getElementById('passwordError');
    
    if (teacherLink) {
        teacherLink.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent default navigation
            showPasswordModal();
        });
    }
    
    // Show password modal
    function showPasswordModal() {
        passwordModal.style.display = 'flex';
        teacherPasswordInput.value = '';
        passwordError.style.display = 'none';
        teacherPasswordInput.focus();
        
        // Add escape key listener
        document.addEventListener('keydown', handleEscapeKey);
    }
    
    // Hide password modal
    function hidePasswordModal() {
        passwordModal.style.display = 'none';
        document.removeEventListener('keydown', handleEscapeKey);
    }
    
    // Handle escape key
    function handleEscapeKey(e) {
        if (e.key === 'Escape') {
            hidePasswordModal();
        }
    }
    
    // Toggle password visibility
    if (togglePasswordVisibility) {
        togglePasswordVisibility.addEventListener('click', function() {
            const input = teacherPasswordInput;
            const icon = document.querySelector('.password-toggle-icon');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = '🙈';
            } else {
                input.type = 'password';
                icon.textContent = '👁️';
            }
        });
    }
    
    // Cancel button
    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', function() {
            hidePasswordModal();
        });
    }
    
    // Submit button
    if (submitPasswordBtn) {
        submitPasswordBtn.addEventListener('click', function() {
            handlePasswordSubmit();
        });
    }
    
    // Enter key support
    if (teacherPasswordInput) {
        teacherPasswordInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePasswordSubmit();
            }
        });
    }
    
    // Handle password submission
    function handlePasswordSubmit() {
        const password = teacherPasswordInput.value.trim();
        
        if (!password) {
            showPasswordError('Please enter a password');
            return;
        }
        
        // Add loading state
        submitPasswordBtn.classList.add('loading');
        submitPasswordBtn.textContent = '';
        
        // Simulate a brief loading delay for better UX
        setTimeout(() => {
            if (password === '9739') {
                // Correct password - show success and redirect
                showPasswordSuccess();
                setTimeout(() => {
                    window.location.href = 'teacher.html?auth=verified';
                }, 1000);
            } else {
                // Wrong password - show error
                showPasswordError('Incorrect password. Please try again.');
                submitPasswordBtn.classList.remove('loading');
                submitPasswordBtn.textContent = 'Access Dashboard';
                
                // Clear the input and focus it
                teacherPasswordInput.value = '';
                teacherPasswordInput.focus();
            }
        }, 800);
    }
    
    // Show password error
    function showPasswordError(message) {
        const errorText = document.querySelector('.error-text');
        if (errorText) {
            errorText.textContent = message;
        }
        passwordError.style.display = 'flex';
        
        // Add shake animation to the modal
        const modal = document.querySelector('.password-modal');
        modal.style.animation = 'none';
        setTimeout(() => {
            modal.style.animation = 'shake 0.5s ease-in-out';
        }, 10);
    }
    
    // Show password success
    function showPasswordSuccess() {
        passwordError.style.display = 'none';
        submitPasswordBtn.classList.remove('loading');
        submitPasswordBtn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
        submitPasswordBtn.textContent = '✅ Access Granted!';
        
        // Show success notification
        showNotification('✅ Access granted! Redirecting to teacher dashboard...', 'success');
    }
    
    // Click outside modal to close
    if (passwordModal) {
        passwordModal.addEventListener('click', function(e) {
            if (e.target === passwordModal) {
                hidePasswordModal();
            }
        });
    }
});

// Function to show password error with countdown
function showPasswordError() {
    let countdown = 8;
    showNotification(`❌ Incorrect password! Returning to practice in ${countdown} seconds...`, 'error');
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            showNotification(`❌ Incorrect password! Returning to practice in ${countdown} seconds...`, 'error');
        } else {
            clearInterval(countdownInterval);
            showNotification('🔄 Returning to practice...', 'info');
            // Focus back on the practice area
            if (letterInputs && letterInputs.length > 0 && letterInputs[0]) {
                letterInputs[0].focus();
            }
        }
    }, 1000);
}

// Function to start practice mode with words that need practice
function startPracticeMode() {
    console.log('Starting practice mode...');
    
    // Identify words that need practice (wrong or hint used)
    practiceWords = [];
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const attempts = entry.attempts || [];
        const correctWord = words[i];
        const firstTryCorrect = attempts.length > 0 && attempts[0] === correctWord;
        
        if (!firstTryCorrect || (Array.isArray(hintUsed[i]) ? hintUsed[i].length > 0 : hintUsed[i])) {
            practiceWords.push(correctWord);
        }
    }
    
    if (practiceWords.length === 0) {
        showNotification('No words need practice!', 'success');
        return;
    }
    
    // Store original words and switch to practice mode
    originalWords = [...words];
    words = [...practiceWords];
    isPracticeMode = true;
    
    // Shuffle practice words
    if (words.length > 1) {
        shuffleArray(words);
    }
    
    // Reset state for practice
    resetQuizState();
    updateDisplay();
    closeModal();
    
    // Update UI to show practice mode
    updatePracticeModeUI();
    
    // Speak first word
    setTimeout(() => {
        if (words.length > 0) speakWord(words[0]);
    }, 500);
    
    showNotification(`Starting practice with ${words.length} word${words.length > 1 ? 's' : ''}!`, 'info');
}

// Function to update UI for practice mode
function updatePracticeModeUI() {
    const title = document.querySelector('.title');
    const exitButton = document.getElementById('exitPracticeButton');
    
    if (title) {
        // Preserve the logo and update the text
        const logoHtml = '<img src="logo.png" alt="Spelling Practice Logo" class="logo">';
        
        if (isIndividualWordPractice) {
            title.innerHTML = logoHtml + '🎯 Word Practice';
            title.style.color = '#10b981';
        } else if (isPracticeMode) {
            title.innerHTML = logoHtml + '🎯 Practice Mode';
            title.style.color = '#f59e0b';
        } else if (!isPracticeMode && !isIndividualWordPractice) {
            title.innerHTML = logoHtml + 'Spelling Practice';
            title.style.color = '#2563eb';
        }
    }
    
    // Show/hide exit practice button
    if (exitButton) {
        if (isIndividualWordPractice) {
            exitButton.style.display = 'inline-block';
            exitButton.textContent = '🔙 Back to Practice';
        } else if (isPracticeMode) {
            exitButton.style.display = 'inline-block';
            exitButton.textContent = '🚪 Exit Practice';
        } else {
            exitButton.style.display = 'none';
        }
    }
}

// Function to exit practice mode
function exitPracticeMode() {
    console.log('Exiting practice mode...');
    
    // Restore original words
    words = [...originalWords];
    isPracticeMode = false;
    practiceWords = [];
    
    // Reset state
    resetQuizState();
    updateDisplay();
    updatePracticeModeUI();
    
    showNotification('Returned to main quiz', 'info');
}

// Function to check if student wants to continue practicing
function checkForContinuedPractice() {
    // Check if there are still words that need practice in this practice session
    let stillNeedPractice = [];
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const attempts = entry.attempts || [];
        const correctWord = words[i];
        const firstTryCorrect = attempts.length > 0 && attempts[0] === correctWord;
        
        if (!firstTryCorrect || (Array.isArray(hintUsed[i]) ? hintUsed[i].length > 0 : hintUsed[i])) {
            stillNeedPractice.push(correctWord);
        }
    }
    
    if (stillNeedPractice.length > 0) {
        // Offer to continue practicing these words
        let html = `<h2 style="margin-bottom:18px;">Continue Practice?</h2>
            <p style="margin-bottom:16px;">You still have <strong>${stillNeedPractice.length} word${stillNeedPractice.length > 1 ? 's' : ''}</strong> that could use more practice:</p>
            <div style="margin:12px 0;font-weight:600;color:#f59e0b;">${stillNeedPractice.join(', ')}</div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">
                <button onclick="continuePractice()" style="background:#ffc107;color:#856404;border:none;padding:12px 24px;border-radius:8px;font-weight:600;cursor:pointer;">
                    🎯 Keep Practicing
                </button>
                <button onclick="exitPracticeMode(); closeModal();" style="background:#6b7280;color:white;border:none;padding:12px 24px;border-radius:8px;font-weight:600;cursor:pointer;">
                    🚪 Return to Main Quiz
                </button>
            </div>`;
        showModal(html);
    } else {
        // All practice words mastered, return to main quiz
        showNotification('Great job! All practice words completed!', 'success');
        exitPracticeMode();
    }
}

// Function to continue practicing the same words
function continuePractice() {
    console.log('Continuing practice...');
    
    // Reset state for another practice round
    resetQuizState();
    updateDisplay();
    closeModal();
    
    // Shuffle words again
    if (words.length > 1) {
        shuffleArray(words);
    }
    
    // Speak first word
    setTimeout(() => {
        if (words.length > 0) speakWord(words[0]);
    }, 200);
    
    showNotification('Continuing practice session!', 'info');
}

// Function to toggle alphabet keyboard visibility
function toggleAlphabetKeyboard() {
    isAlphabetKeyboardVisible = !isAlphabetKeyboardVisible;
    
    if (alphabetKeyboard) {
        alphabetKeyboard.style.display = isAlphabetKeyboardVisible ? 'block' : 'none';
    } else {
        console.log('alphabetKeyboard element not found!');
    }
    
    // Update button text to show current state
    if (alphabetsButton) {
        alphabetsButton.textContent = isAlphabetKeyboardVisible ? '🔤 Hide Alphabets' : '🔤 Alphabets';
    }
    
    // Set up alphabet key event listeners when keyboard is shown
    if (isAlphabetKeyboardVisible) {
        setupAlphabetKeys();
        showNotification('Virtual keyboard shown! Click letters to input them.', 'info');
    } else {
        showNotification('Virtual keyboard hidden.', 'info');
    }
}

// Function to set up alphabet key event listeners
function setupAlphabetKeys() {
    const alphabetKeys = document.querySelectorAll('.alphabet-key');
    alphabetKeys.forEach(key => {
        // Remove existing listeners to avoid duplicates
        key.removeEventListener('click', handleAlphabetKeyClick);
        // Add new listener
        key.addEventListener('click', handleAlphabetKeyClick);
    });
}

// Function to handle alphabet key clicks
function handleAlphabetKeyClick(event) {
    const letter = event.target.getAttribute('data-letter');
    if (!letter) return;
    
    // Find the target letter box
    let targetBox = null;
    
    if (letterInputs && letterInputs.length > 0) {
        // First priority: use the currently focused box
        if (currentFocusedLetterBox && letterInputs.includes(currentFocusedLetterBox)) {
            targetBox = currentFocusedLetterBox;
        } else {
            // Second priority: use the active element if it's a letter box
            const activeElement = document.activeElement;
            if (activeElement && activeElement.classList.contains('letter-hint-box')) {
                targetBox = activeElement;
            } else {
                // Third priority: find the first empty box
                targetBox = letterInputs.find(box => box.value === '');
                
                // Fourth priority: use the first box
                if (!targetBox) {
                    targetBox = letterInputs[0];
                }
            }
        }
        
        if (targetBox && targetBox.classList.contains('letter-hint-box')) {
            // Input the letter
            targetBox.value = letter;
            targetBox.disabled = false; // Re-enable if it was disabled from hint
            
            // Trigger the input event to handle auto-advance
            const inputEvent = new Event('input', { bubbles: true });
            targetBox.dispatchEvent(inputEvent);
            
            // Keep focus on the target box or move to next
            const boxIndex = letterInputs.indexOf(targetBox);
            if (boxIndex < letterInputs.length - 1 && letterInputs[boxIndex + 1]) {
                letterInputs[boxIndex + 1].focus();
                currentFocusedLetterBox = letterInputs[boxIndex + 1];
            } else {
                targetBox.focus();
                currentFocusedLetterBox = targetBox;
            }
            
            // Visual feedback for the clicked alphabet key
            event.target.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
            event.target.style.color = 'white';
            setTimeout(() => {
                event.target.style.background = '';
                event.target.style.color = '';
            }, 200);
        }
    }
}

// --- Voice Input Functionality ---
let isVoiceInputActive = false;
let recognition = null;
let voiceInputButton = null;

// Initialize voice input when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - initializing voice input');
    voiceInputButton = document.getElementById('voiceInputButton');
    console.log('voiceInputButton found:', !!voiceInputButton);
    
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('Speech recognition not supported');
        if (voiceInputButton) {
            voiceInputButton.style.display = 'none';
            // Show a tooltip or message that voice input is not supported
            voiceInputButton.title = 'Voice input not supported in this browser';
        }
        return;
    }
    
    console.log('Speech recognition is supported');
    
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    console.log('Speech recognition initialized:', !!recognition);
    
    // Set up voice input button event listener now that everything is ready
    if (voiceInputButton) {
        console.log('Setting up voice input button event listener');
        voiceInputButton.addEventListener('click', () => {
            console.log('Voice input button clicked!');
            toggleVoiceInput();
        });
    } else {
        console.log('voiceInputButton not found in DOMContentLoaded!');
    }
    
    // Configure speech recognition
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    // Handle speech recognition results
    recognition.onresult = function(event) {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            }
        }
        
        if (finalTranscript) {
            processVoiceInput(finalTranscript.toLowerCase().trim());
        }
    };
    
    // Handle speech recognition errors
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
            showNotification('No speech detected. Try speaking louder.', 'warning');
        } else if (event.error === 'not-allowed') {
            showNotification('Microphone access denied. Please allow microphone access.', 'error');
        } else if (event.error === 'network') {
            showNotification('Network error. Please check your internet connection.', 'error');
        } else {
            showNotification('Voice recognition error. Please try again.', 'error');
        }
        stopVoiceInput();
    };
    
    // Handle speech recognition start
    recognition.onstart = function() {
        console.log('Speech recognition started');
    };
    
    // Handle speech recognition end
    recognition.onend = function() {
        console.log('Speech recognition ended');
        if (isVoiceInputActive) {
            // Restart recognition if it's still supposed to be active
            setTimeout(() => {
                if (isVoiceInputActive && recognition) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log('Recognition restart failed:', e);
                        stopVoiceInput();
                    }
                }
            }, 100);
        }
    };
});

// Function to toggle voice input on/off
function toggleVoiceInput() {
    console.log('toggleVoiceInput called');
    console.log('recognition available:', !!recognition);
    console.log('isVoiceInputActive:', isVoiceInputActive);
    
    if (!recognition) {
        console.log('No recognition available');
        showNotification('Voice input not supported in this browser', 'error');
        return;
    }
    
    if (isVoiceInputActive) {
        console.log('Stopping voice input');
        stopVoiceInput();
    } else {
        console.log('Starting voice input');
        startVoiceInput();
    }
}

// Function to start voice input
function startVoiceInput() {
    if (!recognition || !letterInputs || letterInputs.length === 0) {
        showNotification('No word to spell or voice input not available', 'warning');
        return;
    }
    
    // Check if there are any empty boxes
    const hasEmptyBoxes = letterInputs.some(box => box.value === '');
    if (!hasEmptyBoxes) {
        showNotification('All letters are already filled! Clear some letters first.', 'warning');
        return;
    }
    
    try {
        isVoiceInputActive = true;
        recognition.start();
        
        // Update button appearance
        if (voiceInputButton) {
            voiceInputButton.classList.add('listening');
            voiceInputButton.textContent = '🔴 Stop Voice';
        }
        
        // Show helpful instructions
        const emptyCount = letterInputs.filter(box => box.value === '').length;
        showNotification(`Voice input started! Speak ${emptyCount} letter${emptyCount > 1 ? 's' : ''} clearly, one at a time.`, 'info');
        console.log('Voice input started');
    } catch (error) {
        console.error('Error starting voice input:', error);
        if (error.name === 'InvalidStateError') {
            showNotification('Voice input is already running. Please wait.', 'warning');
        } else {
            showNotification('Failed to start voice input. Please try again.', 'error');
        }
        isVoiceInputActive = false;
    }
}

// Function to stop voice input
function stopVoiceInput() {
    if (recognition) {
        isVoiceInputActive = false;
        recognition.stop();
        
        // Update button appearance
        if (voiceInputButton) {
            voiceInputButton.classList.remove('listening');
            voiceInputButton.textContent = '🎤 Voice Input';
        }
        
        showNotification('Voice input stopped', 'info');
        console.log('Voice input stopped');
    }
}

// Function to process voice input and convert to letters
function processVoiceInput(transcript) {
    console.log('Processing voice input:', transcript);
    
    // Clean up the transcript and extract letters
    const words = transcript.split(/\s+/);
    
    for (const word of words) {
        // Check if it's a single letter (a-z)
        if (word.length === 1 && /^[a-z]$/.test(word)) {
            inputLetterToBox(word);
        } else {
            // Try to extract letters from common speech patterns
            const letter = extractLetterFromSpeech(word);
            if (letter) {
                inputLetterToBox(letter);
            }
        }
    }
}

// Function to extract letter from speech patterns
function extractLetterFromSpeech(word) {
    // Common ways people might say letters
    const letterMappings = {
        'ay': 'a', 'eh': 'a', 'alpha': 'a',
        'bee': 'b', 'be': 'b', 'bravo': 'b',
        'see': 'c', 'sea': 'c', 'charlie': 'c',
        'dee': 'd', 'delta': 'd',
        'ee': 'e', 'echo': 'e',
        'eff': 'f', 'foxtrot': 'f',
        'gee': 'g', 'golf': 'g',
        'aitch': 'h', 'hotel': 'h',
        'eye': 'i', 'india': 'i',
        'jay': 'j', 'juliet': 'j',
        'kay': 'k', 'kilo': 'k',
        'ell': 'l', 'lima': 'l',
        'em': 'm', 'mike': 'm',
        'en': 'n', 'november': 'n',
        'oh': 'o', 'oscar': 'o',
        'pee': 'p', 'papa': 'p',
        'cue': 'q', 'queue': 'q', 'quebec': 'q',
        'are': 'r', 'romeo': 'r',
        'ess': 's', 'sierra': 's',
        'tee': 't', 'tea': 't', 'tango': 't',
        'you': 'u', 'uniform': 'u',
        'vee': 'v', 'victor': 'v',
        'double': 'w', 'whiskey': 'w',
        'ex': 'x', 'xray': 'x',
        'why': 'y', 'yankee': 'y',
        'zee': 'z', 'zed': 'z', 'zulu': 'z'
    };
    
    return letterMappings[word.toLowerCase()] || null;
}

// Function to input a letter to the appropriate box
function inputLetterToBox(letter) {
    if (!letterInputs || letterInputs.length === 0) {
        return;
    }
    
    // Find the first empty box
    let targetBox = letterInputs.find(box => box.value === '');
    
    if (!targetBox) {
        // If no empty boxes, check if all boxes are filled
        const allFilled = letterInputs.every(box => box.value !== '');
        if (allFilled) {
            // All boxes are filled, stop voice input and check spelling
            stopVoiceInput();
            showNotification('All letters filled! Checking spelling...', 'success');
            setTimeout(() => {
                checkSpelling();
            }, 500);
            return;
        }
        // If not all filled but no empty box found, use the first box
        targetBox = letterInputs[0];
    }
    
    if (targetBox) {
        const boxIndex = letterInputs.indexOf(targetBox);
        
        // Input the letter (convert to lowercase for consistency)
        targetBox.value = letter.toLowerCase();
        targetBox.disabled = false;
        
        // Focus on the target box
        targetBox.focus();
        
        // Simulate the same logic as keyboard input
        if (targetBox.value.length === 1 && boxIndex < letterInputs.length - 1) {
            // Move to next box if not the last one
            if (letterInputs[boxIndex + 1]) {
                setTimeout(() => {
                    letterInputs[boxIndex + 1].focus();
                }, 50);
            }
        } else if (targetBox.value.length === 1 && boxIndex === letterInputs.length - 1) {
            // Auto-check when last letter is entered (same as keyboard input)
            setTimeout(() => {
                if (!quizComplete && words[currentWordIndex]) {
                    checkSpelling();
                }
            }, 100);
        }
        
        // Visual feedback
        targetBox.style.background = '#e7fbe9';
        targetBox.style.transform = 'scale(1.1)';
        setTimeout(() => {
            targetBox.style.background = '';
            targetBox.style.transform = '';
        }, 300);
        
        console.log(`Voice input: "${letter}" added to box ${boxIndex + 1}/${letterInputs.length}`);
        
        // Show feedback about recognized letter
        const remainingEmpty = letterInputs.filter(box => box.value === '').length;
        if (remainingEmpty > 0) {
            showNotification(`✓ "${letter.toUpperCase()}" - ${remainingEmpty} more letter${remainingEmpty > 1 ? 's' : ''} needed`, 'success');
        } else {
            // All boxes filled
            stopVoiceInput();
            showNotification('All letters filled! Checking spelling...', 'success');
        }
    }
}

// Function to practice an individual word
function practiceIndividualWord(word) {
    console.log(`Starting individual practice for word: ${word}`);
    
    // Save the current state
    originalPracticeState = {
        words: [...words],
        currentWordIndex: currentWordIndex,
        userAnswers: [...userAnswers],
        hintUsed: [...hintUsed],
        quizComplete: quizComplete,
        isPracticeMode: isPracticeMode,
        practiceWords: [...practiceWords],
        originalWords: [...originalWords]
    };
    
    // Set up for individual word practice
    isIndividualWordPractice = true;
    words = [word]; // Only practice this one word
    currentWordIndex = 0;
    quizComplete = false;
    
    // Reset state for this single word
    userAnswers = [{ attempts: [], correct: false }];
    hintUsed = [false];
    
    // Close modal and update display
    closeModal();
    updateDisplay();
    updatePracticeModeUI();
    
    // Speak the word
    setTimeout(() => {
        speakWord(word);
    }, 500);
    
    showNotification(`🎯 Individual practice: "${word}"`, 'info');
}

// Function to update UI for individual word practice
function updateIndividualWordPracticeUI() {
    const title = document.querySelector('.title');
    const exitButton = document.getElementById('exitPracticeButton');
    
    if (title && isIndividualWordPractice) {
        title.textContent = '🎯 Word Practice';
        title.style.color = '#10b981';
    }
    
    // Show exit button for individual practice
    if (exitButton) {
        exitButton.style.display = 'inline-block';
        exitButton.textContent = '🔙 Back to Practice';
    }
}

// Function to exit individual word practice
function exitIndividualWordPractice() {
    console.log('Exiting individual word practice...');
    
    if (!originalPracticeState) {
        console.error('No original state to restore!');
        return;
    }
    
    // Restore the original state
    words = [...originalPracticeState.words];
    currentWordIndex = originalPracticeState.currentWordIndex;
    userAnswers = [...originalPracticeState.userAnswers];
    hintUsed = [...originalPracticeState.hintUsed];
    quizComplete = originalPracticeState.quizComplete;
    isPracticeMode = originalPracticeState.isPracticeMode;
    practiceWords = [...originalPracticeState.practiceWords];
    originalWords = [...originalPracticeState.originalWords];
    
    // Clear individual practice state
    isIndividualWordPractice = false;
    originalPracticeState = null;
    
    // Update display and UI
    updateDisplay();
    updatePracticeModeUI(); // This will restore the correct title and button state
    
    showNotification('🔄 Returned to original practice', 'success');
}

// --- Celebration Animation Functions ---
function triggerCelebrationAnimation(isCorrectWithoutHints = false) {
    const celebrationArea = document.getElementById('celebrationArea');
    const celebrationAnimation = document.getElementById('celebrationAnimation');
    const celebrationText = document.getElementById('celebrationText');
    
    if (!celebrationArea || !celebrationAnimation || !celebrationText) return;
    
    // Set appropriate celebration text
    const messages = [
        'Great Job!', 'Excellent!', 'Perfect!', 'Well Done!', 
        'Amazing!', 'Fantastic!', 'Brilliant!', 'Outstanding!'
    ];
    
    if (isCorrectWithoutHints) {
        celebrationText.textContent = messages[Math.floor(Math.random() * messages.length)];
    } else {
        celebrationText.textContent = 'Good Try!';
    }
    
    // Remove any existing animation
    celebrationAnimation.classList.remove('active');
    
    // Trigger animation after a small delay
    setTimeout(() => {
        celebrationAnimation.classList.add('active');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            celebrationAnimation.classList.remove('active');
        }, 3000);
    }, 100);
}

function triggerPerfectQuizCelebration() {
    const celebrationArea = document.getElementById('celebrationArea');
    const celebrationAnimation = document.getElementById('celebrationAnimation');
    const celebrationText = document.getElementById('celebrationText');
    
    if (!celebrationArea || !celebrationAnimation || !celebrationText) return;
    
    // Set special message for perfect quiz
    celebrationText.textContent = '🎉 PERFECT QUIZ! 🎉';
    celebrationText.style.fontSize = '0.8rem';
    celebrationText.style.color = '#f59e0b';
    
    // Remove any existing animation
    celebrationAnimation.classList.remove('active');
    
    // Trigger animation after a small delay
    setTimeout(() => {
        celebrationAnimation.classList.add('active');
        
        // Reset text style after animation
        setTimeout(() => {
            celebrationAnimation.classList.remove('active');
            celebrationText.style.fontSize = '0.9rem';
            celebrationText.style.color = '#22c55e';
        }, 3000);
    }, 500);
}

// --- Results Panel Functions ---

// Update the results panel with current progress
function updateResultsPanel() {
    console.log('=== UPDATE RESULTS PANEL ===');
    
    const resultsContent = document.getElementById('resultsContent');
    const scoreSummary = document.getElementById('scoreSummary');
    const currentScore = document.getElementById('currentScore');
    
    console.log('Elements found - resultsContent:', !!resultsContent, 'currentScore:', !!currentScore);
    
    if (!resultsContent || !currentScore) {
        console.error('Required elements not found for results panel update');
        return;
    }
    
    // Calculate current score (only first-try correct answers)
    let correctCount = 0;
    let totalAttempted = 0;
    
    for (let i = 0; i < words.length; i++) {
        const userAnswer = userAnswers[i];
        if (userAnswer && userAnswer.attempts && userAnswer.attempts.length > 0) {
            totalAttempted++;
            // Check if first attempt was correct
            if (userAnswer.attempts[0] === words[i]) {
                correctCount++;
            }
        }
    }
    
    console.log('Score calculation - correctCount:', correctCount, 'totalAttempted:', totalAttempted);
    
    // Update score display
    currentScore.textContent = `${correctCount}/${totalAttempted}`;
    console.log('Score updated to:', currentScore.textContent);
    
    // Clear placeholder if we have results
    if (totalAttempted > 0) {
        const placeholder = resultsContent.querySelector('.results-placeholder');
        if (placeholder) {
            placeholder.remove();
            console.log('Placeholder removed');
        }
    }
    
    console.log('=== UPDATE RESULTS PANEL COMPLETE ===');
}

// Add a new result to the panel (compact version)
function addResultToPanel(wordIndex, isCorrect, userAttempt, usedHint = false) {
    console.log('=== ADD RESULT TO PANEL ===');
    console.log('wordIndex:', wordIndex, 'isCorrect:', isCorrect, 'userAttempt:', userAttempt, 'usedHint:', usedHint);
    
    const resultsContent = document.getElementById('resultsContent');
    console.log('resultsContent element found:', !!resultsContent);
    
    if (!resultsContent) {
        console.error('Results content element not found!');
        return;
    }
    
    const word = words[wordIndex];
    const userAnswer = userAnswers[wordIndex];
    
    console.log('word:', word, 'userAnswer:', userAnswer);
    
    // Create result item
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${isCorrect ? 'correct' : 'incorrect'}${usedHint ? ' hint-used' : ''}`;
    
    // Status icon
    let statusIcon = isCorrect ? '✅' : '❌';
    if (usedHint) statusIcon += ' 💡';
    
    // For incorrect answers, show letter boxes instead of the actual word (anti-cheating)
    let displayWord;
    if (isCorrect) {
        displayWord = word; // Show actual word for correct answers
    } else {
        // Create letter boxes for wrong answers to prevent cheating
        displayWord = '□'.repeat(word.length); // Using box characters
        // Alternative: displayWord = '_'.repeat(word.length); // Using underscores
    }
    
    // Compact content - NO correct spelling shown for wrong answers
    let resultContent = `
        <div class="result-word">
            <span class="${isCorrect ? '' : 'letter-boxes'}" style="font-family: monospace; letter-spacing: 2px;">${displayWord}</span>
            <span class="result-status">${statusIcon}</span>
        </div>
    `;
    
    if (!isCorrect) {
        // For wrong answers, only show their attempt and hint info - NO correct spelling
        resultContent += `
            <div class="result-details">Your answer: <strong style="color:#ef4444;">${userAttempt}</strong></div>
        `;
        if (usedHint) {
            resultContent += `<div class="result-details">💡 Hint used</div>`;
        }
        resultContent += `<div class="result-details" style="color:#6b7280; font-size:0.7rem;">Try again or use hints (SPACE on boxes)</div>`;
    } else {
        // For correct answers, show minimal info
        if (userAnswer.attempts.length > 1) {
            resultContent += `<div class="result-details">Correct after ${userAnswer.attempts.length} attempts</div>`;
        } else {
            resultContent += `<div class="result-details">Perfect first try! 🎯</div>`;
        }
        if (usedHint) {
            resultContent += `<div class="result-details">💡 Hint used</div>`;
        }
    }
    
    // Add NEW badge for latest result
    if (resultsContent.children.length === 0 || !resultsContent.querySelector('.new-badge')) {
        resultContent = resultContent.replace('<span class="result-status">', '<span class="result-status">') + '<span class="new-badge">NEW</span>';
    }
    
    resultItem.innerHTML = resultContent;
    
    // Insert at the beginning (latest first)
    if (resultsContent.firstChild) {
        resultsContent.insertBefore(resultItem, resultsContent.firstChild);
        console.log('Result item inserted at beginning');
    } else {
        resultsContent.appendChild(resultItem);
        console.log('Result item appended (first item)');
    }
    
    // Remove NEW badge from previous items
    const existingBadges = resultsContent.querySelectorAll('.new-badge');
    existingBadges.forEach((badge, index) => {
        if (index > 0) badge.remove();
    });
    
    // Scroll to top to show latest result
    resultsContent.scrollTop = 0;
    
    // Update the overall score
    updateResultsPanel();
    
    console.log('=== ADD RESULT TO PANEL COMPLETE ===');
    console.log('Total result items now:', resultsContent.children.length);
}

// Toggle results panel visibility
function toggleResultsPanel() {
    console.log('=== TOGGLE RESULTS PANEL ===');
    
    const resultsPanel = document.getElementById('resultsPanel');
    const practiceLayout = document.querySelector('.practice-layout');
    const toggleBtn = document.querySelector('.results-toggle-btn');
    
    console.log('Elements found:');
    console.log('- resultsPanel:', !!resultsPanel);
    console.log('- practiceLayout:', !!practiceLayout);
    console.log('- toggleBtn:', !!toggleBtn);
    
    if (!resultsPanel || !practiceLayout || !toggleBtn) {
        console.error('Required elements not found for toggle');
        return;
    }
    
    const isHidden = resultsPanel.classList.contains('hidden');
    console.log('Current state - isHidden:', isHidden);
    
    if (isHidden) {
        // Show panel
        console.log('Showing results panel...');
        resultsPanel.classList.remove('hidden');
        practiceLayout.classList.remove('results-hidden');
        toggleBtn.innerHTML = '📊 Hide Results';
        console.log('Panel shown');
    } else {
        // Hide panel
        console.log('Hiding results panel...');
        resultsPanel.classList.add('hidden');
        practiceLayout.classList.add('results-hidden');
        toggleBtn.innerHTML = '📊 Show Results';
        console.log('Panel hidden');
    }
    
    console.log('=== TOGGLE COMPLETE ===');
}

// --- End Results Panel Functions ---

// ... existing code ...

// ... existing code ...

// Always require fresh sign-in on page load
console.log('DOM loaded, requiring fresh authentication...');

// Always prompt for authentication - no auto-login
promptUserName();