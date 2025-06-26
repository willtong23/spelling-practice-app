// Global variables
let students = [];
let results = [];
let filteredResults = [];
let wordSets = [];
let classes = [];
let assignments = [];

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log("=== ROBBIE DASHBOARD INITIALIZING ===");
    
    // Initialize Firebase
    if (typeof firebase !== 'undefined') {
        console.log("Firebase initialized successfully");
        loadAllData();
    } else {
        console.error("Firebase not loaded");
        showNotification("Firebase not loaded. Please refresh the page.", "error");
    }
    
    // Setup event listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Print button
    const printBtn = document.getElementById("exportScreenshotBtn");
    if (printBtn) {
        printBtn.addEventListener("click", printPage);
    }
    
    // Modal close button
    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeModal);
    }
    
    // Modal overlay click to close
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) {
        modalOverlay.addEventListener("click", function(e) {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
    
    // Analytics filter button
    const applyFilterBtn = document.getElementById("applyAnalyticsFilter");
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener("click", applyAnalyticsFilter);
    }
    
    // Sorting dropdown
    const sortDropdown = document.getElementById("sortResults");
    if (sortDropdown) {
        sortDropdown.addEventListener("change", () => {
            applySorting();
            updateFilteredAnalytics();
        });
    }
    
    console.log("Event listeners setup complete");
}

// Print page functionality
function printPage() {
    window.print();
}

// Load all data from Firebase
async function loadAllData() {
    console.log("=== LOADING ALL DATA FOR ROBBIE ===");
    console.log("Firebase db available:", !!window.db);
    console.log("Firebase app:", firebase.app());

    try {
        // First, check what data is available in the database
        await checkDatabaseData();
        
        console.log("Loading Robbie's data...");
        await loadRobbieData();

        console.log("Loading word sets...");
        await loadWordSets();
        console.log("Word sets loaded:", wordSets.length);

        console.log("=== ALL ROBBIE DATA LOADED SUCCESSFULLY ===");

        // Initialize analytics
        initializeAnalyticsFilters();
        
        // Set default sort to "All" and display data immediately
        const sortDropdown = document.getElementById("sortResults");
        if (sortDropdown) {
            sortDropdown.value = "all";
        }
        
        // Enrich and display data immediately
        enrichResults(filteredResults);
        applySorting();
        updateFilteredAnalytics();
        
        // Hide loading screen and show dashboard
        const loadingScreen = document.getElementById("loadingScreen");
        const dashboardContainer = document.getElementById("dashboardContainer");
        
        if (loadingScreen) loadingScreen.style.display = "none";
        if (dashboardContainer) dashboardContainer.style.display = "block";
        
    } catch (error) {
        console.error("=== ERROR LOADING DATA ===");
        console.error("Error details:", error);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        showNotification("Error loading data. Check console.", "error");
    }
}

// Load Robbie's data
async function loadRobbieData() {
    try {
        console.log("=== LOADING ROBBIE'S DATA ===");
        
        // Load Robbie's student record
        const studentSnapshot = await window.db.collection("students").where("name", "==", "robbie").get();
        if (studentSnapshot.empty) {
            console.log("No student named 'robbie' found in students collection");
            students = [];
        } else {
            students = studentSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("Robbie's student record loaded:", students[0]);
        }
        
        // Load Robbie's quiz results
        const resultsSnapshot = await window.db.collection("results").where("user", "==", "robbie").get();
        if (resultsSnapshot.empty) {
            console.log("No quiz results found for 'robbie'");
            results = [];
        } else {
            results = resultsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`Loaded ${results.length} quiz results for Robbie`);
            
            // Log some sample data to understand the structure
            if (results.length > 0) {
                console.log("Sample result structure:", results[0]);
                console.log("Sample result words:", results[0].words ? results[0].words.slice(0, 2) : "No words array");
                console.log("Sample result timestamp:", results[0].timestamp);
            }
        }
        
        // Initialize filtered results with all results
        filteredResults = [...results];
        
        console.log("=== ROBBIE'S DATA LOADED SUCCESSFULLY ===");
        console.log("Total students loaded:", students.length);
        console.log("Total results loaded:", results.length);
        
    } catch (error) {
        console.error("Error loading Robbie's data:", error);
        students = [];
        results = [];
        filteredResults = [];
    }
}

