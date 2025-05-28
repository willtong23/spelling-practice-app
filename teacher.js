// Enhanced Teacher Dashboard Logic
// Global variables
let wordSets = [];
let students = [];
let classes = [];
let assignments = [];
let quizResults = [];
let filteredResults = []; // For analytics filtering

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
    
    // Test Firebase connection first
    const connectionOk = await testFirebaseConnection();
    if (!connectionOk) {
        showNotification('Failed to connect to Firebase database. Please check your internet connection.', 'error');
        return;
    }
    
    // Check password
    const password = prompt('Enter teacher password:');
    if (password !== '9739') {
        alert('Incorrect password');
        window.location.href = 'index.html';
        return;
    }
    
    // Initialize tabs
    initializeTabs();
    
    // Load all data
    await loadAllData();
    
    // Setup event listeners and analytics
    setupEventListeners();
    initializeAnalyticsFilters();
    
    console.log('=== TEACHER DASHBOARD INITIALIZED ===');
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
        console.log('Quiz results loaded:', quizResults.length);
        
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
        
        // If no word sets exist, create a default one from the old wordlist
        if (wordSets.length === 0) {
            await createDefaultWordSet();
        }
    } catch (error) {
        console.error('Error loading word sets:', error);
        wordSets = [];
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
    
    if (wordSets.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #64748b; grid-column: 1/-1;">No word sets created yet. Click "Create New Set" to get started.</p>';
        return;
    }
    
    grid.innerHTML = wordSets.map(set => `
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
    `).join('');
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
        <div class="section-header">
            <h3>Classes</h3>
            <button class="btn btn-primary" onclick="showCreateClassModal()">Add Class</button>
        </div>
        <div class="classes-list">
            ${classes.map(cls => {
                const studentsInClass = students.filter(s => s.classId === cls.id);
                const classAssignments = assignments.filter(a => a.classId === cls.id);
                const defaultWordSet = wordSets.find(ws => ws.id === cls.defaultWordSetId);
                
                return `
                    <div class="class-card">
                        <div class="class-header">
                            <div class="class-info">
                                <h4>${cls.name}</h4>
                                <p>${cls.description || 'No description'}</p>
                                <div class="class-stats">
                                    <span class="stat-item">${studentsInClass.length} students</span>
                                    <span class="stat-item">${classAssignments.length} assignments</span>
                                </div>
                            </div>
                            <div class="class-actions">
                                <button class="btn-small btn-edit" onclick="editClass('${cls.id}')">Edit</button>
                                <button class="btn-small btn-secondary" onclick="syncClassAssignments('${cls.id}')" title="Ensure all students have proper assignments">Sync Assignments</button>
                                <button class="btn-small btn-delete" onclick="deleteClass('${cls.id}')">Delete</button>
                            </div>
                        </div>
                        
                        <div class="default-word-set-section">
                            <div class="default-set-header">
                                <span class="default-set-label">Default Word Set:</span>
                                <span class="default-set-name">${defaultWordSet ? defaultWordSet.name : 'None set'}</span>
                            </div>
                            <div class="default-set-controls">
                                <select class="default-set-select" id="classDefaultSet_${cls.id}">
                                    <option value="">No default set</option>
                                    ${wordSets.map(ws => `
                                        <option value="${ws.id}" ${ws.id === cls.defaultWordSetId ? 'selected' : ''}>
                                            ${ws.name} (${ws.words.length} words)
                                        </option>
                                    `).join('')}
                                </select>
                                <button class="btn-small btn-primary" onclick="setClassDefaultWordSet('${cls.id}')">
                                    Set Default
                                </button>
                            </div>
                        </div>
                        
                        ${studentsInClass.length > 0 ? `
                            <div class="class-students">
                                <h5>Students in this class:</h5>
                                <div class="student-tags">
                                    ${studentsInClass.map(student => {
                                        const studentAssignments = assignments.filter(a => a.studentId === student.id);
                                        return `<span class="student-tag ${studentAssignments.length > 0 ? 'has-assignment' : ''}">${student.name}</span>`;
                                    }).join('')}
                                </div>
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
        <div class="section-header">
            <h3>Students</h3>
            <button class="btn btn-primary" onclick="showAddStudentModal()">Add Student</button>
        </div>
        <div class="students-list">
            ${students.map(student => {
                const studentClass = classes.find(c => c.id === student.classId);
                const studentAssignments = assignments.filter(a => a.studentId === student.id);
                const defaultWordSet = wordSets.find(ws => ws.id === student.defaultWordSetId);
                
                return `
                    <div class="student-card">
                        <div class="student-header">
                            <div class="student-info">
                                <h4>${student.name}</h4>
                                <p>Class: ${studentClass ? studentClass.name : 'No class assigned'}</p>
                                <div class="student-stats">
                                    <span class="stat-item">${studentAssignments.length} assignments</span>
                                </div>
                            </div>
                            <div class="student-actions">
                                <button class="btn-small btn-edit" onclick="editStudent('${student.id}')">Edit</button>
                                <button class="btn-small btn-delete" onclick="deleteStudent('${student.id}')">Delete</button>
                            </div>
                        </div>
                        
                        <div class="default-word-set-section">
                            <div class="default-set-header">
                                <span class="default-set-label">Default Word Set:</span>
                                <span class="default-set-name">${defaultWordSet ? defaultWordSet.name : 'None set'}</span>
                            </div>
                            <div class="default-set-controls">
                                <select class="default-set-select" id="studentDefaultSet_${student.id}">
                                    <option value="">No default set</option>
                                    ${wordSets.map(ws => `
                                        <option value="${ws.id}" ${ws.id === student.defaultWordSetId ? 'selected' : ''}>
                                            ${ws.name} (${ws.words.length} words)
                                        </option>
                                    `).join('')}
                                </select>
                                <button class="btn-small btn-primary" onclick="setStudentDefaultWordSet('${student.id}')">
                                    Set Default
                                </button>
                            </div>
                        </div>
                        
                        ${studentAssignments.length > 0 ? `
                            <div class="student-assignments">
                                <h5>Current assignments:</h5>
                                <div class="assignment-tags">
                                    ${studentAssignments.map(assignment => {
                                        const wordSet = wordSets.find(ws => ws.id === assignment.wordSetId);
                                        return `<span class="assignment-tag">${wordSet ? wordSet.name : 'Unknown set'}</span>`;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
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
            students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
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
        const hasCompleted = quizResults.some(result => {
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
        
        quizResults = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('Quiz result document:', doc.id, data);
            quizResults.push({ id: doc.id, ...data });
        });
        
        console.log('Quiz results loaded successfully:', quizResults.length);
    } catch (error) {
        console.error('Error loading quiz results:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        quizResults = [];
        throw error; // Re-throw to be caught by loadAllData
    }
}

function renderAnalytics() {
    // Initialize filters and populate dropdowns
    updateAnalyticsFilterOptions();
    
    // Set filtered results to all results initially
    filteredResults = [...quizResults];
    
    // Update analytics display
    updateFilteredAnalytics();
    renderFilteredAnalyticsTable();
    
    // Show default insights
    generateInsights();
    
    // Add test data button for demonstration
    if (quizResults.length === 0) {
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
    
    // Export analytics data
    document.getElementById('exportAnalyticsBtn').addEventListener('click', exportAnalyticsData);
    
    // Export PDF data
    document.getElementById('exportPdfBtn').addEventListener('click', exportPdfData);
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
            name,
            classId: classId || null,
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
    
    // Check if assignment already exists
    const existingAssignment = assignments.find(a => a.studentId === studentId);
    if (existingAssignment) {
        if (!confirm('This student already has an assignment. Do you want to replace it?')) {
            return;
        }
        // Delete existing assignment
        await window.db.collection('assignments').doc(existingAssignment.id).delete();
        assignments = assignments.filter(a => a.id !== existingAssignment.id);
    }
    
    try {
        const assignmentData = {
            studentId,
            wordSetId,
            assignedAt: new Date(),
            assignedBy: 'teacher',
            type: 'individual'
        };
        
        const docRef = await window.db.collection('assignments').add(assignmentData);
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
        showNotification('Assignment created successfully!', 'success');
        
        // Clear selections
        document.getElementById('assignStudentSelect').value = '';
        document.getElementById('assignWordSetSelect').value = '';
    } catch (error) {
        console.error('Error creating assignment:', error);
        showNotification('Error creating assignment', 'error');
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
    
    // Show confirmation dialog
    const confirmMessage = `This will assign "${wordSetName}" to all ${classStudents.length} students in class "${className}" and also set it as their individual default word set.\n\nDo you want to continue?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        let assignmentsCreated = 0;
        let defaultsUpdated = 0;
        
        // Create assignments for all students in the class AND set as their default
        for (const student of classStudents) {
            try {
                // Check if assignment already exists
                const existingAssignment = assignments.find(a => a.studentId === student.id);
                if (existingAssignment) {
                    await window.db.collection('assignments').doc(existingAssignment.id).delete();
                    assignments = assignments.filter(a => a.id !== existingAssignment.id);
                }
                
                // Create new assignment
                const assignmentData = {
                    studentId: student.id,
                    wordSetId,
                    assignedAt: new Date(),
                    assignedBy: 'teacher',
                    type: 'class',
                    classId
                };
                
                const docRef = await window.db.collection('assignments').add(assignmentData);
                assignments.push({ id: docRef.id, ...assignmentData });
                assignmentsCreated++;
                
                // Also set as student's default word set
                await window.db.collection('students').doc(student.id).update({
                    defaultWordSetId: wordSetId
                });
                
                // Update local data
                const studentIndex = students.findIndex(s => s.id === student.id);
                if (studentIndex !== -1) {
                    students[studentIndex].defaultWordSetId = wordSetId;
                }
                defaultsUpdated++;
                
            } catch (error) {
                console.error(`Error processing student ${student.name}:`, error);
            }
        }
        
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
        
        if (assignmentsCreated === classStudents.length && defaultsUpdated === classStudents.length) {
            showNotification(`Successfully assigned "${wordSetName}" to ${assignmentsCreated} students and set as default for ${defaultsUpdated} students!`, 'success');
        } else {
            showNotification(`Partially completed: ${assignmentsCreated} assignments created, ${defaultsUpdated} defaults updated out of ${classStudents.length} students`, 'warning');
        }
        
        // Clear selections
        document.getElementById('assignClassSelect').value = '';
        document.getElementById('assignClassWordSetSelect').value = '';
    } catch (error) {
        console.error('Error creating class assignment:', error);
        showNotification('Error creating class assignment', 'error');
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
        quizResults = quizResults.filter(r => r.id !== resultId);
        
        renderAnalytics();
        showNotification('Quiz result deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting quiz result:', error);
        showNotification('Error deleting quiz result', 'error');
    }
}

async function deleteAllResults() {
    if (!confirm('Are you sure you want to delete ALL quiz results? This action cannot be undone!')) {
        return;
    }
    
    try {
        const batch = db.batch();
        quizResults.forEach(result => {
            batch.delete(window.db.collection('results').doc(result.id));
        });
        await batch.commit();
        
        quizResults = [];
        renderAnalytics();
        showNotification('All quiz results deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting all results:', error);
        showNotification('Error deleting all results', 'error');
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
    
    // Initialize filtered results with all results
    filteredResults = [...quizResults];
}

// Analytics filtering functionality
function setupAnalyticsEventListeners() {
    const filterType = document.getElementById('analyticsFilterType');
    const filterValue = document.getElementById('analyticsFilterValue');
    const applyFilterBtn = document.getElementById('applyAnalyticsFilter');
    const exportBtn = document.getElementById('exportAnalyticsBtn');
    
    if (filterType) {
        filterType.addEventListener('change', updateAnalyticsFilterOptions);
    }
    
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyAnalyticsFilter);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAnalyticsData);
    }
}

function updateAnalyticsFilterOptions() {
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue');
    
    filterValue.innerHTML = '<option value="">Choose...</option>';
    filterValue.disabled = filterType === 'all';
    
    if (filterType === 'student') {
        students.forEach(student => {
            filterValue.innerHTML += `<option value="${student.id}">${student.name}</option>`;
        });
    } else if (filterType === 'class') {
        classes.forEach(cls => {
            filterValue.innerHTML += `<option value="${cls.id}">${cls.name}</option>`;
        });
    }
}

function applyAnalyticsFilter() {
    const filterType = document.getElementById('analyticsFilterType').value;
    const filterValue = document.getElementById('analyticsFilterValue').value;
    const fromDate = document.getElementById('analyticsFromDate').value;
    const toDate = document.getElementById('analyticsToDate').value;
    
    // Start with all results
    filteredResults = [...quizResults];
    
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
        const student = students.find(s => s.id === filterValue);
        if (student) {
            filteredResults = filteredResults.filter(result => 
                result.user && result.user.toLowerCase().trim() === student.name.toLowerCase().trim()
            );
        }
    } else if (filterType === 'class' && filterValue) {
        const classStudents = students.filter(s => s.classId === filterValue);
        const studentNames = classStudents.map(s => s.name.toLowerCase().trim());
        filteredResults = filteredResults.filter(result => 
            result.user && studentNames.includes(result.user.toLowerCase().trim())
        );
    }
    
    // Update analytics display
    updateFilteredAnalytics();
    generateInsights();
    renderFilteredAnalyticsTable();
    
    showNotification('Analytics filter applied successfully!', 'success');
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
        students.find(s => s.id === filterValue)?.name : null;
    const className = filterType === 'class' && filterValue ? 
        classes.find(c => c.id === filterValue)?.name : null;
    
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
    
    if (filteredResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b;">No results match the selected filters.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredResults.map(result => {
        const dateTime = result.date ? new Date(result.date).toLocaleString() : 'Unknown';
        const words = result.words || [];
        
        // Count only words that were correct on first attempt
        const firstTryCorrect = words.filter(w => {
            const attempts = w.attempts || [];
            return attempts.length > 0 && attempts[0] === w.word;
        }).length;
        
        const total = words.length;
        const score = total > 0 ? Math.round((firstTryCorrect / total) * 100) : 0;
        
        // Find word set
        const wordSetName = result.wordSetId ? 
            (wordSets.find(ws => ws.id === result.wordSetId)?.name || 'Unknown Set') : 
            'Legacy Set';
        
        // Format time display
        const totalTimeSeconds = result.totalTimeSeconds || 0;
        const minutes = Math.floor(totalTimeSeconds / 60);
        const seconds = totalTimeSeconds % 60;
        const timeDisplay = totalTimeSeconds > 0 ? 
            (minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`) : 
            'N/A';
        
        // Create detailed breakdown
        let detailsHtml = '<div style="font-size:0.85rem;">';
        
        // Section 1: Correct Words
        const correctWords = result.words.filter(w => w.correct && !w.hint);
        if (correctWords.length > 0) {
            detailsHtml += '<div style="margin-bottom:8px;">';
            detailsHtml += '<div style="font-weight:600;color:#059669;margin-bottom:4px;">✅ Correct (' + correctWords.length + '):</div>';
            detailsHtml += '<div style="color:#059669;">' + correctWords.map(w => w.word).join(', ') + '</div>';
            detailsHtml += '</div>';
        }
        
        // Section 2: Mistakes and Hints
        const mistakesAndHints = result.words.filter(w => !w.correct || w.hint);
        if (mistakesAndHints.length > 0) {
            detailsHtml += '<div>';
            detailsHtml += '<div style="font-weight:600;color:#dc2626;margin-bottom:4px;">❌ Needs Review (' + mistakesAndHints.length + '):</div>';
            
            mistakesAndHints.forEach(w => {
                detailsHtml += '<div style="margin-bottom:2px;">';
                
                if (!w.correct) {
                    // Show wrong spelling with correction
                    const wrongAttempt = w.attempts && w.attempts.length > 0 ? w.attempts[0] : 'no attempt';
                    detailsHtml += '<span style="color:#dc2626;text-decoration:line-through;">' + wrongAttempt + '</span>';
                    detailsHtml += ' → ';
                    detailsHtml += '<span style="color:#059669;font-weight:600;">' + w.word + '</span>';
                } else if (w.hint) {
                    // Show word with hints (correct but used hints)
                    let wordDisplay = w.word;
                    if (w.hintLetters && w.hintLetters.length > 0) {
                        wordDisplay = w.word.split('').map((letter, letterIndex) => {
                            if (w.hintLetters.includes(letterIndex)) {
                                return `<u>${letter}</u>`;
                            }
                            return letter;
                        }).join('');
                    } else {
                        wordDisplay = `<u>${w.word}</u>`;
                    }
                    detailsHtml += '<span style="color:#f59e0b;">' + wordDisplay + ' (hint)</span>';
                }
                
                detailsHtml += '</div>';
            });
            
            detailsHtml += '</div>';
        }
        
        detailsHtml += '</div>';
        
        // Create a simple summary for the cell content
        let summaryText = '';
        if (correctWords.length > 0) {
            summaryText += `✅ ${correctWords.length} correct`;
        }
        if (mistakesAndHints.length > 0) {
            if (summaryText) summaryText += ', ';
            summaryText += `❌ ${mistakesAndHints.length} need review`;
        }
        if (!summaryText) summaryText = 'No data';
        
        return `
            <tr>
                <td>${result.user || 'Unknown'}</td>
                <td>${dateTime}</td>
                <td>${wordSetName}</td>
                <td style="text-align: center;">${timeDisplay}</td>
                <td>
                    <span style="color: ${score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'}; font-weight: 600;">
                        ${score}% (${firstTryCorrect}/${total})
                    </span>
                </td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; cursor: help;" title="${detailsHtml.replace(/"/g, '&quot;')}">
                    ${summaryText}
                </td>
                <td>
                    <button class="btn-small btn-delete" onclick="deleteQuizResult('${result.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function exportAnalyticsData() {
    if (filteredResults.length === 0) {
        showNotification('No data to export', 'error');
        return;
    }
    
    // Create CSV content
    let csvContent = 'Student,Date,Time,Word Set,Duration,Score,Total Words,Correct Words,Hint Usage,Details\n';
    
    filteredResults.forEach(result => {
        const date = result.date ? new Date(result.date) : new Date();
        const words = result.words || [];
        const firstTryCorrect = words.filter(w => {
            const attempts = w.attempts || [];
            return attempts.length > 0 && attempts[0] === w.word;
        }).length;
        const score = words.length > 0 ? Math.round((firstTryCorrect / words.length) * 100) : 0;
        const hintsUsed = words.filter(w => w.hint).length;
        const wordSetName = result.wordSetId ? 
            (wordSets.find(ws => ws.id === result.wordSetId)?.name || 'Unknown Set') : 
            'Legacy Set';
        
        // Format duration
        const totalTimeSeconds = result.totalTimeSeconds || 0;
        const minutes = Math.floor(totalTimeSeconds / 60);
        const seconds = totalTimeSeconds % 60;
        const duration = totalTimeSeconds > 0 ? 
            (minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`) : 
            'N/A';
        
        const details = words.map(w => {
            const attempts = w.attempts || [];
            return `${w.word}:${attempts.join('/')}${w.hint ? '(H)' : ''}`;
        }).join(';');
        
        csvContent += `"${result.user || 'Unknown'}","${date.toLocaleDateString()}","${date.toLocaleTimeString()}","${wordSetName}","${duration}",${score},${words.length},${firstTryCorrect},${hintsUsed},"${details}"\n`;
    });
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spelling_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Analytics data exported successfully!', 'success');
}

// PDF Export Function
function exportPdfData() {
    if (filteredResults.length === 0) {
        showNotification('No data to export', 'error');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text('Spelling Practice Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);
    
    let yPos = 50;
    
    // Group by student
    const studentData = {};
    filteredResults.forEach(result => {
        const student = result.user || 'Unknown';
        if (!studentData[student]) studentData[student] = [];
        studentData[student].push(result);
    });
    
    Object.keys(studentData).forEach(studentName => {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.text(`Student: ${studentName}`, 20, yPos);
        yPos += 15;
        
        studentData[studentName].forEach(result => {
            const words = result.words || [];
            const correctWords = words.filter(w => w.correct && !w.hint);
            const mistakesAndHints = words.filter(w => !w.correct || w.hint);
            
            if (correctWords.length > 0 || mistakesAndHints.length > 0) {
                doc.setFontSize(10);
                doc.text(`Word Set: ${result.wordSetName || 'Unknown'} - ${new Date(result.date).toLocaleDateString()}`, 20, yPos);
                yPos += 8;
                
                // Show correct words
                if (correctWords.length > 0) {
                    doc.setFontSize(9);
                    doc.text(`✓ Words Spelled Correctly (${correctWords.length}):`, 20, yPos);
                    yPos += 6;
                    const correctWordsText = correctWords.map(w => w.word).join(', ');
                    const correctLines = doc.splitTextToSize(correctWordsText, 170);
                    doc.text(correctLines, 25, yPos);
                    yPos += correctLines.length * 5 + 3;
                }
                
                // Show mistakes and hints
                if (mistakesAndHints.length > 0) {
                    doc.setFontSize(9);
                    doc.text(`✗ Words Needing Practice (${mistakesAndHints.length}):`, 20, yPos);
                    yPos += 6;
                    
                    mistakesAndHints.forEach(w => {
                        let practiceText = '';
                        
                        if (!w.correct) {
                            // Show wrong spelling with correction
                            const wrongAttempt = w.attempts && w.attempts.length > 0 ? w.attempts[0] : 'no attempt';
                            practiceText = `• ${wrongAttempt} → ${w.word} (incorrect spelling)`;
                        } else if (w.hint) {
                            // Show word with hints
                            if (w.hintLetters && w.hintLetters.length > 0) {
                                const hintedLetters = w.hintLetters.map(pos => w.word[pos]).join(', ');
                                practiceText = `• ${w.word} (used hints for letters: ${hintedLetters})`;
                            } else {
                                practiceText = `• ${w.word} (used hints)`;
                            }
                        }
                        
                        const practiceLines = doc.splitTextToSize(practiceText, 170);
                        doc.text(practiceLines, 25, yPos);
                        yPos += practiceLines.length * 5;
                    });
                }
                
                yPos += 10;
            }
        });
    });
    
    doc.save(`spelling_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('PDF report generated!', 'success');
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
                        
                        const docRef = await window.db.collection('assignments').add(assignmentData);
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