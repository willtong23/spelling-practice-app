// Get DOM elements
const wordInput = document.getElementById('wordInput');
const addButton = document.getElementById('addButton');
const wordList = document.getElementById('wordList');
const saveButton = document.getElementById('saveButton');

let words = [];

// Function to update the word list display
function updateWordList() {
    wordList.innerHTML = '';
    words.forEach((word, index) => {
        const wordItem = document.createElement('div');
        wordItem.className = 'word-item';
        wordItem.innerHTML = `
            <span>${word}</span>
            <button class="delete-btn" data-index="${index}">Delete</button>
        `;
        wordList.appendChild(wordItem);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            words.splice(index, 1);
            updateWordList();
        });
    });
}

// Add word when Add button is clicked
addButton.addEventListener('click', () => {
    const word = wordInput.value.trim().toLowerCase();
    if (word && !words.includes(word)) {
        words.push(word);
        wordInput.value = '';
        updateWordList();
    }
});

// Add word when Enter key is pressed
wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addButton.click();
    }
});

// Save words to Firestore
saveButton.addEventListener('click', async () => {
    try {
        await db.collection('spelling').doc('wordlist').set({ words });
        alert('Word list saved to Firebase!');
    } catch (error) {
        alert('Error saving word list to Firebase.');
        console.error(error);
    }
});

// Load words from Firestore on page load
async function loadWords() {
    try {
        const doc = await db.collection('spelling').doc('wordlist').get();
        if (doc.exists) {
            words = doc.data().words || [];
            updateWordList();
        }
    } catch (error) {
        console.error('Error loading words from Firebase:', error);
    }
}

// Initial display of words
loadWords(); 