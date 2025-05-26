// Get DOM elements
const wordInput = document.getElementById('wordInput');
const addButton = document.getElementById('addButton');
const wordList = document.getElementById('wordList');
const saveButton = document.getElementById('saveButton');

// Load saved words from localStorage
let words = JSON.parse(localStorage.getItem('spellingWords')) || [];

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

// Save words to localStorage and GitHub
saveButton.addEventListener('click', async () => {
    // Save to localStorage
    localStorage.setItem('spellingWords', JSON.stringify(words));
    
    // Save to words.json
    try {
        const response = await fetch('words.json', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ words: words })
        });
        
        if (response.ok) {
            alert('Word list saved successfully!');
        } else {
            alert('Error saving word list. Please try again.');
        }
    } catch (error) {
        alert('Error saving word list. Please try again.');
        console.error('Error:', error);
    }
});

// Initial display of words
updateWordList(); 