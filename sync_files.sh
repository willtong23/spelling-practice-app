#!/bin/bash

# Sync script to keep spelling apps directories synchronized
# This script ensures the GitHub repo has all functionality and syncs to local folder

echo "🔄 Starting file synchronization..."

# Define directories
GITHUB_DIR="/Users/willtong/spelling-practice-app"
LOCAL_DIR="/Users/willtong/spelling apps"

# Ensure we're in the GitHub directory
cd "$GITHUB_DIR"

echo "📝 Adding All Words button to HTML..."

# Fix the HTML file to include All Words button
cat > temp_index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spelling Practice</title>
    <link rel="stylesheet" href="styles.css">
    <!-- Firebase App (the core Firebase SDK) -->
    <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
    <!-- Add Firestore -->
    <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></script>
    <script>
      const firebaseConfig = {
        apiKey: "AIzaSyDP4A2AA9WocJtRTCF8i3wuN9DuZxLadDE",
        authDomain: "spelling-v001.firebaseapp.com",
        projectId: "spelling-v001",
        storageBucket: "spelling-v001.firebasestorage.app",
        messagingSenderId: "789364838972",
        appId: "1:789364838972:web:f571d4f5e385c4e0fce939"
      };
      firebase.initializeApp(firebaseConfig);
      window.db = firebase.firestore();
    </script>
</head>
<body>
    <div class="container">
        <h1>Spelling Practice</h1>
        <div class="practice-card">
            <div class="progress-bar-container">
                <div class="progress-bar" id="progressBar"></div>
            </div>
            <div class="progress-display">
                Word <span id="currentWordNumber">1</span> of <span id="totalWords">0</span>
            </div>
            <div class="word-display">
                <button id="speakButton" class="listen-btn" aria-label="Listen to the word">
                    <span class="icon">🔊</span> <span>Listen</span>
                </button>
                <button id="allWordsButton" class="all-words-btn" aria-label="Show all words">
                    <span class="icon">📝</span> <span>All Words</span>
                </button>
            </div>
            <div class="letter-hint" id="letterHint"></div>
            <form class="answer-section" autocomplete="off" onsubmit="return false;">
                <button id="checkButton" type="button">Check</button>
            </form>
            <div class="result-message" id="resultMessage"></div>
            <div class="navigation-buttons">
                <button id="prevButton" disabled>← Previous</button>
                <button id="nextButton" disabled>Next →</button>
            </div>
        </div>
        <!-- Modal for All Words and End-of-Quiz Feedback -->
        <div id="modalOverlay" class="modal-overlay" style="display:none;">
            <div class="modal-content" id="modalContent">
                <button id="closeModalBtn" class="close-modal-btn">×</button>
                <div id="modalBody"></div>
            </div>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>
EOF

# Replace the index.html file
mv temp_index.html index.html

echo "✅ HTML file updated with All Words button"

echo "📋 Copying files from GitHub repo to local directory..."

# Copy all files from GitHub repo to local directory
cp -f index.html "$LOCAL_DIR/"
cp -f script.js "$LOCAL_DIR/"
cp -f styles.css "$LOCAL_DIR/"
cp -f teacher.html "$LOCAL_DIR/"
cp -f teacher.js "$LOCAL_DIR/"

echo "✅ Files synchronized successfully!"
echo "📍 GitHub repo (master): $GITHUB_DIR"
echo "📍 Local directory: $LOCAL_DIR"
echo ""
echo "🌐 Local links:"
echo "   Student app: file://$GITHUB_DIR/index.html"
echo "   Teacher dashboard: file://$GITHUB_DIR/teacher.html"
echo ""
echo "💡 To run this sync script anytime: bash sync_files.sh" 