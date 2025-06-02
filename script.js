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

// Multi-list challenge variables
let isMultiListChallenge = false;
let selectedWordSetsForChallenge = [];
let currentChallengeListIndex = 0;
let challengeResults = [];
let originalSingleListState = null;
let challengeSelectionOrder = []; // Track the order of checkbox selections

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
            
            // Check if this student has a specific individual assignment (highest priority)
            const assignmentsSnapshot = await window.db.collection('assignments').where('studentId', '==', studentId).get();
            
            if (!assignmentsSnapshot.empty) {
                const assignmentDoc = assignmentsSnapshot.docs[0];
                const wordSetId = assignmentDoc.data().wordSetId;
                userAssignmentId = wordSetId; // Store for panel display
                console.log(`Found specific individual assignment for student: wordSetId = ${wordSetId}`);
                
                // Get the word set
                const wordSetDoc = await window.db.collection('wordSets').doc(wordSetId).get();
                if (wordSetDoc.exists && wordSetDoc.data().words && wordSetDoc.data().words.length > 0) {
                    console.log(`Using specific individual assignment for ${userName}: "${wordSetDoc.data().name}"`);
                    return {
                        words: wordSetDoc.data().words,
                        setId: wordSetId,
                        setName: wordSetDoc.data().name
                    };
                } else {
                    console.log(`Individual assignment word set ${wordSetId} is empty or invalid, checking alternatives...`);
                }
            }
            
            // No individual assignment - check for class assignments (second priority)
            if (studentData.classId) {
                console.log(`No individual assignment, checking class assignments for classId: ${studentData.classId}`);
                const classAssignmentsSnapshot = await window.db.collection('assignments')
                    .where('classId', '==', studentData.classId)
                    .where('type', '==', 'class')
                    .get();
                
                console.log(`Found ${classAssignmentsSnapshot.size} class assignments for class ${studentData.classId}`);
                
                classAssignmentsSnapshot.forEach(doc => {
                    const assignmentData = doc.data();
                    assignedWordSetIds.add(assignmentData.wordSetId);
                    console.log(`Found class assignment: ${assignmentData.wordSetId} (Assignment ID: ${doc.id}, Type: ${assignmentData.type})`);
                });
                
                // Add class default word set if exists
                const classDoc = await window.db.collection('classes').doc(studentData.classId).get();
                if (classDoc.exists && classDoc.data().defaultWordSetId) {
                    assignedWordSetIds.add(classDoc.data().defaultWordSetId);
                    console.log(`Found class default word set: ${classDoc.data().defaultWordSetId}`);
                }
            }
            
            // No assignments - check for student's default word set (third priority)
            if (studentData.defaultWordSetId) {
                console.log(`No assignments, checking student's default word set: ${studentData.defaultWordSetId}`);
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
            
            // No student default - check for class default word set (fourth priority)
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
                console.log(`Found individual assignment: ${doc.data().wordSetId}`);
            });
            
            // Get class assignments if student is in a class
            if (studentData.classId) {
                console.log(`Student is in class: ${studentData.classId}, checking for class assignments...`);
                const classAssignmentsSnapshot = await window.db.collection('assignments').where('classId', '==', studentData.classId).get();
                
                console.log(`Found ${classAssignmentsSnapshot.size} class assignments for class ${studentData.classId}`);
                
                classAssignmentsSnapshot.forEach(doc => {
                    const assignmentData = doc.data();
                    assignedWordSetIds.add(assignmentData.wordSetId);
                    console.log(`Found class assignment: ${assignmentData.wordSetId} (Assignment ID: ${doc.id}, Type: ${assignmentData.type})`);
                });
                
                // Add class default word set if exists
                const classDoc = await window.db.collection('classes').doc(studentData.classId).get();
                if (classDoc.exists && classDoc.data().defaultWordSetId) {
                    assignedWordSetIds.add(classDoc.data().defaultWordSetId);
                    console.log(`Found class default word set: ${classDoc.data().defaultWordSetId}`);
                }
            }
            
            // Add student's default word set if exists
            if (studentData.defaultWordSetId) {
                assignedWordSetIds.add(studentData.defaultWordSetId);
                console.log(`Found student default word set: ${studentData.defaultWordSetId}`);
            }
            
            // Load only the assigned word sets
            if (assignedWordSetIds.size > 0) {
                console.log(`Total unique word set IDs found: ${assignedWordSetIds.size}`);
                console.log('Loading word sets for IDs:', Array.from(assignedWordSetIds));
                
                for (const wordSetId of assignedWordSetIds) {
                    try {
                        const wordSetDoc = await window.db.collection('wordSets').doc(wordSetId).get();
                        if (wordSetDoc.exists) {
                            const wordSetData = { id: wordSetDoc.id, ...wordSetDoc.data() };
                            
                            // Check if we already have this word set (by ID only)
                            const existingById = availableWordSets.find(ws => ws.id === wordSetData.id);
                            
                            if (existingById) {
                                console.log(`Skipping duplicate word set by ID: ${wordSetData.name} (${wordSetData.id})`);
                                continue;
                            }
                            
                            availableWordSets.push(wordSetData);
                            console.log(`Added word set: ${wordSetData.name} (${wordSetData.id})`);
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
        
        // Populate the simplified word set list with radio buttons
        const wordSetList = document.getElementById('wordSetList');
        if (wordSetList) {
            wordSetList.innerHTML = '';
            
            if (availableWordSets.length === 0) {
                wordSetList.innerHTML = '<div class="no-sets-message">No word sets assigned</div>';
            } else {
                // Add multi-list challenge header if there are multiple sets
                if (availableWordSets.length > 1) {
                    const challengeHeader = document.createElement('div');
                    challengeHeader.className = 'challenge-header';
                    challengeHeader.innerHTML = `
                        <div class="challenge-controls">
                            <button id="startMultiChallengeBtn" class="challenge-btn multi-challenge-btn" disabled>
                                🏃 Start Multi-List Challenge
                            </button>
                        </div>
                        <div class="challenge-divider">
                            <span>Select Multiple Lists for Challenge</span>
                        </div>
                    `;
                    wordSetList.appendChild(challengeHeader);
                }
                
                availableWordSets.forEach((set, index) => {
                    const setItem = document.createElement('div');
                    setItem.className = 'word-set-item';
                    
                    const isDefault = index === 0; // First set is default
                    
                    setItem.innerHTML = `
                        <div class="word-set-selection">
                            <label class="word-set-label">
                                <input type="radio" name="selectedWordSet" value="${set.id}" ${isDefault ? 'checked' : ''} class="word-set-radio">
                                <span class="word-set-name">${set.name}</span>
                                <span class="word-set-count">(${set.words.length} words)</span>
                            </label>
                            ${availableWordSets.length > 1 ? `
                                <input type="checkbox" value="${set.id}" class="word-set-checkbox" data-set-name="${set.name}" data-word-count="${set.words.length}">
                            ` : ''}
                        </div>
                        <div class="word-preview-tooltip" style="display: none;">
                            <div class="word-preview-header">Words in this set:</div>
                            <div class="word-preview-list">${set.words.join(', ')}</div>
                        </div>
                    `;
                    
                    // Radio button event handling (existing single-list functionality)
                    const radio = setItem.querySelector('input[type="radio"]');
                    radio.addEventListener('change', function(e) {
                        if (this.checked) {
                            console.log(`Word set selected: ${set.name} (${set.id})`);
                            e.stopPropagation();
                            switchToWordSet(set.id, set.name, set.words);
                        }
                    });
                    
                    // Checkbox event handling (new multi-list functionality)
                    const checkbox = setItem.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.addEventListener('change', function(e) {
                            e.stopPropagation();
                            
                            if (this.checked) {
                                // Add to selection order if not already present
                                if (!challengeSelectionOrder.includes(this.value)) {
                                    challengeSelectionOrder.push(this.value);
                                }
                            } else {
                                // Remove from selection order
                                const index = challengeSelectionOrder.indexOf(this.value);
                                if (index > -1) {
                                    challengeSelectionOrder.splice(index, 1);
                                }
                            }
                            
                            updateMultiChallengeButton();
                        });
                    }
                    
                    // Hover tooltip functionality with dynamic positioning
                    const tooltip = setItem.querySelector('.word-preview-tooltip');
                    let hoverTimeout;
                    
                    setItem.addEventListener('mouseenter', function(e) {
                        // Clear any existing timeout
                        clearTimeout(hoverTimeout);
                        
                        // Hide all other tooltips first
                        document.querySelectorAll('.word-preview-tooltip').forEach(t => {
                            t.style.display = 'none';
                        });
                        
                        // Show this tooltip after a short delay with dynamic positioning
                        hoverTimeout = setTimeout(() => {
                            const rect = setItem.getBoundingClientRect();
                            const tooltipRect = tooltip.getBoundingClientRect();
                            const viewportWidth = window.innerWidth;
                            const viewportHeight = window.innerHeight;
                            
                            // Calculate optimal position
                            let left, top;
                            
                            // Try to position to the right of the item first
                            left = rect.right + 15;
                            top = rect.top + (rect.height / 2);
                            
                            // If tooltip would go off the right edge, position it to the left
                            if (left + 350 > viewportWidth) {
                                left = rect.left - 350 - 15;
                            }
                            
                            // If still off screen to the left, center it horizontally
                            if (left < 0) {
                                left = Math.max(10, (viewportWidth - 350) / 2);
                                top = rect.bottom + 10; // Position below the item instead
                            }
                            
                            // Make sure tooltip doesn't go off the bottom of the screen
                            if (top + 100 > viewportHeight) {
                                top = rect.top - 100;
                            }
                            
                            // Make sure tooltip doesn't go off the top of the screen
                            if (top < 10) {
                                top = 10;
                            }
                            
                            // Apply positioning and show
                            tooltip.style.left = left + 'px';
                            tooltip.style.top = top + 'px';
                            tooltip.style.transform = 'none'; // Remove any transform
                            tooltip.style.display = 'block';
                            
                            console.log('Tooltip positioned at:', left, top);
                        }, 300);
                    });
                    
                    setItem.addEventListener('mouseleave', function(e) {
                        // Clear timeout if mouse leaves before tooltip shows
                        clearTimeout(hoverTimeout);
                        
                        // Hide tooltip
                        tooltip.style.display = 'none';
                    });
                    
                    // Make the entire item clickable by clicking the radio when item is clicked
                    setItem.addEventListener('click', function(e) {
                        // Only trigger if not clicking directly on inputs
                        if (e.target !== radio && e.target !== checkbox) {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log(`Item clicked: selecting ${set.name} (${set.id})`);
                            radio.click();
                        }
                    });
                    
                    wordSetList.appendChild(setItem);
                });
                
                // Set up multi-challenge button handlers
                if (availableWordSets.length > 1) {
                    setupMultiChallengeHandlers();
                }
                
                // Auto-select and load the first (default) word set
                if (availableWordSets.length > 0) {
                    const defaultSet = availableWordSets[0];
                    selectedWordSetId = defaultSet.id;
                    // The default set will be loaded by the main initialization
                }
            }
        }
        
        console.log('Loaded assigned word sets:', availableWordSets);
    } catch (error) {
        console.error('Error loading assigned word sets:', error);
        availableWordSets = [];
        
        // Show error message
        const wordSetList = document.getElementById('wordSetList');
        if (wordSetList) {
            wordSetList.innerHTML = '<div class="error-message">Error loading word sets</div>';
        }
    }
}

// Update the word set panel display
function updateWordSetPanel() {
    const wordSetList = document.getElementById('wordSetList');
    if (!wordSetList) return;
    
    // Update radio button selection
    const radioButtons = wordSetList.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.checked = (radio.value === currentWordSetId);
    });
}

