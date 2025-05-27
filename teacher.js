// Teacher Dashboard Logic
// --- Manage Word List ---
const wordListTbody = document.getElementById('wordListTbody');
const newWordInput = document.getElementById('newWordInput');
const addWordBtn = document.getElementById('addWordBtn');

let words = [];

async function loadWords() {
    try {
        const doc = await db.collection('spelling').doc('wordlist').get();
        if (doc.exists) {
            words = doc.data().words || [];
        } else {
            words = [];
        }
        renderWordList();
    } catch (e) {
        alert('Error loading words from Firebase.');
    }
}

async function saveWordsToFirebase() {
    try {
        await db.collection('spelling').doc('wordlist').set({ words });
        renderWordList();
    } catch (e) {
        alert('Error saving words to Firebase.');
    }
}

function renderWordList() {
    wordListTbody.innerHTML = '';
    words.forEach((word, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${word}</td><td><button onclick="deleteWord(${idx})" style="color:#ef4444;background:none;border:none;cursor:pointer;font-weight:700;">Delete</button></td>`;
        wordListTbody.appendChild(tr);
    });
}

function addWord() {
    const word = newWordInput.value.trim().toLowerCase();
    if (word && !words.includes(word)) {
        words.push(word);
        newWordInput.value = '';
        saveWordsToFirebase();
    }
}

function deleteWord(idx) {
    words.splice(idx, 1);
    saveWordsToFirebase();
}

addWordBtn.addEventListener('click', addWord);
newWordInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') addWord();
});

loadWords();

// --- User Data Placeholder ---
const userDataTbody = document.getElementById('userDataTbody');
const performanceSummary = document.getElementById('performanceSummary');

function renderUserData() {
    userDataTbody.innerHTML = `<tr><td colspan='5' style='text-align:center;color:#888;'>No user data yet.</td></tr>`;
    performanceSummary.innerHTML = `<em>No user data yet. This will show class performance, most-missed words, and trends.</em>`;
}
renderUserData(); 