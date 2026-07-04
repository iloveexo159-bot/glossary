const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions-list');
const searchBtn = document.getElementById('search-btn');
const backBtn = document.getElementById('back-btn');
const homeLogo = document.getElementById('home-logo');
const flashcardsBtn = document.getElementById('flashcards-btn');
const saveTermBtn = document.getElementById('save-term-btn');
const bookmarkIcon = document.getElementById('bookmark-icon');
const flashcardBadge = document.getElementById('flashcard-badge');
const syncVersionBtn = document.getElementById('sync-version-btn');
const driftNotification = document.getElementById('drift-notification');

// Highlight UI Elements
const tooltip = document.getElementById('highlight-tooltip');
const noteEditor = document.getElementById('inline-note-editor');
const termDescription = document.getElementById('term-description');

let searchHistory = []; 
let currentFocus = -1; 

let savedFlashcards = JSON.parse(localStorage.getItem('wikiFlashcards')) || [];
let currentlyViewedTerm = "";
let currentlyViewedDesc = "";
let currentArticleRevid = null; // Holds the current active Wikipedia text revision profile ID

// State for active text selection
let activeSelectionText = "";
let activeSelectionCoords = null;
let currentTags = [];

// Initialize application badge counter layout values
updateBadgeCount();

// --- 1. HANDLING TYPING SUGGESTIONS ---
searchInput.addEventListener('input', function() {
    const query = searchInput.value.trim();
    currentFocus = -1; 
    if (query.length === 0) {
        suggestionsList.className = 'hidden';
        return;
    }
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&limit=5&search=${encodeURIComponent(query)}`;
    fetch(url).then(response => response.json()).then(data => displaySuggestions(data[1]));
});

function displaySuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    if (suggestions.length === 0) { suggestionsList.className = 'hidden'; return; }
    suggestions.forEach(term => {
        const li = document.createElement('li');
        li.textContent = term;
        li.addEventListener('click', function() {
            searchInput.value = term;
            performMainSearch(term); 
        });
        suggestionsList.appendChild(li);
    });
    suggestionsList.className = '';
}

// --- 2. KEYBOARD NAVIGATION ---
searchInput.addEventListener('keydown', function(e) {
    const items = suggestionsList.getElementsByTagName('li');
    if (e.key === 'Enter') {
        e.preventDefault(); 
        if (currentFocus > -1 && items.length > 0 && !suggestionsList.classList.contains('hidden')) {
            items[currentFocus].click();
        } else { performMainSearch(searchInput.value.trim()); }
        return;
    }
    if (items.length === 0 || suggestionsList.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { currentFocus++; addActive(items); } 
    else if (e.key === 'ArrowUp') { currentFocus--; addActive(items); } 
});
function addActive(items) {
    removeActive(items); 
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    items[currentFocus].classList.add('active'); 
}
function removeActive(items) {
    for (let i = 0; i < items.length; i++) { items[i].classList.remove('active'); }
}

// --- 3. HANDLING THE MAIN SEARCH ---
searchBtn.addEventListener('click', () => performMainSearch(searchInput.value.trim()));

function performMainSearch(term, isBackNav = false) {
    if (term.length === 0) return;
    if (!isBackNav) searchHistory.push(term);

    suggestionsList.className = 'hidden';
    document.body.className = 'results-state';
    document.getElementById('flashcards-display').classList.add('hidden');
    document.getElementById('content-display').classList.remove('hidden');
    driftNotification.classList.add('hidden');

    hideHighlightUI();

    // Query elements matching full page content meta summaries AND text profile updates properties info (revid)
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages|info&exintro=1&explaintext=1&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=1&origin=*`;

    const titleEl = document.getElementById('term-title');
    const descEl = document.getElementById('term-description');
    const imgEl = document.getElementById('term-image');

    titleEl.textContent = "Loading...";
    descEl.textContent = "";
    imgEl.classList.add('hidden'); 
    imgEl.src = "";
    bookmarkIcon.classList.remove('saved-icon');

    fetch(extractUrl)
        .then(response => response.json())
        .then(data => {
            if (!data.query || !data.query.pages) {
                titleEl.textContent = "No results found";
                return;
            }
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0]; 
            const actualTitle = pages[pageId].title;
            const extract = pages[pageId].extract;
            const liveRevid = pages[pageId].lastrevid || null;
            
            currentArticleRevid = liveRevid;

            if (pages[pageId].thumbnail) {
                imgEl.src = pages[pageId].thumbnail.source;
                imgEl.classList.remove('hidden'); 
            }

            titleEl.textContent = actualTitle;
            currentlyViewedTerm = actualTitle;
            currentlyViewedDesc = extract ? extract : "No text found.";
            descEl.textContent = currentlyViewedDesc;

            const isAlreadySaved = savedFlashcards.some(card => card.title === actualTitle && card.type === 'article');
            if (isAlreadySaved) bookmarkIcon.classList.add('saved-icon');

            // Evaluate if saved parameters have drifted away from live Wiki versions
            const relatedCards = savedFlashcards.filter(card => card.title === actualTitle);
            let versionMismatchDetected = false;

            relatedCards.forEach(card => {
                if (card.revid && liveRevid && card.revid !== liveRevid) {
                    versionMismatchDetected = true;
                }
            });

            if (versionMismatchDetected) {
                driftNotification.classList.remove('hidden');
            }

            // Map and apply saved highlight nodes onto presentation template layout structures
            applySavedHighlights(actualTitle);
        });
}

