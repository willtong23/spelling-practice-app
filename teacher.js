// Enhanced Teacher Dashboard Logic
// Global variables
let wordSets = [];
let students = [];
let classes = [];
let assignments = [];
let results = [];
let wordSetFolders = []; // New: Store word set folders
let currentSelectedFolder = null; // Track currently selected folder
let bulkSelectionMode = false;
let filteredResults = []; // For analytics filtering

// Global variables for bulk operations
let selectedItems = {
    classes: new Set(),
    students: new Set(),
    assignments: new Set()
};

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== TEACHER DASHBOARD INITIALIZING ===');
    
    // Function to update loading status
    function updateLoadingStatus(message) {
        const statusElement = document.getElementById('loadingStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
        console.log('Loading:', message);
    }
    
    // Test Firebase connection first
    updateLoadingStatus('Testing database connection...');
    const connectionOk = await testFirebaseConnection();
    if (!connectionOk) {
        updateLoadingStatus('❌ Database connection failed!');
        showNotification('Failed to connect to Firebase database. Please check your internet connection.', 'error');
        return;
    }
    
    // Check password
    updateLoadingStatus('Verifying access...');
    const urlParams = new URLSearchParams(window.location.search);
    const isAlreadyAuthenticated = urlParams.get('auth') === 'verified';
    
    if (!isAlreadyAuthenticated) {
        updateLoadingStatus('Please enter password...');
        const password = prompt('Enter teacher password:');
        if (password !== '9739') {
            alert('Incorrect password');
            window.location.href = 'index.html';
            return;
        }
    } else {
        // Clean up the URL parameter after successful authentication
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    updateLoadingStatus('Initializing interface...');
    // Initialize tabs
    initializeTabs();
    
    updateLoadingStatus('Loading dashboard data...');
    // Load all data
    await loadAllData();
    
    updateLoadingStatus('Setting up controls...');
    // Setup event listeners
    setupEventListeners();
    
    updateLoadingStatus('Almost ready...');
    
    // Hide loading screen and show dashboard with smooth transition
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        const dashboardContainer = document.getElementById('dashboardContainer');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.3s ease-out';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
        
        if (dashboardContainer) {
            dashboardContainer.style.display = 'block';
            dashboardContainer.style.opacity = '0';
            dashboardContainer.style.transition = 'opacity 0.3s ease-in';
            setTimeout(() => {
                dashboardContainer.style.opacity = '1';
            }, 50);
        }
        
        console.log('=== TEACHER DASHBOARD READY ===');
    }, 800); // Slightly longer delay for smoother experience
});

// Tab functionality
function initializeTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });
            
            // Load data for the active tab
            switch(targetTab) {
                case 'word-sets':
                    renderWordSets();
                    break;
                case 'students':
                    renderStudentsAndClasses();
                    break;
                case 'assignments':
                    renderAssignments();
                    break;
                case 'analytics':
                    renderAnalytics();
                    break;
            }
        });
    });
}