// Handle word set selection changes
function setupWordSetPanel() {
    console.log('Setting up word set panel...');
    
    // Function to setup panel toggle
    function setupPanelToggle() {
        const wordSetToggleBtn = document.getElementById('wordSetToggleBtn');
        const panelToggle = document.getElementById('panelToggle'); // Also handle the panel header button
        const wordSetPanel = document.getElementById('wordSetPanel');
        const mainContent = document.getElementById('mainContent');
        
        console.log('Panel toggle setup - Elements found:');
        console.log('- wordSetToggleBtn:', !!wordSetToggleBtn);
        console.log('- panelToggle:', !!panelToggle);
        console.log('- wordSetPanel:', !!wordSetPanel);
        console.log('- mainContent:', !!mainContent);
        
        if (wordSetPanel && mainContent) {
            console.log('Setting up panel toggle functionality...');
            
            // Function to toggle panel state
            function togglePanel() {
                const isCurrentlyOpen = wordSetPanel.classList.contains('open');
                console.log('Current open state:', isCurrentlyOpen);
                
                if (isCurrentlyOpen) {
                    // Collapse the panel
                    wordSetPanel.classList.remove('open');
                    mainContent.classList.remove('panel-open');
                    if (wordSetToggleBtn) wordSetToggleBtn.textContent = '▼'; // Down arrow for collapsed state (ready to expand)
                    if (panelToggle) panelToggle.textContent = '▶'; // Right arrow for collapsed state
                    console.log('Panel collapsed');
                } else {
                    // Expand the panel
                    wordSetPanel.classList.add('open');
                    mainContent.classList.add('panel-open');
                    if (wordSetToggleBtn) wordSetToggleBtn.textContent = '▲'; // Up arrow for expanded state (ready to collapse)
                    if (panelToggle) panelToggle.textContent = '▼'; // Down arrow for expanded state
                    console.log('Panel expanded');
                }
                
                console.log('New open state:', wordSetPanel.classList.contains('open'));
            }
            
            // Set up main toggle button event listener
            if (wordSetToggleBtn) {
                wordSetToggleBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Word set toggle clicked!');
                    togglePanel();
                });
            }
            
            // Set up panel header toggle button event listener
            if (panelToggle) {
                panelToggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Panel header toggle clicked!');
                    togglePanel();
                });
            }
            
            // Set initial state - panel closed, down arrow
            wordSetPanel.classList.remove('open');
            mainContent.classList.remove('panel-open');
            if (wordSetToggleBtn) wordSetToggleBtn.textContent = '▼';
            if (panelToggle) panelToggle.textContent = '▶';
            
            console.log('Panel toggle setup complete!');
            return true;
        } else {
            console.error('Panel toggle setup failed - missing elements');
            return false;
        }
    }
    
    // Try to setup immediately
    if (!setupPanelToggle()) {
        // If immediate setup fails, try again after a delay
        console.log('Retrying panel toggle setup after delay...');
        setTimeout(() => {
            if (!setupPanelToggle()) {
                console.error('Panel toggle setup failed after retry');
            }
        }, 500);
    }
    
    // Helper function to close the panel programmatically
    function closePanelCurtain() {
        const wordSetPanel = document.getElementById('wordSetPanel');
        const mainContent = document.getElementById('mainContent');
        const wordSetToggleBtn = document.getElementById('wordSetToggleBtn');
        const panelToggle = document.getElementById('panelToggle');
        
        if (wordSetPanel && wordSetPanel.classList.contains('open')) {
            console.log('Closing word set panel curtain...');
            
            // Close the panel
            wordSetPanel.classList.remove('open');
            if (mainContent) mainContent.classList.remove('panel-open');
            
            // Update button states
            if (wordSetToggleBtn) wordSetToggleBtn.textContent = '▼'; // Down arrow for collapsed state
            if (panelToggle) panelToggle.textContent = '▶'; // Right arrow for collapsed state
            
            console.log('Panel curtain closed');
        }
    }
    
    // Expose the close function globally so other functions can use it
    window.closePanelCurtain = closePanelCurtain;
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

