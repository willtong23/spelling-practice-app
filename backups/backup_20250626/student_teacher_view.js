// Universal Student Teacher View - Dynamic Data Loading
// This file works for any student by reading URL parameters

// Firebase Configuration - Using spelling-v001 project (same as main app)
const firebaseConfig = {
    apiKey: "AIzaSyDP4A2AA9WocJtRTCF8i3wuN9DuZxLadDE",
    authDomain: "spelling-v001.firebaseapp.com",
    projectId: "spelling-v001",
    storageBucket: "spelling-v001.firebasestorage.app",
    messagingSenderId: "789364838972",
    appId: "1:789364838972:web:f571d4f5e385c4e0fce939"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();

// Test Firebase connection and authentication
async function testFirebaseConnection() {
    try {
        console.log('Testing Firebase connection...');
        // Try a simple read operation to test connection and permissions
        const testSnapshot = await window.db.collection('students').limit(1).get();
        console.log('Firebase connection successful. Students collection accessible.');
        return true;
    } catch (error) {
        console.error('Firebase connection test failed:', error);
        if (error.code === 'permission-denied') {
            showError('Authentication required. Please sign in through the main app first.', [
                'Go to the main app (index.html)',
                'Sign in with your student name',
                'Then return to this page'
            ]);
        } else {
            showError('Database connection failed. Please check your internet connection.');
        }
        return false;
    }
}

// Enable offline persistence to handle connection issues
window.db.enablePersistence({
    synchronizeTabs: true
}).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
        console.log('The current browser does not support offline persistence');
    }
});

// Global variables
let currentStudent = null;
let students = [];
let results = [];
let filteredResults = [];
let allResults = [];
let wordSets = [];

// Get student name from URL parameters
function getStudentNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentName = urlParams.get('student');
    console.log('Student name from URL:', studentName);
    return studentName ? studentName.toLowerCase().trim() : null;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== UNIVERSAL TEACHER VIEW INITIALIZING ===');
    console.log('🚀 DOM Content Loaded - Starting initialization...');
    
    currentStudent = getStudentNameFromURL();
    console.log('👤 Current student from URL:', currentStudent);
    
    if (!currentStudent) {
        console.error('❌ No student specified in URL');
        showError('No student specified. Please provide a student name in the URL (e.g., ?student=tyler)');
        return;
    }
    
    // Test Firebase connection first
    console.log('🔥 Testing Firebase connection...');
    const connectionOk = await testFirebaseConnection();
    if (!connectionOk) {
        console.log('❌ Firebase connection failed, stopping initialization');
        return;
    }
    console.log('✅ Firebase connection successful');
    
    console.log('📊 Starting to load data for student:', currentStudent);
    updateStudentNameDisplay(currentStudent);
    setupEventListeners();
    
    // IMPORTANT: Add await here to wait for data loading
    console.log('⏳ Calling loadAllData...');
    await loadAllData();
    console.log('🎉 Initialization complete!');
});

// Update the student name in the page title and header
function updateStudentNameDisplay(studentName) {
    const displayElement = document.getElementById('studentNameDisplay');
    if (displayElement) {
        displayElement.textContent = studentName.charAt(0).toUpperCase() + studentName.slice(1);
    }
    
    // Update page title
    document.title = `Learning Data for ${studentName.charAt(0).toUpperCase() + studentName.slice(1)} - Spelling Practice App`;
}

// Setup event listeners
function setupEventListeners() {
    const applyFilterBtn = document.getElementById('applyAnalyticsFilter');
    const sortBySelect = document.getElementById('sortBy');
    const displayFilter = document.getElementById('displayFilter');
    const detailsFilter = document.getElementById('detailsFilter');
    
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyAnalyticsFilter);
    }
    
    if (sortBySelect) {
        sortBySelect.addEventListener('change', applySorting);
    }
    
    if (displayFilter) {
        displayFilter.addEventListener('change', applyAnalyticsFilter);
    }
    
    if (detailsFilter) {
        detailsFilter.addEventListener('change', updateFilteredAnalytics);
    }
    
    console.log('Event listeners set up successfully');
}