// Check database data
async function checkDatabaseData() {
    try {
        console.log("=== CHECKING DATABASE DATA ===");
        
        // Check all students
        const allStudentsSnapshot = await window.db.collection("students").limit(10).get();
        console.log(`Total students in database: ${allStudentsSnapshot.size}`);
        if (!allStudentsSnapshot.empty) {
            const sampleStudents = allStudentsSnapshot.docs.map(doc => doc.data().name);
            console.log("Sample student names:", sampleStudents);
        }
        
        // Check all results
        const allResultsSnapshot = await window.db.collection("results").limit(10).get();
        console.log(`Total results in database: ${allResultsSnapshot.size}`);
        if (!allResultsSnapshot.empty) {
            const sampleUsers = [...new Set(allResultsSnapshot.docs.map(doc => doc.data().user))];
            console.log("Sample users with results:", sampleUsers);
            
            const sampleResult = allResultsSnapshot.docs[0].data();
            console.log("Sample result structure:", {
                user: sampleResult.user,
                timestamp: sampleResult.timestamp,
                wordSetName: sampleResult.wordSetName,
                wordsCount: sampleResult.words ? sampleResult.words.length : 0
            });
        }
        
        // Check all word sets
        const allWordSetsSnapshot = await window.db.collection("wordSets").limit(10).get();
        console.log(`Total word sets in database: ${allWordSetsSnapshot.size}`);
        if (!allWordSetsSnapshot.empty) {
            const sampleWordSets = allWordSetsSnapshot.docs.map(doc => doc.data().name);
            console.log("Sample word set names:", sampleWordSets);
        }
        
        console.log("=== DATABASE CHECK COMPLETE ===");
        
    } catch (error) {
        console.error("Error checking database data:", error);
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

// Initialize analytics filters
function initializeAnalyticsFilters() {
    console.log("Initializing analytics filters...");
    
    // Get the actual filter elements from the HTML
    const studentFilter = document.getElementById("analyticsStudentFilter");
    const wordSetFilter = document.getElementById("analyticsWordSetFilter");
    const fromDateFilter = document.getElementById("analyticsFromDate");
    const toDateFilter = document.getElementById("analyticsToDate");
    const applyFilterBtn = document.getElementById("applyAnalyticsFilter");
    
    // Set default date range (last 30 days)
    if (fromDateFilter && toDateFilter) {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        fromDateFilter.value = thirtyDaysAgo.toISOString().split("T")[0];
        toDateFilter.value = today.toISOString().split("T")[0];
    }
    
    // Populate student filter with Robbie
    if (studentFilter) {
        studentFilter.innerHTML = '<option value="">All Students</option>';
        if (students.length > 0) {
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.name;
                option.textContent = student.name;
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
    
    // Add event listener for apply filter button
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyAnalyticsFilter);
    }
    
    console.log("Analytics filters initialized successfully");
    console.log("Available students:", students.length);
    console.log("Available word sets:", wordSets.length);
    console.log("Available results:", results.length);
}

function enrichResults(results) {
    // Calculate trial numbers. To do this accurately, we must first sort by date.
    const sortedByDate = [...results].sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
    const wordSetTrials = new Map();

    sortedByDate.forEach(result => {
        const wordSetName = result.wordSetName || 'Unknown Set';
        const trial = (wordSetTrials.get(wordSetName) || 0) + 1;
        wordSetTrials.set(wordSetName, trial);
        result.trialNumber = trial; // Assign trial number to the original object
    });

    // Add other calculated values needed for sorting and display
    results.forEach(result => {
        // Time Taken Calculation
        if (result.startTime && result.finishTime) {
            const start = new Date(result.startTime);
            const finish = new Date(result.finishTime);
            result.timeTakenSeconds = Math.round((finish - start) / 1000);
        } else {
            result.timeTakenSeconds = 0;
        }

        // Score Calculation
        if (result.words && result.words.length > 0) {
            const correct = result.words.filter(w => (w.attempts || [])[0] === w.word).length;
            result.scoreValue = correct / result.words.length;
            result.scoreDisplay = `${correct} / ${result.words.length}`;
        } else {
            result.scoreValue = 0;
            result.scoreDisplay = 'N/A';
        }
    });
}

// Apply analytics filter
function applyAnalyticsFilter() {
    console.log("Applying analytics filter...");
    
    const fromDate = document.getElementById("analyticsFromDate").value;
    const toDate = document.getElementById("analyticsToDate").value;
    
    // Start with all results
    let newFilteredResults = [...results];
    
    // Apply date range filter
    if (fromDate || toDate) {
        newFilteredResults = newFilteredResults.filter(result => {
            const resultDate = result.timestamp ? new Date(result.timestamp.toDate()) : new Date(result.date);
            
            if (fromDate && toDate) {
                const from = new Date(fromDate);
                const to = new Date(toDate);
                to.setHours(23, 59, 59); // Include the entire end date
                return resultDate >= from && resultDate <= to;
            } else if (fromDate) {
                const from = new Date(fromDate);
                return resultDate >= from;
            } else if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59); // Include the entire end date
                return resultDate <= to;
            }
            return true;
        });
    }
    
    filteredResults = newFilteredResults;
    enrichResults(filteredResults);
    applySorting();
    updateFilteredAnalytics();
}

