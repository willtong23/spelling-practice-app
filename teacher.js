// Teacher Dashboard Logic
// --- Manage Word List ---
const wordListTbody = document.getElementById('wordListTbody');
const newWordInput = document.getElementById('newWordInput');
const addWordBtn = document.getElementById('addWordBtn');

// For demo: use localStorage (replace with Firebase for real app)
function getWords() {
    return JSON.parse(localStorage.getItem('spellingWords') || '[]');
}
function setWords(words) {
    localStorage.setItem('spellingWords', JSON.stringify(words));
}

function renderWordList() {
    const words = getWords();
    wordListTbody.innerHTML = '';
    words.forEach((word, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${word}</td><td><button onclick="deleteWord(${idx})" style="color:#ef4444;background:none;border:none;cursor:pointer;font-weight:700;">Delete</button></td>`;
        wordListTbody.appendChild(tr);
    });
}

function addWord() {
    const word = newWordInput.value.trim().toLowerCase();
    if (word && !getWords().includes(word)) {
        const words = getWords();
        words.push(word);
        setWords(words);
        newWordInput.value = '';
        renderWordList();
    }
}

function deleteWord(idx) {
    const words = getWords();
    words.splice(idx, 1);
    setWords(words);
    renderWordList();
}

addWordBtn.addEventListener('click', addWord);
newWordInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') addWord();
});

renderWordList();

// --- User Data Placeholder ---
const userDataTbody = document.getElementById('userDataTbody');
const performanceSummary = document.getElementById('performanceSummary');

// For demo: show placeholder data
function renderUserData() {
    userDataTbody.innerHTML = '';
    // Example data (replace with real data from Firebase)
    const demoData = [
        { user: 'Alice', date: '2024-05-01', word: 'could', attempts: 2, result: '✅' },
        { user: 'Alice', date: '2024-05-01', word: 'should', attempts: 1, result: '✅' },
        { user: 'Bob', date: '2024-05-01', word: 'went', attempts: 3, result: '❌' },
        { user: 'Bob', date: '2024-05-01', word: 'want', attempts: 2, result: '✅' },
    ];
    demoData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.user}</td><td>${row.date}</td><td>${row.word}</td><td>${row.attempts}</td><td>${row.result}</td>`;
        userDataTbody.appendChild(tr);
    });
    // Example summary
    performanceSummary.innerHTML = `<b>Class Accuracy:</b> <span class='highlight'>75%</span> <br> <b>Most-missed word:</b> <span class='danger'>went</span>`;
}

renderUserData(); 