// Print page function
function printPage() {
    window.print();
}

// Load all data for the current student
async function loadAllData() {
    console.log('📊 === STARTING loadAllData ===');
    try {
        console.log('🔄 Showing loading screen...');
        showLoading();
        
        console.log('🚀 Starting parallel data loading...');
        
        // Load student data, results, and word sets in parallel
        console.log('⏳ Calling Promise.all for data loading...');
        await Promise.all([
            loadStudentData(),
            loadStudentResults(),
            loadWordSets()
        ]);
        
        console.log('✅ Promise.all completed successfully!');
        console.log('📊 Data loaded - Students:', students.length, 'Results:', results.length, 'WordSets:', wordSets.length);
        
        if (students.length === 0) {
            console.warn('⚠️ No students found, showing error...');
            showError(`No student found with name "${currentStudent}". This student may not have any practice records yet, or the name might be misspelled. Available students: Tyler, Robbie.`);
            return;
        }
        
        console.log('✅ Student found:', students[0]);
        
        // Initialize filters and display data
            console.log('🔧 Initializing analytics filters...');
    initializeAnalyticsFilters();
    
    console.log('📈 Updating filtered analytics...');
    updateFilteredAnalytics();
        
        console.log('👁️ Hiding loading and showing content...');
        hideLoading();
        showMainContent();
        
        console.log('=== DATA LOADING COMPLETE ===');
        console.log('Student loaded:', students[0]);
        console.log('Results loaded:', results.length);
        console.log('Word sets loaded:', wordSets.length);
        
    } catch (error) {
        console.error('💥 Error in loadAllData:', error);
        if (error.code === 'permission-denied') {
            showError('Access denied. Please ensure you have proper permissions to view student data. Try refreshing the page or contact your administrator.');
        } else if (error.code === 'unavailable') {
            showError('Unable to connect to the database. Please check your internet connection and try again.');
        } else {
            showError('Failed to load student data. Please try again later. Error: ' + error.message);
        }
    }
}

// Load student record
async function loadStudentData() {
    console.log('👤 === STARTING loadStudentData ===');
    try {
        console.log(`🔍 Loading student data for: ${currentStudent}`);
        
        // Load ALL students (same as teacher dashboard)
        console.log('📊 Querying students collection...');
        const studentSnapshot = await window.db.collection("students").get();
        console.log('📊 Students query completed, size:', studentSnapshot.size);
        
        if (studentSnapshot.empty) {
            console.log('⚠️ No students found in students collection');
            students = [];
        } else {
            // Get all students and filter by name (case-insensitive)
            console.log('📋 Processing students documents...');
            const allStudents = studentSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('📋 Total students in database:', allStudents.length);
            console.log('📋 First few students:', allStudents.slice(0, 3).map(s => s.name || s.username));
            
            // Filter students by name using same logic as teacher dashboard
            console.log('🔍 Filtering students for name:', currentStudent);
            students = allStudents.filter(student => 
                student.name && 
                student.name.toLowerCase().trim() === currentStudent.toLowerCase().trim()
            );
            console.log('🎯 Filtered students result:', students.length);
            
            if (students.length > 0) {
                console.log(`✅ Student record loaded:`, students[0]);
            } else {
                console.log(`❌ No student named '${currentStudent}' found in students collection`);
                
                // Get list of available students for error message
                const availableStudents = allStudents
                    .map(s => s.name)
                    .filter(name => name)
                    .sort();
                console.log('📋 Available students:', availableStudents);
                
                // Update error message with available students
                const errorElement = document.getElementById('error-message');
                if (errorElement && availableStudents.length > 0) {
                    errorElement.innerHTML = `
                        <div class="alert alert-warning">
                            <h4>No student found with name "${currentStudent}"</h4>
                            <p>This student may not have any practice records yet, or the name might be misspelled.</p>
                            <p><strong>Available students:</strong> ${availableStudents.join(', ')}</p>
                        </div>
                    `;
                }
            }
        }
        console.log('✅ loadStudentData completed');
        
    } catch (error) {
        console.error('💥 Error loading student data:', error);
        students = [];
    }
}