// Global authentication check function
function isUserAuthenticated() {
    const isAuthenticated = localStorage.getItem('userAuthenticated') === 'true';
    const storedUserName = localStorage.getItem('userName');
    return isAuthenticated && storedUserName && userName;
}

// Disable app interface when not authenticated
function disableAppInterface() {
    const practiceSection = document.querySelector('.practice-card');
    const controlButtons = document.querySelectorAll('.control-btn');
    const letterInputs = document.querySelectorAll('.letter-hint-box');
    
    if (practiceSection) {
        practiceSection.style.opacity = '0.3';
        practiceSection.style.pointerEvents = 'none';
    }
    
    controlButtons.forEach(btn => {
        if (btn.id !== 'clearDataBtn') { // Keep sign out button enabled
            btn.disabled = true;
            btn.style.opacity = '0.3';
        }
    });
    
    letterInputs.forEach(input => {
        input.disabled = true;
    });
}

// Enable app interface when authenticated
function enableAppInterface() {
    const practiceSection = document.querySelector('.practice-card');
    const controlButtons = document.querySelectorAll('.control-btn');
    const letterInputs = document.querySelectorAll('.letter-hint-box');
    
    if (practiceSection) {
        practiceSection.style.opacity = '1';
        practiceSection.style.pointerEvents = 'auto';
    }
    
    controlButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
    });
    
    letterInputs.forEach(input => {
        input.disabled = false;
    });
}

// --- Name Prompt ---
function promptUserName() {
    // Always require sign-in - no auto-login on refresh
    console.log('=== AUTHENTICATION REQUIRED ===');
    console.log('Browser refresh detected - requiring fresh sign-in');
    console.log('=== END DEBUG ===');
    
    // Clear any stored authentication data
    localStorage.removeItem('userName');
    localStorage.removeItem('userAuthenticated');
    
    // Disable app interface until authenticated
    disableAppInterface();
    
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
    
    // Handle cancel button - prevent access without authentication
    cancelBtn.addEventListener('click', function() {
        // Don't hide the modal - keep it visible
        showNameError('Authentication is required to use this app. Please sign in or refresh the page.');
        nameInput.focus();
    });
    
    // Handle click outside modal - prevent access without authentication
    nameModal.addEventListener('click', function(e) {
        if (e.target === nameModal) {
            // Don't hide the modal - keep it visible
            showNameError('Authentication is required to use this app. Please sign in or refresh the page.');
            nameInput.focus();
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
                
                // Enable app interface after successful authentication
                enableAppInterface();
                
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

// Play success sound for correct answers with hints (gentle, assuring)
function playHintSuccessSound() {
    try {
        // Create a gentle, assuring tone using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a gentle, assuring tone sequence (softer than full success)
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A note
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime + 0.15); // C note
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.3); // E note
        
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime); // Softer volume
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
        // Fallback: just log if audio context fails
        console.log('Hint success sound not available');
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
            
            // Reset the checking flag when user starts typing again (fixes auto-check on subsequent attempts)
            if (isCheckingSpelling) {
                isCheckingSpelling = false;
                console.log('Reset isCheckingSpelling flag - user is typing again');
            }
            
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
                    if (!quizComplete && words[currentWordIndex] && !isCheckingSpelling) {
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
                
                // Reset the checking flag when user uses hints (also indicates new attempt)
                if (isCheckingSpelling) {
                    isCheckingSpelling = false;
                    console.log('Reset isCheckingSpelling flag - user used hint');
                }
                
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
                            if (!quizComplete && words[currentWordIndex] && !isCheckingSpelling) {
                                checkSpelling();
                            }
                        }, 100);
                    }
                }
            }
            
            // Enhanced backspace and delete handling for better user experience
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault(); // Prevent default behavior
                
                // Reset the checking flag when user clears letters (indicates new attempt)
                if (isCheckingSpelling) {
                    isCheckingSpelling = false;
                    console.log('Reset isCheckingSpelling flag - user cleared letters');
                }
                
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
    
    // Clear the results panel for new round
    clearResultsPanel();
    
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
        // End of current word list
        if (isMultiListChallenge) {
            // For multi-list challenge, complete current list and move to next
            completeCurrentChallengeList();
        } else {
            // For regular quiz, show feedback
            quizComplete = true;
            showEndOfQuizFeedback();
        }
    }
}

