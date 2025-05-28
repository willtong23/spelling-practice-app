// Simple Teacher Dashboard - Working Version
let wordSets = [];
let students = [];
let classes = [];
let assignments = [];
let quizResults = [];

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Teacher dashboard loading...');
    
    // Show password modal first
    showTeacherPasswordModal();
});

// Password modal functionality
function showTeacherPasswordModal() {
    const modal = document.createElement('div');
    modal.id = 'teacherPasswordModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h2 style="margin: 0 0 20px 0; text-align: center;">Teacher Access</h2>
            <p style="margin: 0 0 20px 0; text-align: center; color: #666;">Enter password to access teacher dashboard</p>
            <input type="password" id="teacherPasswordInput" placeholder="Enter password" 
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; margin-bottom: 20px; font-size: 16px;">
            <button onclick="checkTeacherPassword()" 
                    style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer;">
                Access Dashboard
            </button>
            <div id="passwordError" style="color: red; margin-top: 10px; text-align: center; display: none;"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on password input
    setTimeout(() => {
        document.getElementById('teacherPasswordInput').focus();
    }, 100);
    
    // Handle Enter key
    document.getElementById('teacherPasswordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkTeacherPassword();
        }
    });
}

function checkTeacherPassword() {
    const password = document.getElementById('teacherPasswordInput').value;
    const errorDiv = document.getElementById('passwordError');
    
    if (password === '9739') {
        // Correct password
        document.getElementById('teacherPasswordModal').remove();
        initializeDashboard();
    } else {
        // Wrong password
        errorDiv.textContent = 'Incorrect password. Please try again.';
        errorDiv.style.display = 'block';
        document.getElementById('teacherPasswordInput').value = '';
        document.getElementById('teacherPasswordInput').focus();
    }
}

// Initialize dashboard after password verification
async function initializeDashboard() {
    console.log('Initializing teacher dashboard...');
    
    try {
        // Test Firebase connection
        await testFirebaseConnection();
        
        // Load all data
        await loadAllData();
        
        // Initialize tabs
        initializeTabs();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('Teacher dashboard initialized successfully');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('Error connecting to database. Please refresh and try again.');
    }
}

// Test Firebase connection
async function testFirebaseConnection() {
    try {
        console.log('Testing Firebase connection...');
        const testDoc = await window.db.collection('test').limit(1).get();
        console.log('Firebase connection successful');
        return true;
    } catch (error) {
        console.error('Firebase connection failed:', error);
        throw error;
    }
}

// Load all data from Firebase
async function loadAllData() {
    console.log('Loading data from Firebase...');
    
    try {
        await Promise.all([
            loadWordSets(),
            loadStudents(),
            loadClasses(),
            loadAssignments(),
            loadQuizResults()
        ]);
        
        // Render all sections
        renderWordSets();
        renderStudentsAndClasses();
        renderAssignments();
        renderAnalytics();
        
        console.log('All data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// Tab functionality
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    console.log('Initializing tabs...', 'Found', tabBtns.length, 'tab buttons');
    
    if (tabBtns.length === 0) {
        console.error('No tab buttons found!');
        return;
    }
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
    // Activate first tab by default
    if (tabBtns.length > 0) {
        tabBtns[0].click();
    }
}

// Load functions
async function loadWordSets() {
    try {
        const snapshot = await window.db.collection('wordSets').get();
        wordSets = [];
        snapshot.forEach(doc => {
            wordSets.push({ id: doc.id, ...doc.data() });
        });
        console.log('Loaded', wordSets.length, 'word sets');
    } catch (error) {
        console.error('Error loading word sets:', error);
        wordSets = [];
    }
}

async function loadStudents() {
    try {
        const snapshot = await window.db.collection('students').get();
        students = [];
        snapshot.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });
        console.log('Loaded', students.length, 'students');
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
        console.log('Loaded', classes.length, 'classes');
    } catch (error) {
        console.error('Error loading classes:', error);
        classes = [];
    }
}

async function loadAssignments() {
    try {
        const snapshot = await window.db.collection('assignments').get();
        assignments = [];
        snapshot.forEach(doc => {
            assignments.push({ id: doc.id, ...doc.data() });
        });
        console.log('Loaded', assignments.length, 'assignments');
    } catch (error) {
        console.error('Error loading assignments:', error);
        assignments = [];
    }
}

async function loadQuizResults() {
    try {
        const snapshot = await window.db.collection('results').orderBy('date', 'desc').get();
        quizResults = [];
        snapshot.forEach(doc => {
            quizResults.push({ id: doc.id, ...doc.data() });
        });
        console.log('Loaded', quizResults.length, 'quiz results');
    } catch (error) {
        console.error('Error loading quiz results:', error);
        quizResults = [];
    }
}

