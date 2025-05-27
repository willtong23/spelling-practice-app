// Enhanced Teacher Dashboard Logic
// Global variables
let wordSets = [];
let students = [];
let classes = [];
let assignments = [];
let quizResults = [];

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadAllData();
    setupEventListeners();
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

// Load all data from Firebase
async function loadAllData() {
    try {
        await Promise.all([
            loadWordSets(),
            loadStudents(),
            loadClasses(),
            loadAssignments(),
            loadQuizResults()
        ]);
        
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
        console.error('Error loading data:', error);
        showNotification('Error loading data from database', 'error');
    }
}

// Word Sets Management
async function loadWordSets() {
    try {
        const snapshot = await db.collection('wordSets').get();
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
        const doc = await db.collection('spelling').doc('wordlist').get();
        let words = ['want', 'went', 'what', 'should', 'could']; // default fallback
        
        if (doc.exists && doc.data().words) {
            words = doc.data().words;
        }
        
        const defaultSet = {
            name: 'Basic Words',
            description: 'Default word set for spelling practice',
            words: words,
            difficulty: 'beginner',
            createdAt: new Date(),
            createdBy: 'system'
        };
        
        const docRef = await db.collection('wordSets').add(defaultSet);
        wordSets.push({ id: docRef.id, ...defaultSet });
        
        // Update the main wordlist to point to this set
        await db.collection('spelling').doc('wordlist').set({ 
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
                ${set.words.slice(0, 8).map(word => `<span class="word-tag">${word}</span>`).join('')}
                ${set.words.length > 8 ? `<span class="word-tag">+${set.words.length - 8} more</span>` : ''}
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
        const snapshot = await db.collection('students').get();
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
        const snapshot = await db.collection('classes').get();
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
    const container = document.getElementById('classesList');
    if (!container) return;
    
    if (classes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b;">No classes created yet.</p>';
        return;
    }
    
    container.innerHTML = classes.map(cls => {
        const studentCount = students.filter(s => s.classId === cls.id).length;
        return `
            <div class="class-item">
                <div class="class-info">
                    <div class="class-name">${cls.name}</div>
                    <div class="class-count">${studentCount} students</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-small btn-edit" onclick="editClass('${cls.id}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteClass('${cls.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudents() {
    const container = document.getElementById('studentsList');
    if (!container) return;
    
    if (students.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b;">No students added yet.</p>';
        return;
    }
    
    container.innerHTML = students.map(student => {
        const studentClass = classes.find(c => c.id === student.classId);
        const assignment = assignments.find(a => a.studentId === student.id);
        const assignedSet = assignment ? wordSets.find(ws => ws.id === assignment.wordSetId) : null;
        
        return `
            <div class="student-item">
                <div class="student-info">
                    <div class="student-name">${student.name}</div>
                    <div class="student-class">Class: ${studentClass ? studentClass.name : 'No class assigned'}</div>
                    ${assignedSet ? `<div class="assigned-set">Assigned: ${assignedSet.name}</div>` : ''}
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-small btn-edit" onclick="editStudent('${student.id}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteStudent('${student.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Assignments Management
async function loadAssignments() {
    try {
        const snapshot = await db.collection('assignments').get();
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
        const snapshot = await db.collection('results').orderBy('date', 'desc').get();
        quizResults = [];
        snapshot.forEach(doc => {
            quizResults.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading quiz results:', error);
        quizResults = [];
    }
}

function renderAnalytics() {
    updateAnalyticsStats();
    renderAnalyticsTable();
}

function updateAnalyticsStats() {
    // Update stat cards
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalWordSets').textContent = wordSets.length;
    document.getElementById('totalQuizzes').textContent = quizResults.length;
    
    // Calculate average score
    if (quizResults.length > 0) {
        const totalScore = quizResults.reduce((sum, result) => {
            const correct = result.words ? result.words.filter(w => w.correct).length : 0;
            const total = result.words ? result.words.length : 0;
            return sum + (total > 0 ? (correct / total) * 100 : 0);
        }, 0);
        const averageScore = Math.round(totalScore / quizResults.length);
        document.getElementById('averageScore').textContent = averageScore + '%';
    } else {
        document.getElementById('averageScore').textContent = '0%';
    }
}

function renderAnalyticsTable() {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;
    
    if (quizResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">No quiz results yet.</td></tr>';
        return;
    }
    
    tbody.innerHTML = quizResults.map(result => {
        const dateTime = result.date ? new Date(result.date).toLocaleString() : 'Unknown';
        const words = result.words || [];
        const correct = words.filter(w => w.correct).length;
        const total = words.length;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        // Find word set (this might need to be enhanced based on how you track which set was used)
        const wordSetName = result.wordSetId ? 
            (wordSets.find(ws => ws.id === result.wordSetId)?.name || 'Unknown Set') : 
            'Legacy Set';
        
        const wordDetails = words.map(w => {
            let wrongs = (w.attempts || []).filter(a => a !== w.word);
            let wrongStr = wrongs.length ? ` [${wrongs.join(', ')}]` : '';
            let hintStr = w.hint ? ' H' : '';
            return `${w.word}${wrongStr}${hintStr}`;
        }).join(', ');
        
        return `
            <tr>
                <td>${result.user || 'Unknown'}</td>
                <td>${dateTime}</td>
                <td>${wordSetName}</td>
                <td>
                    <span style="color: ${score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'}; font-weight: 600;">
                        ${score}% (${correct}/${total})
                    </span>
                </td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${wordDetails}">
                    ${wordDetails}
                </td>
                <td>
                    <button class="btn-small btn-delete" onclick="deleteQuizResult('${result.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
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
    
    // Modal
    closeModalBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
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
        
        const docRef = await db.collection('wordSets').add(wordSet);
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
        
        await db.collection('wordSets').doc(setId).update(updates);
        
        // Update local array
        const index = wordSets.findIndex(ws => ws.id === setId);
        if (index !== -1) {
            wordSets[index] = { ...wordSets[index], ...updates };
        }
        
        // If this is the active set, update the main wordlist
        const spellingDoc = await db.collection('spelling').doc('wordlist').get();
        if (spellingDoc.exists && spellingDoc.data().activeSetId === setId) {
            await db.collection('spelling').doc('wordlist').update({ words });
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
        await db.collection('wordSets').doc(setId).delete();
        wordSets = wordSets.filter(ws => ws.id !== setId);
        
        // Remove any assignments using this word set
        const assignmentsToDelete = assignments.filter(a => a.wordSetId === setId);
        for (const assignment of assignmentsToDelete) {
            await db.collection('assignments').doc(assignment.id).delete();
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
        
        const docRef = await db.collection('classes').add(classData);
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
        
        await db.collection('classes').doc(classId).update(updates);
        
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
        
        const docRef = await db.collection('students').add(studentData);
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
        
        await db.collection('students').doc(studentId).update(updates);
        
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
        await db.collection('assignments').doc(existingAssignment.id).delete();
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
        
        const docRef = await db.collection('assignments').add(assignmentData);
        assignments.push({ id: docRef.id, ...assignmentData });
        
        // Update the main wordlist for this student (for backward compatibility)
        const wordSet = wordSets.find(ws => ws.id === wordSetId);
        if (wordSet) {
            await db.collection('spelling').doc('wordlist').set({ 
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
    
    try {
        // Create assignments for all students in the class
        for (const student of classStudents) {
            // Check if assignment already exists
            const existingAssignment = assignments.find(a => a.studentId === student.id);
            if (existingAssignment) {
                await db.collection('assignments').doc(existingAssignment.id).delete();
                assignments = assignments.filter(a => a.id !== existingAssignment.id);
            }
            
            const assignmentData = {
                studentId: student.id,
                wordSetId,
                assignedAt: new Date(),
                assignedBy: 'teacher',
                type: 'class',
                classId
            };
            
            const docRef = await db.collection('assignments').add(assignmentData);
            assignments.push({ id: docRef.id, ...assignmentData });
        }
        
        // Update the main wordlist (for backward compatibility)
        const wordSet = wordSets.find(ws => ws.id === wordSetId);
        if (wordSet) {
            await db.collection('spelling').doc('wordlist').set({ 
                words: wordSet.words,
                activeSetId: wordSetId 
            });
        }
        
        renderAssignments();
        renderStudentsAndClasses();
        showNotification(`Assigned word set to ${classStudents.length} students in the class!`, 'success');
        
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
        await db.collection('classes').doc(classId).delete();
        classes = classes.filter(c => c.id !== classId);
        
        // Update students to remove class assignment
        const classStudents = students.filter(s => s.classId === classId);
        for (const student of classStudents) {
            await db.collection('students').doc(student.id).update({ classId: null });
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
        await db.collection('students').doc(studentId).delete();
        students = students.filter(s => s.id !== studentId);
        
        // Remove any assignments for this student
        const studentAssignments = assignments.filter(a => a.studentId === studentId);
        for (const assignment of studentAssignments) {
            await db.collection('assignments').doc(assignment.id).delete();
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
        await db.collection('assignments').doc(assignmentId).delete();
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
        await db.collection('results').doc(resultId).delete();
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
            batch.delete(db.collection('results').doc(result.id));
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
                await db.collection('wordSets').doc(set.id).delete();
                
                // Remove any assignments using this word set
                const assignmentsToDelete = assignments.filter(a => a.wordSetId === set.id);
                for (const assignment of assignmentsToDelete) {
                    await db.collection('assignments').doc(assignment.id).delete();
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