// --- 4. FLASHCARD SAVING UTILS ---
function getFormattedDate() {
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function updateBadgeCount() {
    if (savedFlashcards.length > 0) {
        flashcardBadge.textContent = savedFlashcards.length;
        flashcardBadge.classList.remove('hidden');
    } else {
        flashcardBadge.classList.add('hidden');
    }
}

function triggerSaveAnimation() {
    updateBadgeCount();
    flashcardBadge.classList.add('pop');
    setTimeout(() => flashcardBadge.classList.remove('pop'), 300);
}

// TYPE 1: Save Full Article
saveTermBtn.addEventListener('click', function() {
    if (!currentlyViewedTerm) return;
    const existingIndex = savedFlashcards.findIndex(c => c.title === currentlyViewedTerm && c.type === 'article');

    if (existingIndex >= 0) {
        savedFlashcards.splice(existingIndex, 1);
        bookmarkIcon.classList.remove('saved-icon');
    } else {
        savedFlashcards.unshift({
            type: 'article',
            title: currentlyViewedTerm,
            desc: currentlyViewedDesc,
            date: getFormattedDate(),
            revid: currentArticleRevid
        });
        bookmarkIcon.classList.add('saved-icon');
        triggerSaveAnimation();
    }
    localStorage.setItem('wikiFlashcards', JSON.stringify(savedFlashcards));
});

// --- 5. TEXT HIGHLIGHTING LOGIC & RENDERING ---
document.addEventListener('mouseup', function(e) {
    if (tooltip.contains(e.target) || noteEditor.contains(e.target)) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0 && termDescription.contains(selection.anchorNode)) {
        activeSelectionText = text;
        const range = selection.getRangeAt(0);
        activeSelectionCoords = range.getBoundingClientRect();
        
        tooltip.style.top = `${activeSelectionCoords.top + window.scrollY - 40}px`;
        tooltip.style.left = `${activeSelectionCoords.left + window.scrollX + (activeSelectionCoords.width / 2)}px`;
        
        tooltip.classList.remove('hidden');
        noteEditor.classList.add('hidden');
    } else {
        tooltip.classList.add('hidden');
    }
});

function hideHighlightUI() {
    tooltip.classList.add('hidden');
    noteEditor.classList.add('hidden');
    window.getSelection().removeAllRanges();
    currentTags = [];
    document.getElementById('tag-container').innerHTML = '';
    document.getElementById('note-input').value = "";
    document.getElementById('tag-input').value = "";
}

// Inline content text replacement engine for applying highlighting wrappers safely
function applySavedHighlights(title) {
    if (!currentlyViewedDesc) return;

    let textHTML = currentlyViewedDesc
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const highlights = savedFlashcards.filter(c => c.title === title && c.selectedText);

    // Sort matching patterns by string length descending to process nested phrases accurately
    highlights.sort((a, b) => b.selectedText.length - a.selectedText.length);

    const placeholders = [];

    highlights.forEach(hl => {
        const phrase = hl.selectedText;
        if (!phrase || !textHTML.includes(phrase)) return;

        const escapedPhrase = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escapedPhrase, 'g');

        textHTML = textHTML.replace(regex, (match) => {
            const token = `___HL_TOKEN_STRIP_${placeholders.length}___`;
            placeholders.push({
                token: token,
                html: `<mark class="wiki-highlight">${match}</mark>`
            });
            return token;
        });
    });

    placeholders.forEach(item => {
        textHTML = textHTML.replace(item.token, item.html);
    });

    termDescription.innerHTML = textHTML;
}

// TYPE 3: Save Highlight ONLY
document.getElementById('tooltip-save-btn').addEventListener('click', () => {
    savedFlashcards.unshift({
        type: 'highlight',
        title: currentlyViewedTerm,
        selectedText: activeSelectionText,
        date: getFormattedDate(),
        revid: currentArticleRevid
    });
    localStorage.setItem('wikiFlashcards', JSON.stringify(savedFlashcards));
    triggerSaveAnimation();
    applySavedHighlights(currentlyViewedTerm);
    hideHighlightUI();
});