// Render functions
function renderWordSets() {
    const container = document.getElementById('wordSetsContainer');
    if (!container) return;
    
    if (wordSets.length === 0) {
        container.innerHTML = '<p>No word sets found. Create one to get started!</p>';
        return;
    }
    
    container.innerHTML = wordSets.map(wordSet => `
        <div class="word-set-card">
            <h3>${wordSet.name}</h3>
            <p>${wordSet.description || 'No description'}</p>
            <p><strong>Difficulty:</strong> ${wordSet.difficulty || 'Unknown'}</p>
            <p><strong>Words:</strong> ${wordSet.words ? wordSet.words.length : 0}</p>
            <div class="card-actions">
                <button class="btn-small btn-primary" onclick="editWordSet('${wordSet.id}')">Edit</button>
                <button class="btn-small btn-delete" onclick="deleteWordSet('${wordSet.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderStudentsAndClasses() {
    renderClasses();
    renderStudents();
}

function renderClasses() {
    const container = document.getElementById('classesContainer');
    if (!container) return;
    
    if (classes.length === 0) {
        container.innerHTML = '<p>No classes found. Create one to organize students!</p>';
        return;
    }
    
    container.innerHTML = classes.map(cls => {
        const studentsInClass = students.filter(s => s.classId === cls.id);
        return `
            <div class="class-card">
                <h3>${cls.name}</h3>
                <p>${cls.description || 'No description'}</p>
                <p><strong>Students:</strong> ${studentsInClass.length}</p>
                <div class="card-actions">
                    <button class="btn-small btn-primary" onclick="editClass('${cls.id}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteClass('${cls.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudents() {
    const container = document.getElementById('studentsContainer');
    if (!container) return;
    
    if (students.length === 0) {
        container.innerHTML = '<p>No students found. Add students to get started!</p>';
        return;
    }
    
    container.innerHTML = students.map(student => {
        const studentClass = classes.find(c => c.id === student.classId);
        return `
            <div class="student-card">
                <h3>${student.name}</h3>
                <p><strong>Class:</strong> ${studentClass ? studentClass.name : 'No class assigned'}</p>
                <div class="card-actions">
                    <button class="btn-small btn-primary" onclick="editStudent('${student.id}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteStudent('${student.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderAssignments() {
    const tbody = document.getElementById('assignmentsTableBody');
    if (!tbody) return;
    
    if (assignments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No assignments found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = assignments.map(assignment => {
        const student = students.find(s => s.id === assignment.studentId);
        const wordSet = wordSets.find(ws => ws.id === assignment.wordSetId);
        const assignedDate = assignment.assignedAt ? new Date(assignment.assignedAt.toDate()).toLocaleDateString() : 'Unknown';
        
        return `
            <tr>
                <td>${student ? student.name : 'Unknown Student'}</td>
                <td>${wordSet ? wordSet.name : 'Unknown Set'}</td>
                <td>${assignedDate}</td>
                <td>Pending</td>
                <td>
                    <button class="btn-small btn-delete" onclick="deleteAssignment('${assignment.id}')">Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderAnalytics() {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;
    
    if (quizResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No quiz results found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = quizResults.map(result => {
        const dateTime = result.date ? new Date(result.date).toLocaleString() : 'Unknown';
        return `
            <tr>
                <td>${result.user || 'Unknown'}</td>
                <td>${result.wordSetName || 'Unknown Set'}</td>
                <td>${dateTime}</td>
                <td>
                    <button class="btn-small btn-delete" onclick="deleteQuizResult('${result.id}')">Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Event listeners
function setupEventListeners() {
    // Word Sets
    document.getElementById('createWordSetBtn')?.addEventListener('click', showCreateWordSetModal);
    document.getElementById('createClassBtn')?.addEventListener('click', showCreateClassModal);
    document.getElementById('addStudentBtn')?.addEventListener('click', showAddStudentModal);
}

// Modal functions (simplified)
function showCreateWordSetModal() {
    alert('Create Word Set functionality will be implemented soon!');
}

function showCreateClassModal() {
    alert('Create Class functionality will be implemented soon!');
}

function showAddStudentModal() {
    alert('Add Student functionality will be implemented soon!');
}

// Delete functions (simplified)
function deleteWordSet(id) {
    if (confirm('Delete this word set?')) {
        alert('Delete functionality will be implemented soon!');
    }
}

function deleteClass(id) {
    if (confirm('Delete this class?')) {
        alert('Delete functionality will be implemented soon!');
    }
}

function deleteStudent(id) {
    if (confirm('Delete this student?')) {
        alert('Delete functionality will be implemented soon!');
    }
}

function deleteAssignment(id) {
    if (confirm('Delete this assignment?')) {
        alert('Delete functionality will be implemented soon!');
    }
}

function deleteQuizResult(id) {
    if (confirm('Delete this quiz result?')) {
        alert('Delete functionality will be implemented soon!');
    }
}

// Edit functions (simplified)
function editWordSet(id) {
    alert('Edit Word Set functionality will be implemented soon!');
}

function editClass(id) {
    alert('Edit Class functionality will be implemented soon!');
}

function editStudent(id) {
    alert('Edit Student functionality will be implemented soon!');
}

console.log('Teacher dashboard script loaded'); 