function applySorting() {
    const sortBy = document.getElementById("sortResults").value;
    console.log(`Applying sort: ${sortBy}`);

    const sortFunctions = {
        'date-latest': (a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0),
        'date-oldest': (a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0),
        'wordset-alphabetical': (a, b) => (a.wordSetName || '').localeCompare(b.wordSetName || ''),
        'time-longest': (a, b) => b.timeTakenSeconds - a.timeTakenSeconds,
        'time-shortest': (a, b) => a.timeTakenSeconds - b.timeTakenSeconds,
        'score-highest': (a, b) => b.scoreValue - a.scoreValue,
        'score-lowest': (a, b) => a.scoreValue - b.scoreValue,
        'all': (a, b) => {
            const wordSetCompare = (a.wordSetName || '').localeCompare(b.wordSetName || '');
            if (wordSetCompare !== 0) {
                return wordSetCompare;
            }
            return a.trialNumber - b.trialNumber;
        }
    };

    if (sortFunctions[sortBy]) {
        filteredResults.sort(sortFunctions[sortBy]);
    }
}

// Update filtered analytics display
function updateFilteredAnalytics() {
    console.log("Updating filtered analytics display...");
    
    const resultsTableContainer = document.getElementById("resultsTableContainer");
    
    if (!resultsTableContainer) {
        console.log("Analytics containers not found");
        return;
    }

    // Generate HTML for the results table
    if (filteredResults.length > 0) {
        const tableHTML = `
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Word Set</th>
                        <th>Date</th>
                        <th>Trial</th>
                        <th>Time Taken</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredResults.map(result => {
                        const wordSetName = result.wordSetName || 'Unknown Set';
                        const date = result.timestamp ? new Date(result.timestamp.toDate()).toLocaleDateString() : 'Unknown';
                        const trialNumber = result.trialNumber || 'N/A';
                        const timeDiff = result.timeTakenSeconds;
                        const timeTaken = `${Math.floor(timeDiff / 60)}:${(timeDiff % 60).toString().padStart(2, '0')}`;
                        
                        return `
                            <tr>
                                <td>${wordSetName}</td>
                                <td>${date}</td>
                                <td><span class="trial-badge trial-${trialNumber}th">${trialNumber}</span></td>
                                <td>${timeTaken}</td>
                                <td>${result.scoreDisplay}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        resultsTableContainer.innerHTML = tableHTML;
    } else {
        resultsTableContainer.innerHTML = '<p class="no-results">No results found for the selected filters.</p>';
    }
}

// Modal Functions
function showModal(title, content) {
    const modalTitle = document.getElementById("modalTitle");
    const modalBody = document.getElementById("modalBody");
    const modalOverlay = document.getElementById("modalOverlay");
    
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = content;
    if (modalOverlay) modalOverlay.style.display = "flex";
}

function closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) modalOverlay.style.display = "none";
}

// Notification function
function showNotification(message, type = "info") {
    console.log(`Notification [${type}]:`, message);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}