// TYPE 2: Transition to Note Editor
document.getElementById('tooltip-note-btn').addEventListener('click', () => {
    tooltip.classList.add('hidden');
    noteEditor.style.top = `${activeSelectionCoords.bottom + window.scrollY + 10}px`;
    noteEditor.style.left = `${activeSelectionCoords.left + window.scrollX}px`;
    noteEditor.classList.remove('hidden');
    document.getElementById('note-input').value = "";
    document.getElementById('tag-input').value = "";
    document.getElementById('note-input').focus();
});

document.getElementById('editor-cancel').addEventListener('click', hideHighlightUI);

// TYPE 2: Save Highlight WITH Note
document.getElementById('editor-save').addEventListener('click', () => {
    const noteVal = document.getElementById('note-input').value.trim();

    savedFlashcards.unshift({
        type: 'note',
        title: currentlyViewedTerm,
        selectedText: activeSelectionText,
        note: noteVal,
        tags: currentTags.join(', '),
        date: getFormattedDate(),
        revid: currentArticleRevid
    });
    localStorage.setItem('wikiFlashcards', JSON.stringify(savedFlashcards));
    triggerSaveAnimation();
    applySavedHighlights(currentlyViewedTerm);
    hideHighlightUI();
});

// --- 6. VIEWING FLASHCARDS ---
flashcardsBtn.addEventListener('click', () => {
    renderFlashcards();
});

function renderFlashcards() {
    document.body.className = 'results-state'; 
    document.getElementById('content-display').classList.add('hidden');
    document.getElementById('flashcards-display').classList.remove('hidden');
    suggestionsList.className = 'hidden';
    hideHighlightUI();

    const grid = document.getElementById('flashcards-grid');
    grid.innerHTML = ''; 

    if (savedFlashcards.length === 0) {
        grid.innerHTML = '<p>You haven\'t saved any flashcards yet. Search for a term, or highlight text to make a note!</p>';
        return;
    }

    savedFlashcards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'flashcard';

        let innerContent = '';
        
        if (card.type === 'article' || !card.type) {
            innerContent = `<div class="card-desc">${card.desc}</div>`;
        } else if (card.type === 'highlight') {
            innerContent = `<div class="card-highlight">"${card.selectedText}"</div>`;
        } else if (card.type === 'note') {
            innerContent = `
                <div class="card-highlight">"${card.selectedText}"</div>
                ${card.note ? `<div class="card-note">${card.note}</div>` : ''}
                ${card.tags ? `<div class="card-tags">${card.tags}</div>` : ''}
            `;
        }

        cardDiv.innerHTML = `
            <div class="flashcard-content">
                <div class="card-header">
                    <h3>${card.title}</h3>
                    <span class="card-date">${card.date || ''}</span>
                </div>
                ${innerContent}
            </div>
            <div class="card-actions">
                <button class="read-btn">Read full text</button>
                <button class="delete-btn">Remove</button>
            </div>
        `;

        cardDiv.querySelector('.read-btn').addEventListener('click', () => {
            searchInput.value = card.title;
            performMainSearch(card.title);
        });

        cardDiv.querySelector('.delete-btn').addEventListener('click', () => {
            savedFlashcards.splice(index, 1);
            localStorage.setItem('wikiFlashcards', JSON.stringify(savedFlashcards));
            updateBadgeCount();
            renderFlashcards(); 
        });

        grid.appendChild(cardDiv);
    });
}

// --- 7. VERSION SYNCHRONIZATION VIA FUZZY STRING ALIGNMENT ---
syncVersionBtn.addEventListener('click', () => {
    if (!currentlyViewedTerm || !currentArticleRevid) return;

    let totalUpdatesCounter = 0;

    savedFlashcards.forEach(card => {
        if (card.title === currentlyViewedTerm && card.revid !== currentArticleRevid) {
            // Run alignment routines only if literal textual selection strings exist
            if (card.selectedText) {
                // If it isn't an exact match, call the sliding token index window alignment helper
                if (!currentlyViewedDesc.includes(card.selectedText)) {
                    const dynamicAlignedStr = findFuzzyMatch(currentlyViewedDesc, card.selectedText);
                    if (dynamicAlignedStr) {
                        card.selectedText = dynamicAlignedStr;
                        totalUpdatesCounter++;
                    }
                } else {
                    totalUpdatesCounter++;
                }
            } else if (card.type === 'article' && card.desc) {
                card.desc = currentlyViewedDesc;
                totalUpdatesCounter++;
            }
            // Advance the snapshot revision anchor tag definition safely
            card.revid = currentArticleRevid;
        }
    });

    localStorage.setItem('wikiFlashcards', JSON.stringify(savedFlashcards));
    driftNotification.classList.add('hidden');
    applySavedHighlights(currentlyViewedTerm);
    updateBadgeCount();
    alert(`Syncing operation successful! Remapped ${totalUpdatesCounter} configuration components.`);
});

