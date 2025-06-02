// ===== SENTENCES FUNCTIONALITY =====
let sentences = [];
let filteredSentences = [];
let sentenceStudents = [];
let sentenceWordSets = [];

// Load sentences from Firebase
async function loadSentences() {
  console.log("Loading sentences...");
  try {
    let snapshot;
    
    // Try multiple approaches to load sentences
    try {
      // First try with createdAt ordering
      snapshot = await window.db.collection('sentences').orderBy('createdAt', 'desc').get();
      console.log("Loaded with createdAt ordering");
    } catch (e) {
      console.log("createdAt ordering failed, trying timestamp...");
      try {
        // Try with timestamp ordering
        snapshot = await window.db.collection('sentences').orderBy('timestamp', 'desc').get();
        console.log("Loaded with timestamp ordering");
      } catch (e2) {
        console.log("timestamp ordering failed, trying without ordering...");
        // Load without ordering as fallback
        snapshot = await window.db.collection('sentences').get();
        console.log("Loaded without ordering");
      }
    }
    
    sentences = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log("Raw sentence data:", data);
      
      // Normalize the date field - handle multiple formats
      let normalizedDate = null;
      if (data.createdAt) {
        if (typeof data.createdAt === 'string') {
          normalizedDate = data.createdAt;
        } else if (data.createdAt.toDate) {
          normalizedDate = data.createdAt.toDate().toISOString();
        } else if (data.createdAt.seconds) {
          normalizedDate = new Date(data.createdAt.seconds * 1000).toISOString();
        }
      } else if (data.timestamp) {
        if (typeof data.timestamp === 'string') {
          normalizedDate = data.timestamp;
        } else if (data.timestamp.toDate) {
          normalizedDate = data.timestamp.toDate().toISOString();
        } else if (data.timestamp.seconds) {
          normalizedDate = new Date(data.timestamp.seconds * 1000).toISOString();
        }
      } else if (data.date) {
        normalizedDate = typeof data.date === 'string' ? data.date : new Date(data.date).toISOString();
      }
      
      // Create normalized sentence object
      const sentence = {
        id: doc.id,
        studentName: data.studentName || data.student || data.userName || data.user || 'Unknown Student',
        targetWord: data.targetWord || data.word || data.target || 'Unknown Word',
        sentence: data.sentence || data.text || data.content || 'No sentence',
        wordSetName: data.wordSetName || data.wordSet || data.setName || 'Unknown Set',
        wordSetId: data.wordSetId || data.wordSetID || data.setId || null,
        createdAt: normalizedDate || new Date().toISOString(),
        // Keep original data for reference
        _originalData: data
      };
      
      sentences.push(sentence);
    });
    
    // Sort by date if we couldn't order in the query
    sentences.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // desc order (newest first)
    });
    
    console.log(`✅ Successfully loaded ${sentences.length} sentences`);
    console.log("Sample sentence:", sentences[0]);
    
    filteredSentences = [...sentences];
    populateFilterOptions();
    updateSentencesStats();
    return sentences;
    
  } catch (error) {
    console.error("❌ Error loading sentences:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      name: error.name
    });
    
    // Show user-friendly error message
    if (typeof showNotification === 'function') {
      showNotification("Error loading sentences from database", "error");
    }
    
    // Return empty array as fallback
    sentences = [];
    filteredSentences = [];
    return [];
  }
}

// Populate filter dropdown options
function populateFilterOptions() {
  console.log("Populating filter options...");
  
  // Get unique students and word sets
  const uniqueStudents = [...new Set(sentences.map(s => s.studentName).filter(name => name))].sort();
  const uniqueWordSets = [...new Set(sentences.map(s => s.wordSetName).filter(name => name && name !== 'Unknown Set'))].sort();
  
  // Update filter dropdowns
  const filterValue = document.getElementById('sentencesFilterValue');
  const filterType = document.getElementById('sentencesFilterType');
  
  if (filterValue && filterType) {
    // Clear existing options
    filterValue.innerHTML = '<option value="">Choose...</option>';
    
    // Add options based on current filter type
    filterType.addEventListener('change', function() {
      filterValue.innerHTML = '<option value="">Choose...</option>';
      filterValue.disabled = this.value === 'all';
      
      if (this.value === 'student') {
        uniqueStudents.forEach(student => {
          const option = document.createElement('option');
          option.value = student;
          option.textContent = student;
          filterValue.appendChild(option);
        });
      } else if (this.value === 'wordset') {
        uniqueWordSets.forEach(wordSet => {
          const option = document.createElement('option');
          option.value = wordSet;
          option.textContent = wordSet;
          filterValue.appendChild(option);
        });
      }
    });
  }
}

