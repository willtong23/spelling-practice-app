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

async function renderUserData() {
    userDataTbody.innerHTML = '';
    let allResults = [];
    try {
        const snapshot = await db.collection('results').orderBy('date', 'desc').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const user = data.user || 'unknown';
            const date = data.date ? data.date.split('T')[0] : '';
            (data.words || []).forEach(wordObj => {
                allResults.push({
                    user,
                    date,
                    word: wordObj.word,
                    attempts: (wordObj.attempts || []).length,
                    result: wordObj.correct ? '✅' : '❌',
                    hint: wordObj.hint ? 'H' : ''
                });
            });
        });
    } catch (e) {
        userDataTbody.innerHTML = `<tr><td colspan='6' style='text-align:center;color:#888;'>Error loading user data.</td></tr>`;
        performanceSummary.innerHTML = `<em>Error loading user data.</em>`;
        return;
    }
    if (allResults.length === 0) {
        userDataTbody.innerHTML = `<tr><td colspan='6' style='text-align:center;color:#888;'>No user data yet.</td></tr>`;
        performanceSummary.innerHTML = `<em>No user data yet. This will show class performance, most-missed words, and trends.</em>`;
        return;
    }
    allResults.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.user}</td><td>${row.date}</td><td>${row.word}</td><td>${row.attempts}</td><td>${row.result} ${row.hint ? `<span style='color:#fbbf24;font-weight:700;'>H</span>` : ''}</td>`;
        userDataTbody.appendChild(tr);
    });
    // Example summary (can be improved)
    const total = allResults.length;
    const correct = allResults.filter(r => r.result === '✅').length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const wordMissCounts = {};
    allResults.forEach(r => {
        if (r.result === '❌') wordMissCounts[r.word] = (wordMissCounts[r.word] || 0) + 1;
    });
    let mostMissed = '-';
    let maxMiss = 0;
    for (const w in wordMissCounts) {
        if (wordMissCounts[w] > maxMiss) {
            maxMiss = wordMissCounts[w];
            mostMissed = w;
        }
    }
    performanceSummary.innerHTML = `<b>Class Accuracy:</b> <span class='highlight'>${accuracy}%</span> <br> <b>Most-missed word:</b> <span class='danger'>${mostMissed}</span>`;
}
renderUserData(); 