// --- Spelling Check Function ---
function checkSpelling() {
    // Check authentication first
    if (!isUserAuthenticated()) {
        console.log('Unauthorized access attempt blocked');
        showNotification('Please sign in to use this feature.', 'error');
        promptUserName();
        return;
    }
    
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
        
        // Play appropriate success sound based on whether hints were used
        setTimeout(() => {
            if (isCorrectWithoutHints) {
                playSuccessSound(); // Exciting celebration for perfect answers
    } else {
                playHintSuccessSound(); // Gentle, assuring sound for hint-assisted answers
            }
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
        if (isMultiListChallenge) {
            exitMultiListChallenge();
        } else if (isIndividualWordPractice) {
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
    
    let html = '';
    
    // COMPACT: Only show Focus Practice box if there are words that need practice (only for main quiz)
    if (!isPracticeMode && wordsNeedingPractice.length > 0) {
        html += `<div style="margin-bottom:16px;padding:12px 16px;background:#fff3cd;border:2px solid #ffc107;border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:12px;">
                <h3 style="margin:0;color:#856404;font-size:1.1rem;">🎯 Focus Practice</h3>
                <button onclick="startPracticeMode()" style="background:#ffc107;color:#856404;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.9rem;">
                    🎯 Focus Practice
                </button>
            </div>
            <div style="color:#856404;font-weight:600;font-size:0.95rem;">
                ${wordsNeedingPractice.length} word${wordsNeedingPractice.length > 1 ? 's' : ''} need practice
            </div>
        </div>`;
    }
    
    // Results table (always show)
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:separate;border-spacing:0 8px;">';
    html += '<tr><th style="text-align:left;padding:4px 8px;">Word</th><th style="text-align:center;padding:4px 8px;">First Try</th><th style="text-align:left;padding:4px 8px;">All Attempts</th></tr>';
    
    for (let i = 0; i < words.length; i++) {
        const entry = userAnswers[i] || { attempts: [], correct: false };
        const attempts = entry.attempts || [];
        const correctWord = words[i];
        
        // Check if first attempt was correct
        const firstTryCorrect = attempts.length > 0 && attempts[0] === correctWord;
        const eventuallyCorrect = attempts.includes(correctWord);
        
        // Always show the correct word in after-session feedback
        const displayWord = correctWord;
        
        html += `<tr style="background:#f8fafc;"><td style="font-weight:bold;padding:4px 8px;">${displayWord}</td><td style="text-align:center;padding:4px 8px;">`;
        
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
    
    // Calculate and show first-try score (only for main quiz, not practice) - COMPACT VERSION
    if (!isPracticeMode) {
        const firstTryCorrectCount = words.filter((word, i) => {
            const attempts = (userAnswers[i] || {}).attempts || [];
            return attempts.length > 0 && attempts[0] === word;
        }).length;
        
        const firstTryScore = Math.round((firstTryCorrectCount / words.length) * 100);
        
        html += `<div style="margin-top:12px;padding:8px 12px;background:#f8fafc;border-radius:8px;text-align:center;font-size:0.9rem;">
            <strong>First-Try Score: ${firstTryScore}% (${firstTryCorrectCount}/${words.length})</strong>
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
        
        // Calculate total time with 10-minute cap
        let totalTimeSeconds = 0;
        if (window.quizStartTime) {
            const rawTime = Math.round((now - window.quizStartTime) / 1000);
            // Cap at 10 minutes (600 seconds) - user likely forgot to sign out
            totalTimeSeconds = Math.min(rawTime, 600);
        }
        
        const quizData = {
            user: userName,  // Changed from userName to user
            date: now.toISOString(), // Use ISO string for consistent parsing
            words: wordsData,  // Changed to array of word objects
            wordSetId: currentWordSetId, // Include word set ID for tracking
            wordSetName: currentWordSetName, // Include word set name for display
            timestamp: now, // Firebase timestamp for server-side operations
            completedAt: now, // Additional timestamp for completion tracking
            totalTimeSeconds: totalTimeSeconds, // Add total time in seconds
            // Add start and end times for teacher dashboard display
            startTime: window.quizStartTime ? window.quizStartTime.toISOString() : now.toISOString(),
            finishTime: now.toISOString()
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
    
    // Verify authentication before initializing
    const isAuthenticated = localStorage.getItem('userAuthenticated') === 'true';
    const storedUserName = localStorage.getItem('userName');
    
    if (!isAuthenticated || !storedUserName || !userName) {
        console.log('User not properly authenticated, blocking app initialization');
        showNotification('Authentication required. Please sign in.', 'error');
        // Show the sign-in modal again if it's not visible
        setTimeout(() => {
            promptUserName();
        }, 1000);
        return;
    }
    
    console.log('User authenticated, proceeding with app initialization');
    console.log('window.db available:', !!window.db);
    console.log('firebase available:', typeof firebase !== 'undefined');
    
    // Update username display
    updateUsernameDisplay();
    
    if (window.db) {
        console.log('Firebase is available, loading from Firestore');
        // Load available word sets first, then load words
        loadAvailableWordSets().then(() => {
            loadWordsFromFirestore().then(() => {
                // After words are loaded, start practice immediately
                startPracticeImmediately();
            });
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
        
        // Start practice immediately with default words
        startPracticeImmediately();
    }
}

// Initialize the app - first prompt for name, then start
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking for user name...');
    
    // Setup word set panel immediately when DOM is ready
    setupWordSetPanel();
    
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
let accumulatedVoiceText = ''; // Store accumulated voice input text

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
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Add final transcript to accumulated text
        if (finalTranscript.trim()) {
            accumulatedVoiceText += finalTranscript + ' ';
            console.log('Added to accumulated text:', finalTranscript);
            console.log('Total accumulated text:', accumulatedVoiceText);
        }
        
        // Process all accumulated text + current interim text
        const totalText = accumulatedVoiceText + interimTranscript;
        if (totalText.trim()) {
            processVoiceInput(totalText.toLowerCase().trim());
        }
        
        // Show interim feedback if available
        if (interimTranscript.trim()) {
            showNotification(`Listening: "${interimTranscript}"`, 'info');
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
        // Clear accumulated text when starting fresh
        accumulatedVoiceText = '';
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

// Clear the results panel for a new round
function clearResultsPanel() {
    console.log('=== CLEARING RESULTS PANEL ===');
    
    const resultsContent = document.getElementById('resultsContent');
    const currentScore = document.getElementById('currentScore');
    const resultsFooter = document.getElementById('resultsFooter');
    
    if (resultsContent) {
        // Clear all result items
        resultsContent.innerHTML = '';
        
        // Add back the placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'results-placeholder';
        placeholder.innerHTML = `
            <div class="placeholder-icon">🎯</div>
            <p>Start spelling to see your results here!</p>
        `;
        resultsContent.appendChild(placeholder);
        console.log('Results content cleared and placeholder restored');
    }
    
    if (currentScore) {
        // Reset score display
        currentScore.textContent = '0/0';
        console.log('Score display reset');
    }
    
    if (resultsFooter) {
        // Hide footer stats
        resultsFooter.style.display = 'none';
        console.log('Results footer hidden');
    }
    
    console.log('=== RESULTS PANEL CLEARED ===');
}

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

// Switch to a new word set immediately (simplified version)
async function switchToWordSet(wordSetId, wordSetName, wordSetWords) {
    try {
        console.log(`Switching to word set: ${wordSetName} (${wordSetId})`);
        
        // Close the word set panel curtain immediately when starting practice
        if (window.closePanelCurtain) {
            window.closePanelCurtain();
        }
        
        // Update the current words and UI
        words = [...wordSetWords];
        currentWordSetId = wordSetId;
        currentWordSetName = wordSetName;
        selectedWordSetId = wordSetId;
        
        // Shuffle words for new session
        if (words.length > 1) {
            shuffleArray(words);
        }
        
        // Reset quiz state and update display
        resetQuizState();
        updateDisplay();
        updateWordSetPanel();
        updatePracticeModeUI();
        
        showNotification(`Switched to "${wordSetName}" (${words.length} words)`, 'success');
        
        // Speak the first word
        setTimeout(() => {
            if (words.length > 0) speakWord(words[0]);
        }, 500);
        
    } catch (error) {
        console.error('Error switching word set:', error);
        showNotification('Error switching word set. Please try again.', 'error');
    }
}

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
        processedLetterCount = 0; // Reset processed letter count
        accumulatedVoiceText = ''; // Reset accumulated text
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
let processedLetterCount = 0; // Track how many letters we've already processed

function processVoiceInput(transcript) {
    console.log('Processing voice input:', transcript);
    
    // Clean up the transcript and extract letters
    const words = transcript.split(/\s+/);
    let extractedLetters = [];
    
    for (const word of words) {
        // Check if it's a single letter (a-z)
        if (word.length === 1 && /^[a-z]$/.test(word)) {
            extractedLetters.push(word);
        } else {
            // Try to extract letters from common speech patterns
            const letter = extractLetterFromSpeech(word);
            if (letter) {
                extractedLetters.push(letter);
            }
        }
    }
    
    console.log('Extracted letters:', extractedLetters);
    console.log('Already processed:', processedLetterCount, 'letters');
    
    // Only process new letters (skip letters we've already processed)
    const newLetters = extractedLetters.slice(processedLetterCount);
    console.log('New letters to process:', newLetters);
    
    // Process each new letter
    for (const letter of newLetters) {
        const success = inputLetterToBox(letter);
        if (success) {
            processedLetterCount++;
            console.log('Successfully processed letter:', letter, 'Total processed:', processedLetterCount);
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
        return false;
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
            return false;
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
        
        return true; // Successfully added letter
    }
    
    return false; // Failed to add letter
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

// Function to detect and clean up duplicate word sets
async function cleanupDuplicateWordSets() {
    try {
        console.log('Checking for duplicate word sets...');
        
        // Get all word sets
        const wordSetsSnapshot = await window.db.collection('wordSets').get();
        const allWordSets = [];
        
        wordSetsSnapshot.forEach(doc => {
            allWordSets.push({ id: doc.id, ...doc.data() });
        });
        
        // Group by name to find duplicates
        const wordSetsByName = {};
        const duplicates = [];
        
        allWordSets.forEach(wordSet => {
            const name = wordSet.name.toLowerCase().trim();
            if (!wordSetsByName[name]) {
                wordSetsByName[name] = [];
            }
            wordSetsByName[name].push(wordSet);
        });
        
        // Find duplicates
        Object.keys(wordSetsByName).forEach(name => {
            const sets = wordSetsByName[name];
            if (sets.length > 1) {
                console.log(`Found ${sets.length} word sets with name "${name}":`, sets);
                // Keep the first one, mark others as duplicates
                for (let i = 1; i < sets.length; i++) {
                    duplicates.push(sets[i]);
                }
            }
        });
        
        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} duplicate word sets:`, duplicates);
            
            if (confirm(`Found ${duplicates.length} duplicate word sets. Do you want to remove them?`)) {
                for (const duplicate of duplicates) {
                    try {
                        await window.db.collection('wordSets').doc(duplicate.id).delete();
                        console.log(`Deleted duplicate word set: ${duplicate.name} (${duplicate.id})`);
                    } catch (error) {
                        console.error(`Error deleting duplicate word set ${duplicate.id}:`, error);
                    }
                }
                
                showNotification(`Cleaned up ${duplicates.length} duplicate word sets`, 'success');
                
                // Reload the word sets
                await loadAvailableWordSets();
            }
        } else {
            console.log('No duplicate word sets found');
            showNotification('No duplicate word sets found', 'info');
        }
        
    } catch (error) {
        console.error('Error checking for duplicate word sets:', error);
        showNotification('Error checking for duplicates', 'error');
    }
}

// Add this function to the global scope for debugging
window.cleanupDuplicateWordSets = cleanupDuplicateWordSets;

// Multi-List Challenge Functions
function setupMultiChallengeHandlers() {
    const startChallengeBtn = document.getElementById('startMultiChallengeBtn');
    
    if (startChallengeBtn) {
        startChallengeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            startMultiListChallenge();
        });
    }
}