// Load student's quiz results
async function loadStudentResults() {
    try {
        console.log(`Loading quiz results for: ${currentStudent}`);
        
        // Load ALL quiz results (same as teacher dashboard)
        const snapshot = await window.db.collection('results').orderBy('date', 'desc').get();
        
        if (snapshot.empty) {
            console.log('No quiz results found in results collection');
            results = [];
        } else {
            // Get all results and filter by user name (case-insensitive)
            allResults = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Filter results by user name using same logic as teacher dashboard
            results = allResults.filter(result => 
                result.user && 
                result.user.toLowerCase().trim() === currentStudent.toLowerCase().trim()
            );
            
            // Enrich results with calculated data
            if (results.length > 0) {
                enrichResults(results);
                console.log(`Loaded ${results.length} quiz results for ${currentStudent}`);
                console.log('Sample result structure:', results[0]);
            } else {
                console.log(`No quiz results found for '${currentStudent}'`);
                
                // Get list of users who have results for error message
                const usersWithResults = [...new Set(allResults
                    .map(r => r.user)
                    .filter(user => user)
                )].sort();
                console.log('Users with quiz results:', usersWithResults);
            }
        }
        
        // Initialize filtered results
        filteredResults = [...results];
        
    } catch (error) {
        console.error('Error loading student results:', error);
        results = [];
        filteredResults = [];
    }
}

// Load word sets
async function loadWordSets() {
    try {
        const snapshot = await window.db.collection("wordSets").get();
        wordSets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log("Word sets loaded:", wordSets.length);
    } catch (error) {
        console.error("Error loading word sets:", error);
        wordSets = [];
    }
}

// Enrich results with calculated data
function enrichResults(results) {
    // Calculate trial numbers by sorting by date first
    const sortedByDate = [...results].sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
    const wordSetTrials = new Map();

    sortedByDate.forEach(result => {
        const wordSetName = result.wordSetName || 'Unknown Set';
        const trial = (wordSetTrials.get(wordSetName) || 0) + 1;
        wordSetTrials.set(wordSetName, trial);
        result.trialNumber = trial;
    });

    // Add other calculated values
    results.forEach(result => {
        // Time Taken Calculation
        if (result.startTime && result.finishTime) {
            const start = new Date(result.startTime);
            const finish = new Date(result.finishTime);
            result.timeTakenSeconds = Math.round((finish - start) / 1000);
        } else {
            result.timeTakenSeconds = 0;
        }

        // Score Calculation - only count as correct if answer was right AND no hint was used
        if (result.words && result.words.length > 0) {
            const correct = result.words.filter(w => {
                const isCorrectAnswer = (w.attempts || [])[0] === w.word;
                const usedHint = w.hint; // Firebase stores hint usage as boolean
                return isCorrectAnswer && !usedHint; // Only correct if right answer AND no hint used
            }).length;
            result.scoreValue = Math.round((correct / result.words.length) * 100); // Convert to percentage
            result.scoreDisplay = `${correct} / ${result.words.length}`;
        } else {
            result.scoreValue = 0;
            result.scoreDisplay = 'N/A';
        }

        // Format time display
        if (result.timeTakenSeconds > 0) {
            const minutes = Math.floor(result.timeTakenSeconds / 60);
            const seconds = result.timeTakenSeconds % 60;
            result.timeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        } else {
            result.timeDisplay = 'N/A';
        }
    });
}