// Apply filters and sorting
function applySentencesFilter() {
  console.log("Applying sentences filter...");
  
  const filterType = document.getElementById('sentencesFilterType')?.value || 'all';
  const filterValue = document.getElementById('sentencesFilterValue')?.value || '';
  const fromDate = document.getElementById('sentencesFromDate')?.value;
  const toDate = document.getElementById('sentencesToDate')?.value;
  const sortBy = document.getElementById('sentencesSortBy')?.value || 'date_desc';
  
  // Start with all sentences
  filteredSentences = [...sentences];
  
  // Apply filters
  if (filterType === 'student' && filterValue) {
    filteredSentences = filteredSentences.filter(s => s.studentName === filterValue);
  } else if (filterType === 'wordset' && filterValue) {
    filteredSentences = filteredSentences.filter(s => s.wordSetName === filterValue);
  }
  
  // Date filtering
  if (fromDate) {
    const fromDateTime = new Date(fromDate).getTime();
    filteredSentences = filteredSentences.filter(s => {
      const sentenceDate = s.createdAt ? new Date(s.createdAt).getTime() : 0;
      return sentenceDate >= fromDateTime;
    });
  }
  
  if (toDate) {
    const toDateTime = new Date(toDate + 'T23:59:59').getTime();
    filteredSentences = filteredSentences.filter(s => {
      const sentenceDate = s.createdAt ? new Date(s.createdAt).getTime() : 0;
      return sentenceDate <= toDateTime;
    });
  }
  
  // Apply sorting
  applySentencesSorting(sortBy);
  
  // Update display
  renderSentencesTable();
  updateSentencesStats();
  updateSentenceInsights();
}

// Apply sorting to filtered sentences
function applySentencesSorting(sortBy) {
  switch (sortBy) {
    case 'date_asc':
      filteredSentences.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      break;
    case 'date_desc':
      filteredSentences.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case 'student_asc':
      filteredSentences.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
      break;
    case 'student_desc':
      filteredSentences.sort((a, b) => (b.studentName || '').localeCompare(a.studentName || ''));
      break;
    case 'word_asc':
      filteredSentences.sort((a, b) => (a.targetWord || '').localeCompare(b.targetWord || ''));
      break;
    case 'word_desc':
      filteredSentences.sort((a, b) => (b.targetWord || '').localeCompare(a.targetWord || ''));
      break;
    case 'wordset_asc':
      filteredSentences.sort((a, b) => (a.wordSetName || '').localeCompare(b.wordSetName || ''));
      break;
    case 'wordset_desc':
      filteredSentences.sort((a, b) => (b.wordSetName || '').localeCompare(a.wordSetName || ''));
      break;
  }
}

