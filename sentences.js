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
    // Show popup for export options
    const exportOptions = await showSentenceItemsPerPageModal();
    if (!exportOptions) return; // User cancelled

    if (filteredSentences.length === 0) {
      if (typeof showNotification === 'function') {
        showNotification("No sentence data to export", "warning");
      }
      return;
    }

    if (typeof showNotification === 'function') {
      showNotification("Generating sentence record download...", "info");
    }

    // Get current filter and sort settings from the sentences view
    const filterType = document.getElementById('sentencesFilterType').value;
    const filterValue = document.getElementById('sentencesFilterValue').value;
    const fromDate = document.getElementById('sentencesFromDate').value;
    const toDate = document.getElementById('sentencesToDate').value;
    const sortBy = document.getElementById('sentencesSortBy').value;

    // Use the current filtered sentences
    let validSentences = [...filteredSentences];

    if (validSentences.length === 0) {
      if (typeof showNotification === 'function') {
        showNotification("No data to export with current filters", "error");
      }
      return;
    }

    // Get filter and sort information for the header
    let filterInfo = "";
    if (filterType === "student" && filterValue) {
      filterInfo = `Student: ${filterValue}`;
    } else if (filterType === "wordset" && filterValue) {
      filterInfo = `Word Set: ${filterValue}`;
    } else {
      filterInfo = "All Students";
    }

    const sortLabel = document.getElementById('sentencesSortBy').selectedOptions[0].text;
    const screenshots = [];

    if (exportOptions.mode === 'separate') {
      // Separate by student mode - create individual pages for each student
      const uniqueStudents = [...new Set(validSentences.map(s => s.studentName))]
        .filter(name => name)
        .sort();

      if (uniqueStudents.length === 0) {
        if (typeof showNotification === 'function') {
          showNotification("No students found in the data", "error");
        }
        return;
      }

      if (typeof showNotification === 'function') {
        showNotification(`Creating individual reports for ${uniqueStudents.length} students...`, "info");
      }

      for (let studentIndex = 0; studentIndex < uniqueStudents.length; studentIndex++) {
        const studentName = uniqueStudents[studentIndex];
        const studentSentences = validSentences.filter(s => s.studentName === studentName);

        if (studentSentences.length === 0) continue;

        // Create individual student report
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

        // Create table rows for the student's sentences
        let tableRows = '';
        studentSentences.forEach((sentence, index) => {
          const date = sentence.createdAt ? new Date(sentence.createdAt) : new Date();
          const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          tableRows += `
            <tr style="border-bottom: 1px solid #e5e7eb; ${index % 2 === 1 ? 'background: #f8fafc;' : ''}">
              <td style="padding: 15px; border-right: 1px solid #e5e7eb; font-weight: 600; color: #1e293b;">${sentence.targetWord || 'N/A'}</td>
              <td style="padding: 15px; border-right: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">${sentence.wordSetName || 'Unknown Set'}</td>
              <td style="padding: 15px; border-right: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">
                <div>${formattedDate}</div>
                <div style="font-size: 12px; color: #94a3b8;">${formattedTime}</div>
              </td>
              <td style="padding: 15px; color: #1e293b; line-height: 1.4;">${sentence.sentence || 'No sentence'}</td>
            </tr>
          `;
        });

        screenshotContainer.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px;">
            <img src="logo.png" alt="Logo" style="width: 60px; height: 60px; margin-right: 20px;">
            <div style="flex: 1; text-align: center;">
              <h1 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 700;">Sentence Practice Report</h1>
              <h2 style="margin: 10px 0 0 0; color: #3b82f6; font-size: 24px; font-weight: 600;">${studentName}</h2>
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; color: #64748b;">
            <span>Filter: ${filterInfo} | Sort: ${sortLabel}</span>
            <span>Total Sentences: ${studentSentences.length}</span>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Target Word</th>
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Word Set</th>
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Date & Time</th>
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px;">Sentence</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; font-size: 14px; color: #64748b;">
            Generated: ${new Date().toLocaleString()} | Individual Report for ${studentName}
          </div>
        `;

        // Add to document temporarily
        document.body.appendChild(screenshotContainer);

        try {
          const canvas = await html2canvas(screenshotContainer, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 1600,
            height: screenshotContainer.scrollHeight
          });

          const link = document.createElement('a');
          link.download = `${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_sentence_report.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();

          screenshots.push(link.download);
        } catch (error) {
          console.error(`Error generating screenshot for ${studentName}:`, error);
          if (typeof showNotification === 'function') {
            showNotification(`Error generating report for ${studentName}`, "error");
          }
        } finally {
          document.body.removeChild(screenshotContainer);
        }

        // Small delay between students
        if (studentIndex < uniqueStudents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (screenshots.length > 0) {
        if (typeof showNotification === 'function') {
          showNotification(`Successfully created ${screenshots.length} individual student reports!`, "success");
        }
      }
    } else {
      // Original items per page mode
      const itemsPerPage = parseInt(exportOptions.value);
      const totalPages = Math.ceil(validSentences.length / itemsPerPage);

      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const startIndex = pageNum * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, validSentences.length);
        const pageSentences = validSentences.slice(startIndex, endIndex);

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
        pageSentences.forEach((sentence, index) => {
          const date = sentence.createdAt ? new Date(sentence.createdAt) : new Date();
          const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          tableRows += `
            <tr style="border-bottom: 1px solid #e5e7eb; ${index % 2 === 1 ? 'background: #f8fafc;' : ''}">
              <td style="padding: 15px; border-right: 1px solid #e5e7eb; font-weight: 600; color: #1e293b;">${sentence.studentName || 'Unknown'}</td>
              <td style="padding: 15px; border-right: 1px solid #e5e7eb; font-weight: 600; color: #3b82f6;">${sentence.targetWord || 'N/A'}</td>
              <td style="padding: 15px; border-right: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">${sentence.wordSetName || 'Unknown Set'}</td>
              <td style="padding: 15px; border-right: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">
                <div>${formattedDate}</div>
                <div style="font-size: 12px; color: #94a3b8;">${formattedTime}</div>
              </td>
              <td style="padding: 15px; color: #1e293b; line-height: 1.4;">${sentence.sentence || 'No sentence'}</td>
            </tr>
          `;
        });

        screenshotContainer.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px;">
            <img src="logo.png" alt="Logo" style="width: 60px; height: 60px; margin-right: 20px;">
            <div style="flex: 1; text-align: center;">
              <h1 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 700;">Sentence Practice Records</h1>
              ${totalPages > 1 ? `<h2 style="margin: 10px 0 0 0; color: #64748b; font-size: 18px;">Page ${pageNum + 1} of ${totalPages}</h2>` : ''}
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; color: #64748b;">
            <span>Filter: ${filterInfo} | Sort: ${sortLabel}</span>
            <span>Showing ${pageSentences.length} of ${validSentences.length} sentences</span>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Student</th>
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Target Word</th>
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Word Set</th>
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px; border-right: 2px solid rgba(255,255,255,0.2);">Date & Time</th>
                <th style="color: white; padding: 20px 15px; text-align: left; font-weight: 700; font-size: 18px;">Sentence</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; font-size: 14px; color: #64748b;">
            Total Students: ${[...new Set(validSentences.map(s => s.studentName).filter(name => name))].length} students
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
          link.download = totalPages > 1 ? 
            `sentences_${filterInfo.replace(/[^a-zA-Z0-9]/g, '_')}_${sortLabel.replace(/[^a-zA-Z0-9]/g, '_')}_page_${pageNum + 1}_of_${totalPages}.png` :
            `sentences_${filterInfo.replace(/[^a-zA-Z0-9]/g, '_')}_${sortLabel.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();

          screenshots.push(link.download);
        } catch (error) {
          console.error('Error generating sentence record:', error);
          if (typeof showNotification === 'function') {
            showNotification(`Error generating page ${pageNum + 1}`, "error");
          }
        } finally {
          // Clean up - remove the temporary container
          document.body.removeChild(screenshotContainer);
        }

        // Small delay between pages
        if (pageNum < totalPages - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (screenshots.length > 0) {
        if (typeof showNotification === 'function') {
          showNotification(
            totalPages > 1 ? 
              `Successfully exported ${screenshots.length} screenshot pages!` : 
              "Sentence record downloaded successfully!", 
            "success"
          );
        }
      }
    }

  } catch (error) {
    console.error('Export error:', error);
    if (typeof showNotification === 'function') {
      showNotification("Failed to export sentence record", "error");
    }
  }
}

function exportSentencesPdf() {
  // Filter to get current sentences from the view
  const validSentences = filteredSentences.filter(sentence => {
    return sentence.studentName && sentence.sentence;
  });

  if (validSentences.length === 0) {
    if (typeof showNotification === 'function') {
      showNotification('No valid sentence data to export', 'warning');
    }
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('Sentence Practice Report', 20, 20);

  // Date range and filter info
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  const filterType = document.getElementById('sentencesFilterType').value;
  const filterValue = document.getElementById('sentencesFilterValue').value;
  const fromDate = document.getElementById('sentencesFromDate').value;
  const toDate = document.getElementById('sentencesToDate').value;

  let filterInfo = 'Filter: ';
  if (filterType === 'student' && filterValue) {
    filterInfo += `Student - ${filterValue}`;
  } else if (filterType === 'wordset' && filterValue) {
    filterInfo += `Word Set - ${filterValue}`;
  } else {
    filterInfo += 'All Students';
  }

  if (fromDate || toDate) {
    filterInfo += ` | Date Range: ${fromDate || 'Start'} to ${toDate || 'End'}`;
  }

  doc.text(filterInfo, 20, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40);
  doc.text(`Total Sentences: ${validSentences.length}`, 20, 50);

  let yPos = 70;

  // Process each sentence
  validSentences.forEach((sentence, index) => {
    if (yPos > 250) { // Start new page if needed
      doc.addPage();
      yPos = 20;
    }

    // Student name header
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`Student: ${sentence.studentName}`, 20, yPos);
    
    yPos += 8;
    
    // Target word and word set
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Target Word: ${sentence.targetWord || 'N/A'}`, 25, yPos);
    doc.text(`Word Set: ${sentence.wordSetName || 'Unknown Set'}`, 120, yPos);
    
    yPos += 8;
    
    // Date
    const date = sentence.createdAt ? new Date(sentence.createdAt) : new Date();
    doc.text(`Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`, 25, yPos);
    
    yPos += 8;
    
    // Sentence text
    doc.setFont(undefined, 'bold');
    doc.text('Sentence:', 25, yPos);
    doc.setFont(undefined, 'normal');
    
    // Split long sentences across multiple lines
    const sentenceText = sentence.sentence || 'No sentence';
    const maxWidth = 160;
    const lines = doc.splitTextToSize(sentenceText, maxWidth);
    
    yPos += 6;
    lines.forEach((line, lineIndex) => {
      if (yPos > 280) { // Check if we need a new page
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 30, yPos);
      yPos += 6;
    });
    
    yPos += 8; // Add space between entries
    
    // Add a line separator
    if (index < validSentences.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.line(20, yPos, 190, yPos);
      yPos += 8;
    }
  });

  // Save the PDF
  const today = new Date().toISOString().split('T')[0];
  doc.save(`sentence_report_${today}.pdf`);

  if (typeof showNotification === 'function') {
    showNotification('Sentence report exported to PDF successfully!', 'success');
  }
}