// Initialize analytics filters
function initializeAnalyticsFilters() {
    console.log("Initializing analytics filters...");
    
    const studentFilter = document.getElementById("analyticsStudentFilter");
    const wordSetFilter = document.getElementById("analyticsWordSetFilter");
    const fromDateFilter = document.getElementById("analyticsFromDate");
    const toDateFilter = document.getElementById("analyticsToDate");
    
    // Set default date range (last 30 days)
    if (fromDateFilter && toDateFilter) {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        fromDateFilter.value = thirtyDaysAgo.toISOString().split("T")[0];
        toDateFilter.value = today.toISOString().split("T")[0];
    }
    
    // Populate student filter with current student
    if (studentFilter) {
        studentFilter.innerHTML = '<option value="">All Students</option>';
        if (students.length > 0) {
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.name;
                option.textContent = student.name.charAt(0).toUpperCase() + student.name.slice(1);
                option.selected = student.name === currentStudent;
                studentFilter.appendChild(option);
            });
        }
    }
    
    // Populate word set filter
    if (wordSetFilter) {
        wordSetFilter.innerHTML = '<option value="">All Word Sets</option>';
        if (wordSets.length > 0) {
            wordSets.forEach(wordSet => {
                const option = document.createElement('option');
                option.value = wordSet.name;
                option.textContent = wordSet.name;
                wordSetFilter.appendChild(option);
            });
        }
    }
    
    console.log("Analytics filters initialized successfully");
}

// Apply analytics filter
function applyAnalyticsFilter() {
    const studentFilter = document.getElementById("analyticsStudentFilter");
    const wordSetFilter = document.getElementById("analyticsWordSetFilter");
    const fromDateFilter = document.getElementById("analyticsFromDate");
    const toDateFilter = document.getElementById("analyticsToDate");
    const displayFilter = document.getElementById("displayFilter");
    
    let filtered = [...results];
    
    // Filter by student (though this should always be the current student)
    if (studentFilter && studentFilter.value) {
        filtered = filtered.filter(result => result.user === studentFilter.value);
    }
    
    // Filter by word set
    if (wordSetFilter && wordSetFilter.value) {
        filtered = filtered.filter(result => result.wordSetName === wordSetFilter.value);
    }
    
    // Filter by date range
    if (fromDateFilter && fromDateFilter.value) {
        const fromDate = new Date(fromDateFilter.value);
        filtered = filtered.filter(result => {
            const resultDate = result.timestamp?.toDate() || new Date(0);
            return resultDate >= fromDate;
        });
    }
    
    if (toDateFilter && toDateFilter.value) {
        const toDate = new Date(toDateFilter.value);
        toDate.setHours(23, 59, 59, 999); // End of day
        filtered = filtered.filter(result => {
            const resultDate = result.timestamp?.toDate() || new Date(0);
            return resultDate <= toDate;
        });
    }
    
    // Filter by display type
    if (displayFilter && displayFilter.value === 'complete') {
        // Complete Round: Only show quizzes where all words were attempted
        filtered = filtered.filter(result => {
            // Check if this is a complete round
            if (!result.words || !result.wordSetName) return false;
            
            // Find the word set to get the total number of words
            const wordSet = wordSets.find(ws => ws.name === result.wordSetName);
            if (!wordSet || !wordSet.words) return false;
            
            // Compare attempted words vs total words in the set
            const attemptedWords = result.words.length;
            const totalWords = wordSet.words.length;
            
            // Only show complete rounds (attempted all words)
            return attemptedWords === totalWords;
        });
    }
    // For 'all', 'hide-details', 'show-details': show all results (no filtering by completeness)
    
    filteredResults = filtered;
    applySorting();
    updateFilteredAnalytics();
    
    console.log(`Filter applied. Showing ${filteredResults.length} of ${results.length} results.`);
}