// Render sentences in table format
function renderSentencesTable() {
  console.log("Rendering sentences table...");
  const tableBody = document.getElementById('sentencesTableBody');
  
  if (!tableBody) {
    console.error("Sentences table body element not found");
    return;
  }

  if (filteredSentences.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
          <div style="font-size: 2rem; margin-bottom: 16px;">📝</div>
          <strong>No sentences found</strong><br>
          <span style="font-size: 0.9rem;">Try adjusting your filters or encourage students to practice sentences.</span>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  filteredSentences.forEach(sentence => {
    const date = sentence.createdAt ? new Date(sentence.createdAt).toLocaleDateString() : 'Unknown date';
    const time = sentence.createdAt ? new Date(sentence.createdAt).toLocaleTimeString() : '';
    const wordSet = sentence.wordSetName || 'Unknown Set';
    
    html += `
      <tr>
        <td><strong>${sentence.studentName || 'Unknown'}</strong></td>
        <td>
          <span class="target-word-badge" style="background: #1e40af; color: white !important; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.9rem;">
            ${sentence.targetWord || 'N/A'}
          </span>
        </td>
        <td>
          <span class="wordset-badge" style="background: #059669; color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
            ${wordSet}
          </span>
        </td>
        <td style="font-size: 0.9rem; color: #64748b;">${date}<br>${time}</td>
        <td style="font-style: italic; line-height: 1.4; padding: 8px;">"${sentence.sentence || 'No sentence'}"</td>
        <td>
          <button class="btn-tiny btn-edit" onclick="editSentence('${sentence.id}')" title="Edit">✏️</button>
          <button class="btn-tiny btn-delete" onclick="deleteSentence('${sentence.id}')" title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
  
  // Add or update stats element for print export
  let statsElement = document.querySelector('.sentences-stats');
  if (!statsElement) {
    // Create stats element if it doesn't exist
    const tableContainer = document.querySelector('.sentences-table-container') || tableBody.parentElement;
    if (tableContainer) {
      statsElement = document.createElement('div');
      statsElement.className = 'sentences-stats';
      statsElement.style.display = 'none'; // Hidden normally, shown only in print
      tableContainer.insertBefore(statsElement, tableContainer.firstChild);
    }
  }
}

// Update sentences statistics
function updateSentencesStats() {
  const uniqueStudents = [...new Set(filteredSentences.map(s => s.studentName).filter(name => name))];
  const uniqueWords = [...new Set(filteredSentences.map(s => s.targetWord).filter(word => word))];
  const uniqueWordSets = [...new Set(filteredSentences.map(s => s.wordSetName).filter(name => name && name !== 'Unknown Set'))];
  
  // Update stat displays
  const elements = {
    filteredSentenceStudents: uniqueStudents.length,
    filteredTotalSentences: filteredSentences.length,
    filteredUniqueWords: uniqueWords.length,
    filteredSentenceWordSets: uniqueWordSets.length
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
  
  // Update label for students
  const studentsLabel = document.getElementById('filteredSentenceStudentsLabel');
  if (studentsLabel) {
    studentsLabel.textContent = uniqueStudents.length === 1 ? 'Student' : 'Students';
  }
}

// Update sentence insights
function updateSentenceInsights() {
  const insightsSection = document.getElementById('sentenceInsightsSection');
  const insightsDiv = document.getElementById('sentencesInsights');
  
  if (!insightsDiv || filteredSentences.length === 0) return;
  
  const uniqueStudents = [...new Set(filteredSentences.map(s => s.studentName).filter(name => name))];
  const avgSentenceLength = filteredSentences.reduce((sum, s) => sum + (s.sentence?.length || 0), 0) / filteredSentences.length;
  const mostActiveStudent = getMostActiveStudent();
  const mostUsedWordSet = getMostUsedWordSet();
  
  let insights = `<h4 style="margin: 0 0 12px 0; color: #059669;">📝 Sentence Practice Insights</h4>`;
  insights += `<ul style="margin: 0; padding-left: 20px; color: #374151;">`;
  insights += `<li><strong>${uniqueStudents.length}</strong> students have practiced sentence writing</li>`;
  insights += `<li>Average sentence length: <strong>${Math.round(avgSentenceLength)}</strong> characters</li>`;
  if (mostActiveStudent) {
    insights += `<li>Most active student: <strong>${mostActiveStudent.name}</strong> (${mostActiveStudent.count} sentences)</li>`;
  }
  if (mostUsedWordSet) {
    insights += `<li>Most practiced word set: <strong>${mostUsedWordSet.name}</strong> (${mostUsedWordSet.count} sentences)</li>`;
  }
  insights += `</ul>`;
  
  insightsDiv.innerHTML = insights;
  insightsSection.style.display = 'block';
}

// Helper functions
function getMostActiveStudent() {
  const studentCounts = {};
  filteredSentences.forEach(s => {
    if (s.studentName) {
      studentCounts[s.studentName] = (studentCounts[s.studentName] || 0) + 1;
    }
  });
  
  const entries = Object.entries(studentCounts);
  if (entries.length === 0) return null;
  
  const [name, count] = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  return { name, count };
}

function getMostUsedWordSet() {
  const wordSetCounts = {};
  filteredSentences.forEach(s => {
    if (s.wordSetName && s.wordSetName !== 'Unknown Set') {
      wordSetCounts[s.wordSetName] = (wordSetCounts[s.wordSetName] || 0) + 1;
    }
  });
  
  const entries = Object.entries(wordSetCounts);
  if (entries.length === 0) return null;
  
  const [name, count] = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  return { name, count };
}

// Export functions
async function exportSentencesScreenshot() {
  try {
    if (filteredSentences.length === 0) {
      if (typeof showNotification === 'function') {
        showNotification("No sentence data to export", "warning");
      }
      return;
    }

    if (typeof showNotification === 'function') {
      showNotification("Generating sentence record download...", "info");
    }

    // Create a container for the export content
    const screenshotContainer = document.createElement('div');
    screenshotContainer.style.cssText = `
      width: 1600px !important;
      max-width: none !important;
      min-width: 1600px !important;
      background: white;
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      box-sizing: border-box !important;
      position: absolute !important;
      top: -10000px;
      left: -10000px;
      margin: 0 !important;
      border: none !important;
      overflow: visible !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 9999;
      transform: none !important;
    `;

    // Create table rows for the sentence data
    let tableRows = '';
    filteredSentences.forEach((sentence, index) => {
      const date = sentence.createdAt ? new Date(sentence.createdAt).toLocaleDateString() : 'Unknown date';
      const time = sentence.createdAt ? new Date(sentence.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) : '';
      
      const rowColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      
      tableRows += `
        <tr style="background: ${rowColor}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 15px 12px; font-weight: 600; color: #1e293b; border-right: 1px solid #e2e8f0;">
            ${sentence.studentName || 'Unknown'}
          </td>
          <td style="padding: 15px 12px; text-align: center; border-right: 1px solid #e2e8f0;">
            <span style="background: #1e40af; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block;">
              ${sentence.targetWord || 'N/A'}
            </span>
          </td>
          <td style="padding: 15px 12px; text-align: center; border-right: 1px solid #e2e8f0;">
            <span style="background: #059669; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
              ${sentence.wordSetName || 'Unknown Set'}
            </span>
          </td>
          <td style="padding: 15px 12px; text-align: center; color: #64748b; font-size: 14px; border-right: 1px solid #e2e8f0;">
            ${date}<br><span style="font-size: 12px;">${time}</span>
          </td>
          <td style="padding: 15px 12px; font-style: italic; line-height: 1.4; color: #374151; max-width: 300px;">
            "${sentence.sentence || 'No sentence'}"
          </td>
        </tr>
      `;
    });

    // Build the complete HTML with header and table
    screenshotContainer.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px;">
        <img src="logo.png" alt="Logo" style="width: 60px; height: 60px; margin-right: 20px;">
        <div style="flex: 1; text-align: center;">
          <h1 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 700;">📝 Sentence Record</h1>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);">
            <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 16px; border-right: 2px solid rgba(255,255,255,0.2);">Student</th>
            <th style="color: white; padding: 20px 15px; text-align: center; font-weight: 700; font-size: 16px; border-right: 2px solid rgba(255,255,255,0.2);">Target Word</th>
            <th style="color: white; padding: 20px 15px; text-align: center; font-weight: 700; font-size: 16px; border-right: 2px solid rgba(255,255,255,0.2);">Word Set</th>
            <th style="color: white; padding: 20px 15px; text-align: center; font-weight: 700; font-size: 16px; border-right: 2px solid rgba(255,255,255,0.2);">Date & Time</th>
            <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 16px;">Sentence</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div style="text-align: center; margin-top: 20px; padding: 15px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; color: #0c4a6e;">
        <strong>📊 Summary:</strong> ${filteredSentences.length} sentences from ${[...new Set(filteredSentences.map(s => s.studentName).filter(name => name))].length} students
        <br><span style="font-size: 14px; margin-top: 5px; display: block;">Generated: ${new Date().toLocaleString()}</span>
      </div>
    `;

    // Add to document temporarily
    document.body.appendChild(screenshotContainer);

    try {
      // Generate the screenshot using html2canvas
      const canvas = await html2canvas(screenshotContainer, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 1600,
        height: screenshotContainer.scrollHeight
      });

      // Create download link
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      link.download = `sentence_record_${today}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      if (typeof showNotification === 'function') {
        showNotification("Sentence record downloaded successfully!", "success");
      }

    } catch (error) {
      console.error('Error generating sentence record:', error);
      if (typeof showNotification === 'function') {
        showNotification("Error generating sentence record", "error");
      }
    } finally {
      // Clean up - remove the temporary container
      document.body.removeChild(screenshotContainer);
    }

  } catch (error) {
    console.error('Export error:', error);
    if (typeof showNotification === 'function') {
      showNotification("Failed to export sentence record", "error");
    }
  }
}

function exportSentencesPdf() {
  if (typeof showNotification === 'function') {
    showNotification("PDF export functionality coming soon!", "info");
  }
}

// Delete functions
function deleteSentence(sentenceId) {
  if (confirm("Are you sure you want to delete this sentence?")) {
    window.db.collection('sentences').doc(sentenceId).delete()
      .then(() => {
        if (typeof showNotification === 'function') {
          showNotification("Sentence deleted successfully", "success");
        }
        loadSentences().then(() => {
          applySentencesFilter();
        });
      })
      .catch(error => {
        console.error("Error deleting sentence:", error);
        if (typeof showNotification === 'function') {
          showNotification("Error deleting sentence", "error");
        }
      });
  }
}

function deleteAllSentences() {
  if (confirm("⚠️ DANGER: This will permanently delete ALL sentences from ALL students!\n\nThis action cannot be undone. Are you absolutely sure?")) {
    if (confirm("🚨 FINAL WARNING: You are about to delete ALL sentence data!\n\nType 'DELETE ALL' in the next prompt to confirm.")) {
      const confirmation = prompt("Type 'DELETE ALL' to confirm deletion:");
      if (confirmation === 'DELETE ALL') {
        // Delete all sentences
        const batch = window.db.batch();
        sentences.forEach(sentence => {
          const docRef = window.db.collection('sentences').doc(sentence.id);
          batch.delete(docRef);
        });
        
        batch.commit()
          .then(() => {
            if (typeof showNotification === 'function') {
              showNotification("All sentences deleted successfully", "success");
            }
            loadSentences().then(() => {
              applySentencesFilter();
            });
          })
          .catch(error => {
            console.error("Error deleting all sentences:", error);
            if (typeof showNotification === 'function') {
              showNotification("Error deleting sentences", "error");
            }
          });
      }
    }
  }
}

function editSentence(sentenceId) {
  const sentence = sentences.find(s => s.id === sentenceId);
  if (!sentence) return;
  
  const newSentence = prompt("Edit sentence:", sentence.sentence);
  if (newSentence && newSentence.trim() && newSentence !== sentence.sentence) {
    window.db.collection('sentences').doc(sentenceId).update({
      sentence: newSentence.trim(),
      updatedAt: new Date().toISOString()
    })
    .then(() => {
      if (typeof showNotification === 'function') {
        showNotification("Sentence updated successfully", "success");
      }
      loadSentences().then(() => {
        applySentencesFilter();
      });
    })
    .catch(error => {
      console.error("Error updating sentence:", error);
      if (typeof showNotification === 'function') {
        showNotification("Error updating sentence", "error");
      }
    });
  }
}

// Main render function (for compatibility)
function renderSentences() {
  console.log("=== 🔄 RENDER SENTENCES STARTED ===");
  
  // Check Firebase connection
  if (!window.db) {
    console.error("❌ Firebase database not available!");
    const tableBody = document.getElementById('sentencesTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: #dc2626;">
            <div style="font-size: 2rem; margin-bottom: 16px;">⚠️</div>
            <strong>Database Connection Error</strong><br>
            <span style="font-size: 0.9rem;">Firebase not initialized. Please refresh the page.</span><br>
            <button onclick="location.reload()" style="margin-top: 12px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Refresh Page</button>
          </td>
        </tr>
      `;
    }
    return;
  }
  
  console.log("✅ Firebase database is available");
  console.log("🔍 Starting sentence loading process...");
  
  // Show loading state
  const tableBody = document.getElementById('sentencesTableBody');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
          <div style="font-size: 2rem; margin-bottom: 16px;">⏳</div>
          <strong>Loading sentences...</strong><br>
          <span style="font-size: 0.9rem;">Retrieving data from Firebase...</span>
        </td>
      </tr>
    `;
  }
  
  loadSentences().then((loadedSentences) => {
    console.log("📊 Load sentences completed:");
    console.log(`   Total sentences: ${loadedSentences ? loadedSentences.length : 0}`);
    console.log(`   Sentences array: ${sentences.length}`);
    
    if (sentences.length > 0) {
      console.log("📝 Sample sentence structure:", {
        id: sentences[0].id,
        studentName: sentences[0].studentName,
        targetWord: sentences[0].targetWord,
        wordSetName: sentences[0].wordSetName,
        createdAt: sentences[0].createdAt
      });
    }
    
    console.log("🔧 Applying filters...");
    applySentencesFilter();
    console.log(`   Filtered sentences: ${filteredSentences.length}`);
    
    // Set up event listeners only once
    const buttons = [
      { id: 'applySentencesFilter', handler: applySentencesFilter, name: 'apply filter' },
      { id: 'exportSentencesScreenshotBtn', handler: exportSentencesScreenshot, name: 'export screenshot' },
      { id: 'exportSentencesPdfBtn', handler: exportSentencesPdf, name: 'export PDF' },
      { id: 'deleteAllSentencesBtn', handler: deleteAllSentences, name: 'delete all' }
    ];
    
    buttons.forEach(({ id, handler, name }) => {
      const btn = document.getElementById(id);
      if (btn && !btn.hasAttribute('data-listener-added')) {
        btn.addEventListener('click', handler);
        btn.setAttribute('data-listener-added', 'true');
        console.log(`✅ Added ${name} button listener`);
      }
    });
    
    console.log("=== ✅ RENDER SENTENCES COMPLETED SUCCESSFULLY ===");
    console.log(`📈 Final summary: ${sentences.length} total, ${filteredSentences.length} filtered`);
    
  }).catch(error => {
    console.error("=== ❌ RENDER SENTENCES ERROR ===");
    console.error("Error details:", error);
    
    // Show detailed error in the UI
    const tableBody = document.getElementById('sentencesTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: #dc2626;">
            <div style="font-size: 2rem; margin-bottom: 16px;">❌</div>
            <strong>Error Loading Sentences</strong><br>
            <span style="font-size: 0.9rem;">${error.message || 'Unknown error occurred'}</span><br>
            <div style="margin-top: 16px;">
              <button onclick="renderSentences()" style="margin: 4px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>
              <button onclick="testSentenceDatabase()" style="margin: 4px; padding: 8px 16px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer;">Test Database</button>
            </div>
          </td>
        </tr>
      `;
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log("Sentences functionality initialized");
  });
} else {
  console.log("Sentences functionality ready");
}

