#!/usr/bin/env python3
import re

# Read the current HTML file
with open('index.html', 'r') as f:
    content = f.read()

# Define the new word-display section with both buttons
new_section = '''            <div class="word-display">
                <button id="speakButton" class="listen-btn" aria-label="Listen to the word">
                    <span class="icon">🔊</span> <span>Listen</span>
                </button>
                <button id="allWordsButton" class="all-words-btn" aria-label="Show all words">
                    <span class="icon">📝</span> <span>All Words</span>
                </button>
            </div>'''

# Replace the word-display section
pattern = r'            <div class="word-display">.*?            </div>'
content = re.sub(pattern, new_section, content, flags=re.DOTALL)

# Write the updated content back
with open('index.html', 'w') as f:
    f.write(content)

print('All Words button added successfully!') 