// Show modal for selecting sentence export options
function showSentenceItemsPerPageModal() {
  return new Promise((resolve) => {
    const modalContent = `
      <div style="text-align: center;">
        <h3 style="margin: 0 0 20px 0; color: #1e293b;">Export Sentence Screenshot Options</h3>
        <p style="margin: 0 0 24px 0; color: #64748b;">Choose how to organize the screenshot pages:</p>
        
        <div style="margin-bottom: 32px;">
          <h4 style="margin: 0 0 16px 0; color: #1e293b; font-size: 1.1rem;">📄 Items Per Page</h4>
          <p style="margin: 0 0 16px 0; color: #64748b; font-size: 0.9rem;">All students mixed together on each page:</p>
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 12px; margin-bottom: 16px;">
            <button class="items-per-page-btn" data-value="4" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">4</button>
            <button class="items-per-page-btn" data-value="5" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">5</button>
            <button class="items-per-page-btn" data-value="8" style="padding: 12px; border: 2px solid #3b82f6; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">8</button>
            <button class="items-per-page-btn" data-value="10" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">10</button>
            <button class="items-per-page-btn" data-value="12" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">12</button>
            <button class="items-per-page-btn" data-value="15" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">15</button>
            <button class="items-per-page-btn" data-value="20" style="padding: 12px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s;">20</button>
          </div>
        </div>
        
        <div style="border-top: 2px solid #e0e7ef; padding-top: 24px;">
          <h4 style="margin: 0 0 16px 0; color: #1e293b; font-size: 1.1rem;">👥 Separate by Student</h4>
          <p style="margin: 0 0 16px 0; color: #64748b; font-size: 0.9rem;">Create individual pages for each student (perfect for handing out individual reports):</p>
          <button class="separate-student-btn" data-value="separate" style="padding: 16px 24px; border: 2px solid #e0e7ef; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 1rem;">
            📋 Separate by Student
          </button>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 32px;">
          <button id="cancelSentenceItemsPerPage" class="btn-secondary">Cancel</button>
          <button id="confirmSentenceItemsPerPage" class="btn-primary">Export Screenshots</button>
        </div>
      </div>
    `;

    // Show modal using the existing modal system
    if (typeof showModal === 'function') {
      showModal(modalContent);
    } else {
      // Fallback if showModal is not available
      const modalOverlay = document.getElementById('modalOverlay');
      const modalBody = document.getElementById('modalBody');
      const modalTitle = document.getElementById('modalTitle');
      
      if (modalOverlay && modalBody && modalTitle) {
        modalTitle.textContent = 'Export Options';
        modalBody.innerHTML = modalContent;
        modalOverlay.style.display = 'flex';
      }
    }

    let selectedValue = '8'; // Default value
    let selectedMode = 'page'; // Default mode

    // Add event listeners for option selection
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('items-per-page-btn')) {
        // Remove selection from all buttons
        document.querySelectorAll('.items-per-page-btn, .separate-student-btn').forEach(btn => {
          btn.style.border = '2px solid #e0e7ef';
          btn.style.background = 'white';
          btn.style.color = 'black';
        });
        
        // Highlight selected button
        e.target.style.border = '2px solid #3b82f6';
        e.target.style.background = '#3b82f6';
        e.target.style.color = 'white';
        
        selectedValue = e.target.dataset.value;
        selectedMode = 'page';
      } else if (e.target.classList.contains('separate-student-btn')) {
        // Remove selection from all buttons
        document.querySelectorAll('.items-per-page-btn, .separate-student-btn').forEach(btn => {
          btn.style.border = '2px solid #e0e7ef';
          btn.style.background = 'white';
          btn.style.color = 'black';
        });
        
        // Highlight selected button
        e.target.style.border = '2px solid #3b82f6';
        e.target.style.background = '#3b82f6';
        e.target.style.color = 'white';
        
        selectedValue = e.target.dataset.value;
        selectedMode = 'separate';
      } else if (e.target.id === 'confirmSentenceItemsPerPage') {
        if (typeof closeModal === 'function') {
          closeModal();
        } else {
          const modalOverlay = document.getElementById('modalOverlay');
          if (modalOverlay) modalOverlay.style.display = 'none';
        }
        
        resolve({
          value: selectedValue,
          mode: selectedMode
        });
      } else if (e.target.id === 'cancelSentenceItemsPerPage') {
        if (typeof closeModal === 'function') {
          closeModal();
        } else {
          const modalOverlay = document.getElementById('modalOverlay');
          if (modalOverlay) modalOverlay.style.display = 'none';
        }
        
        resolve(null);
      }
    });
  });
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