function updateMultiChallengeButton() {
    const startChallengeBtn = document.getElementById('startMultiChallengeBtn');
    const checkboxes = document.querySelectorAll('.word-set-checkbox');
    
    if (!startChallengeBtn || !checkboxes) return;
    
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    if (selectedCount === 0) {
        startChallengeBtn.disabled = true;
        startChallengeBtn.textContent = '🏃 Start Multi-List Challenge';
    } else {
        startChallengeBtn.disabled = false;
        const totalWords = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .reduce((sum, cb) => sum + parseInt(cb.dataset.wordCount), 0);
        startChallengeBtn.textContent = `🏃 Start Challenge (${selectedCount} lists, ${totalWords} words)`;
    }
}

function startMultiListChallenge() {
    const checkboxes = document.querySelectorAll('.word-set-checkbox:checked');
    
    if (checkboxes.length === 0) {
        showNotification('Please select at least one word set for the challenge.', 'warning');
        return;
    }
    
    // Close the word set panel curtain immediately when starting challenge
    if (window.closePanelCurtain) {
        window.closePanelCurtain();
    }
    
    // Store original state
    originalSingleListState = {
        words: [...words],
        currentWordSetId: currentWordSetId,
        currentWordSetName: currentWordSetName,
        isPracticeMode: isPracticeMode,
        isIndividualWordPractice: isIndividualWordPractice
    };
    
    // Prepare challenge data in selection order
    selectedWordSetsForChallenge = challengeSelectionOrder.map(setId => {
        const wordSet = availableWordSets.find(set => set.id === setId);
        const checkbox = document.querySelector(`.word-set-checkbox[value="${setId}"]`);
        
        return {
            id: setId,
            name: checkbox.dataset.setName,
            words: wordSet ? wordSet.words : [],
            wordCount: parseInt(checkbox.dataset.wordCount)
        };
    });
    
    // Initialize challenge state
    isMultiListChallenge = true;
    currentChallengeListIndex = 0;
    challengeResults = [];
    
    console.log(`Starting multi-list challenge with ${selectedWordSetsForChallenge.length} word sets in selection order:`, selectedWordSetsForChallenge);
    
    // Start with the first word set
    startNextChallengeList();
    
    // Update UI
    updateMultiChallengeUI();
    
    showNotification(`🏃 Multi-List Challenge Started! ${selectedWordSetsForChallenge.length} word sets to complete.`, 'success');
}

function startNextChallengeList() {
    if (currentChallengeListIndex >= selectedWordSetsForChallenge.length) {
        // Challenge complete
        completeMultiListChallenge();
        return;
    }
    
    const currentSet = selectedWordSetsForChallenge[currentChallengeListIndex];
    console.log(`Starting challenge list ${currentChallengeListIndex + 1}: ${currentSet.name}`);
    
    // Set individual list start time
    window.currentListStartTime = new Date();
    
    // Set up the current word set
    words = [...currentSet.words];
    currentWordSetId = currentSet.id;
    currentWordSetName = currentSet.name;
    
    // Shuffle words for this list
    if (words.length > 1) {
        shuffleArray(words);
    }
    
    // Reset quiz state for this list
    resetQuizState();
    updateDisplay();
    updateMultiChallengeUI();
    
    const listNumber = currentChallengeListIndex + 1;
    const totalLists = selectedWordSetsForChallenge.length;
    
    // Show list transition notification (brief)
    if (currentChallengeListIndex > 0) {
        showNotification(`📚 List ${listNumber}/${totalLists}: "${currentSet.name}" - ${words.length} words`, 'info');
    } else {
        showNotification(`🏃 Challenge Started! List ${listNumber}/${totalLists}: "${currentSet.name}"`, 'success');
    }
    
    // Speak the first word after a brief delay
    setTimeout(() => {
        if (words.length > 0) speakWord(words[0]);
    }, currentChallengeListIndex > 0 ? 800 : 500); // Slightly longer delay for list transitions
}

function completeCurrentChallengeList() {
    const listEndTime = new Date();
    
    // Store results for this list with individual timing
    const listResult = {
        listIndex: currentChallengeListIndex,
        wordSetId: currentWordSetId,
        wordSetName: currentWordSetName,
        words: [...words],
        userAnswers: [...userAnswers],
        hintUsed: [...hintUsed],
        startedAt: window.currentListStartTime || new Date(),
        completedAt: listEndTime
    };
    
    challengeResults.push(listResult);
    
    console.log(`Completed challenge list ${currentChallengeListIndex + 1}: ${currentWordSetName}`);
    
    // Move to next list
    currentChallengeListIndex++;
    
    if (currentChallengeListIndex >= selectedWordSetsForChallenge.length) {
        // All lists complete - show final results
        completeMultiListChallenge();
    } else {
        // Immediately continue to next list
        startNextChallengeList();
    }
}

function continueToNextChallengeList() {
    closeModal();
    setTimeout(() => {
        startNextChallengeList();
    }, 200);
}