// Apply sorting
function applySorting() {
    const sortBy = document.getElementById('sortBy');
    if (!sortBy) return;
    
    const [field, direction] = sortBy.value.split('-');
    
    filteredResults.sort((a, b) => {
        let aVal, bVal;
        
        switch (field) {
            case 'timestamp':
                aVal = a.timestamp?.toDate() || new Date(0);
                bVal = b.timestamp?.toDate() || new Date(0);
                break;
            case 'score':
                aVal = a.scoreValue || 0;
                bVal = b.scoreValue || 0;
                break;
            case 'wordSetName':
                aVal = (a.wordSetName || '').toLowerCase();
                bVal = (b.wordSetName || '').toLowerCase();
                break;
            case 'timeTaken':
                aVal = a.timeTakenSeconds || 0;
                bVal = b.timeTakenSeconds || 0;
                break;
            case 'trial':
                aVal = a.trialNumber || 0;
                bVal = b.trialNumber || 0;
                break;
            default:
                return 0;
        }
        
        if (direction === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });
    
    updateFilteredAnalytics();
}

// Update the filtered analytics display
function updateFilteredAnalytics() {
    const tableBody = document.getElementById('resultsTableBody');
    if (!tableBody) return;
    
    const detailsFilter = document.getElementById('detailsFilter');
    const showDetails = detailsFilter && detailsFilter.value === 'show-details';
    
    tableBody.innerHTML = '';
    
    if (filteredResults.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = 'No results found for the selected filters.';
        cell.style.textAlign = 'center';
        cell.style.padding = '2rem';
        cell.style.color = '#6b7280';
        return;
    }
    
    filteredResults.forEach(result => {
        const row = tableBody.insertRow();
        
        // Date
        const dateCell = row.insertCell();
        const date = result.timestamp?.toDate();
        dateCell.textContent = date ? date.toLocaleDateString() : 'N/A';
        
        // Word Set
        const wordSetCell = row.insertCell();
        wordSetCell.textContent = result.wordSetName || 'Unknown Set';
        
        // Trial
        const trialCell = row.insertCell();
        const trialNumber = result.trialNumber || 1;
        const trialBadge = document.createElement('span');
        trialBadge.className = 'trial-badge';
        trialBadge.textContent = `${getOrdinalSuffix(trialNumber)} Try`;
        trialCell.appendChild(trialBadge);
        
        // Score
        const scoreCell = row.insertCell();
        scoreCell.className = 'score-cell';
        const scoreValue = result.scoreValue || 0;
        scoreCell.textContent = result.scoreDisplay || 'N/A';
        
        // Add score color coding
        if (scoreValue === 100) {
            scoreCell.classList.add('score-perfect');        // 100% - Green
        } else if (scoreValue >= 50) {
            scoreCell.classList.add('score-good');           // 50-99% - Blue
        } else {
            scoreCell.classList.add('score-needs-improvement'); // <50% - Red
        }
        
        // Time Taken
        const timeCell = row.insertCell();
        timeCell.textContent = result.timeDisplay || 'N/A';
        
        // Details cell - show button or inline details based on display filter
        const detailsCell = row.insertCell();
        
        if (showDetails) {
            // Show details inline
            detailsCell.innerHTML = createInlineDetails(result);
        } else {
            // Show details button (current behavior)
            const detailsBtn = document.createElement('button');
            detailsBtn.textContent = 'View Details';
            detailsBtn.className = 'view-details-btn';
            detailsBtn.onclick = () => showResultDetails(result);
            detailsCell.appendChild(detailsBtn);
        }
    });
}

// Create inline details for show-details mode
function createInlineDetails(result) {
    if (!result.words || result.words.length === 0) {
        return '<div class="no-details">No word details available</div>';
    }
    
    // Calculate hint usage
    let totalHints = 0;
    if (result.words && result.words.length > 0) {
        result.words.forEach((wordResult) => {
            if (wordResult.hint) {
                totalHints++;
            }
        });
    }
    
    let detailsHtml = '<div class="word-list">';
    
    result.words.forEach((wordResult, index) => {
        const isCorrect = wordResult.attempts && wordResult.attempts[0] === wordResult.word;
        const usedHint = wordResult.hint;
        const isCorrectAnswer = isCorrect && !usedHint;
        const statusIcon = isCorrectAnswer ? '✅' : '❌';
        const statusText = isCorrectAnswer ? 'Correct' : 'Incorrect';
        
        // Create word display with hint letter highlighting
        let wordDisplay = wordResult.word;
        if (usedHint && wordResult.hintLetters && wordResult.hintLetters.length > 0) {
            // Highlight specific hint letters
            wordDisplay = wordResult.word
                .split("")
                .map((letter, letterIndex) => {
                    if (wordResult.hintLetters.includes(letterIndex)) {
                        return `<span class="hint-letter">${letter}</span>`;
                    }
                    return letter;
                })
                .join("");
        }
        
        detailsHtml += `
            <div class="word-item">
                <span class="word-number">${index + 1}.</span>
                <span class="word-text">${wordDisplay}</span>
                ${usedHint ? '<span class="hint-indicator-plain">💡 (hint)</span>' : ''}
                <span class="word-status">${statusIcon} ${statusText}</span>
            </div>`;
    });
    
    detailsHtml += '</div>';
    
    return detailsHtml;
}

// Helper function to get ordinal suffix
function getOrdinalSuffix(number) {
    switch(number) {
        case 1: return '1st';
        case 2: return '2nd';
        case 3: return '3rd';
        case 4: return '4th';
        case 5: return '5th';
        default: return `${number}th`;
    }
}

// Show detailed result modal
function showResultDetails(result) {
    const modal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    modalTitle.textContent = `Quiz Details - ${result.wordSetName || 'Unknown Set'}`;
    
    // Calculate hint usage using the correct Firebase structure
    let totalHints = 0;
    let wordsWithHints = [];
    
    if (result.words && result.words.length > 0) {
        result.words.forEach((wordResult, index) => {
            // Use the correct Firebase structure: w.hint (boolean)
            if (wordResult.hint) {
                totalHints++;
                wordsWithHints.push(wordResult.word);
            }
        });
    }
    
    let content = `
        <div class="result-details">
            <div class="word-results-list">`;
    
    if (result.words && result.words.length > 0) {
        result.words.forEach((wordResult, index) => {
            const isCorrect = wordResult.attempts && wordResult.attempts[0] === wordResult.word;
            const usedHint = wordResult.hint;
            const isCorrectAnswer = isCorrect && !usedHint;
            const statusIcon = isCorrectAnswer ? '✅' : '❌';
            const statusText = isCorrectAnswer ? 'Correct' : 'Incorrect';
            
            // Create word display with hint letter highlighting
            let wordDisplay = wordResult.word;
            if (usedHint && wordResult.hintLetters && wordResult.hintLetters.length > 0) {
                // Highlight specific hint letters
                wordDisplay = wordResult.word
                    .split("")
                    .map((letter, letterIndex) => {
                        if (wordResult.hintLetters.includes(letterIndex)) {
                            return `<span class="hint-letter">${letter}</span>`;
                        }
                        return letter;
                    })
                    .join("");
            }
            
            content += `
                <div class="word-result-item">
                    <strong>${index + 1}. ${wordDisplay}</strong>
                    ${usedHint ? ' <span class="hint-used-plain">💡 (hint)</span>' : ''}
                    <br>
                    <span class="result-status">${statusIcon} ${statusText}</span>
                    ${wordResult.attempts && wordResult.attempts.length > 0 ? 
                        `<br><small>Answer: "${wordResult.attempts[0]}"</small>` : ''}
                </div>`;
        });
    } else {
        content += '<p>No word details available.</p>';
    }
    
    content += `
                </div>
        </div>
    `;
    
    modalBody.innerHTML = content;
    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// UI helper functions
function showLoading() {
    const loading = document.getElementById('loadingScreen');
    const error = document.getElementById('errorMessage');
    const main = document.getElementById('dashboardContainer');
    
    if (loading) loading.style.display = 'block';
    if (error) error.style.display = 'none';
    if (main) main.style.display = 'none';
}

function showError(message, instructions = null) {
    const loading = document.getElementById('loadingScreen');
    const error = document.getElementById('errorMessage');
    const main = document.getElementById('dashboardContainer');
    
    if (loading) loading.style.display = 'none';
    if (main) main.style.display = 'none';
    if (error) {
        error.style.display = 'block';
        const errorText = error.querySelector('p');
        if (errorText) {
            let content = message;
            if (instructions && Array.isArray(instructions)) {
                content += '<br><br><strong>To fix this:</strong><ol>';
                instructions.forEach(step => {
                    content += `<li>${step}</li>`;
                });
                content += '</ol>';
            }
            errorText.innerHTML = content;
        }
    }
}

function hideLoading() {
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.style.display = 'none';
}

function showMainContent() {
    const main = document.getElementById('dashboardContainer');
    if (main) main.style.display = 'block';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('detailModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Export screenshot functionality
async function exportScreenshot() {
    try {
        // Show notification
        console.log("Generating screenshot...");
        
        // Get current student name
        const studentName = getStudentNameFromURL() || 'Student';
        
        // Get current filtered results - use the global results array instead of allResults
        const filteredData = results.filter(result => {
            // Apply same filtering logic as the current view
            const displayFilter = document.getElementById('displayFilter').value;
            const wordSetFilter = document.getElementById('analyticsWordSetFilter').value;
            const fromDate = document.getElementById('analyticsFromDate').value;
            const toDate = document.getElementById('analyticsToDate').value;
            
            // Display filter logic
            if (displayFilter === 'complete') {
                const wordSet = wordSets.find(ws => ws.id === result.wordSetId);
                if (wordSet && result.words) {
                    if (result.words.length < wordSet.words.length) {
                        return false; // Skip partial completions
                    }
                }
            }
            
            // Word set filter
            if (wordSetFilter && result.wordSetId !== wordSetFilter) {
                return false;
            }
            
            // Date filters
            if (fromDate || toDate) {
                const resultDate = result.timestamp ? new Date(result.timestamp.toDate()) : null;
                if (resultDate) {
                    if (fromDate && resultDate < new Date(fromDate)) return false;
                    if (toDate && resultDate > new Date(toDate + 'T23:59:59')) return false;
                }
            }
            
            return true;
        });
        
        if (filteredData.length === 0) {
            alert("No data to export with current filters");
            return;
        }
        
        // Create screenshot container
        const screenshotContainer = document.createElement('div');
        screenshotContainer.style.cssText = `
            width: 1600px !important; 
            max-width: none !important; 
            min-width: 1600px !important;
            background: white;
            padding: 40px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            box-sizing: border-box !important; 
            position: absolute !important; 
            margin: 0 !important; 
            border: none !important; 
            overflow: visible !important; 
            display: block !important; 
            visibility: visible !important; 
            opacity: 1 !important; 
            z-index: 9999; 
            transform: none !important;
            left: -9999px;
            top: 0;
        `;
        
        // Generate table rows
        const tableRows = filteredData.map((result, index) => {
            const words = result.words || [];
            const firstTryCorrect = words.filter((w) => {
                const attempts = w.attempts || [];
                const isCorrectAnswer = attempts.length > 0 && attempts[0] === w.word;
                const usedHint = w.hint;
                // Only count as correct if the answer was right AND no hint was used
                return isCorrectAnswer && !usedHint;
            }).length;
            const totalWords = words.length;
            const scoreText = `${firstTryCorrect}/${totalWords}`;
            
            // Get date
            let dateText = "Unknown";
            if (result.timestamp) {
                const date = new Date(result.timestamp.toDate());
                dateText = date.toLocaleDateString() + " " + date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                });
            }
            
            // Create detailed learning information
            let learningDetails = "";
            const mistakesAndHints = words.filter((w) => {
                const attempts = w.attempts || [];
                const isCorrectAnswer = attempts.length > 0 && attempts[0] === w.word;
                return !isCorrectAnswer || w.hint;
            });
            
            if (mistakesAndHints.length > 0) {
                learningDetails = mistakesAndHints.map((w) => {
                    let wordDetail = "";
                    const attempts = w.attempts || [];
                    const isCorrectAnswer = attempts.length > 0 && attempts[0] === w.word;
                    
                    if (!isCorrectAnswer) {
                        // Show wrong spelling in red, then correct spelling in green
                        const wrongAttempt = attempts.length > 0 ? attempts[0] : "no attempt";
                        wordDetail += `<span style="background: #fee2e2; color: #dc2626; padding: 2px 4px; border-radius: 3px; text-decoration: line-through; font-weight: 600; font-size: 18px;">${wrongAttempt}</span>`;
                        wordDetail += ` → `;
                        wordDetail += `<span style="background: #dcfce7; color: #059669; padding: 2px 4px; border-radius: 3px; font-weight: 600; font-size: 18px;">${w.word}</span>`;
                    }
                    
                    if (w.hint) {
                        // Show word with hint indicator
                        if (wordDetail) wordDetail += " | ";
                        wordDetail += "Hint: ";
                        wordDetail += `<span style="background: #fef3c7; color: #d97706; font-weight: 600; font-size: 18px;">${w.word}</span>`;
                    }
                    
                    return `<div style="margin-bottom: 8px; line-height: 1.4;">${wordDetail}</div>`;
                }).join("");
            } else {
                learningDetails = '<span style="color: #059669; font-weight: 600; font-size: 18px;">🎉 Perfect! All words correct without hints</span>';
            }
            
            return `
                <tr style="border-bottom: 2px solid #e2e8f0; ${index % 2 === 0 ? "background: #f8fafc;" : "background: white;"}">
                    <td style="padding: 18px 15px; font-size: 18px; color: #475569; border-right: 1px solid #e2e8f0;">${result.wordSetName || "Unknown Set"}</td>
                    <td style="padding: 18px 15px; text-align: center; border-right: 1px solid #e2e8f0;">
                        <span style="background: ${firstTryCorrect === totalWords ? "#dcfce7" : firstTryCorrect >= totalWords * 0.8 ? "#fef3c7" : "#fee2e2"}; 
                                   color: ${firstTryCorrect === totalWords ? "#166534" : firstTryCorrect >= totalWords * 0.8 ? "#92400e" : "#dc2626"}; 
                                   padding: 8px 12px; border-radius: 6px; font-weight: 600; font-size: 20px;">
                            ${scoreText}
                        </span>
                    </td>
                    <td style="padding: 18px 15px; border-right: 1px solid #e2e8f0; max-width: 400px;">
                        ${learningDetails}
                    </td>
                    <td style="padding: 18px 15px; font-size: 18px; color: #64748b; font-weight: 600;">
                        ${dateText}
                    </td>
                </tr>
            `;
        }).join("");
        
        screenshotContainer.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #22c55e; padding-bottom: 20px;">
                <img src="logo.png" alt="Logo" style="width: 60px; height: 60px; margin-right: 20px;">
                <div style="flex: 1; text-align: center;">
                    <h1 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 700;">Spelling Feedback</h1>
                </div>
                <div style="text-align: right; color: #64748b; font-size: 18px; font-weight: 600;">
                    📋 ${studentName}
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <th style="padding: 20px 15px; text-align: left; font-weight: 700; font-size: 20px; border-right: 1px solid rgba(255,255,255,0.2);">Word Set</th>
                        <th style="padding: 20px 15px; text-align: center; font-weight: 700; font-size: 20px; border-right: 1px solid rgba(255,255,255,0.2);">Score</th>
                        <th style="padding: 20px 15px; text-align: left; font-weight: 700; font-size: 20px; border-right: 1px solid rgba(255,255,255,0.2);">Learning Details</th>
                        <th style="padding: 20px 15px; text-align: left; font-weight: 700; font-size: 20px;">Date & Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <div style="text-align: center; color: #64748b; font-size: 16px; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
                Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
        `;
        
        // Add to document temporarily
        document.body.appendChild(screenshotContainer);
        
        // Generate screenshot
        const canvas = await html2canvas(screenshotContainer, {
            width: 1600,
            height: screenshotContainer.scrollHeight,
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });
        
        // Remove temporary element
        document.body.removeChild(screenshotContainer);
        
        // Create PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        
        let position = 0;
        
        // Add first page
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        // Add additional pages if needed
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        // Save PDF
        const filename = `${studentName}_Learning_Data_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);
        
        console.log("Screenshot exported successfully!");
        
    } catch (error) {
        console.error("Error generating screenshot:", error);
        alert("Error generating screenshot. Please try again.");
    }
} 