// Function to clean up duplicate sentences
async function cleanupDuplicateSentences() {
  if (!confirm("This will scan and remove duplicate sentences from the database.\n\nDuplicates are identified as sentences with:\n- Same student name AND same sentence text\n\nThe oldest copy will be kept, newer duplicates will be deleted.\n\nThis action cannot be undone. Continue?")) {
    return;
  }

  try {
    if (typeof showNotification === 'function') {
      showNotification("Scanning for duplicate sentences...", "info");
    }

    // Make sure we have fresh data
    await loadSentences();

    if (sentences.length === 0) {
      if (typeof showNotification === 'function') {
        showNotification("No sentences found to check for duplicates", "info");
      }
      return;
    }

    console.log(`Checking ${sentences.length} sentences for duplicates...`);

    // Find duplicates
    const duplicatesToDelete = [];
    const seen = new Map(); // key: studentName + sentence text, value: earliest sentence

    // Sort by creation date to keep the oldest sentence
    const sortedSentences = [...sentences].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB; // ascending order (oldest first)
    });

    for (const sentence of sortedSentences) {
      // Create unique key: normalize to handle case variations and extra spaces
      const studentName = (sentence.studentName || '').trim().toLowerCase();
      const sentenceText = (sentence.sentence || '').trim().toLowerCase();
      
      if (!studentName || !sentenceText) {
        // Skip sentences with missing student name or text
        console.warn("Skipping sentence with missing data:", sentence);
        continue;
      }

      const key = `${studentName}|||${sentenceText}`;

      if (seen.has(key)) {
        // This is a duplicate - mark for deletion
        duplicatesToDelete.push(sentence);
        console.log(`Duplicate found for ${sentence.studentName}: "${sentence.sentence}" (ID: ${sentence.id})`);
      } else {
        // First occurrence - keep it
        seen.set(key, sentence);
      }
    }

    if (duplicatesToDelete.length === 0) {
      if (typeof showNotification === 'function') {
        showNotification("No duplicate sentences found! Your data is clean.", "success");
      }
      return;
    }

    // Show summary of what will be deleted
    const summary = duplicatesToDelete.reduce((acc, sentence) => {
      const student = sentence.studentName || 'Unknown';
      if (!acc[student]) {
        acc[student] = 0;
      }
      acc[student]++;
      return acc;
    }, {});

    let summaryText = `Found ${duplicatesToDelete.length} duplicate sentences:\n\n`;
    Object.entries(summary).forEach(([student, count]) => {
      summaryText += `• ${student}: ${count} duplicate${count > 1 ? 's' : ''}\n`;
    });
    summaryText += `\nDo you want to delete these duplicates now?`;

    if (!confirm(summaryText)) {
      return;
    }

    // Delete duplicates in batches
    const batchSize = 500; // Firestore batch limit
    let deletedCount = 0;

    for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
      const batch = window.db.batch();
      const batchItems = duplicatesToDelete.slice(i, i + batchSize);

      batchItems.forEach((sentence) => {
        const sentenceRef = window.db.collection('sentences').doc(sentence.id);
        batch.delete(sentenceRef);
      });

      await batch.commit();
      deletedCount += batchItems.length;

      if (typeof showNotification === 'function') {
        showNotification(`Deleted ${deletedCount}/${duplicatesToDelete.length} duplicate sentences...`, "info");
      }
    }

    if (typeof showNotification === 'function') {
      showNotification(`Successfully removed ${duplicatesToDelete.length} duplicate sentences! 🎉`, "success");
    }

    // Reload data and refresh display
    await loadSentences();
    applySentencesFilter();

  } catch (error) {
    console.error("Error cleaning up duplicate sentences:", error);
    if (typeof showNotification === 'function') {
      showNotification("Error cleaning up duplicates. Please try again.", "error");
    }
  }
}

// Make the function available globally for debugging
if (typeof window !== 'undefined') {
  window.cleanupDuplicateSentences = cleanupDuplicateSentences;
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