function completeMultiListChallenge() {
    console.log('Multi-list challenge complete!');
    
    // Calculate overall statistics
    let totalWords = 0;
    let totalCorrectFirstTry = 0;
    let totalHintsUsed = 0;
    
    challengeResults.forEach(listResult => {
        totalWords += listResult.words.length;
        
        listResult.words.forEach((word, index) => {
            const userAnswer = listResult.userAnswers[index];
            const attempts = userAnswer ? userAnswer.attempts : [];
            const firstTryCorrect = attempts.length > 0 && attempts[0] === word;
            
            if (firstTryCorrect) totalCorrectFirstTry++;
            if (Array.isArray(listResult.hintUsed[index]) ? listResult.hintUsed[index].length > 0 : listResult.hintUsed[index]) {
                totalHintsUsed++;
            }
        });
    });
    
    const overallScore = Math.round((totalCorrectFirstTry / totalWords) * 100);
    
    // Show detailed completion modal with better scrolling
    let html = `
        <div style="max-height: 75vh; overflow-y: auto; padding-right: 8px;">
            <h2 style="color: #22c55e; margin-bottom: 16px; text-align: center;">🏆 Multi-List Challenge Complete!</h2>
            <div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; color: #1e40af;">📊 Overall Results</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 0.9rem;">
                    <div><strong>Total Words:</strong> ${totalWords}</div>
                    <div><strong>First-Try Correct:</strong> ${totalCorrectFirstTry}</div>
                    <div><strong>Overall Score:</strong> ${overallScore}%</div>
                    <div><strong>Hints Used:</strong> ${totalHintsUsed}</div>
                </div>
            </div>
            
            <h3 style="margin-bottom: 12px; color: #1e293b;">📚 Detailed Results by List</h3>
    `;
    
    // Show detailed results for each list
    challengeResults.forEach((listResult, listIndex) => {
        const listCorrect = listResult.words.filter((word, wordIndex) => {
            const userAnswer = listResult.userAnswers[wordIndex];
            const attempts = userAnswer ? userAnswer.attempts : [];
            return attempts.length > 0 && attempts[0] === word;
        }).length;
        
        const listScore = Math.round((listCorrect / listResult.words.length) * 100);
        
        html += `
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 1.1rem;">
                    📋 List ${listIndex + 1}: ${listResult.wordSetName}
                </h4>
                <div style="margin-bottom: 12px; color: #64748b; font-weight: 600;">
                    Score: ${listScore}% (${listCorrect}/${listResult.words.length} words)
                </div>
                
                <div style="overflow-x: auto; margin-bottom: 8px;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0 4px; font-size: 0.85rem;">
                        <tr style="background: #e2e8f0;">
                            <th style="text-align: left; padding: 6px 8px; border-radius: 4px 0 0 4px;">Word</th>
                            <th style="text-align: center; padding: 6px 8px;">First Try</th>
                            <th style="text-align: left; padding: 6px 8px; border-radius: 0 4px 4px 0;">All Attempts</th>
                        </tr>
        `;
        
        // Show each word in this list
        listResult.words.forEach((word, wordIndex) => {
            const userAnswer = listResult.userAnswers[wordIndex];
            const attempts = userAnswer ? userAnswer.attempts : [];
            const firstTryCorrect = attempts.length > 0 && attempts[0] === word;
            const eventuallyCorrect = attempts.includes(word);
            const hintsUsedForWord = Array.isArray(listResult.hintUsed[wordIndex]) ? 
                listResult.hintUsed[wordIndex].length > 0 : listResult.hintUsed[wordIndex];
            
            html += `<tr style="background: #ffffff;">
                <td style="font-weight: 600; padding: 6px 8px; border-radius: 4px 0 0 4px;">${word}</td>
                <td style="text-align: center; padding: 6px 8px;">`;
            
            // Show first try result
            if (firstTryCorrect) {
                html += `<span style='font-size: 1.3em; color: #22c55e;'>✅</span>`;
            } else {
                html += `<span style='font-size: 1.3em; color: #ef4444;'>❌</span>`;
            }
            
            // Add hint indicator
            if (hintsUsedForWord) {
                html += `<span style='color: #fbbf24; font-weight: 700; font-size: 1.1em; margin-left: 4px;' title='Hint used'>H</span>`;
            }
            
            html += `</td><td style="color: #4b5563; padding: 6px 8px; border-radius: 0 4px 4px 0;">`;
            
            // Show all attempts with color coding
            if (attempts.length > 0) {
                const attemptsList = attempts.map((attempt, idx) => {
                    if (attempt === word) {
                        return `<span style="color: #22c55e; font-weight: 600;">${attempt}</span>`;
                    } else {
                        return `<span style="color: #ef4444; font-weight: 600;">${attempt}</span>`;
                    }
                }).join(' → ');
                html += attemptsList;
                
                // Add status if eventually correct but not first try
                if (!firstTryCorrect && eventuallyCorrect) {
                    html += ` <span style="color: #f59e0b; font-size: 0.75em;">(eventually correct)</span>`;
                }
            } else {
                html += '<span style="color: #9ca3af;">No attempts</span>';
            }
            
            html += '</td></tr>';
        });
        
        html += `
                    </table>
                </div>
            </div>
        `;
    });
    
    html += `
        </div>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 2px solid #e5e7eb; display: flex; gap: 12px; justify-content: center; background: white; position: sticky; bottom: 0;">
            <button onclick="exitMultiListChallenge()" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
                Return to Word Sets
            </button>
        </div>
    `;
    
    showModal(html);
    
    // Save challenge results to Firebase
    saveMultiListChallengeResults();
    
    // Mark as complete
    isMultiListChallenge = false;
}

function exitMultiListChallenge() {
    console.log('Exiting multi-list challenge...');
    
    // Restore original state
    if (originalSingleListState) {
        words = [...originalSingleListState.words];
        currentWordSetId = originalSingleListState.currentWordSetId;
        currentWordSetName = originalSingleListState.currentWordSetName;
        isPracticeMode = originalSingleListState.isPracticeMode;
        isIndividualWordPractice = originalSingleListState.isIndividualWordPractice;
    }
    
    // Reset challenge state
    isMultiListChallenge = false;
    selectedWordSetsForChallenge = [];
    currentChallengeListIndex = 0;
    challengeResults = [];
    originalSingleListState = null;
    challengeSelectionOrder = []; // Reset selection order
    
    // Reset quiz and update UI
    resetQuizState();
    updateDisplay();
    updateWordSetPanel();
    updatePracticeModeUI();
    
    closeModal();
    showNotification('Returned to single word set mode', 'info');
}