// Test Firebase connection
async function testFirebaseConnection() {
    console.log('=== TESTING FIREBASE CONNECTION ===');
    try {
        console.log('Firebase app:', firebase.app());
        console.log('Firebase db:', window.db);
        
        // Try a simple read operation
        const testSnapshot = await window.db.collection('results').limit(1).get();
        console.log('Test query successful. Size:', testSnapshot.size);
        
        // Try to get all collections
        const collections = ['results', 'wordSets', 'students', 'classes', 'assignments'];
        for (const collectionName of collections) {
            try {
                const snapshot = await window.db.collection(collectionName).limit(1).get();
                console.log(`Collection '${collectionName}' accessible. Size:`, snapshot.size);
            } catch (error) {
                console.error(`Error accessing collection '${collectionName}':`, error);
            }
        }
        
        console.log('=== FIREBASE CONNECTION TEST COMPLETE ===');
        return true;
    } catch (error) {
        console.error('=== FIREBASE CONNECTION TEST FAILED ===');
        console.error('Error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        return false;
    }
}

// Load all data from Firebase
async function loadAllData() {
    console.log('=== LOADING ALL DATA ===');
    console.log('Firebase db available:', !!window.db);
    console.log('Firebase app:', firebase.app());
    
    try {
        console.log('Loading word sets...');
        await loadWordSets();
        console.log('Word sets loaded:', wordSets.length);
        
        console.log('Loading students...');
        await loadStudents();
        console.log('Students loaded:', students.length);
        
        console.log('Loading classes...');
        await loadClasses();
        console.log('Classes loaded:', classes.length);
        
        console.log('Loading assignments...');
        await loadAssignments();
        console.log('Assignments loaded:', assignments.length);
        
        console.log('Loading quiz results...');
        await loadQuizResults();
        console.log('Quiz results loaded:', results.length);
        
        console.log('=== ALL DATA LOADED SUCCESSFULLY ===');
        
        // Render the active tab
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        switch(activeTab) {
            case 'word-sets':
                renderWordSets();
                break;
            case 'students':
                renderStudentsAndClasses();
                break;
            case 'assignments':
                renderAssignments();
                break;
            case 'analytics':
                renderAnalytics();
                break;
        }
    } catch (error) {
        console.error('=== ERROR LOADING DATA ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        showNotification('Error loading data from database: ' + error.message, 'error');
    }
}

// Word Sets Management
async function loadWordSets() {
    try {
        const snapshot = await window.db.collection('wordSets').get();
        wordSets = [];
        snapshot.forEach(doc => {
            wordSets.push({ id: doc.id, ...doc.data() });
        });
        
        // Also load word set folders
        await loadWordSetFolders();
    } catch (error) {
        console.error('Error loading word sets:', error);
        wordSets = [];
    }
}
wordSets.sort((a, b) => a.name.localeCompare(b.name));
// New function to load word set folders
async function loadWordSetFolders() {
    try {
        const snapshot = await window.db.collection('wordSetFolders').get();
        wordSetFolders = [];
        snapshot.forEach(doc => {
            wordSetFolders.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort folders alphabetically
        wordSetFolders.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error loading word set folders:', error);
        wordSetFolders = [];
    }
}

async function createDefaultWordSet() {
    try {
        // Try to get the old wordlist
        const doc = await window.db.collection('spelling').doc('wordlist').get();
        let words = ['want', 'went', 'what', 'should', 'could']; // default fallback
        
        if (doc.exists && doc.data().words) {
            words = doc.data().words;
        }
        
        const defaultSet = {
            name: 'Basic Words',
            description: 'Default word set for spelling practice',
            words,
            difficulty: 'beginner',
            createdAt: new Date(),
            createdBy: 'system'
        };
        
        const docRef = await window.db.collection('wordSets').add(defaultSet);
        wordSets.push({ id: docRef.id, ...defaultSet });
        
        // Update the main wordlist to point to this set
        await window.db.collection('spelling').doc('wordlist').set({ 
            words: words,
            activeSetId: docRef.id 
        });
        
    } catch (error) {
        console.error('Error creating default word set:', error);
    }
}

function renderWordSets() {
    const grid = document.getElementById('wordSetsGrid');
    if (!grid) return;
    
    // Group word sets by folder
    const wordSetsByFolder = {};
    const rootWordSets = [];
    
    wordSets.forEach(set => {
        if (set.folderId) {
            if (!wordSetsByFolder[set.folderId]) {
                wordSetsByFolder[set.folderId] = [];
            }
            wordSetsByFolder[set.folderId].push(set);
        } else {
            rootWordSets.push(set);
        }
    });
    
    // If viewing a specific folder
    if (currentSelectedFolder) {
        const folder = wordSetFolders.find(f => f.id === currentSelectedFolder);
        const folderWordSets = wordSetsByFolder[currentSelectedFolder] || [];
        
        grid.innerHTML = `
            <div class="folder-navigation">
                <button class="btn-secondary" onclick="showAllWordSets()" style="margin-bottom: 20px;">
                    ← Back to All Folders
                </button>
                <h3 style="margin: 0 0 20px 0; color: #1e293b;">
                    📁 ${folder ? folder.name : 'Unknown Folder'} 
                    <span style="color: #64748b; font-size: 0.8em;">(${folderWordSets.length} word sets)</span>
                </h3>
                ${folder && folder.description ? `<p style="color: #64748b; margin-bottom: 20px;">${folder.description}</p>` : ''}
            </div>
            
            ${folderWordSets.length === 0 ? 
                '<p style="text-align: center; color: #64748b; grid-column: 1/-1;">No word sets in this folder yet.</p>' :
                folderWordSets.sort((a, b) => a.name.localeCompare(b.name)).map(set => renderWordSetCard(set)).join('')
            }
        `;
        return;
    }
    
    // Show all folders and root-level word sets
    let content = '';
    
    // Add folder management header
    content += `
        <div class="folder-management-header" style="grid-column: 1/-1; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div>
                    <h3 style="margin: 0; color: #1e293b;">📚 Word Sets Library</h3>
                    <p style="margin: 5px 0 0 0; color: #64748b; font-size: 0.9em;">
                        ${wordSetFolders.length} folders • ${wordSets.length} total word sets
                    </p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn-secondary" onclick="showBulkMoveModal()">📁 Bulk Move to Folder</button>
                    <button class="btn-secondary" onclick="showCreateFolderModal()">➕ New Folder</button>
                </div>
            </div>
        </div>
    `;
    
    // Render folders
    wordSetFolders.forEach(folder => {
        const folderWordSets = wordSetsByFolder[folder.id] || [];
        content += `
            <div class="folder-card-rectangular" onclick="openFolder('${folder.id}')" style="cursor: pointer;">
                <div class="folder-card-header">
                    <div class="folder-title-section">
                        <div class="folder-icon">📁</div>
                        <div class="folder-title">${folder.name}</div>
                        <div class="folder-count">${folderWordSets.length} word sets</div>
                    </div>
                </div>
                ${folder.description ? `
                    <div class="folder-description">${folder.description}</div>
                ` : ''}
                <div class="folder-wordsets-preview">
                    ${folderWordSets.sort((a, b) => a.name.localeCompare(b.name)).map((set, index) => `
                        <span class="wordset-name-tag" 
                              style="background-color: ${getWordSetColor(index)};"
                              data-wordset-id="${set.id}"
                              data-wordset-name="${set.name}"
                              data-words='${JSON.stringify(set.words)}'
                              onmouseenter="showWordSetPreview(event, '${set.id}')"
                              onmouseleave="hideWordSetPreview()">
                            ${set.name}
                        </span>
                    `).join('')}
                    ${folderWordSets.length === 0 ? '<span class="empty-folder-text">No word sets in this folder</span>' : ''}
                </div>
                <div class="folder-actions" onclick="event.stopPropagation();">
                    <button class="btn-small btn-edit" onclick="editFolder('${folder.id}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteFolder('${folder.id}')">Delete</button>
                </div>
            </div>
        `;
    });
    
    // Add section header for root-level word sets if any exist
    if (rootWordSets.length > 0) {
        content += `
            <div class="section-divider" style="grid-column: 1/-1; margin: 20px 0;">
                <h4 style="color: #64748b; margin: 0;">📄 Word Sets (No Folder)</h4>
            </div>
        `;
        
        // Render root-level word sets
        content += rootWordSets.sort((a, b) => a.name.localeCompare(b.name)).map(set => renderWordSetCard(set)).join('');
    }
    
    if (wordSets.length === 0 && wordSetFolders.length === 0) {
        content = '<p style="text-align: center; color: #64748b; grid-column: 1/-1;">No word sets or folders created yet. Click "Create New Set" to get started.</p>';
    }
    
    grid.innerHTML = content;
}

// Helper function to render individual word set cards
function renderWordSetCard(set) {
    return `
        <div class="word-set-card">
            <div class="word-set-header">
                <div class="word-set-title">${set.name}</div>
                <div class="word-set-count">${set.words.length} words</div>
            </div>
            <div class="word-set-words">
                ${set.words.slice(0, 10).map(word => `<span class="word-tag">${word}</span>`).join('')}
                ${set.words.length > 10 ? `<span class="word-tag">+${set.words.length - 10} more</span>` : ''}
            </div>
            <div style="margin-bottom: 12px; color: #64748b; font-size: 0.9rem;">
                ${set.description || 'No description'}
            </div>
            <div class="word-set-actions">
                <button class="btn-small btn-edit" onclick="editWordSet('${set.id}')">Edit</button>
                <button class="btn-small btn-assign" onclick="quickAssignWordSet('${set.id}')">Assign</button>
                <button class="btn-small btn-delete" onclick="deleteWordSet('${set.id}')">Delete</button>
            </div>
        </div>
    `;
}

// New functions for folder navigation
function openFolder(folderId) {
    currentSelectedFolder = folderId;
    renderWordSets();
}

function showAllWordSets() {
    currentSelectedFolder = null;
    renderWordSets();
}

// Students and Classes Management
async function loadStudents() {
    try {
        const snapshot = await window.db.collection('students').get();
        students = [];
        snapshot.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading students:', error);
        students = [];
    }
}

async function loadClasses() {
    try {
        const snapshot = await window.db.collection('classes').get();
        classes = [];
        snapshot.forEach(doc => {
            classes.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        classes = [];
    }
}

function renderStudentsAndClasses() {
    renderClasses();
    renderStudents();
}

function renderClasses() {
    const container = document.getElementById('classesContainer');
    if (!container) return;
    
    if (classes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No classes created yet.</p>
                <button class="btn btn-primary" onclick="showCreateClassModal()">Create First Class</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="section-header-enhanced">
            <div class="section-title-group">
                <h3>📚 Classes Overview</h3>
                <span class="section-count">${classes.length} ${classes.length === 1 ? 'class' : 'classes'}</span>
            </div>
            <div class="section-actions">
                <input type="text" id="classSearchInput" placeholder="🔍 Search classes..." class="search-input" onkeyup="filterClasses()">
                <button class="btn-enhanced ${bulkSelectionMode ? 'btn-danger' : 'btn-secondary'}" onclick="toggleBulkSelectionMode('classes')">
                    ${bulkSelectionMode ? '❌ Cancel Selection' : '☑️ Bulk Select'}
                </button>
                <button class="btn btn-primary" onclick="showCreateClassModal()">➕ Add Class</button>
            </div>
        </div>
        
        ${bulkSelectionMode ? `
            <div class="bulk-actions-bar">
                <div class="bulk-actions-left">
                    <label class="bulk-select-all">
                        <input type="checkbox" id="selectAllClasses" onchange="toggleSelectAllClasses()">
                        <span>Select All Classes</span>
                    </label>
                    <span class="selected-count" id="selectedClassesCount">0 selected</span>
                </div>
                <div class="bulk-actions-right">
                    <button class="btn-bulk btn-danger" onclick="bulkDeleteClasses()" id="bulkDeleteClassesBtn" disabled>
                        🗑️ Delete Selected Classes
                    </button>
                </div>
            </div>
        ` : ''}
        
        <div class="classes-grid" id="classesGrid">
            ${classes.map(cls => {
                const studentsInClass = students.filter(s => s.classId === cls.id);
                const classAssignments = assignments.filter(a => a.classId === cls.id);
                const defaultWordSet = wordSets.find(ws => ws.id === cls.defaultWordSetId);
                
                return `
                    <div class="enhanced-class-card ${bulkSelectionMode ? 'selection-mode' : ''}" data-class-name="${cls.name.toLowerCase()}">
                        ${bulkSelectionMode ? `
                            <div class="selection-checkbox">
                                <input type="checkbox" class="class-checkbox" data-class-id="${cls.id}" onchange="updateClassSelection('${cls.id}')">
                            </div>
                        ` : ''}
                        
                        <div class="card-header-enhanced">
                            <div class="card-title-section">
                                <h4 class="card-title">📚 ${cls.name}</h4>
                                <p class="card-description">${cls.description || 'No description provided'}</p>
                            </div>
                            <div class="card-stats-grid">
                                <div class="stat-box students-stat">
                                    <span class="stat-number">${studentsInClass.length}</span>
                                    <span class="stat-label">Students</span>
                                </div>
                                <div class="stat-box assignments-stat">
                                    <span class="stat-number">${classAssignments.length}</span>
                                    <span class="stat-label">Assignments</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card-content-section">
                            <div class="default-word-set-enhanced">
                                <div class="setting-row">
                                    <span class="setting-label">🎯 Default Word Set:</span>
                                    <span class="setting-value ${defaultWordSet ? 'has-value' : 'no-value'}">
                                        ${defaultWordSet ? defaultWordSet.name : 'None set'}
                                    </span>
                                </div>
                                <div class="setting-controls">
                                    <select class="enhanced-select" id="classDefaultSet_${cls.id}">
                                        <option value="">Choose default word set...</option>
                                        ${wordSets.map(ws => `
                                            <option value="${ws.id}" ${ws.id === cls.defaultWordSetId ? 'selected' : ''}>
                                                ${ws.name} (${ws.words.length} words)
                                            </option>
                                        `).join('')}
                                    </select>
                                    <button class="btn-enhanced btn-primary" onclick="setClassDefaultWordSet('${cls.id}')">
                                        Set Default
                                    </button>
                                </div>
                            </div>

                            ${classAssignments.length > 0 ? `
                                <div class="assignments-section">
                                    <div class="section-header-mini">
                                        <h5 class="section-title-mini">📋 Class Assignments</h5>
                                        <div class="assignment-controls">
                                            <button class="btn-toggle" onclick="toggleClassAssignments('${cls.id}')" id="toggleClassBtn_${cls.id}">
                                                ${classAssignments.length > 3 ? 'Show All' : 'Hide'}
                                            </button>
                                            <button class="btn-danger-small" onclick="deleteAllClassAssignments('${cls.id}')" title="Delete all assignments for this class">
                                                🗑️ Delete All
                                            </button>
                                        </div>
                                    </div>
                                    <div class="assignments-container" id="classAssignments_${cls.id}">
                                        ${renderAssignmentsList(classAssignments.slice(0, 3), 'class', cls.id)}
                                        ${classAssignments.length > 3 ? `
                                            <div class="more-indicator">
                                                <span class="more-text">+ ${classAssignments.length - 3} more assignments</span>
                                                <span class="more-hint">Click "Show All" to view</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            ` : `
                                <div class="assignments-section empty">
                                    <div class="empty-assignments">
                                        <span class="empty-icon">📝</span>
                                        <span class="empty-text">No class assignments yet</span>
                                        <button class="btn-enhanced btn-primary" onclick="showQuickAssignToClass('${cls.id}')">
                                            Assign Word Set
                                        </button>
                                    </div>
                                </div>
                            `}
                            
                            ${studentsInClass.length > 0 ? `
                                <div class="students-section">
                                    <h5 class="section-title-mini">👥 Students in this class</h5>
                                    <div class="students-chips-container">
                                        ${studentsInClass.map(student => {
                                            const studentAssignments = assignments.filter(a => a.studentId === student.id);
                                            return `<span class="student-chip-inline ${studentAssignments.length > 0 ? 'has-assignments' : ''}" 
                                                     onclick="scrollToStudent('${student.id}')" 
                                                     title="Click to view ${student.name}'s details">
                                                    <span class="student-name">${student.name}</span>
                                                    <span class="student-assignment-count">${studentAssignments.length}</span>
                                                </span>`;
                                        }).join(' ')}
                                    </div>
                                </div>
                            ` : `
                                <div class="students-section empty">
                                    <span class="empty-text">No students in this class yet</span>
                                </div>
                            `}
                        </div>
                        
                        ${!bulkSelectionMode ? `
                            <div class="card-actions-enhanced">
                                <button class="btn-enhanced btn-secondary" onclick="editClass('${cls.id}')">✏️ Edit</button>
                                <button class="btn-enhanced btn-primary" onclick="showQuickAssignToClass('${cls.id}')">📝 Quick Assign</button>
                                <button class="btn-enhanced btn-danger" onclick="deleteClass('${cls.id}')">🗑️ Delete</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderStudents() {
    const container = document.getElementById('studentsContainer');
    if (!container) return;
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No students added yet.</p>
                <button class="btn btn-primary" onclick="showAddStudentModal()">Add First Student</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="section-header-enhanced">
            <div class="section-title-group">
                <h3>👥 Students Overview</h3>
                <span class="section-count">${students.length} ${students.length === 1 ? 'student' : 'students'}</span>
            </div>
            <div class="section-actions">
                <input type="text" id="studentSearchInput" placeholder="🔍 Search students..." class="search-input" onkeyup="filterStudents()">
                <select id="classFilterSelect" class="filter-select" onchange="filterStudentsByClass()">
                    <option value="">All Classes</option>
                    ${classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('')}
                </select>
                <button class="btn-enhanced ${bulkSelectionMode ? 'btn-danger' : 'btn-secondary'}" onclick="toggleBulkSelectionMode('students')">
                    ${bulkSelectionMode ? '❌ Cancel Selection' : '☑️ Bulk Select'}
                </button>
                <button class="btn btn-primary" onclick="showAddStudentModal()">➕ Add Student</button>
            </div>
        </div>
        
        ${bulkSelectionMode ? `
            <div class="bulk-actions-bar">
                <div class="bulk-actions-left">
                    <label class="bulk-select-all">
                        <input type="checkbox" id="selectAllStudents" onchange="toggleSelectAllStudents()">
                        <span>Select All Students</span>
                    </label>
                    <span class="selected-count" id="selectedStudentsCount">0 selected</span>
                </div>
                <div class="bulk-actions-right">
                    <button class="btn-bulk btn-danger" onclick="bulkDeleteStudents()" id="bulkDeleteStudentsBtn" disabled>
                        🗑️ Delete Selected Students
                    </button>
                </div>
            </div>
        ` : ''}
        
        <div class="students-grid maximum-separation-grid" id="studentsGrid" 
             style="display: grid !important; 
                    grid-template-columns: 1fr !important; 
                    gap: 80px !important; 
                    padding: 40px 0 !important;">
            ${students.map((student, index) => {
                const studentClass = classes.find(c => c.id === student.classId);
                const studentAssignments = assignments.filter(a => a.studentId === student.id);
                const classAssignments = studentClass ? assignments.filter(a => a.classId === studentClass.id) : [];
                const defaultWordSet = wordSets.find(ws => ws.id === student.defaultWordSetId);
                const totalAssignments = studentAssignments.length + classAssignments.length;
                
                // Alternating colors for maximum visual separation
                const isEven = index % 2 === 0;
                const cardStyle = isEven ? 
                    `background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%) !important; 
                     border: 6px solid #dc2626 !important; 
                     box-shadow: 0 0 0 6px #dc2626, 0 0 0 12px #fbbf24, 0 20px 40px rgba(220, 38, 38, 0.3) !important;` :
                    `background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%) !important; 
                     border: 6px solid #2563eb !important; 
                     box-shadow: 0 0 0 6px #2563eb, 0 0 0 12px #10b981, 0 20px 40px rgba(37, 99, 235, 0.3) !important;`;
                
                const titleStyle = isEven ?
                    `background: linear-gradient(135deg, #dc2626, #fbbf24) !important;` :
                    `background: linear-gradient(135deg, #2563eb, #10b981) !important;`;
                
                return `
                    <div class="enhanced-student-card maximum-separation-card ${bulkSelectionMode ? 'selection-mode' : ''}" 
                         id="student_${student.id}" 
                         data-student-name="${student.name.toLowerCase()}" 
                         data-class-id="${student.classId || ''}"
                         style="${cardStyle}
                                border-radius: 20px !important; 
                                padding: 30px !important; 
                                margin: 40px 0 !important; 
                                position: relative !important;
                                transform: scale(1) !important;">
                        ${bulkSelectionMode ? `
                            <div class="selection-checkbox">
                                <input type="checkbox" class="student-checkbox" data-student-id="${student.id}" onchange="updateStudentSelection('${student.id}')">
                            </div>
                        ` : ''}
                        
                        <div class="card-header-enhanced">
                            <div class="card-title-section">
                                <h4 class="card-title" style="${titleStyle}
                                                            -webkit-background-clip: text !important; 
                                                            -webkit-text-fill-color: transparent !important; 
                                                            background-clip: text !important; 
                                                            font-size: 1.8rem !important; 
                                                            font-weight: 900 !important; 
                                                            text-transform: uppercase !important; 
                                                            letter-spacing: 2px !important; 
                                                            margin-bottom: 20px !important;">👤 ${student.name}</h4>
                                <p class="card-description">
                                    Class: ${studentClass ? `📚 ${studentClass.name}` : '❌ No class assigned'}
                                </p>
                            </div>
                            <div class="card-stats-grid">
                                <div class="stat-box individual-stat">
                                    <span class="stat-number">${studentAssignments.length}</span>
                                    <span class="stat-label">Individual</span>
                                </div>
                                <div class="stat-box class-stat">
                                    <span class="stat-number">${classAssignments.length}</span>
                                    <span class="stat-label">From Class</span>
                                </div>
                                <div class="stat-box total-stat">
                                    <span class="stat-number">${totalAssignments}</span>
                                    <span class="stat-label">Total</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card-content-section">
                            <div class="default-word-set-enhanced">
                                <div class="setting-row">
                                    <span class="setting-label">🎯 Default Word Set:</span>
                                    <span class="setting-value ${defaultWordSet ? 'has-value' : 'no-value'}">
                                        ${defaultWordSet ? defaultWordSet.name : 'None set'}
                                    </span>
                                </div>
                                <div class="setting-controls">
                                    <select class="enhanced-select" id="studentDefaultSet_${student.id}">
                                        <option value="">Choose default word set...</option>
                                        ${wordSets.map(ws => `
                                            <option value="${ws.id}" ${ws.id === student.defaultWordSetId ? 'selected' : ''}>
                                                ${ws.name} (${ws.words.length} words)
                                            </option>
                                        `).join('')}
                                    </select>
                                    <button class="btn-enhanced btn-primary" onclick="setStudentDefaultWordSet('${student.id}')">
                                        Set Default
                                    </button>
                                </div>
                            </div>

                            ${classAssignments.length > 0 ? `
                                <div class="assignments-section class-assignments">
                                    <div class="section-header-mini">
                                        <h5 class="section-title-mini">📚 Class Assignments</h5>
                                        <div class="assignment-controls">
                                            <span class="assignment-count">${classAssignments.length} assignments</span>
                                            ${classAssignments.length > 3 ? `
                                                <button class="btn-toggle" onclick="toggleStudentClassAssignments('${student.id}')" id="toggleClassBtn_${student.id}">
                                                    Show All
                                                </button>
                                            ` : ''}
                                            <button class="btn-danger-small" onclick="deleteAllClassAssignments('${studentClass.id}')" title="Delete all class assignments for this class">
                                                🗑️ Delete All
                                            </button>
                                        </div>
                                    </div>
                                    <div class="assignments-container" id="classAssignments_${student.id}">
                                        ${renderAssignmentsList(classAssignments.slice(0, 3), 'class-inherited', student.id)}
                                        ${classAssignments.length > 3 ? `
                                            <div class="more-indicator">
                                                <span class="more-text">+ ${classAssignments.length - 3} more class assignments</span>
                                                <span class="more-hint">Click "Show All" to view all ${classAssignments.length} assignments</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            ` : `
                                <div class="assignments-section individual-assignments empty">
                                    <div class="empty-assignments">
                                        <span class="empty-icon">📝</span>
                                        <span class="empty-text">No individual assignments yet</span>
                                        <button class="btn-enhanced btn-primary" onclick="showQuickAssignToStudent('${student.id}')">
                                            Assign Word Set
                                        </button>
                                    </div>
                                </div>
                            `}
                            
                            ${studentAssignments.length > 0 ? `
                                <div class="assignments-section individual-assignments">
                                    <div class="section-header-mini">
                                        <h5 class="section-title-mini">👤 Individual Assignments</h5>
                                        <div class="assignment-controls">
                                            <span class="assignment-count">${studentAssignments.length} assignments</span>
                                            <button class="btn-toggle" onclick="toggleStudentAssignments('${student.id}')" id="toggleStudentBtn_${student.id}">
                                                ${studentAssignments.length > 5 ? 'Show All' : 'Hide'}
                                            </button>
                                            <button class="btn-danger-small" onclick="deleteAllStudentAssignments('${student.id}')" title="Delete all individual assignments for this student">
                                                🗑️ Delete All
                                            </button>
                                        </div>
                                    </div>
                                    <div class="assignments-container" id="studentAssignments_${student.id}">
                                        ${renderAssignmentsList(studentAssignments.slice(0, 5), 'individual', student.id)}
                                        ${studentAssignments.length > 5 ? `
                                            <div class="more-indicator">
                                                <span class="more-text">+ ${studentAssignments.length - 5} more individual assignments</span>
                                                <span class="more-hint">Click "Show All" to view all ${studentAssignments.length} assignments</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            ` : `
                                <div class="assignments-section individual-assignments empty">
                                    <div class="empty-assignments">
                                        <span class="empty-icon">📝</span>
                                        <span class="empty-text">No individual assignments yet</span>
                                        <button class="btn-enhanced btn-primary" onclick="showQuickAssignToStudent('${student.id}')">
                                            Assign Word Set
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>
                        
                        ${!bulkSelectionMode ? `
                            <div class="card-actions-enhanced">
                                <button class="btn-enhanced btn-secondary" onclick="editStudent('${student.id}')">✏️ Edit</button>
                                <button class="btn-enhanced btn-primary" onclick="showQuickAssignToStudent('${student.id}')">📝 Quick Assign</button>
                                <button class="btn-enhanced btn-danger" onclick="deleteStudent('${student.id}')">🗑️ Delete</button>
                            </div>
                        ` : ''}
                    </div>
                    ${index < students.length - 1 ? `
                        <div style="width: 100%; 
                                   height: 20px; 
                                   margin: 40px 0; 
                                   background: linear-gradient(90deg, transparent, ${isEven ? '#dc2626' : '#2563eb'}, transparent); 
                                   border-radius: 10px; 
                                   position: relative;">
                            <div style="position: absolute; 
                                       top: 50%; 
                                       left: 50%; 
                                       transform: translate(-50%, -50%); 
                                       background: white; 
                                       padding: 8px 16px; 
                                       border-radius: 20px; 
                                       font-size: 0.8rem; 
                                       font-weight: bold; 
                                       color: ${isEven ? '#dc2626' : '#2563eb'}; 
                                       border: 2px solid ${isEven ? '#dc2626' : '#2563eb'};">
                                ▼ NEXT STUDENT ▼
                            </div>
                        </div>
                    ` : ''}
                `;
            }).join('')}
        </div>
    `;
}

// Helper function to render assignments list with consistent formatting
function renderAssignmentsList(assignmentsList, type, parentId = null) {
    return assignmentsList.map(assignment => {
        const wordSet = wordSets.find(ws => ws.id === assignment.wordSetId);
        const assignedDate = assignment.assignedAt ? new Date(assignment.assignedAt.toDate()).toLocaleDateString() : 'Unknown';
        
        return `
            <div class="assignment-item ${type}">
                <div class="assignment-main">
                    <div class="assignment-name">
                        <span class="assignment-icon">${type === 'class' || type === 'class-inherited' ? '📚' : '👤'}</span>
                        <span class="assignment-title">${wordSet ? wordSet.name : 'Unknown set'}</span>
                        <span class="word-count">${wordSet ? wordSet.words.length : '?'} words</span>
                    </div>
                    <div class="assignment-meta">
                        <span class="assignment-date">📅 ${assignedDate}</span>
                        <span class="assignment-type-badge ${type}">${type === 'class' || type === 'class-inherited' ? 'Class' : 'Individual'}</span>
                    </div>
                </div>
                <div class="assignment-actions">
                    ${type === 'individual' ? `
                        <button class="btn-tiny btn-edit" onclick="editStudentAssignment('${assignment.id}', '${assignment.studentId}')" title="Edit assignment">
                            ✏️
                        </button>
                    ` : ''}
                    <button class="btn-tiny btn-delete" onclick="deleteAssignment('${assignment.id}')" title="Remove assignment">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Enhanced search and filter functions
function filterClasses() {
    const searchTerm = document.getElementById('classSearchInput').value.toLowerCase();
    const classCards = document.querySelectorAll('.enhanced-class-card');
    
    classCards.forEach(card => {
        const className = card.getAttribute('data-class-name');
        if (className.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function filterStudents() {
    const searchTerm = document.getElementById('studentSearchInput').value.toLowerCase();
    const studentCards = document.querySelectorAll('.enhanced-student-card');
    
    studentCards.forEach(card => {
        const studentName = card.getAttribute('data-student-name');
        if (studentName.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function filterStudentsByClass() {
    const selectedClassId = document.getElementById('classFilterSelect').value;
    const studentCards = document.querySelectorAll('.enhanced-student-card');
    
    studentCards.forEach(card => {
        const studentClassId = card.getAttribute('data-class-id');
        if (!selectedClassId || studentClassId === selectedClassId) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Assignments Management
async function loadAssignments() {
    try {
        const snapshot = await window.db.collection('assignments').get();
        assignments = [];
        snapshot.forEach(doc => {
            assignments.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading assignments:', error);
        assignments = [];
    }
}

function renderAssignments() {
    populateAssignmentSelects();
    renderAssignmentsTable();
}

function populateAssignmentSelects() {
    // Populate student selects
    const studentSelect = document.getElementById('assignStudentSelect');
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">Choose a student...</option>' +
            students.map(s => `<option value="${s.id}">${s.displayName || s.name}</option>`).join(''); // Use displayName
    }
    
    // Populate class selects
    const classSelect = document.getElementById('assignClassSelect');
    if (classSelect) {
        classSelect.innerHTML = '<option value="">Choose a class...</option>' +
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    // Populate word set selects
    const wordSetOptions = wordSets.map(ws => `<option value="${ws.id}">${ws.name}</option>`).join('');
    const assignWordSetSelect = document.getElementById('assignWordSetSelect');
    const assignClassWordSetSelect = document.getElementById('assignClassWordSetSelect');
    
    if (assignWordSetSelect) {
        assignWordSetSelect.innerHTML = '<option value="">Choose a word set...</option>' + wordSetOptions;
    }
    if (assignClassWordSetSelect) {
        assignClassWordSetSelect.innerHTML = '<option value="">Choose a word set...</option>' + wordSetOptions;
    }
}

function renderAssignmentsTable() {
    const tbody = document.getElementById('assignmentsTableBody');
    if (!tbody) return;
    
    if (assignments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">No assignments created yet.</td></tr>';
        return;
    }
    
    tbody.innerHTML = assignments.map(assignment => {
        const student = students.find(s => s.id === assignment.studentId);
        const studentClass = student ? classes.find(c => c.id === student.classId) : null;
        const wordSet = wordSets.find(ws => ws.id === assignment.wordSetId);
        const assignedDate = assignment.assignedAt ? new Date(assignment.assignedAt.toDate()).toLocaleDateString() : 'Unknown';
        
        // Improved completion detection logic
        const hasCompleted = results.some(result => {
            if (!student || !result.user) return false;
            
            const resultUser = result.user.trim().toLowerCase();
            const studentName = student.name.trim().toLowerCase();
            const resultWordSetId = result.wordSetId;
            const assignmentWordSetId = assignment.wordSetId;
            
            // Check if names match (exact or close match)
            const nameMatches = resultUser === studentName || 
                               resultUser.includes(studentName) || 
                               studentName.includes(resultUser);
            
            // Check if word set matches
            const wordSetMatches = resultWordSetId === assignmentWordSetId;
            
            // Check if the quiz was completed after the assignment was created
            const assignmentTime = assignment.assignedAt ? assignment.assignedAt.toDate() : new Date(0);
            const resultTime = result.date ? new Date(result.date) : new Date();
            const timeMatches = resultTime >= assignmentTime;
            
            console.log('Checking completion for:', {
                studentName,
                resultUser,
                nameMatches,
                wordSetMatches,
                timeMatches,
                assignmentTime: assignmentTime.toISOString(),
                resultTime: resultTime.toISOString()
            });
            
            return nameMatches && wordSetMatches && timeMatches;
        });
        
        return `
            <tr>
                <td>${student ? student.name : 'Unknown Student'}</td>
                <td>${studentClass ? studentClass.name : 'No Class'}</td>
                <td>${wordSet ? wordSet.name : 'Unknown Set'}</td>
                <td>${assignedDate}</td>
                <td>
                    <span style="color: ${hasCompleted ? '#22c55e' : '#f59e0b'}; font-weight: 600;">
                        ${hasCompleted ? '✅ Completed' : '⏳ Pending'}
                    </span>
                </td>
                <td>
                    <button class="btn-small btn-delete" onclick="deleteAssignment('${assignment.id}')">Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Analytics
async function loadQuizResults() {
    try {
        console.log('Attempting to load quiz results from Firebase...');
        console.log('Database reference:', window.db);
        
        const snapshot = await window.db.collection('results').orderBy('date', 'desc').get();
        console.log('Firebase query completed. Snapshot size:', snapshot.size);
        
        results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('Quiz result document:', doc.id, data);
            results.push({ id: doc.id, ...data });
        });
        
        console.log('Quiz results loaded successfully:', results.length);
    } catch (error) {
        console.error('Error loading quiz results:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        results = [];
        throw error; // Re-throw to be caught by loadAllData
    }
}

function renderAnalytics() {
    // Initialize filters and setup event listeners
    initializeAnalyticsFilters();
    
    // Update filter options with current data
    updateAnalyticsFilterOptions();
    
    // Set filtered results to all results initially
    filteredResults = [...results];
    
    // Update analytics display
    updateFilteredAnalytics();
    renderFilteredAnalyticsTable();
    
    // Show default insights
    generateInsights();
    
    // Add test data button for demonstration
    if (results.length === 0) {
        const testDataBtn = document.createElement('button');
        testDataBtn.className = 'btn-secondary';
        testDataBtn.textContent = '🧪 Add Test Data';
        testDataBtn.style.marginLeft = '12px';
        testDataBtn.onclick = addTestData;
        document.querySelector('#analytics .section-card .section-title').parentNode.querySelector('div').appendChild(testDataBtn);
    }
}

// Event Listeners
function setupEventListeners() {
    // Word Sets
    document.getElementById('createWordSetBtn')?.addEventListener('click', showCreateWordSetModal);
    document.getElementById('cleanupWordSetsBtn')?.addEventListener('click', cleanupWordSets);
    
    // Students & Classes
    document.getElementById('createClassBtn')?.addEventListener('click', showCreateClassModal);
    document.getElementById('addStudentBtn')?.addEventListener('click', showAddStudentModal);
    
    // Assignments
    document.getElementById('assignToStudentBtn')?.addEventListener('click', assignToStudent);
    document.getElementById('assignToClassBtn')?.addEventListener('click', assignToClass);
    document.getElementById('refreshAssignmentsBtn')?.addEventListener('click', refreshAssignmentStatus);
    
    // Analytics
    document.getElementById('deleteAllResultsBtn')?.addEventListener('click', deleteAllResults);
    setupAnalyticsEventListeners();
    
    // Modal
    closeModalBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    
    // Export screenshot
    document.getElementById('exportScreenshotBtn').addEventListener('click', exportScreenshot);
    
    // Export PDF data
    document.getElementById('exportPdfBtn').addEventListener('click', exportAnalyticsData);
}

// Modal Functions
function showModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modalOverlay.style.display = 'flex';
}

function closeModal() {
    modalOverlay.style.display = 'none';
}

// Word Set Functions
function showCreateWordSetModal() {
    const content = `
        <div class="form-group">
            <label class="form-label">Folder/Group:</label>
            <div style="display: flex; gap: 8px; align-items: center;">
                <select class="form-select" id="wordSetFolder" style="flex: 1;">
                    <option value="">📁 No Folder (Root Level)</option>
                    ${wordSetFolders.map(folder => `
                        <option value="${folder.id}">${folder.name}</option>
                    `).join('')}
                </select>
                <button type="button" class="btn-small btn-secondary" onclick="showCreateFolderModal()">➕ New Folder</button>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Set Name:</label>
            <input type="text" class="form-input" id="wordSetName" placeholder="e.g., Grade 3 Words">
        </div>
        <div class="form-group">
            <label class="form-label">Description:</label>
            <input type="text" class="form-input" id="wordSetDescription" placeholder="Brief description of this word set">
        </div>
        <div class="form-group">
            <label class="form-label">Difficulty Level:</label>
            <select class="form-select" id="wordSetDifficulty">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Words (one per line):</label>
            <textarea class="form-textarea" id="wordSetWords" placeholder="want&#10;went&#10;what&#10;should&#10;could"></textarea>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="createWordSet()">Create Set</button>
        </div>
    `;
    showModal('Create New Word Set', content);
}

async function createWordSet() {
    const name = document.getElementById('wordSetName').value.trim();
    const description = document.getElementById('wordSetDescription').value.trim();
    const difficulty = document.getElementById('wordSetDifficulty').value;
    const wordsText = document.getElementById('wordSetWords').value.trim();
    const folderId = document.getElementById('wordSetFolder').value;
    
    if (!name || !wordsText) {
        showNotification('Please fill in the name and words fields', 'error');
        return;
    }
    
    const words = wordsText.split('\n').map(w => w.trim().toLowerCase()).filter(w => w);
    
    if (words.length === 0) {
        showNotification('Please add at least one word', 'error');
        return;
    }
    
    try {
        const wordSet = {
            name,
            description,
            difficulty,
            words,
            createdAt: new Date(),
            createdBy: 'teacher'
        };
        
        const docRef = await window.db.collection('wordSets').add(wordSet);
        wordSets.push({ id: docRef.id, ...wordSet });
        
        closeModal();
        renderWordSets();
        showNotification('Word set created successfully!', 'success');
    } catch (error) {
        console.error('Error creating word set:', error);
        showNotification('Error creating word set', 'error');
    }
}

async function editWordSet(setId) {
    const wordSet = wordSets.find(ws => ws.id === setId);
    if (!wordSet) return;
    
    const content = `
        <div class="form-group">
            <label class="form-label">Folder/Group:</label>
            <div style="display: flex; gap: 8px; align-items: center;">
                <select class="form-select" id="editWordSetFolder" style="flex: 1;">
                    <option value="">📁 No Folder (Root Level)</option>
                    ${wordSetFolders.map(folder => `
                        <option value="${folder.id}" ${folder.id === wordSet.folderId ? 'selected' : ''}>
                            ${folder.name}
                        </option>
                    `).join('')}
                </select>
                <button type="button" class="btn-small btn-secondary" onclick="showCreateFolderModal()">➕ New Folder</button>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Set Name:</label>
            <input type="text" class="form-input" id="editWordSetName" value="${wordSet.name}">
        </div>
        <div class="form-group">
            <label class="form-label">Description:</label>
            <input type="text" class="form-input" id="editWordSetDescription" value="${wordSet.description || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Difficulty Level:</label>
            <select class="form-select" id="editWordSetDifficulty">
                <option value="beginner" ${wordSet.difficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
                <option value="intermediate" ${wordSet.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                <option value="advanced" ${wordSet.difficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Words (one per line):</label>
            <textarea class="form-textarea" id="editWordSetWords">${wordSet.words.join('\n')}</textarea>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="updateWordSet('${setId}')">Update Set</button>
        </div>
    `;
    showModal('Edit Word Set', content);
}

async function updateWordSet(setId) {
    const name = document.getElementById('editWordSetName').value.trim();
    const description = document.getElementById('editWordSetDescription').value.trim();
    const difficulty = document.getElementById('editWordSetDifficulty').value;
    const wordsText = document.getElementById('editWordSetWords').value.trim();
    const folderId = document.getElementById('editWordSetFolder').value;
    
    if (!name || !wordsText) {
        showNotification('Please fill in the name and words fields', 'error');
        return;
    }
    
    const words = wordsText.split('\n').map(w => w.trim().toLowerCase()).filter(w => w);
    
    if (words.length === 0) {
        showNotification('Please add at least one word', 'error');
        return;
    }
    
    try {
        const updates = {
            name,
            description,
            difficulty,
            words,
            folderId: folderId || null, // Add folder information
            updatedAt: new Date()
        };
        
        await window.db.collection('wordSets').doc(setId).update(updates);
        
        // Update local array
        const index = wordSets.findIndex(ws => ws.id === setId);
        if (index !== -1) {
            wordSets[index] = { ...wordSets[index], ...updates };
        }
        
        // If this is the active set, update the main wordlist
        const spellingDoc = await window.db.collection('spelling').doc('wordlist').get();
        if (spellingDoc.exists && spellingDoc.data().activeSetId === setId) {
            await window.db.collection('spelling').doc('wordlist').update({ words });
        }
        
        closeModal();
        renderWordSets();
        showNotification('Word set updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating word set:', error);
        showNotification('Error updating word set', 'error');
    }
}

async function deleteWordSet(setId) {
    if (!confirm('Are you sure you want to delete this word set? This action cannot be undone.')) {
        return;
    }
    
    try {
        await window.db.collection('wordSets').doc(setId).delete();
        wordSets = wordSets.filter(ws => ws.id !== setId);
        
        // Remove any assignments using this word set
        const assignmentsToDelete = assignments.filter(a => a.wordSetId === setId);
        for (const assignment of assignmentsToDelete) {
            await window.db.collection('assignments').doc(assignment.id).delete();
        }
        assignments = assignments.filter(a => a.wordSetId !== setId);
        
        renderWordSets();
        showNotification('Word set deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting word set:', error);
        showNotification('Error deleting word set', 'error');
    }
}

// Class Functions
function showCreateClassModal() {
    const content = `
        <div class="form-group">
            <label class="form-label">Class Name:</label>
            <input type="text" class="form-input" id="className" placeholder="e.g., Grade 3A">
        </div>
        <div class="form-group">
            <label class="form-label">Description:</label>
            <input type="text" class="form-input" id="classDescription" placeholder="Brief description of this class">
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="createClass()">Create Class</button>
        </div>
    `;
    showModal('Create New Class', content);
}

async function createClass() {
    const name = document.getElementById('className').value.trim();
    const description = document.getElementById('classDescription').value.trim();
    
    if (!name) {
        showNotification('Please enter a class name', 'error');
        return;
    }
    
    try {
        const classData = {
            name,
            description,
            createdAt: new Date(),
            createdBy: 'teacher'
        };
        
        const docRef = await window.db.collection('classes').add(classData);
        classes.push({ id: docRef.id, ...classData });
        
        closeModal();
        renderStudentsAndClasses();
        showNotification('Class created successfully!', 'success');
    } catch (error) {
        console.error('Error creating class:', error);
        showNotification('Error creating class', 'error');
    }
}

// FIXED: Edit Class Function
async function editClass(classId) {
    const classToEdit = classes.find(c => c.id === classId);
    if (!classToEdit) {
        showNotification('Class not found', 'error');
        return;
    }
    
    const content = `
        <div class="form-group">
            <label class="form-label">Class Name:</label>
            <input type="text" class="form-input" id="editClassName" value="${classToEdit.name}">
        </div>
        <div class="form-group">
            <label class="form-label">Description:</label>
            <input type="text" class="form-input" id="editClassDescription" value="${classToEdit.description || ''}">
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="updateClass('${classId}')">Update Class</button>
        </div>
    `;
    showModal('Edit Class', content);
}

async function updateClass(classId) {
    const name = document.getElementById('editClassName').value.trim();
    const description = document.getElementById('editClassDescription').value.trim();
    
    if (!name) {
        showNotification('Please enter a class name', 'error');
        return;
    }
    
    try {
        const updates = {
            name,
            description,
            updatedAt: new Date()
        };
        
        await window.db.collection('classes').doc(classId).update(updates);
        
        // Update local array
        const index = classes.findIndex(c => c.id === classId);
        if (index !== -1) {
            classes[index] = { ...classes[index], ...updates };
        }
        
        closeModal();
        renderStudentsAndClasses();
        showNotification('Class updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating class:', error);
        showNotification('Error updating class', 'error');
    }
}

// Student Functions
function showAddStudentModal() {
    const classOptions = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    const content = `
        <div class="form-group">
            <label class="form-label">Student Name:</label>
            <input type="text" class="form-input" id="studentName" placeholder="Enter student's full name">
        </div>
        <div class="form-group">
            <label class="form-label">Assign to Class:</label>
            <select class="form-select" id="studentClass">
                <option value="">No class assigned</option>
                ${classOptions}
            </select>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="addStudent()">Add Student</button>
        </div>
    `;
    showModal('Add New Student', content);
}

async function addStudent() {
    const name = document.getElementById('studentName').value.trim();
    const classId = document.getElementById('studentClass').value;
    
    if (!name) {
        showNotification('Please enter a student name', 'error');
        return;
    }
    
    try {
        const studentData = {
            name: name, // Store login name in 'name' field
            displayName: name,
            classId: classId || null,
            password: '123456', // Add default password
            createdAt: new Date(),
            createdBy: 'teacher'
        };
        
        const docRef = await window.db.collection('students').add(studentData);
        students.push({ id: docRef.id, ...studentData });
        
        closeModal();
        renderStudentsAndClasses();
        showNotification('Student added successfully!', 'success');
    } catch (error) {
        console.error('Error adding student:', error);
        showNotification('Error adding student', 'error');
    }
}

// FIXED: Edit Student Function
async function editStudent(studentId) {
    const studentToEdit = students.find(s => s.id === studentId);
    if (!studentToEdit) {
        showNotification('Student not found', 'error');
        return;
    }
    
    const classOptions = classes.map(c => 
        `<option value="${c.id}" ${c.id === studentToEdit.classId ? 'selected' : ''}>${c.name}</option>`
    ).join('');
    
    const content = `
        <div class="form-group">
            <label class="form-label">Student Name:</label>
            <input type="text" class="form-input" id="editStudentName" value="${studentToEdit.name}">
        </div>
        <div class="form-group">
            <label class="form-label">Assign to Class:</label>
            <select class="form-select" id="editStudentClass">
                <option value="" ${!studentToEdit.classId ? 'selected' : ''}>No class assigned</option>
                ${classOptions}
            </select>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="updateStudent('${studentId}')">Update Student</button>
        </div>
    `;
    showModal('Edit Student', content);
}

async function updateStudent(studentId) {
    const name = document.getElementById('editStudentName').value.trim();
    const classId = document.getElementById('editStudentClass').value;
    
    if (!name) {
        showNotification('Please enter a student name', 'error');
        return;
    }
    
    try {
        const updates = {
            name,
            classId: classId || null,
            updatedAt: new Date()
        };
        
        await window.db.collection('students').doc(studentId).update(updates);
        
        // Update local array
        const index = students.findIndex(s => s.id === studentId);
        if (index !== -1) {
            students[index] = { ...students[index], ...updates };
        }
        
        closeModal();
        renderStudentsAndClasses();
        renderAssignments(); // Refresh assignments to show updated class info
        showNotification('Student updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating student:', error);
        showNotification('Error updating student', 'error');
    }
}

// Assignment Functions
async function assignToStudent() {
    const studentId = document.getElementById('assignStudentSelect').value;
    const wordSetId = document.getElementById('assignWordSetSelect').value;
    
    if (!studentId || !wordSetId) {
        showNotification('Please select both a student and a word set', 'error');
        return;
    }
    
    // Enhanced duplicate check - check both local and Firebase
    const existingAssignment = assignments.find(a => a.studentId === studentId && a.wordSetId === wordSetId);
    if (existingAssignment) {
        showNotification('This student already has this word set assigned', 'warning');
        return;
    }
    
    // Double-check in Firebase to prevent race conditions
    try {
        const firebaseCheck = await window.db.collection('assignments')
            .where('studentId', '==', studentId)
            .where('wordSetId', '==', wordSetId)
            .get();
        
        if (!firebaseCheck.empty) {
            showNotification('This assignment already exists in the database', 'warning');
            // Reload assignments to sync local data
            await loadAssignments();
            renderAssignments();
            renderStudentsAndClasses();
            return;
        }
    } catch (error) {
        console.error('Error checking for existing assignments:', error);
    }
    
    try {
        const assignmentData = {
            studentId,
            wordSetId,
            assignedAt: new Date(),
            assignedBy: 'teacher',
            type: 'individual'
        };
        
        const docRef = await createAssignmentWithValidation(assignmentData);
        assignments.push({ id: docRef.id, ...assignmentData });
        
        // Update the main wordlist for this student (for backward compatibility)
        const wordSet = wordSets.find(ws => ws.id === wordSetId);
        if (wordSet) {
            await window.db.collection('spelling').doc('wordlist').set({ 
                words: wordSet.words,
                activeSetId: wordSetId 
            });
        }
        
        renderAssignments();
        renderStudentsAndClasses();
        
        const studentName = students.find(s => s.id === studentId)?.name;
        const wordSetName = wordSets.find(ws => ws.id === wordSetId)?.name;
        showNotification(`Successfully assigned "${wordSetName}" to ${studentName}!`, 'success');
        
        // Clear selections
        document.getElementById('assignStudentSelect').value = '';
        document.getElementById('assignWordSetSelect').value = '';
    } catch (error) {
        console.error('Error creating assignment:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error creating assignment';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied - Check Firebase security rules';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Database temporarily unavailable - Please try again';
        } else if (error.code === 'deadline-exceeded') {
            errorMessage = 'Request timeout - Please check your internet connection';
        } else if (error.code === 'resource-exhausted') {
            errorMessage = 'Database quota exceeded - Please try again later';
        } else if (error.message) {
            errorMessage = `Assignment error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

async function assignToClass() {
    const classId = document.getElementById('assignClassSelect').value;
    const wordSetId = document.getElementById('assignClassWordSetSelect').value;
    
    if (!classId || !wordSetId) {
        showNotification('Please select both a class and a word set', 'error');
        return;
    }
    
    const classStudents = students.filter(s => s.classId === classId);
    if (classStudents.length === 0) {
        showNotification('No students found in this class', 'error');
        return;
    }
    
    const className = classes.find(c => c.id === classId)?.name;
    const wordSetName = wordSets.find(ws => ws.id === wordSetId)?.name;
    
    // Check if this class already has this word set assigned
    const existingClassAssignment = assignments.find(a => a.classId === classId && a.wordSetId === wordSetId && a.type === 'class');
    if (existingClassAssignment) {
        showNotification(`Class "${className}" already has "${wordSetName}" assigned`, 'warning');
        return;
    }
    
    // Double-check in Firebase to prevent race conditions
    try {
        const firebaseCheck = await window.db.collection('assignments')
            .where('classId', '==', classId)
            .where('wordSetId', '==', wordSetId)
            .where('type', '==', 'class')
            .get();
        
        if (!firebaseCheck.empty) {
            showNotification('This class assignment already exists in the database', 'warning');
            await loadAssignments();
            renderAssignments();
            renderStudentsAndClasses();
            return;
        }
    } catch (error) {
        console.error('Error checking for existing class assignments:', error);
    }
    
    // Show confirmation dialog
    const confirmMessage = `This will assign "${wordSetName}" to class "${className}" (${classStudents.length} students).\n\nThis creates ONE class assignment that applies to all students in the class.\n\nDo you want to continue?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // Create ONE class assignment
        const classAssignmentData = {
            classId,
            wordSetId,
            assignedAt: new Date(),
            assignedBy: 'teacher',
            type: 'class',
            studentCount: classStudents.length
        };
        
        const docRef = await window.db.collection('assignments').add(classAssignmentData);
        assignments.push({ id: docRef.id, ...classAssignmentData });
        
        // Update the main wordlist (for backward compatibility)
        const wordSet = wordSets.find(ws => ws.id === wordSetId);
        if (wordSet) {
            await window.db.collection('spelling').doc('wordlist').set({ 
                words: wordSet.words,
                activeSetId: wordSetId 
            });
        }
        
        renderAssignments();
        renderStudentsAndClasses();
        
        showNotification(`✅ Successfully assigned "${wordSetName}" to class "${className}" (${classStudents.length} students)!`, 'success');
        
        // Clear selections
        document.getElementById('assignClassSelect').value = '';
        document.getElementById('assignClassWordSetSelect').value = '';
    } catch (error) {
        console.error('Error creating class assignment:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error creating class assignment';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied - Check Firebase security rules';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Database temporarily unavailable - Please try again';
        } else if (error.code === 'deadline-exceeded') {
            errorMessage = 'Request timeout - Please check your internet connection';
        } else if (error.code === 'resource-exhausted') {
            errorMessage = 'Database quota exceeded - Please try again later';
        } else if (error.message) {
            errorMessage = `Class assignment error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Create a simple notification
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
    }, 3000);
}

// Delete functions
async function deleteClass(classId) {
    if (!confirm('Are you sure you want to delete this class? Students in this class will be unassigned.')) {
        return;
    }
    
    try {
        await window.db.collection('classes').doc(classId).delete();
        classes = classes.filter(c => c.id !== classId);
        
        // Update students to remove class assignment
        const classStudents = students.filter(s => s.classId === classId);
        for (const student of classStudents) {
            await window.db.collection('students').doc(student.id).update({ classId: null });
            student.classId = null;
        }
        
        renderStudentsAndClasses();
        showNotification('Class deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting class:', error);
        showNotification('Error deleting class', 'error');
    }
}

async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student? All their data will be removed.')) {
        return;
    }
    
    try {
        await window.db.collection('students').doc(studentId).delete();
        students = students.filter(s => s.id !== studentId);
        
        // Remove any assignments for this student
        const studentAssignments = assignments.filter(a => a.studentId === studentId);
        for (const assignment of studentAssignments) {
            await window.db.collection('assignments').doc(assignment.id).delete();
        }
        assignments = assignments.filter(a => a.studentId !== studentId);
        
        renderStudentsAndClasses();
        renderAssignments();
        showNotification('Student deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting student:', error);
        showNotification('Error deleting student', 'error');
    }
}

async function deleteAssignment(assignmentId) {
    if (!confirm('Are you sure you want to remove this assignment?')) {
        return;
    }
    
    try {
        await window.db.collection('assignments').doc(assignmentId).delete();
        assignments = assignments.filter(a => a.id !== assignmentId);
        
        renderAssignments();
        renderStudentsAndClasses();
        showNotification('Assignment removed successfully!', 'success');
    } catch (error) {
        console.error('Error deleting assignment:', error);
        showNotification('Error deleting assignment', 'error');
    }
}

async function deleteQuizResult(resultId) {
    if (!confirm('Are you sure you want to delete this quiz result?')) {
        return;
    }
    
    try {
        await window.db.collection('results').doc(resultId).delete();
        results = results.filter(r => r.id !== resultId);
        
        renderAnalytics();
        showNotification('Quiz result deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting quiz result:', error);
        showNotification('Error deleting quiz result', 'error');
    }
}

async function deleteAllResults() {
    // First confirmation dialog
    if (!confirm('⚠️ WARNING: This will permanently delete ALL quiz results from ALL students!\n\nThis action cannot be undone. Are you absolutely sure you want to continue?')) {
        return;
    }
    
    // Second confirmation with password
    const password = prompt('🔐 To confirm this dangerous action, please enter the teacher password:');
    
    if (password !== '9739') {
        if (password !== null) { // User didn't cancel
            showNotification('❌ Incorrect password! Delete operation cancelled for security.', 'error');
        }
        return;
    }
    
    // Final confirmation with exact text match
    const confirmText = prompt('⚠️ FINAL CONFIRMATION:\n\nType exactly "DELETE ALL DATA" (without quotes) to proceed:');
    
    if (confirmText !== 'DELETE ALL DATA') {
        if (confirmText !== null) { // User didn't cancel
            showNotification('❌ Confirmation text does not match. Delete operation cancelled.', 'error');
        }
        return;
    }
    
    try {
        showNotification('🗑️ Deleting all quiz results... Please wait.', 'info');
        
        const batch = db.batch();
        results.forEach(result => {
            batch.delete(window.db.collection('results').doc(result.id));
        });
        await batch.commit();
        
        results = [];
        filteredResults = [];
        renderAnalytics();
        renderFilteredAnalyticsTable();
        
        showNotification('✅ All quiz results have been permanently deleted!', 'success');
        
        // Log this action for security purposes
        console.log(`[SECURITY] All quiz results deleted at ${new Date().toISOString()}`);
        
    } catch (error) {
        console.error('Error deleting all results:', error);
        showNotification('❌ Error deleting all results. Please try again.', 'error');
    }
}

// Quick assign function (from word set card)
function quickAssignWordSet(wordSetId) {
    // Switch to assignments tab and pre-select the word set
    document.querySelector('[data-tab="assignments"]').click();
    
    setTimeout(() => {
        const assignWordSetSelect = document.getElementById('assignWordSetSelect');
        const assignClassWordSetSelect = document.getElementById('assignClassWordSetSelect');
        
        if (assignWordSetSelect) assignWordSetSelect.value = wordSetId;
        if (assignClassWordSetSelect) assignClassWordSetSelect.value = wordSetId;
        
        showNotification('Word set selected for assignment. Choose a student or class above.', 'info');
    }, 100);
}

// Function to refresh assignment status
async function refreshAssignmentStatus() {
    showNotification('Refreshing assignment status...', 'info');
    try {
        // Reload quiz results to get the latest data
        await loadQuizResults();
        // Re-render the assignments table
        renderAssignmentsTable();
        showNotification('Assignment status refreshed!', 'success');
    } catch (error) {
        console.error('Error refreshing assignment status:', error);
        showNotification('Error refreshing assignment status', 'error');
    }
}

// Function to clean up test word sets and create proper defaults
async function cleanupWordSets() {
    try {
        console.log('Checking for problematic word sets...');
        
        // Find word sets with test data (like ['a', 'b', 'c'])
        const problematicSets = wordSets.filter(set => {
            const words = set.words || [];
            // Check if it's a test set with single letters or very short words
            const isTestSet = words.length <= 3 && words.every(word => word.length <= 1);
            return isTestSet;
        });
        
        if (problematicSets.length > 0) {
            console.log('Found problematic word sets:', problematicSets);
            
            for (const set of problematicSets) {
                console.log(`Deleting problematic word set: ${set.name} with words:`, set.words);
                await window.db.collection('wordSets').doc(set.id).delete();
                
                // Remove any assignments using this word set
                const assignmentsToDelete = assignments.filter(a => a.wordSetId === set.id);
                for (const assignment of assignmentsToDelete) {
                    await window.db.collection('assignments').doc(assignment.id).delete();
                }
            }
            
            // Reload data
            await loadAllData();
            showNotification(`Cleaned up ${problematicSets.length} problematic word sets`, 'success');
        } else {
            showNotification('No problematic word sets found', 'info');
        }
        
        // Ensure we have at least one proper word set
        if (wordSets.length === 0) {
            await createDefaultWordSet();
            await loadAllData();
        }
        
    } catch (error) {
        console.error('Error cleaning up word sets:', error);
        showNotification('Error cleaning up word sets', 'error');
    }
}

// New function to initialize analytics filters
function initializeAnalyticsFilters() {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    document.getElementById('analyticsFromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('analyticsToDate').value = today.toISOString().split('T')[0];
    
    // Initialize filter options - use the correct function
    updateAnalyticsFilterOptions();
    
    // Setup event listeners
    document.getElementById('analyticsFilterType').addEventListener('change', updateAnalyticsFilterOptions);
    document.getElementById('applyAnalyticsFilter').addEventListener('click', applyAnalyticsFilter);
    document.getElementById('analyticsSortBy').addEventListener('change', applyAnalyticsFilter);
    
    // Initialize filtered results with all results
    filteredResults = [...results];
}

// Analytics filtering functionality
function setupAnalyticsEventListeners() {
    const filterType = document.getElementById('analyticsFilterType');
    const filterValue = document.getElementById('analyticsFilterValue');
    const applyFilterBtn = document.getElementById('applyAnalyticsFilter');
    
    if (filterType) {
        filterType.addEventListener('change', updateAnalyticsFilterOptions);
    }
    
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyAnalyticsFilter);
    }
}

function updateAnalyticsFilterOptions() {
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue');
    
    console.log('Updating filter options for type:', filterType);
    console.log('Available students:', students.length);
    console.log('Available classes:', classes.length);
    console.log('Available quiz results:', results.length);
    
    filterValue.innerHTML = '<option value="">Choose...</option>';
    filterValue.disabled = filterType === 'all';
    
    if (filterType === 'student') {
        // Get unique student names from quiz results and match with student records
        const studentNamesFromResults = [...new Set(results.map(result => result.user))].filter(name => name && name.trim());
        
        // Also include all students from the students array
        const allStudentNames = [...new Set([
            ...studentNamesFromResults,
            ...students.map(s => s.name).filter(name => name && name.trim())
        ])].sort();
        
        console.log('Student names from results:', studentNamesFromResults);
        console.log('All student names:', allStudentNames);
        
        if (allStudentNames.length > 0) {
            // Add a special option to show modal
            filterValue.innerHTML += `<option value="__SHOW_MODAL__">📋 Select from list (${allStudentNames.length} students)</option>`;
            
            // Also add individual options for direct selection
            allStudentNames.forEach(studentName => {
                if (studentName && studentName.trim()) {
                    filterValue.innerHTML += `<option value="${studentName}">${studentName}</option>`;
                }
            });
        } else {
            filterValue.innerHTML += '<option value="" disabled>No students found - students need to complete quizzes first</option>';
        }
        
    } else if (filterType === 'class') {
        console.log('Classes available:', classes);
        
        if (classes.length > 0) {
            // Add a special option to show modal
            filterValue.innerHTML += `<option value="__SHOW_MODAL__">📋 Select from list (${classes.length} classes)</option>`;
            
            // Also add individual options for direct selection
            classes.forEach(cls => {
                const studentsInClass = students.filter(s => s.classId === cls.id);
                filterValue.innerHTML += `<option value="${cls.id}">${cls.name} (${studentsInClass.length} students)</option>`;
            });
        } else {
            filterValue.innerHTML += '<option value="" disabled>No classes found - create classes first</option>';
        }
    }
    
    // Add event listener for modal selection
    filterValue.removeEventListener('change', handleFilterValueChange);
    filterValue.addEventListener('change', handleFilterValueChange);
}

function handleFilterValueChange() {
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue');
    
    if (filterValue.value === '__SHOW_MODAL__') {
        if (filterType === 'student') {
            showStudentSelectionModal();
        } else if (filterType === 'class') {
            showClassSelectionModal();
        }
        // Reset to default
        filterValue.value = '';
    }
}

function showStudentSelectionModal() {
    // Get unique student names from quiz results and match with student records
    const studentNamesFromResults = [...new Set(results.map(result => result.user))].filter(name => name && name.trim());
    const allStudentNames = [...new Set([
        ...studentNamesFromResults,
        ...students.map(s => s.name).filter(name => name && name.trim())
    ])].sort();
    
    if (allStudentNames.length === 0) {
        showNotification('No students found. Students need to complete quizzes first.', 'warning');
        return;
    }
    
    const content = `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b;">Select a Student</h4>
            <p style="margin: 0; color: #64748b;">Choose a student to filter the analytics data:</p>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e0e7ef; border-radius: 8px; padding: 8px;">
            ${allStudentNames.map(studentName => {
                // Count quiz sessions for this student
                const studentQuizzes = results.filter(r => r.user && r.user.toLowerCase().trim() === studentName.toLowerCase().trim());
                const studentRecord = students.find(s => s.name.toLowerCase().trim() === studentName.toLowerCase().trim());
                const studentClass = studentRecord ? classes.find(c => c.id === studentRecord.classId) : null;
                
                return `
                    <div class="student-selection-item" onclick="selectStudent('${studentName}')" style="
                        padding: 12px; 
                        margin: 4px 0; 
                        border: 1px solid #e0e7ef; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        transition: all 0.2s;
                        background: white;
                    " onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#3b82f6';" onmouseout="this.style.background='white'; this.style.borderColor='#e0e7ef';">
                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${studentName}</div>
                        <div style="font-size: 0.85rem; color: #64748b;">
                            ${studentQuizzes.length} quiz session${studentQuizzes.length !== 1 ? 's' : ''}
                            ${studentClass ? ` • Class: ${studentClass.name}` : ' • No class assigned'}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
    `;
    
    showModal('Select Student', content);
}

function showClassSelectionModal() {
    if (classes.length === 0) {
        showNotification('No classes found. Create classes first in the Students & Classes tab.', 'warning');
        return;
    }
    
    const content = `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b;">Select a Class</h4>
            <p style="margin: 0; color: #64748b;">Choose a class to filter the analytics data:</p>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e0e7ef; border-radius: 8px; padding: 8px;">
            ${classes.map(cls => {
                const studentsInClass = students.filter(s => s.classId === cls.id);
                const classQuizzes = results.filter(r => {
                    const studentNames = studentsInClass.map(s => s.name.toLowerCase().trim());
                    return r.user && studentNames.includes(r.user.toLowerCase().trim());
                });
                
                return `
                    <div class="class-selection-item" onclick="selectClass('${cls.id}')" style="
                        padding: 12px; 
                        margin: 4px 0; 
                        border: 1px solid #e0e7ef; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        transition: all 0.2s;
                        background: white;
                    " onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#3b82f6';" onmouseout="this.style.background='white'; this.style.borderColor='#e0e7ef';">
                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${cls.name}</div>
                        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 6px;">
                            ${cls.description || 'No description'}
                        </div>
                        <div style="font-size: 0.85rem; color: #64748b;">
                            ${studentsInClass.length} student${studentsInClass.length !== 1 ? 's' : ''} • 
                            ${classQuizzes.length} quiz session${classQuizzes.length !== 1 ? 's' : ''}
                        </div>
                        ${studentsInClass.length > 0 ? `
                            <div style="margin-top: 8px; font-size: 0.8rem; color: #64748b;">
                                Students: ${studentsInClass.slice(0, 3).map(s => s.name).join(', ')}${studentsInClass.length > 3 ? ` +${studentsInClass.length - 3} more` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
    `;
    
    showModal('Select Class', content);
}

function selectStudent(studentName) {
    const filterValue = document.getElementById('analyticsFilterValue');
    
    // Add the student to the dropdown if not already there
    const existingOption = Array.from(filterValue.options).find(option => option.value === studentName);
    if (!existingOption) {
        const option = document.createElement('option');
        option.value = studentName;
        option.textContent = studentName;
        filterValue.appendChild(option);
    }
    
    // Select the student
    filterValue.value = studentName;
    
    closeModal();
    
    // Auto-apply the filter
    applyAnalyticsFilter();
    
    showNotification(`Filtered analytics for student: ${studentName}`, 'success');
}

function selectClass(classId) {
    const filterValue = document.getElementById('analyticsFilterValue');
    const selectedClass = classes.find(c => c.id === classId);
    
    if (!selectedClass) return;
    
    // Add the class to the dropdown if not already there
    const existingOption = Array.from(filterValue.options).find(option => option.value === classId);
    if (!existingOption) {
        const studentsInClass = students.filter(s => s.classId === classId);
        const option = document.createElement('option');
        option.value = classId;
        option.textContent = `${selectedClass.name} (${studentsInClass.length} students)`;
        filterValue.appendChild(option);
    }
    
    // Select the class
    filterValue.value = classId;
    
    closeModal();
    
    // Auto-apply the filter
    applyAnalyticsFilter();
    
    showNotification(`Filtered analytics for class: ${selectedClass.name}`, 'success');
}

function applyAnalyticsFilter() {
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue').value;
    const fromDate = document.getElementById('analyticsFromDate').value;
    const toDate = document.getElementById('analyticsToDate').value;
    const sortBy = document.getElementById('analyticsSortBy').value;
    
    // Start with all results
    filteredResults = [...results];
    
    // Apply date filter
    if (fromDate || toDate) {
        filteredResults = filteredResults.filter(result => {
            const resultDate = new Date(result.date);
            const from = fromDate ? new Date(fromDate) : new Date('1900-01-01');
            const to = toDate ? new Date(toDate + 'T23:59:59') : new Date();
            return resultDate >= from && resultDate <= to;
        });
    }
    
    // Apply student/class filter
    if (filterType === 'student' && filterValue) {
        // Filter by student name directly (since filterValue is now the student name)
        filteredResults = filteredResults.filter(result => 
            result.user && result.user.toLowerCase().trim() === filterValue.toLowerCase().trim()
        );
    } else if (filterType === 'class' && filterValue) {
        // Filter by class ID (filterValue is the class ID)
        const classStudents = students.filter(s => s.classId === filterValue);
        const studentNames = classStudents.map(s => s.name.toLowerCase().trim());
        filteredResults = filteredResults.filter(result => 
            result.user && studentNames.includes(result.user.toLowerCase().trim())
        );
    }
    
    // Apply sorting based on selected criteria
    filteredResults.sort((a, b) => {
        switch (sortBy) {
            case 'date_desc':
                return new Date(b.date || b.endTime) - new Date(a.date || a.endTime);
            case 'date_asc':
                return new Date(a.date || a.endTime) - new Date(b.date || b.endTime);
            case 'student_asc':
                return (a.user || '').localeCompare(b.user || '');
            case 'student_desc':
                return (b.user || '').localeCompare(a.user || '');
            case 'wordset_asc':
                const aWordSet = wordSets.find(ws => ws.id === a.wordSetId)?.name || 'Unknown';
                const bWordSet = wordSets.find(ws => ws.id === b.wordSetId)?.name || 'Unknown';
                return aWordSet.localeCompare(bWordSet);
            case 'wordset_desc':
                const aWordSetDesc = wordSets.find(ws => ws.id === a.wordSetId)?.name || 'Unknown';
                const bWordSetDesc = wordSets.find(ws => ws.id === b.wordSetId)?.name || 'Unknown';
                return bWordSetDesc.localeCompare(aWordSetDesc);
            case 'mistakes_asc':
                const aMistakes = (a.words || []).filter(w => !w.correct).length;
                const bMistakes = (b.words || []).filter(w => !w.correct).length;
                return aMistakes - bMistakes;
            case 'mistakes_desc':
                const aMistakesDesc = (a.words || []).filter(w => !w.correct).length;
                const bMistakesDesc = (b.words || []).filter(w => !w.correct).length;
                return bMistakesDesc - aMistakesDesc;
            case 'score_asc':
                const aScore = calculateScore(a);
                const bScore = calculateScore(b);
                return aScore - bScore;
            case 'score_desc':
                const aScoreDesc = calculateScore(a);
                const bScoreDesc = calculateScore(b);
                return bScoreDesc - aScoreDesc;
            case 'totaltime_asc':
                const aTotalTime = a.totalTimeSeconds || 
                    (a.startTime && a.finishTime ? Math.round((new Date(a.finishTime) - new Date(a.startTime)) / 1000) : 0);
                const bTotalTime = b.totalTimeSeconds || 
                    (b.startTime && b.finishTime ? Math.round((new Date(b.finishTime) - new Date(b.startTime)) / 1000) : 0);
                return aTotalTime - bTotalTime;
            case 'totaltime_desc':
                const aTotalTimeDesc = a.totalTimeSeconds || 
                    (a.startTime && a.finishTime ? Math.round((new Date(a.finishTime) - new Date(a.startTime)) / 1000) : 0);
                const bTotalTimeDesc = b.totalTimeSeconds || 
                    (b.startTime && b.finishTime ? Math.round((new Date(b.finishTime) - new Date(b.startTime)) / 1000) : 0);
                return bTotalTimeDesc - aTotalTimeDesc;
            default:
                return new Date(b.date || b.endTime) - new Date(a.date || a.endTime);
        }
    });
    
    // Update analytics display
    updateFilteredAnalytics();
    generateInsights();
    renderFilteredAnalyticsTable();
    
    showNotification('Analytics filter and sorting applied successfully!', 'success');
}

// Helper function to calculate score from result data
function calculateScore(result) {
    const words = result.words || [];
    if (words.length === 0) return '0/0';
    
    const firstTryCorrect = words.filter(w => {
        const attempts = w.attempts || [];
        return attempts.length > 0 && attempts[0] === w.word;
    }).length;
    
    return `${firstTryCorrect}/${words.length}`;
}

function updateFilteredAnalytics() {
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue').value;
    
    // Update student count label
    const studentsLabel = document.getElementById('filteredStudentsLabel');
    if (filterType === 'student') {
        if (studentsLabel) studentsLabel.textContent = 'Student';
        const studentsElement = document.getElementById('filteredStudents');
        if (studentsElement) studentsElement.textContent = filterValue ? '1' : '0';
    } else if (filterType === 'class') {
        if (studentsLabel) studentsLabel.textContent = 'Students in Class';
        const classStudents = students.filter(s => s.classId === filterValue);
        const studentsElement = document.getElementById('filteredStudents');
        if (studentsElement) studentsElement.textContent = classStudents.length;
    } else {
        if (studentsLabel) studentsLabel.textContent = 'Total Students';
        const uniqueStudents = [...new Set(filteredResults.map(r => r.user))].length;
        const studentsElement = document.getElementById('filteredStudents');
        if (studentsElement) studentsElement.textContent = uniqueStudents;
    }
    
    // Update quiz count
    const quizzesElement = document.getElementById('filteredQuizzes');
    if (quizzesElement) quizzesElement.textContent = filteredResults.length;
    
    // Calculate average first-try score
    const averageScoreElement = document.getElementById('filteredAverageScore');
    if (averageScoreElement) {
        if (filteredResults.length > 0) {
            const totalScore = filteredResults.reduce((sum, result) => {
                const words = result.words || [];
                const firstTryCorrect = words.filter(w => {
                    const attempts = w.attempts || [];
                    return attempts.length > 0 && attempts[0] === w.word;
                }).length;
                const total = words.length;
                return sum + (total > 0 ? (firstTryCorrect / total) * 100 : 0);
            }, 0);
            const averageScore = Math.round(totalScore / filteredResults.length);
            averageScoreElement.textContent = averageScore + '%';
        } else {
            averageScoreElement.textContent = '0%';
        }
    }
    
    // Count unique word sets practiced
    const uniqueWordSets = [...new Set(filteredResults.map(r => r.wordSetId).filter(id => id))].length;
    const wordSetsElement = document.getElementById('filteredWordSets');
    if (wordSetsElement) wordSetsElement.textContent = uniqueWordSets;
}

function generateInsights() {
    const insightsSection = document.getElementById('insightsSection');
    const insightsDiv = document.getElementById('analyticsInsights');
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue').value;
    
    if (filteredResults.length === 0) {
        insightsDiv.innerHTML = '<p style="color: #64748b; margin: 0;">No data available for the selected filters.</p>';
        insightsSection.style.display = 'block';
        return;
    }
    
    // If filtering by specific student or class, show individual session insights
    if ((filterType === 'student' || filterType === 'class') && filterValue) {
        const insights = generateIndividualSessionInsights(filteredResults, filterType, filterValue);
        insightsDiv.innerHTML = insights;
    } else {
        // Show overall insights for "All Students" view
        const analysis = analyzePerformanceData(filteredResults);
        const insights = generateInsightsFromAnalysis(analysis, filterType, filterValue);
        insightsDiv.innerHTML = insights;
    }
    
    insightsSection.style.display = 'block';
}

function generateIndividualSessionInsights(results, filterType, filterValue) {
    let insights = '';
    const studentName = filterType === 'student' && filterValue ? 
        filterValue : null; // filterValue is now the student name directly
    const className = filterType === 'class' && filterValue ? 
        classes.find(c => c.id === filterValue)?.name : null; // filterValue is the class ID, convert to name
    
    // Header
    if (studentName) {
        insights += `<h3 style="margin: 0 0 16px 0; color: #1e293b;">Individual Session Insights for ${studentName}</h3>`;
    } else if (className) {
        insights += `<h3 style="margin: 0 0 16px 0; color: #1e293b;">Individual Session Insights for Class ${className}</h3>`;
    }
    
    // Sort results by date (newest first)
    const sortedResults = [...results].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Generate insights for each session
    sortedResults.forEach((result, index) => {
        const sessionInsights = analyzeIndividualSession(result, index + 1);
        insights += sessionInsights;
    });
    
    // Add summary if multiple sessions
    if (sortedResults.length > 1) {
        insights += generateProgressSummary(sortedResults, filterType);
    }
    
    return insights;
}

function analyzeIndividualSession(result, sessionNumber) {
    const words = result.words || [];
    const date = result.date ? new Date(result.date).toLocaleDateString() : 'Unknown Date';
    const time = result.date ? new Date(result.date).toLocaleTimeString() : 'Unknown Time';
    const wordSetName = result.wordSetId ? 
        (wordSets.find(ws => ws.id === result.wordSetId)?.name || 'Unknown Set') : 
        'Legacy Set';
    
    // Calculate session statistics
    const firstTryCorrect = words.filter(w => {
        const attempts = w.attempts || [];
        return attempts.length > 0 && attempts[0] === w.word;
    }).length;
    
    const totalWords = words.length;
    const score = totalWords > 0 ? Math.round((firstTryCorrect / totalWords) * 100) : 0;
    const hintsUsed = words.filter(w => w.hint).length;
    const hintPercentage = totalWords > 0 ? Math.round((hintsUsed / totalWords) * 100) : 0;
    
    // Analyze mistakes
    const mistakes = words.filter(w => {
        const attempts = w.attempts || [];
        return attempts.length > 0 && attempts[0] !== w.word;
    });
    
    const eventuallyCorrect = mistakes.filter(w => {
        const attempts = w.attempts || [];
        return attempts.includes(w.word);
    });
    
    // Performance color
    const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
    const performanceLevel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Improvement';
    
    let sessionInsight = `
        <div style="background: white; border: 2px solid #e0e7ef; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; color: #1e293b;">Session ${sessionNumber}: ${wordSetName}</h4>
                <div style="color: #64748b; font-size: 0.9rem;">${date} at ${time}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px;">
                <div style="text-align: center; padding: 8px; background: #f8fafc; border-radius: 6px;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: ${scoreColor};">${score}%</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Score</div>
                </div>
                <div style="text-align: center; padding: 8px; background: #f8fafc; border-radius: 6px;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #3b82f6;">${firstTryCorrect}/${totalWords}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Correct First Try</div>
                </div>
                <div style="text-align: center; padding: 8px; background: #f8fafc; border-radius: 6px;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #f59e0b;">${hintPercentage}%</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Hints Used</div>
                </div>
            </div>
            
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 4px solid ${scoreColor}; margin-bottom: 12px;">
                <strong>Performance: ${performanceLevel}</strong>
            </div>
    `;
    
    // Add specific insights based on performance
    sessionInsight += `<div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 12px;">`;
    sessionInsight += `<strong>📝 Session Analysis:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px;">`;
    
    if (score >= 80) {
        sessionInsight += `<li>Excellent performance! Strong spelling skills demonstrated</li>`;
        if (hintPercentage === 0) {
            sessionInsight += `<li>No hints needed - shows confidence and knowledge</li>`;
        }
        if (mistakes.length === 0) {
            sessionInsight += `<li>Perfect session - all words spelled correctly on first try</li>`;
        }
    } else if (score >= 60) {
        sessionInsight += `<li>Good performance with room for improvement</li>`;
        if (hintPercentage > 30) {
            sessionInsight += `<li>High hint usage suggests uncertainty - review these word patterns</li>`;
        }
    } else {
        sessionInsight += `<li>Challenging session - consider reviewing basic spelling patterns</li>`;
        sessionInsight += `<li>May benefit from easier word sets to build confidence</li>`;
        if (hintPercentage < 20) {
            sessionInsight += `<li>Low hint usage despite struggles - encourage using hints for learning</li>`;
        }
    }
    
    // Analyze specific mistakes
    if (mistakes.length > 0) {
        sessionInsight += `<li>Struggled with ${mistakes.length} word${mistakes.length > 1 ? 's' : ''}: `;
        const mistakeDetails = mistakes.slice(0, 3).map(w => {
            const attempts = w.attempts || [];
            const firstAttempt = attempts[0] || '';
            return `"${w.word}" (tried: ${firstAttempt})`;
        }).join(', ');
        sessionInsight += mistakeDetails;
        if (mistakes.length > 3) {
            sessionInsight += ` and ${mistakes.length - 3} more`;
        }
        sessionInsight += `</li>`;
        
        if (eventuallyCorrect.length > 0) {
            sessionInsight += `<li>Eventually corrected ${eventuallyCorrect.length} word${eventuallyCorrect.length > 1 ? 's' : ''} - shows persistence</li>`;
        }
    }
    
    sessionInsight += `</ul></div>`;
    
    // Add recommendations for this session
    sessionInsight += `<div style="background: #f8fafc; padding: 12px; border-radius: 6px;">`;
    sessionInsight += `<strong>🎯 Recommendations for Next Session:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px;">`;
    
    if (score >= 80) {
        sessionInsight += `<li>Ready for more challenging words or faster pace</li>`;
        sessionInsight += `<li>Consider introducing new spelling patterns</li>`;
    } else if (score >= 60) {
        sessionInsight += `<li>Review the words that were missed in this session</li>`;
        sessionInsight += `<li>Practice similar spelling patterns before advancing</li>`;
    } else {
        sessionInsight += `<li>Repeat this word set with more practice time</li>`;
        sessionInsight += `<li>Focus on 3-5 words at a time rather than the full set</li>`;
        sessionInsight += `<li>Use more hints to learn correct patterns</li>`;
    }
    
    if (mistakes.length > 0) {
        const commonPatterns = analyzeSpellingPatterns(mistakes);
        if (commonPatterns.length > 0) {
            sessionInsight += `<li>Focus on these spelling patterns: ${commonPatterns.join(', ')}</li>`;
        }
    }
    
    sessionInsight += `</ul></div></div>`;
    
    return sessionInsight;
}

function analyzeSpellingPatterns(mistakes) {
    const patterns = [];
    
    mistakes.forEach(word => {
        const attempts = word.attempts || [];
        const correctWord = word.word;
        const firstAttempt = attempts[0] || '';
        
        // Analyze common spelling pattern issues
        if (correctWord.includes('ie') && firstAttempt.includes('ei')) {
            patterns.push('ie vs ei rule');
        }
        if (correctWord.includes('tion') && firstAttempt.includes('sion')) {
            patterns.push('tion vs sion endings');
        }
        if (correctWord.includes('double') && !firstAttempt.includes('double')) {
            patterns.push('double consonants');
        }
        if (correctWord.endsWith('ly') && !firstAttempt.endsWith('ly')) {
            patterns.push('ly endings');
        }
        if (correctWord.includes('ph') && firstAttempt.includes('f')) {
            patterns.push('ph vs f sounds');
        }
    });
    
    // Return unique patterns
    return [...new Set(patterns)];
}

function generateProgressSummary(sortedResults, filterType) {
    const recentSessions = sortedResults.slice(0, 3);
    const olderSessions = sortedResults.slice(-3);
    
    if (recentSessions.length < 2) return '';
    
    const recentAvg = recentSessions.reduce((sum, result) => {
        const words = result.words || [];
        const firstTryCorrect = words.filter(w => {
            const attempts = w.attempts || [];
            return attempts.length > 0 && attempts[0] === w.word;
        }).length;
        const score = words.length > 0 ? (firstTryCorrect / words.length) * 100 : 0;
        return sum + score;
    }, 0) / recentSessions.length;
    
    const olderAvg = olderSessions.reduce((sum, result) => {
        const words = result.words || [];
        const firstTryCorrect = words.filter(w => {
            const attempts = w.attempts || [];
            return attempts.length > 0 && attempts[0] === w.word;
        }).length;
        const score = words.length > 0 ? (firstTryCorrect / words.length) * 100 : 0;
        return sum + score;
    }, 0) / olderSessions.length;
    
    const improvement = recentAvg - olderAvg;
    const trendIcon = improvement > 5 ? '📈' : improvement < -5 ? '📉' : '➡️';
    const trendText = improvement > 5 ? 'improving' : improvement < -5 ? 'declining' : 'stable';
    const trendColor = improvement > 5 ? '#22c55e' : improvement < -5 ? '#ef4444' : '#3b82f6';
    
    return `
        <div style="background: white; border: 2px solid #2563eb; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 12px 0; color: #1e293b;">📊 Progress Summary</h4>
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 4px solid ${trendColor};">
                <strong>${trendIcon} Overall Trend:</strong> Performance is <span style="color: ${trendColor}; font-weight: bold;">${trendText}</span>
                <br>Recent average: ${Math.round(recentAvg)}% vs Earlier average: ${Math.round(olderAvg)}%
                <br>Change: ${improvement > 0 ? '+' : ''}${Math.round(improvement)}%
            </div>
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 12px;">
                <strong>🎯 Overall Recommendations:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                    ${improvement > 5 ? 
                        '<li>Great progress! Continue with current approach</li><li>Consider gradually increasing difficulty</li>' :
                        improvement < -5 ?
                        '<li>Performance declining - review recent material</li><li>Consider slowing pace or providing additional support</li>' :
                        '<li>Consistent performance - maintain current level</li><li>Look for opportunities to challenge or support as needed</li>'
                    }
                </ul>
            </div>
        </div>
    `;
}

function renderFilteredAnalyticsTable() {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;
    
    // Filter out practice data and individual word practice
    const validResults = filteredResults.filter(result => {
        // Only include results from assigned word sets (exclude "All Words" practice)
        return result.wordSetId && result.wordSetName && 
               result.wordSetName !== 'All Words' && 
               result.wordSetName !== 'Default Set' &&
               !result.wordSetName.includes('Practice') &&
               !result.wordSetName.includes('Individual');
    });
    
    if (validResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">No valid quiz results found. Only assigned word sets are displayed.</td></tr>';
        return;
    }
    
    // Display up to 100 items with scrolling
    const ITEMS_TO_SHOW = Math.min(100, validResults.length);
    const displayResults = validResults.slice(0, ITEMS_TO_SHOW);
    
    // Add sort information above the table
    const sortBy = document.getElementById('analyticsSortBy').value;
    const sortLabel = document.getElementById('analyticsSortBy').selectedOptions[0].text;
    const tableContainer = tbody.closest('table').parentElement;
    
    // Remove existing sort info if present
    const existingSortInfo = tableContainer.querySelector('.sort-info');
    if (existingSortInfo) {
        existingSortInfo.remove();
    }
    
    // Add new sort info
    const sortInfo = document.createElement('div');
    sortInfo.className = 'sort-info';
    sortInfo.style.cssText = `
        background: #f8fafc; 
        padding: 12px 16px; 
        border-radius: 8px; 
        margin-bottom: 16px; 
        border-left: 4px solid #3b82f6;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    sortInfo.innerHTML = `
        <div>
            <strong>Showing ${ITEMS_TO_SHOW} of ${validResults.length} results</strong> • 
            Sorted by: <span style="color: #3b82f6; font-weight: 600;">${sortLabel}</span>
        </div>
        <div style="font-size: 0.875rem; color: #64748b;">
            ${validResults.length > 100 ? `${validResults.length - 100} more results available with filtering` : 'All results shown'}
        </div>
    `;
    
    tableContainer.insertBefore(sortInfo, tableContainer.firstChild);
    
    tbody.innerHTML = displayResults.map(result => {
        const words = result.words || [];
        
        // Format word set name for multi-row display
        let wordSetDisplay = result.wordSetName || 'Unknown Set';
        let wordSetRow1 = wordSetDisplay;
        let wordSetRow2 = '';
        
        // Split long word set names into two rows
        if (wordSetDisplay.length > 20) {
            const parts = wordSetDisplay.split(' ');
            if (parts.length > 3) {
                const midPoint = Math.ceil(parts.length / 2);
                wordSetRow1 = parts.slice(0, midPoint).join(' ');
                wordSetRow2 = parts.slice(midPoint).join(' ');
            }
        }
        
        // Format date and time for multi-row display
        let dateRow = 'Unknown';
        let startTimeRow = '';
        let finishTimeRow = '';
        
        if (result.date) {
            const date = new Date(result.date);
            dateRow = date.toLocaleDateString();
            
            // Use specific start and finish times if available
            if (result.startTime && result.finishTime) {
                const startTime = new Date(result.startTime);
                const finishTime = new Date(result.finishTime);
                startTimeRow = startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                finishTimeRow = finishTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            } else {
                // Fallback to single time
                startTimeRow = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                finishTimeRow = '';
            }
        }
        
        // Calculate summary data
        const totalWords = words.length;
        const firstTryCorrect = words.filter(w => {
            const attempts = w.attempts || [];
            return attempts.length > 0 && attempts[0] === w.word;
        }).length;
        const mistakes = words.filter(w => !w.correct);
        const hintsUsed = words.filter(w => w.hint);
        
        // Create detailed breakdown - Focus on mistakes and hints only
        let detailsHtml = '<div style="font-size:0.85rem;">';
        
        // Only show mistakes and words that used hints
        const mistakesAndHints = words.filter(w => !w.correct || w.hint);
        
        if (mistakesAndHints.length > 0) {
            detailsHtml += '<div style="font-weight:600;color:#dc2626;margin-bottom:6px;">📝 Learning Areas (' + mistakesAndHints.length + '):</div>';
            
            mistakesAndHints.forEach(w => {
                detailsHtml += '<div style="margin-bottom:4px;padding:2px 0;">';
                
                if (!w.correct) {
                    // Show wrong spelling with correction - enhanced display
                    const wrongAttempt = w.attempts && w.attempts.length > 0 ? w.attempts[0] : 'no attempt';
                    detailsHtml += '<span style="background:#fee2e2;color:#dc2626;padding:1px 3px;border-radius:3px;text-decoration:line-through;font-weight:600;">' + wrongAttempt + '</span>';
                    detailsHtml += ' <span style="color:#6b7280;">→</span> ';
                    detailsHtml += '<span style="background:#dcfce7;color:#059669;padding:1px 3px;border-radius:3px;font-weight:600;">' + w.word + '</span>';
                } else if (w.hint) {
                    // Show word with specific hint letters highlighted
                    let wordDisplay = '';
                    if (w.hintLetters && w.hintLetters.length > 0) {
                        wordDisplay = w.word.split('').map((letter, letterIndex) => {
                            if (w.hintLetters.includes(letterIndex)) {
                                return `<span style="background:#fef3c7;color:#d97706;text-decoration:underline;font-weight:700;">${letter}</span>`;
                            }
                            return `<span style="color:#374151;">${letter}</span>`;
                        }).join('');
                    } else {
                        // If no specific hint letters, underline the whole word
                        wordDisplay = `<span style="background:#fef3c7;color:#d97706;text-decoration:underline;font-weight:600;">${w.word}</span>`;
                    }
                    detailsHtml += wordDisplay + ' <span style="color:#d97706;font-size:0.75rem;">(used hint)</span>';
                }
                
                detailsHtml += '</div>';
            });
        } else {
            // All words were correct without hints
            detailsHtml += '<div style="color:#059669;font-weight:600;">🎉 Perfect! All words spelled correctly without hints</div>';
        }
        
        detailsHtml += '</div>';
        
        return `
            <tr>
                <td>${result.user || 'Unknown'}</td>
                <td class="word-set-cell multi-row-cell">
                    <div class="row-1">${wordSetRow1}</div>
                    ${wordSetRow2 ? `<div class="row-2">${wordSetRow2}</div>` : ''}
                    ${(() => {
                        // Add word list below the word set name
                        const wordSet = wordSets.find(ws => ws.id === result.wordSetId);
                        if (wordSet && wordSet.words) {
                            const wordList = wordSet.words.slice(0, 12).join(', '); // Show first 12 words for dashboard
                            const moreWords = wordSet.words.length > 12 ? ` (+${wordSet.words.length - 12} more)` : '';
                            return `
                                <div style="margin-top: 6px; padding: 4px 6px; background: #f0f9ff; border-radius: 3px; font-size: 10px; color: #0369a1; border-left: 2px solid #0ea5e9; line-height: 1.3;">
                                    <strong>Words:</strong> ${wordList}${moreWords}
                                </div>
                            `;
                        }
                        return '';
                    })()}
                </td>
                <td class="date-time-cell multi-row-cell">
                    <div class="row-1">${dateRow}</div>
                    ${startTimeRow ? `<div class="row-2">Start: ${startTimeRow}</div>` : ''}
                    ${finishTimeRow ? `<div class="row-3">End: ${finishTimeRow}</div>` : ''}
                    ${result.totalTimeSeconds ? `<div class="row-4">Total: ${formatTimeDisplay(result.totalTimeSeconds)}</div>` : ''}
                </td>
                <td class="summary-cell multi-row-cell">
                    <div class="summary-row row-1">${firstTryCorrect}/${totalWords}</div>
                    <div class="summary-row row-2">💡 ${hintsUsed.length} hint${hintsUsed.length !== 1 ? 's' : ''}</div>
                </td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;" title="${detailsHtml.replace(/<[^>]*>/g, '')}">${detailsHtml}</td>
                <td>
                    <button class="btn-small btn-delete" onclick="deleteQuizResult('${result.id}')">Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

function analyzePerformanceData(results) {
    const analysis = {
        totalQuizzes: results.length,
        averageScore: 0,
        scoreDistribution: { excellent: 0, good: 0, needsWork: 0 },
        commonMistakes: {},
        wordSetPerformance: {},
        progressTrend: [],
        hintUsage: 0,
        completionRate: 0
    };
    
    if (results.length === 0) return analysis;
    
    let totalScore = 0;
    let totalHints = 0;
    let totalWords = 0;
    
    results.forEach(result => {
        const words = result.words || [];
        const firstTryCorrect = words.filter(w => {
            const attempts = w.attempts || [];
            return attempts.length > 0 && attempts[0] === w.word;
        }).length;
        
        const score = words.length > 0 ? (firstTryCorrect / words.length) * 100 : 0;
        totalScore += score;
        
        // Score distribution
        if (score >= 80) analysis.scoreDistribution.excellent++;
        else if (score >= 60) analysis.scoreDistribution.good++;
        else analysis.scoreDistribution.needsWork++;
        
        // Analyze mistakes and hints
        words.forEach(w => {
            totalWords++;
            if (w.hint) totalHints++;
            
            const attempts = w.attempts || [];
            if (attempts.length > 0 && attempts[0] !== w.word) {
                // Track common mistakes
                const mistake = attempts[0];
                if (!analysis.commonMistakes[w.word]) {
                    analysis.commonMistakes[w.word] = [];
                }
                analysis.commonMistakes[w.word].push(mistake);
            }
        });
        
        // Word set performance
        if (result.wordSetId) {
            if (!analysis.wordSetPerformance[result.wordSetId]) {
                analysis.wordSetPerformance[result.wordSetId] = {
                    name: result.wordSetName || 'Unknown Set',
                    scores: [],
                    totalQuizzes: 0
                };
            }
            analysis.wordSetPerformance[result.wordSetId].scores.push(score);
            analysis.wordSetPerformance[result.wordSetId].totalQuizzes++;
        }
    });
    
    analysis.averageScore = totalScore / results.length;
    analysis.hintUsage = totalWords > 0 ? (totalHints / totalWords) * 100 : 0;
    
    // Calculate progress trend (last 5 quizzes vs first 5)
    if (results.length >= 2) {
        const sortedResults = [...results].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstHalf = sortedResults.slice(0, Math.ceil(sortedResults.length / 2));
        const secondHalf = sortedResults.slice(Math.floor(sortedResults.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, r) => {
            const words = r.words || [];
            const firstTryCorrect = words.filter(w => {
                const attempts = w.attempts || [];
                return attempts.length > 0 && attempts[0] === w.word;
            }).length;
            return sum + (words.length > 0 ? (firstTryCorrect / words.length) * 100 : 0);
        }, 0) / firstHalf.length;
        
        const secondAvg = secondHalf.reduce((sum, r) => {
            const words = r.words || [];
            const firstTryCorrect = words.filter(w => {
                const attempts = w.attempts || [];
                return attempts.length > 0 && attempts[0] === w.word;
            }).length;
            return sum + (words.length > 0 ? (firstTryCorrect / words.length) * 100 : 0);
        }, 0) / secondHalf.length;
        
        analysis.progressTrend = {
            improving: secondAvg > firstAvg + 5,
            stable: Math.abs(secondAvg - firstAvg) <= 5,
            declining: secondAvg < firstAvg - 5,
            change: secondAvg - firstAvg
        };
    }
    
    return analysis;
}

function generateInsightsFromAnalysis(analysis, filterType, filterValue) {
    let insights = '';
    const studentName = filterType === 'student' && filterValue ? 
        students.find(s => s.id === filterValue)?.name : null;
    const className = filterType === 'class' && filterValue ? 
        classes.find(c => c.id === filterValue)?.name : null;
    
    // Header
    if (studentName) {
        insights += `<h3 style="margin: 0 0 16px 0; color: #1e293b;">Overall Insights for ${studentName}</h3>`;
    } else if (className) {
        insights += `<h3 style="margin: 0 0 16px 0; color: #1e293b;">Overall Insights for Class ${className}</h3>`;
    } else {
        insights += `<h3 style="margin: 0 0 16px 0; color: #1e293b;">Overall Learning Insights</h3>`;
    }
    
    // Performance overview
    const scoreColor = analysis.averageScore >= 80 ? '#22c55e' : 
                      analysis.averageScore >= 60 ? '#f59e0b' : '#ef4444';
    
    insights += `<div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid ${scoreColor};">`;
    insights += `<strong>Performance Overview:</strong> Average score is <span style="color: ${scoreColor}; font-weight: bold;">${Math.round(analysis.averageScore)}%</span> across ${analysis.totalQuizzes} quizzes.`;
    insights += `</div>`;
    
    // Progress trend
    if (analysis.progressTrend && analysis.progressTrend.change !== undefined) {
        const trendIcon = analysis.progressTrend.improving ? '📈' : 
                         analysis.progressTrend.stable ? '➡️' : '📉';
        const trendColor = analysis.progressTrend.improving ? '#22c55e' : 
                          analysis.progressTrend.stable ? '#3b82f6' : '#ef4444';
        const trendText = analysis.progressTrend.improving ? 'improving' : 
                         analysis.progressTrend.stable ? 'stable' : 'declining';
        
        insights += `<div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 16px;">`;
        insights += `<strong>${trendIcon} Progress Trend:</strong> Performance is <span style="color: ${trendColor}; font-weight: bold;">${trendText}</span> `;
        insights += `(${analysis.progressTrend.change > 0 ? '+' : ''}${Math.round(analysis.progressTrend.change)}% change over time).`;
        insights += `</div>`;
    }
    
    // Suggestions based on performance
    insights += `<div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 16px;">`;
    insights += `<strong>🎯 Recommendations:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px;">`;
    
    if (analysis.averageScore < 60) {
        insights += `<li>Consider reviewing basic spelling patterns and phonics rules</li>`;
        insights += `<li>Practice with easier word sets to build confidence</li>`;
        insights += `<li>Encourage use of hints when struggling (currently ${Math.round(analysis.hintUsage)}% hint usage)</li>`;
    } else if (analysis.averageScore < 80) {
        insights += `<li>Focus on commonly misspelled words for targeted practice</li>`;
        insights += `<li>Introduce slightly more challenging word sets</li>`;
        insights += `<li>Practice spelling patterns that appear frequently in mistakes</li>`;
    } else {
        insights += `<li>Excellent performance! Consider advancing to more challenging word sets</li>`;
        insights += `<li>Focus on speed and accuracy with timed exercises</li>`;
        insights += `<li>Introduce vocabulary expansion activities</li>`;
    }
    
    if (analysis.hintUsage > 30) {
        insights += `<li>High hint usage (${Math.round(analysis.hintUsage)}%) suggests need for more foundational practice</li>`;
    }
    
    if (analysis.progressTrend && analysis.progressTrend.declining) {
        insights += `<li>Performance is declining - consider reviewing recent material and providing additional support</li>`;
    }
    
    insights += `</ul></div>`;
    
    // Common mistakes analysis
    const mistakes = Object.entries(analysis.commonMistakes)
        .filter(([word, attempts]) => attempts.length >= 2)
        .slice(0, 5);
    
    if (mistakes.length > 0) {
        insights += `<div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 16px;">`;
        insights += `<strong>🔍 Common Spelling Challenges:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px;">`;
        mistakes.forEach(([word, attempts]) => {
            const commonMistake = attempts.reduce((a, b, i, arr) => 
                arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
            );
            insights += `<li><strong>${word}</strong> - often misspelled as "${commonMistake}"</li>`;
        });
        insights += `</ul></div>`;
    }
    
    // Word set performance
    const wordSetPerf = Object.values(analysis.wordSetPerformance);
    if (wordSetPerf.length > 1) {
        const bestSet = wordSetPerf.reduce((a, b) => {
            const avgA = a.scores.reduce((sum, s) => sum + s, 0) / a.scores.length;
            const avgB = b.scores.reduce((sum, s) => sum + s, 0) / b.scores.length;
            return avgA > avgB ? a : b;
        });
        const worstSet = wordSetPerf.reduce((a, b) => {
            const avgA = a.scores.reduce((sum, s) => sum + s, 0) / a.scores.length;
            const avgB = b.scores.reduce((sum, s) => sum + s, 0) / b.scores.length;
            return avgA < avgB ? a : b;
        });
        
        insights += `<div style="background: white; padding: 12px; border-radius: 6px;">`;
        insights += `<strong>📚 Word Set Performance:</strong><br>`;
        insights += `Best performance: <strong>${bestSet.name}</strong> (${Math.round(bestSet.scores.reduce((a, b) => a + b, 0) / bestSet.scores.length)}% avg)<br>`;
        insights += `Needs attention: <strong>${worstSet.name}</strong> (${Math.round(worstSet.scores.reduce((a, b) => a + b, 0) / worstSet.scores.length)}% avg)`;
        insights += `</div>`;
    }
    
    return insights;
}

// Set default word set for a class
async function setClassDefaultWordSet(classId) {
    try {
        const selectElement = document.getElementById(`classDefaultSet_${classId}`);
        const wordSetId = selectElement.value;
        const wordSetName = wordSetId ? wordSets.find(ws => ws.id === wordSetId)?.name : 'None';
        const className = classes.find(c => c.id === classId)?.name;
        
        // Find all students in this class
        const studentsInClass = students.filter(student => student.classId === classId);
        
        // Show confirmation dialog
        const confirmMessage = studentsInClass.length > 0 
            ? `This will set the default word set for class "${className}" to "${wordSetName}" and also update the default word set for all ${studentsInClass.length} students in this class.\n\nDo you want to continue?`
            : `This will set the default word set for class "${className}" to "${wordSetName}".\n\nDo you want to continue?`;
        
        if (!confirm(confirmMessage)) {
            // Reset the select to its previous value
            const currentDefault = classes.find(c => c.id === classId)?.defaultWordSetId;
            selectElement.value = currentDefault || '';
            return;
        }
        
        // Update the class document
        await window.db.collection('classes').doc(classId).update({
            defaultWordSetId: wordSetId || null
        });
        
        // Update local data
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex !== -1) {
            classes[classIndex].defaultWordSetId = wordSetId || null;
        }
        
        let updatedStudentsCount = 0;
        
        if (studentsInClass.length > 0) {
            console.log(`Updating default word set for ${studentsInClass.length} students in class`);
            
            // Update each student's default word set
            for (const student of studentsInClass) {
                try {
                    await window.db.collection('students').doc(student.id).update({
                        defaultWordSetId: wordSetId || null
                    });
                    
                    // Update local data
                    const studentIndex = students.findIndex(s => s.id === student.id);
                    if (studentIndex !== -1) {
                        students[studentIndex].defaultWordSetId = wordSetId || null;
                    }
                    
                    updatedStudentsCount++;
                } catch (error) {
                    console.error(`Error updating student ${student.name}:`, error);
                }
            }
        }
        
        if (updatedStudentsCount > 0) {
            showNotification(`Default word set for class "${className}" and ${updatedStudentsCount} students updated to: ${wordSetName}`, 'success');
        } else {
            showNotification(`Default word set for class "${className}" updated to: ${wordSetName}`, 'success');
        }
        
        // Re-render to show the updated defaults
        renderStudentsAndClasses();
        
    } catch (error) {
        console.error('Error setting class default word set:', error);
        showNotification('Error updating class default word set', 'error');
    }
}

// Set default word set for a student
async function setStudentDefaultWordSet(studentId) {
    try {
        const selectElement = document.getElementById(`studentDefaultSet_${studentId}`);
        const wordSetId = selectElement.value;
        
        // Update the student document
        await window.db.collection('students').doc(studentId).update({
            defaultWordSetId: wordSetId || null
        });
        
        // Update local data
        const studentIndex = students.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
            students[studentIndex].defaultWordSetId = wordSetId || null;
        }
        
        const wordSetName = wordSetId ? wordSets.find(ws => ws.id === wordSetId)?.name : 'None';
        const studentName = students.find(s => s.id === studentId)?.name;
        showNotification(`Default word set for ${studentName} updated to: ${wordSetName}`, 'success');
        
        // Re-render to show the updated default
        renderStudentsAndClasses();
        
    } catch (error) {
        console.error('Error setting student default word set:', error);
        showNotification('Error updating student default word set', 'error');
    }
}

// Sync class assignments - ensure all students have proper word sets
async function syncClassAssignments(classId) {
    try {
        const className = classes.find(c => c.id === classId)?.name;
        const classData = classes.find(c => c.id === classId);
        const studentsInClass = students.filter(s => s.classId === classId);
        
        if (studentsInClass.length === 0) {
            showNotification(`No students found in class "${className}"`, 'warning');
            return;
        }
        
        let studentsWithoutAssignments = [];
        let studentsWithoutDefaults = [];
        
        // Check each student's assignment status
        for (const student of studentsInClass) {
            // Check if student has individual assignment
            const hasAssignment = assignments.some(a => a.studentId === student.id);
            if (!hasAssignment) {
                studentsWithoutAssignments.push(student);
            }
            
            // Check if student has default word set
            if (!student.defaultWordSetId) {
                studentsWithoutDefaults.push(student);
            }
        }
        
        let message = `Class "${className}" Assignment Status:\\n`;
        message += `Total students: ${studentsInClass.length}\\n`;
        message += `Students without individual assignments: ${studentsWithoutAssignments.length}\\n`;
        message += `Students without default word sets: ${studentsWithoutDefaults.length}\\n\\n`;
        
        if (studentsWithoutAssignments.length === 0 && studentsWithoutDefaults.length === 0) {
            message += `All students have proper assignments and defaults!`;
            showNotification(message, 'success');
            return;
        }
        
        // If class has a default word set, offer to apply it
        if (classData.defaultWordSetId) {
            const classDefaultWordSet = wordSets.find(ws => ws.id === classData.defaultWordSetId);
            message += `Class default word set: "${classDefaultWordSet?.name}"\\n\\n`;
            message += `Would you like to:\\n`;
            message += `1. Create assignments for students without individual assignments\\n`;
            message += `2. Set default word sets for students without defaults\\n`;
            message += `3. Both (recommended)`;
            
            const choice = prompt(message + "\\n\\nEnter 1, 2, or 3:");
            
            if (choice === '1' || choice === '3') {
                // Create assignments for students without them
                let assignmentsCreated = 0;
                for (const student of studentsWithoutAssignments) {
                    try {
                        const assignmentData = {
                            studentId: student.id,
                            wordSetId: classData.defaultWordSetId,
                            assignedAt: new Date(),
                            assignedBy: 'teacher',
                            type: 'class_sync',
                            classId
                        };
                        
                        const docRef = await createAssignmentWithValidation(assignmentData);
                        assignments.push({ id: docRef.id, ...assignmentData });
                        assignmentsCreated++;
                    } catch (error) {
                        console.error(`Error creating assignment for ${student.name}:`, error);
                    }
                }
                showNotification(`Created ${assignmentsCreated} new assignments`, 'success');
            }
            
            if (choice === '2' || choice === '3') {
                // Set defaults for students without them
                let defaultsSet = 0;
                for (const student of studentsWithoutDefaults) {
                    try {
                        await window.db.collection('students').doc(student.id).update({
                            defaultWordSetId: classData.defaultWordSetId
                        });
                        
                        // Update local data
                        const studentIndex = students.findIndex(s => s.id === student.id);
                        if (studentIndex !== -1) {
                            students[studentIndex].defaultWordSetId = classData.defaultWordSetId;
                        }
                        defaultsSet++;
                    } catch (error) {
                        console.error(`Error setting default for ${student.name}:`, error);
                    }
                }
                showNotification(`Set defaults for ${defaultsSet} students`, 'success');
            }
            
            if (choice === '1' || choice === '2' || choice === '3') {
                renderAssignments();
                renderStudentsAndClasses();
            }
            
        } else {
            message += `Class has no default word set.\\n\\n`;
            message += `Please set a default word set for the class first, then run sync again.`;
            showNotification(message, 'warning');
        }
        
    } catch (error) {
        console.error('Error syncing class assignments:', error);
        showNotification('Error syncing class assignments', 'error');
    }
}

// Check assignment status across all classes
async function checkAllClassAssignments() {
    try {
        let totalStudents = 0;
        let studentsWithoutAssignments = 0;
        let studentsWithoutDefaults = 0;
        let classesWithoutDefaults = 0;
        let issueDetails = [];
        
        for (const cls of classes) {
            const studentsInClass = students.filter(s => s.classId === cls.id);
            totalStudents += studentsInClass.length;
            
            if (!cls.defaultWordSetId) {
                classesWithoutDefaults++;
                issueDetails.push(`Class "${cls.name}" has no default word set`);
            }
            
            for (const student of studentsInClass) {
                const hasAssignment = assignments.some(a => a.studentId === student.id);
                if (!hasAssignment) {
                    studentsWithoutAssignments++;
                    issueDetails.push(`${student.name} (${cls.name}) has no individual assignment`);
                }
                
                if (!student.defaultWordSetId) {
                    studentsWithoutDefaults++;
                    issueDetails.push(`${student.name} (${cls.name}) has no default word set`);
                }
            }
        }
        
        // Also check students not in any class
        const studentsWithoutClass = students.filter(s => !s.classId);
        for (const student of studentsWithoutClass) {
            totalStudents++;
            const hasAssignment = assignments.some(a => a.studentId === student.id);
            if (!hasAssignment) {
                studentsWithoutAssignments++;
                issueDetails.push(`${student.name} (no class) has no individual assignment`);
            }
            
            if (!student.defaultWordSetId) {
                studentsWithoutDefaults++;
                issueDetails.push(`${student.name} (no class) has no default word set`);
            }
        }
        
        let report = `=== ASSIGNMENT STATUS REPORT ===\\n\\n`;
        report += `Total Students: ${totalStudents}\\n`;
        report += `Classes without default word sets: ${classesWithoutDefaults}\\n`;
        report += `Students without individual assignments: ${studentsWithoutAssignments}\\n`;
        report += `Students without default word sets: ${studentsWithoutDefaults}\\n\\n`;
        
        if (issueDetails.length === 0) {
            report += `✅ All students have proper assignments and defaults!`;
            showNotification(report, 'success');
        } else {
            report += `⚠️ Issues found:\\n\\n`;
            report += issueDetails.slice(0, 10).join('\\n');
            if (issueDetails.length > 10) {
                report += `\\n... and ${issueDetails.length - 10} more issues`;
            }
            report += `\\n\\nRecommendations:\\n`;
            report += `1. Set default word sets for classes without them\\n`;
            report += `2. Use "Sync Assignments" button on each class\\n`;
            report += `3. Manually assign word sets to individual students as needed`;
            
            showModal('Assignment Status Report', `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 0.9rem;">${report}</pre>`);
        }
        
    } catch (error) {
        console.error('Error checking class assignments:', error);
        showNotification('Error checking class assignments', 'error');
    }
}

// Export analytics data as PDF
function exportAnalyticsData() {
    // Filter out practice data like in the table
    const validResults = filteredResults.filter(result => {
        return result.wordSetId && result.wordSetName && 
               result.wordSetName !== 'All Words' && 
               result.wordSetName !== 'Default Set' &&
               !result.wordSetName.includes('Practice') &&
               !result.wordSetName.includes('Individual');
    });
    
    if (validResults.length === 0) {
        showNotification('No valid data to export', 'warning');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Spelling Practice Report', 20, 20);
    
    // Date range and filter info
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue').value;
    const fromDate = document.getElementById('analyticsFromDate').value;
    const toDate = document.getElementById('analyticsToDate').value;
    
    let filterInfo = 'Filter: ';
    if (filterType === 'student' && filterValue) {
        const student = students.find(s => s.id === filterValue);
        filterInfo += `Student - ${student?.name || 'Unknown'}`;
    } else if (filterType === 'class' && filterValue) {
        const cls = classes.find(c => c.id === filterValue);
        filterInfo += `Class - ${cls?.name || 'Unknown'}`;
    } else {
        filterInfo += 'All Students';
    }
    
    if (fromDate || toDate) {
        filterInfo += ` | Date Range: ${fromDate || 'Start'} to ${toDate || 'End'}`;
    }
    
    doc.text(filterInfo, 20, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40);
    doc.text(`Total Results: ${validResults.length}`, 20, 50);
    
    let yPos = 70;
    
    // Process each result
    validResults.forEach((result, index) => {
        // Check if we need a new page
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        // Format dates and times
        const date = result.date ? new Date(result.date).toLocaleDateString() : 'Unknown';
        // Only show end time, not start time as per user request
        const finishTime = result.finishTime ? new Date(result.finishTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                          (result.date ? new Date(result.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown');
        
        const words = result.words || [];
        
        // Calculate score and fraction
        const firstTryCorrect = words.filter(w => {
            const attempts = w.attempts || [];
            return attempts.length > 0 && attempts[0] === w.word;
        }).length;
        const totalWords = words.length;
        const score = totalWords > 0 ? Math.round((firstTryCorrect / totalWords) * 100) : 0;
        const fraction = `${firstTryCorrect}/${totalWords}`;
        
        // Header for this result
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`${index + 1}. ${result.user || 'Unknown'} - ${result.wordSetName || 'Unknown Set'}`, 20, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Date: ${date} | End: ${finishTime}`, 20, yPos);
        yPos += 6;
        doc.text(`Score: ${fraction} (${score}%) | Time: ${result.totalTimeSeconds || 0}s`, 20, yPos);
        yPos += 12;
        
        // Focus on mistakes and hints only
        const mistakesAndHints = words.filter(w => !w.correct || w.hint);
        
        if (mistakesAndHints.length > 0) {
            doc.setFont(undefined, 'bold');
            doc.text(`Learning Areas (${mistakesAndHints.length}):`, 25, yPos);
            yPos += 8;
            
            mistakesAndHints.forEach(w => {
                let practiceText = '';
                
                if (!w.correct) {
                    // Show mistake with colors in text description
                    const wrongAttempt = w.attempts && w.attempts.length > 0 ? w.attempts[0] : 'no attempt';
                    practiceText = `• MISTAKE: "${wrongAttempt}" → "${w.word}" (incorrect spelling)`;
                } else if (w.hint) {
                    // Show word with hint information
                    if (w.hintLetters && w.hintLetters.length > 0) {
                        const hintedLetters = w.hintLetters.map(pos => `${w.word[pos]} (position ${pos + 1})`).join(', ');
                        practiceText = `• HINT USED: "${w.word}" - helped with letters: ${hintedLetters}`;
                    } else {
                        practiceText = `• HINT USED: "${w.word}" (general hint)`;
                    }
                }
                
                doc.setFont(undefined, 'normal');
                const practiceLines = doc.splitTextToSize(practiceText, 170);
                doc.text(practiceLines, 30, yPos);
                yPos += practiceLines.length * 5;
            });
        } else {
            // Perfect performance
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 150, 0); // Green color
            doc.text('🎉 PERFECT! All words spelled correctly without hints', 25, yPos);
            doc.setTextColor(0, 0, 0); // Reset to black
            yPos += 8;
        }
        
        yPos += 10; // Space between results
    });
    
    // Save the PDF
    doc.save(`spelling_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('PDF report generated!', 'success');
}

// Export screenshot of analytics table
async function exportScreenshot() {
    try {
        // Show popup for export options
        const exportOptions = await showItemsPerPageModal();
        if (!exportOptions) return; // User cancelled
        
        showNotification('Generating screenshot...', 'info');
        
        // Get current filter and sort settings from the analytics view
        const filterType = document.getElementById('analyticsFilterType').value;
        const filterValue = document.getElementById('analyticsFilterValue').value;
        const fromDate = document.getElementById('analyticsFromDate').value;
        const toDate = document.getElementById('analyticsToDate').value;
        const sortBy = document.getElementById('analyticsSortBy').value;
        
        // Use the same filtered and sorted results from the current view
        let validResults = [...filteredResults].filter(result => {
            // Only include results from assigned word sets (exclude "All Words" practice)
            return result.wordSetId && result.wordSetName && 
                   result.wordSetName !== 'All Words' && 
                   result.wordSetName !== 'Default Set' &&
                   !result.wordSetName.includes('Practice') &&
                   !result.wordSetName.includes('Individual');
        });
        
        if (validResults.length === 0) {
            showNotification('No data to export with current filters', 'error');
            return;
        }
        
        // Get filter and sort information for the header
        let filterInfo = '';
        if (filterType === 'student' && filterValue) {
            filterInfo = `Student: ${filterValue}`;
        } else if (filterType === 'class' && filterValue) {
            const className = classes.find(c => c.id === filterValue)?.name || 'Unknown Class';
            filterInfo = `Class: ${className}`;
        } else {
            filterInfo = 'All Students';
        }
        
        const sortLabel = document.getElementById('analyticsSortBy').selectedOptions[0].text;
        const screenshots = [];
        
        if (exportOptions.mode === 'separate') {
            // Separate by student mode - create individual pages for each student
            const uniqueStudents = [...new Set(validResults.map(r => r.user))].filter(name => name).sort();
            
            if (uniqueStudents.length === 0) {
                showNotification('No students found in the data', 'error');
                return;
            }
            
            showNotification(`Creating individual reports for ${uniqueStudents.length} students...`, 'info');
            
            for (let studentIndex = 0; studentIndex < uniqueStudents.length; studentIndex++) {
                const studentName = uniqueStudents[studentIndex];
                const studentResults = validResults.filter(r => r.user === studentName);
                
                if (studentResults.length === 0) continue;
                
                // Create individual student report
                const screenshotContainer = document.createElement('div');
                screenshotContainer.style.cssText = `
                    width: 1200px;
                    background: white;
                    padding: 40px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #1e293b;
                    box-sizing: border-box;
                `;
                
                // Generate table rows for this student
                const tableRows = studentResults.map((result, index) => {
                    const words = result.words || [];
                    const firstTryCorrect = words.filter(w => {
                        const attempts = w.attempts || [];
                        return attempts.length > 0 && attempts[0] === w.word;
                    }).length;
                    const totalWords = words.length;
                    const scoreText = `${firstTryCorrect}/${totalWords}`;
                    
                    // Get end time
                    let endTimeText = 'Unknown';
                    if (result.finishTime) {
                        const finishDate = new Date(result.finishTime);
                        endTimeText = finishDate.toLocaleDateString() + ' ' + finishDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    } else if (result.date) {
                        const resultDate = new Date(result.date);
                        endTimeText = resultDate.toLocaleDateString() + ' ' + resultDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }
                    
                    // Create detailed learning information
                    let learningDetails = '';
                    const mistakesAndHints = words.filter(w => !w.correct || w.hint);
                    
                    if (mistakesAndHints.length > 0) {
                        learningDetails = mistakesAndHints.map(w => {
                            let wordDetail = '';
                            
                            if (!w.correct) {
                                // Show wrong spelling in red, then correct spelling in green
                                const wrongAttempt = w.attempts && w.attempts.length > 0 ? w.attempts[0] : 'no attempt';
                                wordDetail += `<span style="background: #fee2e2; color: #dc2626; padding: 2px 4px; border-radius: 3px; text-decoration: line-through; font-weight: 600; font-size: 18px;">${wrongAttempt}</span>`;
                                wordDetail += ` → `;
                                wordDetail += `<span style="background: #dcfce7; color: #059669; padding: 2px 4px; border-radius: 3px; font-weight: 600; font-size: 18px;">${w.word}</span>`;
                            }
                            
                            if (w.hint) {
                                // Show word with hint letters highlighted in yellow and underlined
                                if (wordDetail) wordDetail += ' | ';
                                wordDetail += 'Hint: ';
                                
                                if (w.hintLetters && w.hintLetters.length > 0) {
                                    wordDetail += w.word.split('').map((letter, letterIndex) => {
                                        if (w.hintLetters.includes(letterIndex)) {
                                            return `<span style="background: #fef3c7; color: #d97706; text-decoration: underline; font-weight: 700; font-size: 18px;">${letter}</span>`;
                                        }
                                        return `<span style="color: #374151; font-size: 18px;">${letter}</span>`;
                                    }).join('');
                                } else {
                                    wordDetail += `<span style="background: #fef3c7; color: #d97706; text-decoration: underline; font-weight: 600; font-size: 18px;">${w.word}</span>`;
                                }
                            }
                            
                            return `<div style="margin-bottom: 8px; line-height: 1.4;">${wordDetail}</div>`;
                        }).join('');
                    } else {
                        learningDetails = '<span style="color: #059669; font-weight: 600; font-size: 18px;">🎉 Perfect! All words correct without hints</span>';
                    }
                    
                    return `
                        <tr style="border-bottom: 2px solid #e2e8f0; ${index % 2 === 0 ? 'background: #f8fafc;' : 'background: white;'}">
                            <td style="padding: 18px 15px; font-size: 18px; color: #475569; border-right: 1px solid #e2e8f0;">${result.wordSetName || 'Unknown Set'}</td>
                            <td style="padding: 18px 15px; text-align: center; border-right: 1px solid #e2e8f0;">
                                <span style="background: ${firstTryCorrect === totalWords ? '#dcfce7' : firstTryCorrect >= totalWords * 0.8 ? '#fef3c7' : '#fee2e2'}; 
                                           color: ${firstTryCorrect === totalWords ? '#166534' : firstTryCorrect >= totalWords * 0.8 ? '#92400e' : '#dc2626'}; 
                                           padding: 8px 12px; border-radius: 6px; font-weight: 600; font-size: 20px;">
                                    ${scoreText}
                                </span>
                            </td>
                            <td style="padding: 18px 15px; border-right: 1px solid #e2e8f0; max-width: 400px;">
                                ${learningDetails}
                            </td>
                            <td style="padding: 18px 15px; font-size: 18px; color: #64748b; font-weight: 600;">
                                ${endTimeText}
                            </td>
                        </tr>
                    `;
                }).join('');
                
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
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
                                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Word Set</th>
                                <th style="color: white; padding: 20px 15px; text-align: center; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Score</th>
                                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Learning Details</th>
                                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px;">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                `;
                
                document.body.appendChild(screenshotContainer);
                
                try {
                    const canvas = await html2canvas(screenshotContainer, {
                        scale: 3,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#ffffff',
                        width: 1200,
                        height: screenshotContainer.scrollHeight
                    });
                    
                    const link = document.createElement('a');
                    link.download = `${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_learning_report.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                    
                    screenshots.push(link.download);
                    
                } catch (error) {
                    console.error(`Error generating screenshot for ${studentName}:`, error);
                    showNotification(`Error generating report for ${studentName}`, 'error');
                } finally {
                    document.body.removeChild(screenshotContainer);
                }
                
                // Small delay between students
                if (studentIndex < uniqueStudents.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            if (screenshots.length > 0) {
                showNotification(`Successfully created ${screenshots.length} individual student reports!`, 'success');
            }
            
        } else {
            // Original items per page mode
            const itemsPerPage = parseInt(exportOptions.value);
            const totalPages = Math.ceil(validResults.length / itemsPerPage);
            
            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                const startIndex = pageNum * itemsPerPage;
                const endIndex = Math.min(startIndex + itemsPerPage, validResults.length);
                const pageResults = validResults.slice(startIndex, endIndex);
                
                // Create a clean container for screenshot
                const screenshotContainer = document.createElement('div');
                screenshotContainer.style.cssText = `
                    width: 1200px;
                    background: white;
                    padding: 40px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #1e293b;
                    box-sizing: border-box;
                `;
                
                // Generate table rows for this page
                const tableRows = pageResults.map((result, index) => {
                    const words = result.words || [];
                    const firstTryCorrect = words.filter(w => {
                        const attempts = w.attempts || [];
                        return attempts.length > 0 && attempts[0] === w.word;
                    }).length;
                    const totalWords = words.length;
                    const scoreText = `${firstTryCorrect}/${totalWords}`;
                    
                    let endTimeText = 'Unknown';
                    if (result.finishTime) {
                        const finishDate = new Date(result.finishTime);
                        endTimeText = finishDate.toLocaleDateString() + ' ' + finishDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    } else if (result.date) {
                        const resultDate = new Date(result.date);
                        endTimeText = resultDate.toLocaleDateString() + ' ' + resultDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }
                    
                    let learningDetails = '';
                    const mistakesAndHints = words.filter(w => !w.correct || w.hint);
                    
                    if (mistakesAndHints.length > 0) {
                        learningDetails = mistakesAndHints.map(w => {
                            let wordDetail = '';
                            
                            if (!w.correct) {
                                const wrongAttempt = w.attempts && w.attempts.length > 0 ? w.attempts[0] : 'no attempt';
                                wordDetail += `<span style="background: #fee2e2; color: #dc2626; padding: 2px 4px; border-radius: 3px; text-decoration: line-through; font-weight: 600; font-size: 18px;">${wrongAttempt}</span>`;
                                wordDetail += ` → `;
                                wordDetail += `<span style="background: #dcfce7; color: #059669; padding: 2px 4px; border-radius: 3px; font-weight: 600; font-size: 18px;">${w.word}</span>`;
                            }
                            
                            if (w.hint) {
                                if (wordDetail) wordDetail += ' | ';
                                wordDetail += 'Hint: ';
                                
                                if (w.hintLetters && w.hintLetters.length > 0) {
                                    wordDetail += w.word.split('').map((letter, letterIndex) => {
                                        if (w.hintLetters.includes(letterIndex)) {
                                            return `<span style="background: #fef3c7; color: #d97706; text-decoration: underline; font-weight: 700; font-size: 18px;">${letter}</span>`;
                                        }
                                        return `<span style="color: #374151; font-size: 18px;">${letter}</span>`;
                                    }).join('');
                                } else {
                                    wordDetail += `<span style="background: #fef3c7; color: #d97706; text-decoration: underline; font-weight: 600; font-size: 18px;">${w.word}</span>`;
                                }
                            }
                            
                            return `<div style="margin-bottom: 8px; line-height: 1.4;">${wordDetail}</div>`;
                        }).join('');
                    } else {
                        learningDetails = '<span style="color: #059669; font-weight: 600; font-size: 18px;">🎉 Perfect! All words correct without hints</span>';
                    }
                    
                    return `
                        <tr style="border-bottom: 2px solid #e2e8f0; ${index % 2 === 0 ? 'background: #f8fafc;' : 'background: white;'}">
                            <td style="padding: 18px 15px; font-weight: 600; font-size: 20px; color: #1e293b; border-right: 1px solid #e2e8f0;">${result.user || 'Unknown'}</td>
                            <td style="padding: 18px 15px; font-size: 18px; color: #475569; border-right: 1px solid #e2e8f0;">${result.wordSetName || 'Unknown Set'}</td>
                            <td style="padding: 18px 15px; text-align: center; border-right: 1px solid #e2e8f0;">
                                <span style="background: ${firstTryCorrect === totalWords ? '#dcfce7' : firstTryCorrect >= totalWords * 0.8 ? '#fef3c7' : '#fee2e2'}; 
                                           color: ${firstTryCorrect === totalWords ? '#166534' : firstTryCorrect >= totalWords * 0.8 ? '#92400e' : '#dc2626'}; 
                                           padding: 8px 12px; border-radius: 6px; font-weight: 600; font-size: 20px;">
                                    ${scoreText}
                                </span>
                            </td>
                            <td style="padding: 18px 15px; border-right: 1px solid #e2e8f0; max-width: 400px;">
                                ${learningDetails}
                            </td>
                            <td style="padding: 18px 15px; font-size: 18px; color: #64748b; font-weight: 600;">
                                ${endTimeText}
                            </td>
                        </tr>
                    `;
                }).join('');
                
                screenshotContainer.innerHTML = `
                    <div style="display: flex; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px;">
                        <img src="logo.png" alt="Logo" style="width: 60px; height: 60px; margin-right: 20px;">
                        <div style="flex: 1; text-align: center;">
                            <h1 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 700;">Spelling Feedback</h1>
                        </div>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
                                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Student</th>
                                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Word Set</th>
                                <th style="color: white; padding: 20px 15px; text-align: center; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Score</th>
                                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Learning Details</th>
                                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px;">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                `;
                
                document.body.appendChild(screenshotContainer);
                
                try {
                    const canvas = await html2canvas(screenshotContainer, {
                        scale: 3,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#ffffff',
                        width: 1200,
                        height: screenshotContainer.scrollHeight
                    });
                    
                    const link = document.createElement('a');
                    link.download = totalPages > 1 ? 
                        `analytics_${filterInfo.replace(/[^a-zA-Z0-9]/g, '_')}_${sortLabel.replace(/[^a-zA-Z0-9]/g, '_')}_page_${pageNum + 1}_of_${totalPages}.png` :
                        `analytics_${filterInfo.replace(/[^a-zA-Z0-9]/g, '_')}_${sortLabel.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                    
                    screenshots.push(link.download);
                    
                } catch (error) {
                    console.error('Error generating screenshot:', error);
                    showNotification(`Error generating page ${pageNum + 1}`, 'error');
                } finally {
                    document.body.removeChild(screenshotContainer);
                }
                
                // Small delay between pages
                if (pageNum < totalPages - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            if (screenshots.length > 0) {
                showNotification(
                    totalPages > 1 ? 
                        `Successfully exported ${screenshots.length} screenshot pages!` : 
                        'Screenshot exported successfully!', 
                    'success'
                );
            }
        }
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export screenshot', 'error');
    }
}

// Show modal for selecting items per page
function showItemsPerPageModal() {
    return new Promise((resolve) => {
        const modalContent = `
            <div style="text-align: center;">
                <h3 style="margin: 0 0 20px 0; color: #1e293b;">Export Screenshot Options</h3>
                <p style="margin: 0 0 24px 0; color: #64748b;">Choose how to organize the screenshot pages:</p>
                
                <div style="margin-bottom: 32px;">
                    <h4 style="margin: 0 0 16px 0; color: #1e293b; font-size: 1.1rem;">📄 Items Per Page</h4>
                    <p style="margin: 0 0 16px 0; color: #64748b; font-size: 0.9rem;">All students mixed together on each page:</p>
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 12px; margin-bottom: 16px;">
                        <button class="items-per-page-btn" data-value="4" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">4</button>
                        <button class="items-per-page-btn" data-value="5" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">5</button>
                        <button class="items-per-page-btn" data-value="8" style="padding: 12px; border: 2px solid #3b82f6; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">8</button>
                        <button class="items-per-page-btn" data-value="10" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">10</button>
                        <button class="items-per-page-btn" data-value="12" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">12</button>
                        <button class="items-per-page-btn" data-value="15" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">15</button>
                        <button class="items-per-page-btn" data-value="20" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">20</button>
                    </div>
                </div>
                
                <div style="border-top: 2px solid #e0e7ef; padding-top: 24px;">
                    <h4 style="margin: 0 0 16px 0; color: #1e293b; font-size: 1.1rem;">👥 Separate by Student</h4>
                    <p style="margin: 0 0 16px 0; color: #64748b; font-size: 0.9rem;">Create individual pages for each student (perfect for handing out individual reports):</p>
                    <button class="separate-student-btn" data-value="separate" style="padding: 16px 24px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 1rem;">
                        📋 Separate by Student
                    </button>
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 32px;">
                    <button id="cancelItemsPerPage" class="btn-secondary">Cancel</button>
                    <button id="confirmItemsPerPage" class="btn-primary">Export Screenshots</button>
                </div>
            </div>
        `;
        
        showModal('Export Screenshot Options', modalContent);
        
        let selectedValue = 8; // Default to 8
        let selectedMode = 'items'; // Default to items mode since 8 is pre-selected
        
        // Handle items per page button selection
        document.querySelectorAll('.items-per-page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Reset all buttons
                document.querySelectorAll('.items-per-page-btn').forEach(b => {
                    b.style.border = '2px solid #e0e7ef';
                    b.style.background = 'white';
                    b.style.color = '#1e293b';
                });
                document.querySelectorAll('.separate-student-btn').forEach(b => {
                    b.style.border = '2px solid #e0e7ef';
                    b.style.background = 'white';
                    b.style.color = '#1e293b';
                });
                
                // Highlight selected button
                btn.style.border = '2px solid #3b82f6';
                btn.style.background = '#3b82f6';
                btn.style.color = 'white';
                
                selectedValue = parseInt(btn.dataset.value);
                selectedMode = 'items';
                document.getElementById('confirmItemsPerPage').disabled = false;
            });
        });
        
        // Handle separate by student button selection
        document.querySelectorAll('.separate-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Reset all buttons
                document.querySelectorAll('.items-per-page-btn').forEach(b => {
                    b.style.border = '2px solid #e0e7ef';
                    b.style.background = 'white';
                    b.style.color = '#1e293b';
                });
                document.querySelectorAll('.separate-student-btn').forEach(b => {
                    b.style.border = '2px solid #e0e7ef';
                    b.style.background = 'white';
                    b.style.color = '#1e293b';
                });
                
                // Highlight selected button
                btn.style.border = '2px solid #22c55e';
                btn.style.background = '#22c55e';
                btn.style.color = 'white';
                
                selectedValue = btn.dataset.value;
                selectedMode = 'separate';
                document.getElementById('confirmItemsPerPage').disabled = false;
            });
        });
        
        // Handle confirm
        document.getElementById('confirmItemsPerPage').addEventListener('click', () => {
            closeModal();
            resolve({ mode: selectedMode, value: selectedValue });
        });
        
        // Handle cancel
        document.getElementById('cancelItemsPerPage').addEventListener('click', () => {
            closeModal();
            resolve(null);
        });
    });
}

// Function to show all assignments for a specific student
function showStudentAssignments(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) {
        showNotification('Student not found', 'error');
        return;
    }
    
    const studentAssignments = assignments.filter(a => a.studentId === studentId);
    
    const content = `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b;">All Assignments for ${student.name}</h4>
            <p style="margin: 0; color: #64748b;">Total: ${studentAssignments.length} assignment${studentAssignments.length !== 1 ? 's' : ''}</p>
        </div>
        
        ${studentAssignments.length > 0 ? `
            <div style="max-height: 400px; overflow-y: auto;">
                ${studentAssignments.map(assignment => {
                    const wordSet = wordSets.find(ws => ws.id === assignment.wordSetId);
                    const assignedDate = assignment.assignedAt ? new Date(assignment.assignedAt.toDate()).toLocaleDateString() : 'Unknown';
                    const assignmentType = assignment.type || 'individual';
                    
                    return `
                        <div style="background: #f8fafc; border: 1px solid #e0e7ef; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div>
                                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                                        ${wordSet ? wordSet.name : 'Unknown Word Set'}
                                    </div>
                                    <div style="font-size: 0.85rem; color: #64748b;">
                                        ${wordSet ? wordSet.words.length : 0} words • Assigned: ${assignedDate} • Type: ${assignmentType}
                                    </div>
                                </div>
                                <button class="btn-small btn-delete" onclick="deleteAssignment('${assignment.id}'); closeModal(); renderStudentsAndClasses();" style="margin-left: 12px;">
                                    Remove
                                </button>
                            </div>
                            ${wordSet && wordSet.words ? `
                                <div style="background: #f0f9ff; padding: 8px; border-radius: 4px; font-size: 0.8rem; color: #1e40af;">
                                    <strong>Words:</strong> ${wordSet.words.slice(0, 10).join(', ')}${wordSet.words.length > 10 ? ` (+${wordSet.words.length - 10} more)` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `
            <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                <p>No assignments found for this student.</p>
                <p style="font-size: 0.9rem;">Use the Assignments tab to assign word sets.</p>
            </div>
        `}
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e0e7ef;">
            <button class="btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn-primary" onclick="closeModal(); document.querySelector('[data-tab=\\"assignments\\"]').click();">
                Add More Assignments
            </button>
        </div>
    `;
    
    showModal(`Assignments for ${student.name}`, content);
}

// Enhanced Assignment Functions
function showQuickAssignToStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const wordSetOptions = wordSets.map(ws => `
        <option value="${ws.id}">${ws.name} (${ws.words.length} words)</option>
    `).join('');
    
    const content = `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b;">Quick Assign to ${student.name}</h4>
            <p style="margin: 0; color: #64748b;">Assign a word set directly to this student</p>
        </div>
        
        <div class="form-group">
            <label class="form-label">Select Word Set:</label>
            <select class="form-select" id="quickAssignWordSet">
                <option value="">Choose a word set...</option>
                ${wordSetOptions}
            </select>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="executeQuickAssignToStudent('${studentId}')">Assign Word Set</button>
        </div>
    `;
    
    showModal('Quick Assign', content);
}

function showQuickAssignToClass(classId) {
    const classData = classes.find(c => c.id === classId);
    if (!classData) return;
    
    const studentsInClass = students.filter(s => s.classId === classId);
    
    const wordSetOptions = wordSets.map(ws => `
        <option value="${ws.id}">${ws.name} (${ws.words.length} words)</option>
    `).join('');
    
    const content = `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b;">Quick Assign to Class: ${classData.name}</h4>
            <p style="margin: 0; color: #64748b;">This will automatically assign the word set to all ${studentsInClass.length} students in this class</p>
        </div>
        
        <div class="form-group">
            <label class="form-label">Select Word Set:</label>
            <select class="form-select" id="quickAssignClassWordSet">
                <option value="">Choose a word set...</option>
                ${wordSetOptions}
            </select>
        </div>
        
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 12px; margin: 16px 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="color: #0ea5e9; font-size: 1.2rem;">ℹ️</span>
                <strong style="color: #0c4a6e;">Auto-Assignment</strong>
            </div>
            <p style="margin: 0; color: #0c4a6e; font-size: 0.9rem;">
                All students in this class will automatically receive this assignment. No manual syncing required!
            </p>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="executeQuickAssignToClass('${classId}')">Assign to All Students</button>
        </div>
    `;
    
    showModal('Quick Assign to Class', content);
}

async function executeQuickAssignToStudent(studentId) {
    const wordSetId = document.getElementById('quickAssignWordSet').value;
    
    if (!wordSetId) {
        showNotification('Please select a word set', 'error');
        return;
    }
    
    // Enhanced duplicate check - check both local and Firebase
    const existingAssignment = assignments.find(a => a.studentId === studentId && a.wordSetId === wordSetId);
    if (existingAssignment) {
        showNotification('This student already has this word set assigned', 'warning');
        return;
    }
    
    // Double-check in Firebase to prevent race conditions
    try {
        const firebaseCheck = await window.db.collection('assignments')
            .where('studentId', '==', studentId)
            .where('wordSetId', '==', wordSetId)
            .get();
        
        if (!firebaseCheck.empty) {
            showNotification('This assignment already exists in the database', 'warning');
            // Reload assignments to sync local data
            await loadAssignments();
            renderStudentsAndClasses();
            closeModal();
            return;
        }
    } catch (error) {
        console.error('Error checking for existing assignments:', error);
    }
    
    try {
        const assignmentData = {
            studentId,
            wordSetId,
            assignedAt: new Date(),
            assignedBy: 'teacher',
            type: 'individual'
        };
        
        const docRef = await createAssignmentWithValidation(assignmentData);
        assignments.push({ id: docRef.id, ...assignmentData });
        
        closeModal();
        renderStudentsAndClasses();
        
        const studentName = students.find(s => s.id === studentId)?.name;
        const wordSetName = wordSets.find(ws => ws.id === wordSetId)?.name;
        showNotification(`✅ Successfully assigned "${wordSetName}" to ${studentName}!`, 'success');
        
    } catch (error) {
        console.error('Error creating assignment:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error creating assignment';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied - Check Firebase security rules';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Database temporarily unavailable - Please try again';
        } else if (error.code === 'deadline-exceeded') {
            errorMessage = 'Request timeout - Please check your internet connection';
        } else if (error.code === 'resource-exhausted') {
            errorMessage = 'Database quota exceeded - Please try again later';
        } else if (error.message) {
            errorMessage = `Quick assign error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

async function executeQuickAssignToClass(classId) {
    const wordSetId = document.getElementById('quickAssignClassWordSet').value;
    
    if (!wordSetId) {
        showNotification('Please select a word set', 'error');
        return;
    }
    
    const studentsInClass = students.filter(s => s.classId === classId);
    const classData = classes.find(c => c.id === classId);
    
    if (studentsInClass.length === 0) {
        showNotification('No students found in this class', 'warning');
        return;
    }
    
    // Check if this class already has this word set assigned
    const existingClassAssignment = assignments.find(a => a.classId === classId && a.wordSetId === wordSetId && a.type === 'class');
    if (existingClassAssignment) {
        showNotification(`Class "${classData.name}" already has this word set assigned`, 'warning');
        closeModal();
        return;
    }
    
    // Double-check in Firebase to prevent race conditions
    try {
        const firebaseCheck = await window.db.collection('assignments')
            .where('classId', '==', classId)
            .where('wordSetId', '==', wordSetId)
            .where('type', '==', 'class')
            .get();
        
        if (!firebaseCheck.empty) {
            showNotification('This class assignment already exists in the database', 'warning');
            closeModal();
            await loadAssignments();
            renderAssignments();
            renderStudentsAndClasses();
            return;
        }
    } catch (error) {
        console.error('Error checking for existing class assignments:', error);
    }
    
    try {
        // Create ONE class assignment
        const classAssignmentData = {
            classId: classId,
            wordSetId,
            assignedAt: new Date(),
            assignedBy: 'teacher',
            type: 'class',
            studentCount: studentsInClass.length
        };
        
        const docRef = await createAssignmentWithValidation(classAssignmentData);
        assignments.push({ id: docRef.id, ...classAssignmentData });
        
        closeModal();
        renderStudentsAndClasses();
        renderAssignments(); // Update assignments tab too
        
        const wordSetName = wordSets.find(ws => ws.id === wordSetId)?.name;
        showNotification(`✅ Successfully assigned "${wordSetName}" to class "${classData.name}" (${studentsInClass.length} students)!`, 'success');
        
    } catch (error) {
        console.error('Error creating class assignment:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error creating class assignment';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied - Check Firebase security rules';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Database temporarily unavailable - Please try again';
        } else if (error.code === 'deadline-exceeded') {
            errorMessage = 'Request timeout - Please check your internet connection';
        } else if (error.code === 'resource-exhausted') {
            errorMessage = 'Database quota exceeded - Please try again later';
        } else if (error.message) {
            errorMessage = `Class assignment error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

function editStudentAssignment(assignmentId, studentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    const student = students.find(s => s.id === studentId);
    
    if (!assignment || !student) return;
    
    const currentWordSet = wordSets.find(ws => ws.id === assignment.wordSetId);
    const wordSetOptions = wordSets.map(ws => `
        <option value="${ws.id}" ${ws.id === assignment.wordSetId ? 'selected' : ''}>
            ${ws.name} (${ws.words.length} words)
        </option>
    `).join('');
    
    const content = `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b;">Edit Assignment for ${student.name}</h4>
            <p style="margin: 0; color: #64748b;">Currently assigned: ${currentWordSet ? currentWordSet.name : 'Unknown'}</p>
        </div>
        
        <div class="form-group">
            <label class="form-label">Change Word Set:</label>
            <select class="form-select" id="editAssignmentWordSet">
                ${wordSetOptions}
            </select>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="updateStudentAssignment('${assignmentId}')">Update Assignment</button>
        </div>
    `;
    
    showModal('Edit Assignment', content);
}

async function updateStudentAssignment(assignmentId) {
    const newWordSetId = document.getElementById('editAssignmentWordSet').value;
    
    if (!newWordSetId) {
        showNotification('Please select a word set', 'error');
        return;
    }
    
    try {
        await window.db.collection('assignments').doc(assignmentId).update({
            wordSetId: newWordSetId,
            updatedAt: new Date()
        });
        
        // Update local array
        const index = assignments.findIndex(a => a.id === assignmentId);
        if (index !== -1) {
            assignments[index].wordSetId = newWordSetId;
            assignments[index].updatedAt = new Date();
        }
        
        closeModal();
        renderStudentsAndClasses();
        renderAssignments();
        
        const wordSetName = wordSets.find(ws => ws.id === newWordSetId)?.name;
        showNotification(`✅ Assignment updated to "${wordSetName}"!`, 'success');
        
    } catch (error) {
        console.error('Error updating assignment:', error);
        showNotification('Error updating assignment', 'error');
    }
}

async function deleteClassAssignment(assignmentId) {
    if (!confirm('Are you sure you want to remove this class assignment? This will also remove it from all students who received it from this class.')) {
        return;
    }
    
    try {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment) return;
        
        // Delete the class assignment
        await window.db.collection('assignments').doc(assignmentId).delete();
        
        // Find and delete related student assignments that came from this class
        const relatedStudentAssignments = assignments.filter(a => 
            a.sourceClassId === assignment.classId && 
            a.wordSetId === assignment.wordSetId &&
            a.type === 'from-class'
        );
        
        for (const studentAssignment of relatedStudentAssignments) {
            await window.db.collection('assignments').doc(studentAssignment.id).delete();
        }
        
        // Update local arrays
        assignments = assignments.filter(a => 
            a.id !== assignmentId && 
            !(a.sourceClassId === assignment.classId && a.wordSetId === assignment.wordSetId && a.type === 'from-class')
        );
        
        renderStudentsAndClasses();
        renderAssignments();
        showNotification('Class assignment and related student assignments removed successfully!', 'success');
        
    } catch (error) {
        console.error('Error deleting class assignment:', error);
        showNotification('Error deleting class assignment', 'error');
    }
}

function toggleStudentAssignments(studentId) {
    const container = document.getElementById(`studentAssignments_${studentId}`);
    const toggleBtn = document.getElementById(`toggleStudentBtn_${studentId}`);
    
    if (!container || !toggleBtn) return;
    
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const studentAssignments = assignments.filter(a => a.studentId === studentId);
    
    if (toggleBtn.textContent.trim() === 'Show All') {
        // Show all assignments
        container.innerHTML = renderAssignmentsList(studentAssignments, 'individual');
        toggleBtn.textContent = 'Hide';
    } else {
        // Show only first 5 assignments
        container.innerHTML = `
            ${renderAssignmentsList(studentAssignments.slice(0, 5), 'individual')}
            ${studentAssignments.length > 5 ? `
                <div class="more-indicator">
                    <span class="more-text">+ ${studentAssignments.length - 5} more individual assignments</span>
                    <span class="more-hint">Click "Show All" to view all ${studentAssignments.length} assignments</span>
                </div>
            ` : ''}
        `;
        toggleBtn.textContent = 'Show All';
    }
}

function toggleClassAssignments(classId) {
    const container = document.getElementById(`classAssignments_${classId}`);
    const toggleBtn = document.getElementById(`toggleClassBtn_${classId}`);
    
    if (!container || !toggleBtn) return;
    
    const classAssignments = assignments.filter(a => a.classId === classId);
    
    if (toggleBtn.textContent.trim() === 'Show All') {
        // Show all assignments
        container.innerHTML = renderAssignmentsList(classAssignments, 'class');
        toggleBtn.textContent = 'Hide';
    } else {
        // Show only first 3 assignments
        container.innerHTML = `
            ${renderAssignmentsList(classAssignments.slice(0, 3), 'class')}
            ${classAssignments.length > 3 ? `
                <div class="more-indicator">
                    <span class="more-text">+ ${classAssignments.length - 3} more assignments</span>
                    <span class="more-hint">Click "Show All" to view</span>
                </div>
            ` : ''}
        `;
        toggleBtn.textContent = 'Show All';
    }
}

function scrollToStudent(studentId) {
    const studentElement = document.getElementById(`student_${studentId}`);
    if (studentElement) {
        studentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a brief highlight effect
        studentElement.style.boxShadow = '0 0 20px rgba(37, 99, 235, 0.3)';
        setTimeout(() => {
            studentElement.style.boxShadow = '';
        }, 2000);
    }
}

// Pagination helper function
function goToPage(pageNumber) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('page', pageNumber);
    window.history.pushState({}, '', `${window.location.pathname}?${urlParams}`);
    renderAnalytics();
}

// Old updateFilterOptions function removed - replaced by updateAnalyticsFilterOptions

// Add test data for demonstration
function addTestData() {
    // This is just for demonstration - in real use, data comes from student quizzes
    showNotification('Test data feature is for demonstration only. Real data comes from student quiz completions.', 'info');
}

// Enhanced duplicate assignment cleanup function
async function cleanupDuplicateAssignments() {
    if (!confirm('This will scan and remove duplicate assignments from the database.\n\nDuplicates are identified by:\n- Same student + same word set\n- Same class + same word set\n\nThis action cannot be undone. Continue?')) {
        return;
    }
    
    try {
        showNotification('Scanning for duplicate assignments...', 'info');
        
        // Get all assignments from Firebase
        const assignmentsSnapshot = await window.db.collection('assignments').get();
        const allAssignments = [];
        
        assignmentsSnapshot.forEach(doc => {
            allAssignments.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`Found ${allAssignments.length} total assignments`);
        
        // Find duplicates
        const duplicatesToDelete = [];
        const seen = new Set();
        
        // Sort by creation date to keep the oldest assignment
        allAssignments.sort((a, b) => {
            const dateA = a.assignedAt ? a.assignedAt.toDate() : new Date(0);
            const dateB = b.assignedAt ? b.assignedAt.toDate() : new Date(0);
            return dateA - dateB;
        });
        
        for (const assignment of allAssignments) {
            let key;
            
            // Create unique key based on assignment type
            if (assignment.studentId && assignment.wordSetId) {
                // Individual assignment
                key = `student_${assignment.studentId}_wordset_${assignment.wordSetId}`;
            } else if (assignment.classId && assignment.wordSetId) {
                // Class assignment
                key = `class_${assignment.classId}_wordset_${assignment.wordSetId}`;
            } else {
                // Invalid assignment - mark for deletion
                console.warn('Invalid assignment found:', assignment);
                duplicatesToDelete.push(assignment);
                continue;
            }
            
            if (seen.has(key)) {
                // This is a duplicate
                duplicatesToDelete.push(assignment);
                console.log(`Duplicate found: ${key}`, assignment);
            } else {
                // First occurrence - keep it
                seen.add(key);
            }
        }
        
        if (duplicatesToDelete.length === 0) {
            showNotification('No duplicate assignments found!', 'success');
            return;
        }
        
        // Confirm deletion
        if (!confirm(`Found ${duplicatesToDelete.length} duplicate assignments.\n\nDo you want to delete them now?`)) {
            return;
        }
        
        // Delete duplicates in batches
        const batchSize = 500; // Firestore batch limit
        let deletedCount = 0;
        
        for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
            const batch = window.db.batch();
            const batchItems = duplicatesToDelete.slice(i, i + batchSize);
            
            batchItems.forEach(assignment => {
                const assignmentRef = window.db.collection('assignments').doc(assignment.id);
                batch.delete(assignmentRef);
            });
            
            await batch.commit();
            deletedCount += batchItems.length;
            
            showNotification(`Deleted ${deletedCount}/${duplicatesToDelete.length} duplicates...`, 'info');
        }
        
        showNotification(`Successfully removed ${duplicatesToDelete.length} duplicate assignments!`, 'success');
        
        // Reload data and refresh display
        await loadAllData();
        renderStudentsAndClasses();
        renderAssignments();
        
    } catch (error) {
        console.error('Error cleaning up duplicates:', error);
        showNotification('Error cleaning up duplicates. Please try again.', 'error');
    }
}

// Bulk selection functions
function toggleBulkSelectionMode(section) {
    bulkSelectionMode = !bulkSelectionMode;
    
    // Clear selections when toggling
    selectedItems.classes.clear();
    selectedItems.students.clear();
    selectedItems.assignments.clear();
    
    // Re-render the appropriate section
    if (section === 'classes') {
        renderClasses();
    } else if (section === 'students') {
        renderStudents();
    }
}

function updateClassSelection(classId) {
    const checkbox = document.querySelector(`input[data-class-id="${classId}"]`);
    if (checkbox.checked) {
        selectedItems.classes.add(classId);
    } else {
        selectedItems.classes.delete(classId);
    }
    updateBulkActionButtons('classes');
}

function updateStudentSelection(studentId) {
    const checkbox = document.querySelector(`input[data-student-id="${studentId}"]`);
    if (checkbox.checked) {
        selectedItems.students.add(studentId);
    } else {
        selectedItems.students.delete(studentId);
    }
    updateBulkActionButtons('students');
}

function toggleSelectAllClasses() {
    const selectAllCheckbox = document.getElementById('selectAllClasses');
    const classCheckboxes = document.querySelectorAll('.class-checkbox');
    
    if (selectAllCheckbox.checked) {
        classCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedItems.classes.add(checkbox.dataset.classId);
        });
    } else {
        classCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
            selectedItems.classes.delete(checkbox.dataset.classId);
        });
    }
    updateBulkActionButtons('classes');
}

function toggleSelectAllStudents() {
    const selectAllCheckbox = document.getElementById('selectAllStudents');
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');
    
    if (selectAllCheckbox.checked) {
        studentCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedItems.students.add(checkbox.dataset.studentId);
        });
    } else {
        studentCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
            selectedItems.students.delete(checkbox.dataset.studentId);
        });
    }
    updateBulkActionButtons('students');
}

function updateBulkActionButtons(section) {
    if (section === 'classes') {
        const count = selectedItems.classes.size;
        const countElement = document.getElementById('selectedClassesCount');
        const deleteButton = document.getElementById('bulkDeleteClassesBtn');
        
        if (countElement) countElement.textContent = `${count} selected`;
        if (deleteButton) deleteButton.disabled = count === 0;
    } else if (section === 'students') {
        const count = selectedItems.students.size;
        const countElement = document.getElementById('selectedStudentsCount');
        const deleteButton = document.getElementById('bulkDeleteStudentsBtn');
        
        if (countElement) countElement.textContent = `${count} selected`;
        if (deleteButton) deleteButton.disabled = count === 0;
    }
}

// Bulk delete functions
async function bulkDeleteClasses() {
    if (selectedItems.classes.size === 0) return;
    
    const classNames = Array.from(selectedItems.classes).map(id => {
        const cls = classes.find(c => c.id === id);
        return cls ? cls.name : 'Unknown';
    });
    
    if (!confirm(`Are you sure you want to delete ${selectedItems.classes.size} classes?\n\nClasses to delete:\n${classNames.join('\n')}\n\nThis will also delete all students and assignments in these classes.`)) {
        return;
    }
    
    try {
        const batch = window.db.batch();
        
        for (const classId of selectedItems.classes) {
            // Delete class
            const classRef = window.db.collection('classes').doc(classId);
            batch.delete(classRef);
            
            // Delete students in class
            const studentsInClass = students.filter(s => s.classId === classId);
            studentsInClass.forEach(student => {
                const studentRef = window.db.collection('students').doc(student.id);
                batch.delete(studentRef);
            });
            
            // Delete class assignments
            const classAssignments = assignments.filter(a => a.classId === classId);
            classAssignments.forEach(assignment => {
                const assignmentRef = window.db.collection('assignments').doc(assignment.id);
                batch.delete(assignmentRef);
            });
            
            // Delete individual assignments for students in class
            const studentIds = studentsInClass.map(s => s.id);
            const individualAssignments = assignments.filter(a => studentIds.includes(a.studentId));
            individualAssignments.forEach(assignment => {
                const assignmentRef = window.db.collection('assignments').doc(assignment.id);
                batch.delete(assignmentRef);
            });
        }
        
        await batch.commit();
        
        showNotification(`Successfully deleted ${selectedItems.classes.size} classes and all related data`, 'success');
        selectedItems.classes.clear();
        bulkSelectionMode = false;
        await loadAllData();
        renderStudentsAndClasses();
    } catch (error) {
        console.error('Error bulk deleting classes:', error);
        showNotification('Error deleting classes. Please try again.', 'error');
    }
}

async function bulkDeleteStudents() {
    if (selectedItems.students.size === 0) return;
    
    const studentNames = Array.from(selectedItems.students).map(id => {
        const student = students.find(s => s.id === id);
        return student ? student.name : 'Unknown';
    });
    
    if (!confirm(`Are you sure you want to delete ${selectedItems.students.size} students?\n\nStudents to delete:\n${studentNames.join('\n')}\n\nThis will also delete all their individual assignments.`)) {
        return;
    }
    
    try {
        const batch = window.db.batch();
        
        for (const studentId of selectedItems.students) {
            // Delete student
            const studentRef = window.db.collection('students').doc(studentId);
            batch.delete(studentRef);
            
            // Delete student's individual assignments
            const studentAssignments = assignments.filter(a => a.studentId === studentId);
            studentAssignments.forEach(assignment => {
                const assignmentRef = window.db.collection('assignments').doc(assignment.id);
                batch.delete(assignmentRef);
            });
        }
        
        await batch.commit();
        
        showNotification(`Successfully deleted ${selectedItems.students.size} students and their assignments`, 'success');
        selectedItems.students.clear();
        bulkSelectionMode = false;
        await loadAllData();
        renderStudentsAndClasses();
    } catch (error) {
        console.error('Error bulk deleting students:', error);
        showNotification('Error deleting students. Please try again.', 'error');
    }
}

// Delete all assignments functions
async function deleteAllClassAssignments(classId) {
    const cls = classes.find(c => c.id === classId);
    const classAssignments = assignments.filter(a => a.classId === classId);
    
    if (classAssignments.length === 0) {
        showNotification('No assignments to delete for this class', 'info');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ALL ${classAssignments.length} assignments for class "${cls.name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const batch = window.db.batch();
        
        classAssignments.forEach(assignment => {
            const assignmentRef = window.db.collection('assignments').doc(assignment.id);
            batch.delete(assignmentRef);
        });
        
        await batch.commit();
        
        showNotification(`Successfully deleted all ${classAssignments.length} assignments for class "${cls.name}"`, 'success');
        await loadAllData();
        renderStudentsAndClasses();
    } catch (error) {
        console.error('Error deleting class assignments:', error);
        showNotification('Error deleting class assignments. Please try again.', 'error');
    }
}

async function deleteAllStudentAssignments(studentId) {
    const student = students.find(s => s.id === studentId);
    const studentAssignments = assignments.filter(a => a.studentId === studentId);
    
    if (studentAssignments.length === 0) {
        showNotification('No individual assignments to delete for this student', 'info');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ALL ${studentAssignments.length} individual assignments for "${student.name}"?\n\nThis will not affect class assignments.\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const batch = window.db.batch();
        
        studentAssignments.forEach(assignment => {
            const assignmentRef = window.db.collection('assignments').doc(assignment.id);
            batch.delete(assignmentRef);
        });
        
        await batch.commit();
        
        showNotification(`Successfully deleted all ${studentAssignments.length} individual assignments for "${student.name}"`, 'success');
        await loadAllData();
        renderStudentsAndClasses();
    } catch (error) {
        console.error('Error deleting student assignments:', error);
        showNotification('Error deleting student assignments. Please try again.', 'error');
    }
}

// Enhanced Firebase connection and validation functions
async function checkFirebaseConnection() {
    try {
        // Try a simple read operation to test connection
        await window.db.collection('test').limit(1).get();
        return true;
    } catch (error) {
        console.error('Firebase connection test failed:', error);
        return false;
    }
}

function validateAssignmentData(assignmentData) {
    const errors = [];
    
    if (!assignmentData.wordSetId) {
        errors.push('Word Set ID is required');
    }
    
    if (!assignmentData.assignedAt) {
        errors.push('Assignment date is required');
    }
    
    if (!assignmentData.type) {
        errors.push('Assignment type is required');
    }
    
    if (assignmentData.type === 'individual' && !assignmentData.studentId) {
        errors.push('Student ID is required for individual assignments');
    }
    
    if (assignmentData.type === 'class' && !assignmentData.classId) {
        errors.push('Class ID is required for class assignments');
    }
    
    return errors;
}

async function createAssignmentWithValidation(assignmentData, retryCount = 0) {
    const maxRetries = 3;
    
    try {
        // Check Firebase connection first
        const isConnected = await checkFirebaseConnection();
        if (!isConnected) {
            throw new Error('No connection to database. Please check your internet connection.');
        }
        
        // Validate assignment data
        const validationErrors = validateAssignmentData(assignmentData);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }
        
        // Create the assignment
        const docRef = await window.db.collection('assignments').add(assignmentData);
        return docRef;
    } catch (error) {
        // Retry for network-related errors
        if (retryCount < maxRetries && (
            error.code === 'unavailable' || 
            error.code === 'deadline-exceeded' ||
            error.message.includes('network') ||
            error.message.includes('connection')
        )) {
            console.log(`Assignment creation failed, retrying... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
            return createAssignmentWithValidation(assignmentData, retryCount + 1);
        }
        
        throw error; // Re-throw if not retryable or max retries reached
    }
}

// Add connection status indicator
function showConnectionStatus() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connection-status';
    statusDiv.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        z-index: 10001;
        transition: all 0.3s ease;
    `;
    
    // Check connection and update status
    checkFirebaseConnection().then(isConnected => {
        if (isConnected) {
            statusDiv.textContent = '🟢 Connected';
            statusDiv.style.background = '#22c55e';
            statusDiv.style.color = 'white';
        } else {
            statusDiv.textContent = '🔴 Disconnected';
            statusDiv.style.background = '#ef4444';
            statusDiv.style.color = 'white';
        }
    });
    
    // Remove existing status indicator
    const existing = document.getElementById('connection-status');
    if (existing) {
        existing.remove();
    }
    
    document.body.appendChild(statusDiv);
    
    // Auto-hide after 5 seconds if connected
    setTimeout(() => {
        if (statusDiv.textContent.includes('Connected')) {
            statusDiv.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(statusDiv)) {
                    document.body.removeChild(statusDiv);
                }
            }, 300);
        }
    }, 5000);
}

// Initialize connection monitoring when page loads
document.addEventListener('DOMContentLoaded', () => {
    showConnectionStatus();
    
    // Check connection status periodically
    setInterval(() => {
        checkFirebaseConnection().then(isConnected => {
            const statusDiv = document.getElementById('connection-status');
            if (!isConnected && !statusDiv) {
                showConnectionStatus();
            }
        });
    }, 30000); // Check every 30 seconds
});

// New function specifically for toggling class assignments within student cards
function toggleStudentClassAssignments(studentId) {
    const container = document.getElementById(`classAssignments_${studentId}`);
    const toggleBtn = document.getElementById(`toggleClassBtn_${studentId}`);
    
    if (!container || !toggleBtn) return;
    
    // Get the student and their class assignments
    const student = students.find(s => s.id === studentId);
    const studentClass = student ? classes.find(c => c.id === student.classId) : null;
    const classAssignments = studentClass ? assignments.filter(a => a.classId === studentClass.id) : [];
    
    if (toggleBtn.textContent.trim() === 'Show All') {
        // Show all class assignments
        container.innerHTML = renderAssignmentsList(classAssignments, 'class-inherited', studentId);
        toggleBtn.textContent = 'Hide';
    } else {
        // Show only first 3 class assignments
        container.innerHTML = `
            ${renderAssignmentsList(classAssignments.slice(0, 3), 'class-inherited', studentId)}
            ${classAssignments.length > 3 ? `
                <div class="more-indicator">
                    <span class="more-text">+ ${classAssignments.length - 3} more class assignments</span>
                    <span class="more-hint">Click "Show All" to view all ${classAssignments.length} assignments</span>
                </div>
            ` : ''}
        `;
        toggleBtn.textContent = 'Show All';
    }
}

// New function to show folder creation modal
function showCreateFolderModal() {
    const content = `
        <div class="form-group">
            <label class="form-label">Folder Name:</label>
            <input type="text" class="form-input" id="folderName" placeholder="e.g., Year 3, Grade 4, Advanced Level">
        </div>
        <div class="form-group">
            <label class="form-label">Description:</label>
            <input type="text" class="form-input" id="folderDescription" placeholder="Brief description of this folder">
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="createFolder()">Create Folder</button>
        </div>
    `;
    showModal('Create New Folder', content);
}

// New function to create a folder
async function createFolder() {
    const name = document.getElementById('folderName').value.trim();
    const description = document.getElementById('folderDescription').value.trim();
    
    if (!name) {
        showNotification('Please enter a folder name', 'error');
        return;
    }
    
    // Check if folder name already exists
    if (wordSetFolders.some(folder => folder.name.toLowerCase() === name.toLowerCase())) {
        showNotification('A folder with this name already exists', 'error');
        return;
    }
    
    try {
        const folder = {
            name,
            description,
            createdAt: new Date(),
            createdBy: 'teacher'
        };
        
        const docRef = await window.db.collection('wordSetFolders').add(folder);
        wordSetFolders.push({ id: docRef.id, ...folder });
        
        // Sort folders alphabetically
        wordSetFolders.sort((a, b) => a.name.localeCompare(b.name));
        
        closeModal();
        
        // Refresh the word set creation modal to show the new folder
        setTimeout(() => {
            showCreateWordSetModal();
            // Select the newly created folder
            const folderSelect = document.getElementById('wordSetFolder');
            if (folderSelect) {
                folderSelect.value = docRef.id;
            }
        }, 100);
        
        showNotification('Folder created successfully!', 'success');
    } catch (error) {
        console.error('Error creating folder:', error);
        showNotification('Error creating folder', 'error');
    }
}

// New function to show bulk move modal
function showBulkMoveModal() {
    // Group word sets by folder for better organization
    const wordSetsByFolder = {};
    const rootWordSets = [];
    
    wordSets.forEach(set => {
        if (set.folderId) {
            if (!wordSetsByFolder[set.folderId]) {
                wordSetsByFolder[set.folderId] = [];
            }
            wordSetsByFolder[set.folderId].push(set);
        } else {
            rootWordSets.push(set);
        }
    });
    
    const content = `
        <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; color: #1e293b;">Select Word Sets to Move:</h4>
            <p style="margin: 0; color: #64748b; font-size: 0.9rem;">Choose which word sets you want to move to a folder.</p>
        </div>
        
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            ${rootWordSets.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h5 style="margin: 0 0 10px 0; color: #64748b; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">📄 Root Level (No Folder)</h5>
                    ${rootWordSets.map(set => `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 6px; cursor: pointer; margin-bottom: 5px;" 
                               onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <input type="checkbox" class="bulk-move-checkbox" value="${set.id}" style="margin: 0;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #1e293b;">${set.name}</div>
                                <div style="font-size: 0.8rem; color: #64748b;">${set.words.length} words • ${set.difficulty}</div>
                            </div>
                        </label>
                    `).join('')}
                </div>
            ` : ''}
            
            ${wordSetFolders.map(folder => {
                const folderSets = wordSetsByFolder[folder.id] || [];
                if (folderSets.length === 0) return '';
                
                return `
                    <div style="margin-bottom: 20px;">
                        <h5 style="margin: 0 0 10px 0; color: #64748b; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">📁 ${folder.name}</h5>
                        ${folderSets.map(set => `
                            <label style="display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 6px; cursor: pointer; margin-bottom: 5px;" 
                                   onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                <input type="checkbox" class="bulk-move-checkbox" value="${set.id}" style="margin: 0;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: #1e293b;">${set.name}</div>
                                    <div style="font-size: 0.8rem; color: #64748b;">${set.words.length} words • ${set.difficulty}</div>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                `;
            }).join('')}
        </div>
        
        <div class="form-group">
            <label class="form-label">Move to Folder:</label>
            <select class="form-select" id="bulkMoveTargetFolder">
                <option value="">📁 Root Level (No Folder)</option>
                ${wordSetFolders.map(folder => `
                    <option value="${folder.id}">${folder.name}</option>
                `).join('')}
            </select>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: space-between; margin-top: 20px;">
            <div>
                <button type="button" class="btn-secondary" onclick="selectAllWordSets(true)">Select All</button>
                <button type="button" class="btn-secondary" onclick="selectAllWordSets(false)" style="margin-left: 8px;">Deselect All</button>
            </div>
            <div>
                <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="executeBulkMove()" style="margin-left: 8px;">Move Selected</button>
            </div>
        </div>
    `;
    showModal('Bulk Move Word Sets', content);
}

// Helper functions for bulk move
function selectAllWordSets(select) {
    const checkboxes = document.querySelectorAll('.bulk-move-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = select;
    });
}

async function executeBulkMove() {
    const selectedWordSets = Array.from(document.querySelectorAll('.bulk-move-checkbox:checked')).map(cb => cb.value);
    const targetFolderId = document.getElementById('bulkMoveTargetFolder').value;
    
    if (selectedWordSets.length === 0) {
        showNotification('Please select at least one word set to move', 'error');
        return;
    }
    
    try {
        // Update each selected word set
        for (const wordSetId of selectedWordSets) {
            await window.db.collection('wordSets').doc(wordSetId).update({
                folderId: targetFolderId || null,
                updatedAt: new Date()
            });
            
            // Update local array
            const index = wordSets.findIndex(ws => ws.id === wordSetId);
            if (index !== -1) {
                wordSets[index].folderId = targetFolderId || null;
            }
        }
        
        closeModal();
        renderWordSets();
        
        const targetFolderName = targetFolderId ? 
            wordSetFolders.find(f => f.id === targetFolderId)?.name || 'Unknown Folder' : 
            'Root Level';
        
        showNotification(`Successfully moved ${selectedWordSets.length} word set(s) to ${targetFolderName}!`, 'success');
    } catch (error) {
        console.error('Error moving word sets:', error);
        showNotification('Error moving word sets', 'error');
    }
}

function getWordSetColor(index) {
    const colors = [
        '#e0f2fe', '#fef3c7', '#f0f9ff', '#fef2f2',
        '#f0fdf4', '#faf5ff', '#fff7ed', '#f1f5f9',
        '#fefce8', '#f5f3ff', '#ecfdf5', '#fffbeb'
    ];
    return colors[index % colors.length];
}

// Word Set Preview Tooltip Functions
function showWordSetPreview(event, wordSetId) {
    // Remove any existing tooltip
    hideWordSetPreview();
    
    // Find the word set data
    const wordSet = wordSets.find(ws => ws.id === wordSetId);
    if (!wordSet) return;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'wordset-preview-tooltip';
    tooltip.className = 'wordset-preview-tooltip';
    
    // Create tooltip content
    const wordsToShow = wordSet.words.slice(0, 20); // Show first 20 words
    const hasMore = wordSet.words.length > 20;
    
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong>${wordSet.name}</strong>
            <span class="tooltip-count">(${wordSet.words.length} words)</span>
        </div>
        <div class="tooltip-words">
            ${wordsToShow.map(word => `<span class="tooltip-word">${word}</span>`).join('')}
            ${hasMore ? `<span class="tooltip-more">+${wordSet.words.length - 20} more words</span>` : ''}
        </div>
    `;
    
    // Add to document
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Position to the right of the element, or left if it would go off screen
    let left = rect.right + 10;
    if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - 10;
    }
    
    // Position vertically centered with the element
    let top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
    
    // Keep tooltip within viewport
    if (top < 10) top = 10;
    if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    
    // Show tooltip with animation
    setTimeout(() => tooltip.classList.add('visible'), 10);
}

function hideWordSetPreview() {
    const tooltip = document.getElementById('wordset-preview-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Add time formatting function at the top of the file
function formatTimeDisplay(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    
    // Cap at 10 minutes (600 seconds)
    if (seconds > 600) return '10m+';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
        return `${remainingSeconds}s`;
    } else if (remainingSeconds === 0) {
        return `${minutes}m`;
    } else {
        return `${minutes}m${remainingSeconds}s`;
    }
}