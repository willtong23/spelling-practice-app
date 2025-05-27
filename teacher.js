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
    let allRounds = [];
    let docIds = [];
    try {
        const snapshot = await db.collection('results').orderBy('date', 'desc').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const user = data.user || 'unknown';
            const dateTime = data.date ? new Date(data.date).toLocaleString() : '';
            const words = data.words || [];
            const total = words.length;
            const correct = words.filter(w => w.correct).length;
            const wordDetails = words.map(w => {
                let wrongs = (w.attempts || []).filter(a => a !== w.word);
                let wrongStr = wrongs.length ? ` <span style='color:#ef4444;'>[${wrongs.join(', ')}]</span>` : '';
                let hintStr = w.hint ? ` <span style='color:#fbbf24;font-weight:700;'>H</span>` : '';
                return `<b>${w.word}</b>${wrongStr}${hintStr}`;
            }).join('<br>');
            allRounds.push({
                user,
                dateTime,
                correct,
                total,
                wordDetails,
                id: doc.id
            });
            docIds.push(doc.id);
        });
    } catch (e) {
        userDataTbody.innerHTML = `<tr><td colspan='5' style='text-align:center;color:#888;'>Error loading user data.</td></tr>`;
        performanceSummary.innerHTML = `<em>Error loading user data.</em>`;
        return;
    }
    if (allRounds.length === 0) {
        userDataTbody.innerHTML = `<tr><td colspan='5' style='text-align:center;color:#888;'>No user data yet.</td></tr>`;
        performanceSummary.innerHTML = `<em>No user data yet. This will show class performance, most-missed words, and trends.</em>`;
        return;
    }
    allRounds.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.user}</td><td>${row.dateTime}</td><td>${row.correct} / ${row.total}</td><td>${row.wordDetails}</td><td><button class='delete-result-btn' data-id='${row.id}' style='color:#ef4444;background:none;border:none;cursor:pointer;font-weight:700;'>Delete</button></td>`;
        userDataTbody.appendChild(tr);
    });
    // Attach delete event listeners
    document.querySelectorAll('.delete-result-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            if (confirm('Delete this quiz round?')) {
                await db.collection('results').doc(id).delete();
                renderUserData();
            }
        });
    });
    // Example summary (can be improved)
    const totalWords = allRounds.reduce((sum, r) => sum + r.total, 0);
    const totalCorrect = allRounds.reduce((sum, r) => sum + r.correct, 0);
    const accuracy = totalWords ? Math.round((totalCorrect / totalWords) * 100) : 0;
    // Find most-missed word
    const wordMissCounts = {};
    allRounds.forEach(r => {
        r.wordDetails.replace(/<b>(.*?)<\/b>(.*?)<br>?/g, (m, word, rest) => {
            if (rest.includes("color:#ef4444")) {
                wordMissCounts[word] = (wordMissCounts[word] || 0) + 1;
            }
        });
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
    // Delete all data button
    const deleteAllBtn = document.getElementById('deleteAllResultsBtn');
    if (deleteAllBtn) {
        deleteAllBtn.onclick = async function() {
            if (confirm('Delete ALL user data? This cannot be undone!')) {
                // Batch delete all docs
                for (const id of docIds) {
                    await db.collection('results').doc(id).delete();
                }
                renderUserData();
            }
        };
    }
}
renderUserData(); 