function updateMultiChallengeUI() {
    const title = document.querySelector('.title');
    const exitButton = document.getElementById('exitPracticeButton');
    
    if (title) {
        const logoHtml = '<img src="logo.png" alt="Spelling Practice Logo" class="logo">';
        
        if (isMultiListChallenge) {
            const listNumber = currentChallengeListIndex + 1;
            const totalLists = selectedWordSetsForChallenge.length;
            title.innerHTML = logoHtml + `🏃 Multi List ${listNumber}/${totalLists}`;
            title.style.color = '#3b82f6';
        } else if (isIndividualWordPractice) {
            title.innerHTML = logoHtml + '🎯 Word Practice';
            title.style.color = '#10b981';
        } else if (isPracticeMode) {
            title.innerHTML = logoHtml + '🎯 Practice Mode';
            title.style.color = '#f59e0b';
        } else {
            title.innerHTML = logoHtml + 'Spelling Practice';
            title.style.color = '#2563eb';
        }
    }
    
    // Show/hide exit button
    if (exitButton) {
        if (isMultiListChallenge) {
            exitButton.style.display = 'inline-block';
            exitButton.textContent = '🚪 Exit Multi List';
        } else if (isIndividualWordPractice) {
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

async function saveMultiListChallengeResults() {
    try {
        console.log('Saving multi-list challenge results...');
        
        const now = new Date();
        let totalTimeSeconds = 0;
        if (window.quizStartTime) {
            const rawTime = Math.round((now - window.quizStartTime) / 1000);
            // Cap at 10 minutes (600 seconds) - user likely forgot to sign out
            totalTimeSeconds = Math.min(rawTime, 600);
        }
        
        // Save each list as a separate result entry (so teacher dashboard can see them)
        const savePromises = [];
        
        for (let i = 0; i < challengeResults.length; i++) {
            const listResult = challengeResults[i];
            
            // Transform the list data to match regular quiz format
            const wordsData = listResult.words.map((word, index) => {
                const userAnswer = listResult.userAnswers[index] || { attempts: [], correct: false };
                const attempts = userAnswer.attempts || [];
                
                // A word is only correct if the FIRST attempt was correct
                const firstAttemptCorrect = attempts.length > 0 && attempts[0] === word;
                
                return {
                    word: word,
                    correct: firstAttemptCorrect, // Only true if first attempt was correct
                    attempts: attempts,
                    hint: Array.isArray(listResult.hintUsed[index]) ? listResult.hintUsed[index].length > 0 : listResult.hintUsed[index] || false,
                    hintLetters: Array.isArray(listResult.hintUsed[index]) ? listResult.hintUsed[index] : [], // Track which letters were hinted
                    firstTryCorrect: firstAttemptCorrect // Explicit field for first-try scoring
                };
            });
            
            // Calculate time for this list (using individual timing with 10-min cap)
            let listTimeSeconds;
            if (listResult.startedAt && listResult.completedAt) {
                const rawListTime = Math.round((listResult.completedAt - listResult.startedAt) / 1000);
                // Cap individual list time at 10 minutes (600 seconds)
                listTimeSeconds = Math.min(rawListTime, 600);
            } else {
                // Fallback to proportional time, also capped
                const proportionalTime = Math.round(totalTimeSeconds / challengeResults.length);
                listTimeSeconds = Math.min(proportionalTime, 600);
            }
            
            // Create individual list result (same format as regular quiz)
            const listQuizData = {
                user: userName,
                date: now.toISOString(),
                words: wordsData,
                wordSetId: listResult.wordSetId,
                wordSetName: listResult.wordSetName,
                timestamp: now,
                completedAt: listResult.completedAt,
                totalTimeSeconds: listTimeSeconds,
                // Add individual list start and end times for teacher dashboard display
                startTime: listResult.startedAt ? listResult.startedAt.toISOString() : now.toISOString(),
                finishTime: listResult.completedAt.toISOString(),
                // Add multi-challenge context
                multiChallenge: true,
                challengeListIndex: i + 1,
                challengeTotalLists: challengeResults.length,
                challengeId: `${userName}_${now.getTime()}` // Common ID for all lists in this challenge
            };
            
            console.log(`Saving individual list ${i + 1}:`, listQuizData);
            
            // Save this list as a separate result
            const savePromise = window.db.collection('results').add(listQuizData);
            savePromises.push(savePromise);
        }
        
        // Also save the overall challenge summary (optional - for detailed analysis)
        const challengeSummaryData = {
            user: userName,
            date: now.toISOString(),
            type: 'multi-list-challenge-summary',
            challengeResults: challengeResults,
            totalLists: selectedWordSetsForChallenge.length,
            totalTimeSeconds: totalTimeSeconds,
            timestamp: now,
            completedAt: now,
            challengeId: `${userName}_${now.getTime()}`
        };
        
        savePromises.push(window.db.collection('results').add(challengeSummaryData));
        
        // Wait for all saves to complete
        const results = await Promise.all(savePromises);
        
        console.log(`Multi-list challenge results saved successfully!`);
        console.log(`- ${challengeResults.length} individual list results saved`);
        console.log(`- 1 challenge summary saved`);
        console.log('Document IDs:', results.map(doc => doc.id));
        
        showNotification('Challenge results saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving challenge results:', error);
        showNotification('Error saving challenge results.', 'error');
    }
}

// Make functions globally available
window.continueToNextChallengeList = continueToNextChallengeList;
window.exitMultiListChallenge = exitMultiListChallenge;

function nextWord() {
    console.log('nextWord called, current state:', {
        isIndividualWordPractice,
        isMultiListChallenge,
        currentWordIndex,
        wordsLength: words.length
    });
    
    if (isIndividualWordPractice && originalPracticeState) {
        // For individual word practice, return to the practice mode
        console.log('Completing individual word practice...');
        exitIndividualWordPractice();
        return;
    }
    
    // Check if this is the end of the current word list
    if (currentWordIndex >= words.length - 1) {
        console.log('End of word list reached');
        
        if (isMultiListChallenge) {
            // Complete current challenge list and move to next or finish
            completeCurrentChallengeList();
            return;
        } else {
            // Regular quiz completion - show feedback
            quizComplete = true;
            showEndOfQuizFeedback();
            return;
        }
    }
    
    // Move to next word in current list
    currentWordIndex++;
    updateDisplay();
    
    // Speak the new word
    setTimeout(() => {
        if (words[currentWordIndex]) {
            speakWord(words[currentWordIndex]);
        }
    }, 200);
}

// Function to update username display
function updateUsernameDisplay() {
    const userWelcome = document.getElementById('userWelcome');
    const currentUserName = document.getElementById('currentUserName');
    
    if (userWelcome && currentUserName && userName) {
        currentUserName.textContent = userName;
        userWelcome.style.display = 'flex';
        console.log('Username display updated:', userName);
    } else {
        console.log('Username display elements not found or no username available');
    }
}

// Helper function to automatically speak the first word when practice starts
function autoSpeakFirstWord() {
    console.log('Auto-speaking first word...');
    
    // Wait a moment for everything to be ready
    setTimeout(() => {
        if (words && words.length > 0 && currentWordIndex === 0) {
            console.log('Speaking first word automatically:', words[currentWordIndex]);
            speakWord(words[currentWordIndex]);
        }
    }, 1000); // 1 second delay to ensure everything is loaded
}

// Start practice immediately after successful authentication
function startPracticeImmediately() {
    console.log('Starting practice immediately...');
    
    // Auto-speak first word
    autoSpeakFirstWord();
}

// ===== SENTENCE PRACTICE FUNCTIONALITY =====

// Variables for sentence practice
let isSentencePracticeMode = false;
let currentSentenceWord = '';
let isSentenceVoiceInputActive = false;
let sentenceRecognition = null;
let cursorPosition = 0; // Track cursor position for merged input

// Initialize sentence practice when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const sentenceBtn = document.getElementById('sentencePracticeButton');
        const backBtn = document.getElementById('backToSpellingButton');
        const checkBtn = document.getElementById('checkSentenceButton');
        
        console.log('Sentence practice setup:', {
            sentenceBtn: !!sentenceBtn,
            backBtn: !!backBtn,
            checkBtn: !!checkBtn,
            spellingMode: !!document.getElementById('spellingPracticeMode'),
            sentenceMode: !!document.getElementById('sentencePracticeMode')
        });
        
        // Mini voice controls for merged input
        const startVoiceMiniBtn = document.getElementById('startVoiceMiniBtn');
        const stopVoiceMiniBtn = document.getElementById('stopVoiceMiniBtn');
        
        if (sentenceBtn) {
            sentenceBtn.addEventListener('click', function() {
                console.log('Sentence practice button clicked! Mode:', isSentencePracticeMode);
                if (isSentencePracticeMode) {
                    exitSentenceMode();
                } else {
                    enterSentenceMode();
                }
            });
            console.log('Sentence practice button event listener added');
        } else {
            console.error('Sentence practice button not found!');
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', exitSentenceMode);
        }
        
        if (checkBtn) {
            checkBtn.addEventListener('click', checkSentence);
        }
        
        // Mini voice controls for merged input
        if (startVoiceMiniBtn) {
            startVoiceMiniBtn.addEventListener('click', startMergedVoiceInput);
        }
        
        if (stopVoiceMiniBtn) {
            stopVoiceMiniBtn.addEventListener('click', stopMergedVoiceInput);
        }
        
        // Setup character counter and cursor tracking
        const textarea = document.getElementById('sentenceTextarea');
        const charCount = document.getElementById('charCount');
        if (textarea && charCount) {
            textarea.addEventListener('input', function() {
                charCount.textContent = this.value.length;
            });
            
            // Track cursor position for merged voice input
            textarea.addEventListener('click', function() {
                cursorPosition = this.selectionStart;
            });
            
            textarea.addEventListener('keyup', function() {
                cursorPosition = this.selectionStart;
            });
        }
        
        // Initialize sentence voice recognition
        initializeSentenceVoiceRecognition();
    }, 1000);
});