// Debug function to test Firebase connection and create sample sentence
window.testSentenceDatabase = async function() {
  console.log("=== TESTING SENTENCE DATABASE ===");
  
  if (!window.db) {
    console.error("Firebase database not available!");
    return;
  }
  
  try {
    // Test reading from sentences collection
    console.log("Testing read access to sentences collection...");
    const testSnapshot = await window.db.collection('sentences').limit(1).get();
    console.log("Read test successful. Collection accessible.");
    
    // Test creating a sample sentence
    console.log("Testing write access by creating a test sentence...");
    const testSentence = {
      studentName: 'Test Student',
      targetWord: 'test',
      sentence: 'This is a test sentence.',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
      wordSetId: 'test-set',
      wordSetName: 'Test Word Set'
    };
    
    const docRef = await window.db.collection('sentences').add(testSentence);
    console.log("Test sentence created successfully with ID:", docRef.id);
    
    // Immediately delete the test sentence
    await window.db.collection('sentences').doc(docRef.id).delete();
    console.log("Test sentence deleted successfully");
    
    console.log("=== DATABASE TEST COMPLETED SUCCESSFULLY ===");
    
    // Reload sentences after test
    if (typeof renderSentences === 'function') {
      renderSentences();
    }
    
    return true;
  } catch (error) {
    console.error("=== DATABASE TEST FAILED ===");
    console.error("Error details:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    return false;
  }
}

// Add test button to console
console.log("🔧 DEBUG: Type 'testSentenceDatabase()' in console to test database connection"); 