// --- FUZZY ALIGNMENT ENGINE (SLIDING TOKEN CORRELATION) ---
function findFuzzyMatch(targetText, searchPhrase) {
    if (!targetText || !searchPhrase) return null;

    const searchWords = searchPhrase.toLowerCase().split(/\s+/).filter(Boolean);
    const targetWords = targetText.toLowerCase().split(/\s+/).filter(Boolean);
    const originalTargetWords = targetText.split(/\s+/).filter(Boolean);

    if (searchWords.length === 0 || targetWords.length === 0) return null;

    let optimumMatchProfile = { distance: Infinity, wordStart: -1, wordEnd: -1 };
    const referenceLength = searchWords.length;
    const distanceThresholdLimit = 0.45; // Accepts drifting variations matching up to a 45% matrix shift

    // Evaluate scanning flex bounds to identify phrase drift window frames
    for (let flexOffset = -3; flexOffset <= 3; flexOffset++) {
        const dynamicWindowLength = referenceLength + flexOffset;
        if (dynamicWindowLength <= 0) continue;

        for (let idx = 0; idx <= targetWords.length - dynamicWindowLength; idx++) {
            const chunkSegmentPhrase = targetWords.slice(idx, idx + dynamicWindowLength).join(" ");
            const relativeDistance = calculateLevenshtein(searchPhrase.toLowerCase(), chunkSegmentPhrase);
            const normalizedMetric = relativeDistance / Math.max(searchPhrase.length, chunkSegmentPhrase.length);

            if (normalizedMetric < optimumMatchProfile.distance && normalizedMetric <= distanceThresholdLimit) {
                optimumMatchProfile.distance = normalizedMetric;
                optimumMatchProfile.wordStart = idx;
                optimumMatchProfile.wordEnd = idx + dynamicWindowLength;
            }
        }
    }

    if (optimumMatchProfile.wordStart !== -1) {
        return originalTargetWords.slice(optimumMatchProfile.wordStart, optimumMatchProfile.wordEnd).join(" ");
    }
    return null; 
}

// Levenshtein Distance Calculation Matrix Utilities
function calculateLevenshtein(stringA, stringB) {
    const trackingMatrix = [];
    for (let i = 0; i <= stringA.length; i++) trackingMatrix[i] = [i];
    for (let j = 0; j <= stringB.length; j++) trackingMatrix[0][j] = j;

    for (let i = 1; i <= stringA.length; i++) {
        for (let j = 1; j <= stringB.length; j++) {
            trackingMatrix[i][j] = stringA[i - 1] === stringB[j - 1]
                ? trackingMatrix[i - 1][j - 1]
                : Math.min(
                    trackingMatrix[i - 1][j - 1] + 1, // Substitution
                    trackingMatrix[i][j - 1] + 1,     // Insertion
                    trackingMatrix[i - 1][j] + 1      // Deletion
                  );
        }
    }
    return trackingMatrix[stringA.length][stringB.length];
}

// --- 8. NAVIGATION CONTROLS & UX ---
backBtn.addEventListener('click', function() {
    searchHistory.pop(); 
    if (searchHistory.length > 0) {
        const previousTerm = searchHistory[searchHistory.length - 1];
        searchInput.value = previousTerm;
        performMainSearch(previousTerm, true); 
    } else { goHome(); }
});

homeLogo.addEventListener('click', goHome);

function goHome() {
    document.body.className = 'home-state';
    document.getElementById('content-display').classList.add('hidden');
    document.getElementById('flashcards-display').classList.add('hidden');
    driftNotification.classList.add('hidden');
    searchInput.value = '';
    searchHistory = []; 
    hideHighlightUI();
}

document.addEventListener('click', function(event) {
    if (!searchInput.contains(event.target) && !suggestionsList.contains(event.target)) {
        suggestionsList.className = 'hidden';
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') suggestionsList.className = 'hidden';
    if (event.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'TEXTAREA') {
        event.preventDefault(); 
        searchInput.focus();    
        if (searchInput.value.trim().length > 0) searchInput.dispatchEvent(new Event('input'));
    }
});

// --- 9. TAG INPUT ENHANCEMENT ---
const tagInput = document.getElementById('tag-input');
const tagContainer = document.getElementById('tag-container');

tagInput.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const val = tagInput.value.trim();
        if (val) {
            currentTags.push(val);
            const bubble = document.createElement('span');
            bubble.className = 'tag-bubble';
            bubble.textContent = val + ' x';
            bubble.onclick = () => {
                currentTags = currentTags.filter(t => t !== val);
                bubble.remove();
            };
            tagContainer.appendChild(bubble);
            tagInput.value = '';
        }
    }
});