function enterSentenceMode() {
    isSentencePracticeMode = true;
    document.getElementById('spellingPracticeMode').style.display = 'none';
    document.getElementById('sentencePracticeMode').style.display = 'block';
    document.getElementById('sentencePracticeButton').textContent = '🔤 Back to Spelling';
    
    // Set current word
    const words = getWords();
    if (words && words.length > 0) {
        currentSentenceWord = words[currentWordIndex || 0];
        document.getElementById('sentenceTargetWord').textContent = currentSentenceWord;
        document.getElementById('requiredWordHint').textContent = currentSentenceWord;
    }
    
    showNotification('Sentence practice mode activated! Create sentences using the given words.', 'info');
}

function exitSentenceMode() {
    isSentencePracticeMode = false;
    document.getElementById('spellingPracticeMode').style.display = 'block';
    document.getElementById('sentencePracticeMode').style.display = 'none';
    document.getElementById('sentencePracticeButton').textContent = '📝 Practice Sentences';
    
    // Clear inputs
    document.getElementById('sentenceTextarea').value = '';
    document.getElementById('charCount').textContent = '0';
    
    showNotification('Back to spelling practice!', 'info');
}

function checkSentence() {
    const textarea = document.getElementById('sentenceTextarea');
    const validation = document.getElementById('sentenceValidation');
    
    // Get text from textarea (merged input mode)
    let sentence = (textarea?.value || '').trim();
    
    if (!sentence) {
        validation.textContent = 'Please enter a sentence first.';
        validation.className = 'sentence-validation error';
        return;
    }
    
    if (sentence.length < 5) {
        validation.textContent = 'Your sentence is too short.';
        validation.className = 'sentence-validation warning';
        return;
    }
    
    // Check if word is included
    const hasWord = sentence.toLowerCase().includes(currentSentenceWord.toLowerCase());
    
    if (!hasWord) {
        validation.textContent = `Your sentence must include the word "${currentSentenceWord}".`;
        validation.className = 'sentence-validation error';
        return;
    }
    
    validation.textContent = `Great! Your sentence includes "${currentSentenceWord}".`;
    validation.className = 'sentence-validation success';
    
    // Stop voice input if active
    if (isSentenceVoiceInputActive) {
        stopMergedVoiceInput();
    }
    
    // Move to next word after delay
    setTimeout(() => {
        const words = getWords();
        if (words && words.length > 0) {
            currentWordIndex = (currentWordIndex + 1) % words.length;
            currentSentenceWord = words[currentWordIndex];
            document.getElementById('sentenceTargetWord').textContent = currentSentenceWord;
            document.getElementById('requiredWordHint').textContent = currentSentenceWord;
            
            // Clear inputs
            if (textarea) textarea.value = '';
            document.getElementById('charCount').textContent = '0';
            validation.style.display = 'none';
        }
    }, 2000);
}

// ===== MERGED VOICE INPUT FUNCTIONS =====

function initializeSentenceVoiceRecognition() {
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('Speech recognition not supported for sentence practice');
        return;
    }
    
    // Initialize speech recognition for sentence practice
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    sentenceRecognition = new SpeechRecognition();
    
    // Configure for sentence dictation (capturing words, not letters)
    sentenceRecognition.continuous = false;
    sentenceRecognition.interimResults = true;
    sentenceRecognition.lang = 'en-US';
    sentenceRecognition.maxAlternatives = 1;
    
    // Handle recognition results
    sentenceRecognition.onresult = function(event) {
        let finalTranscript = '';
        
        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            }
        }
        
        // Insert at cursor position in textarea
        if (finalTranscript.trim()) {
            const textarea = document.getElementById('sentenceTextarea');
            if (textarea) {
                const currentText = textarea.value;
                const beforeCursor = currentText.substring(0, cursorPosition);
                const afterCursor = currentText.substring(cursorPosition);
                
                // Add space before and after if needed
                let textToInsert = finalTranscript.trim();
                if (beforeCursor.length > 0 && !beforeCursor.endsWith(' ')) {
                    textToInsert = ' ' + textToInsert;
                }
                if (afterCursor.length > 0 && !textToInsert.endsWith(' ')) {
                    textToInsert = textToInsert + ' ';
                }
                
                // Insert the text
                const newText = beforeCursor + textToInsert + afterCursor;
                textarea.value = newText;
                
                // Update cursor position
                const newCursorPosition = beforeCursor.length + textToInsert.length;
                textarea.setSelectionRange(newCursorPosition, newCursorPosition);
                cursorPosition = newCursorPosition;
                
                // Update character count
                const charCount = document.getElementById('charCount');
                if (charCount) {
                    charCount.textContent = textarea.value.length;
                }
                
                // Update status
                const voiceStatusMini = document.getElementById('sentenceVoiceStatusMini');
                if (voiceStatusMini) {
                    const voiceTextMini = voiceStatusMini.querySelector('.voice-text-mini');
                    if (voiceTextMini) {
                        voiceTextMini.textContent = 'Added: "' + finalTranscript.trim() + '" - Keep speaking or click Stop';
                    }
                }
            }
        }
    };
    
    // Handle recognition end
    sentenceRecognition.onend = function() {
        stopMergedVoiceInput();
    };
    
    // Handle recognition errors
    sentenceRecognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        stopMergedVoiceInput();
    };
}

function startMergedVoiceInput() {
    if (!sentenceRecognition) {
        showNotification('Voice input not available', 'error');
        return;
    }
    
    if (isSentenceVoiceInputActive) {
        showNotification('Voice input is already active', 'warning');
        return;
    }
    
    const textarea = document.getElementById('sentenceTextarea');
    if (textarea) {
        // Store current cursor position
        cursorPosition = textarea.selectionStart;
        textarea.focus();
    }
    
    try {
        isSentenceVoiceInputActive = true;
        sentenceRecognition.start();
        
        // Update UI
        const startMiniBtn = document.getElementById('startVoiceMiniBtn');
        const stopMiniBtn = document.getElementById('stopVoiceMiniBtn');
        const voiceStatusMini = document.getElementById('sentenceVoiceStatusMini');
        
        if (startMiniBtn) {
            startMiniBtn.disabled = true;
            startMiniBtn.style.display = 'none';
        }
        if (stopMiniBtn) {
            stopMiniBtn.disabled = false;
            stopMiniBtn.style.display = 'inline-flex';
        }
        
        if (voiceStatusMini) {
            voiceStatusMini.style.display = 'flex';
            const voiceTextMini = voiceStatusMini.querySelector('.voice-text-mini');
            if (voiceTextMini) {
                voiceTextMini.textContent = 'Listening... Speak words to add at cursor position';
            }
        }
        
        console.log('Merged voice input started at cursor position:', cursorPosition);
    } catch (error) {
        console.error('Error starting merged voice input:', error);
        showNotification('Failed to start voice input', 'error');
        isSentenceVoiceInputActive = false;
    }
}

function stopMergedVoiceInput() {
    if (sentenceRecognition) {
        isSentenceVoiceInputActive = false;
        sentenceRecognition.stop();
        
        // Update UI
        const startMiniBtn = document.getElementById('startVoiceMiniBtn');
        const stopMiniBtn = document.getElementById('stopVoiceMiniBtn');
        const voiceStatusMini = document.getElementById('sentenceVoiceStatusMini');
        
        if (startMiniBtn) {
            startMiniBtn.disabled = false;
            startMiniBtn.style.display = 'inline-flex';
        }
        if (stopMiniBtn) {
            stopMiniBtn.disabled = true;
            stopMiniBtn.style.display = 'none';
        }
        
        if (voiceStatusMini) {
            const voiceTextMini = voiceStatusMini.querySelector('.voice-text-mini');
            if (voiceTextMini) {
                voiceTextMini.textContent = 'Voice input stopped. Click "Add Voice" to continue.';
            }
            
            // Hide status after a delay
            setTimeout(() => {
                voiceStatusMini.style.display = 'none';
            }, 2000);
        }
        
        console.log('Merged voice input stopped');
    }
}