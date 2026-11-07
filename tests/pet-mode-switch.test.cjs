const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.env.SPELLING_APP_DIR || path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const animals = fs.readFileSync(path.join(root, 'animals.js'), 'utf8');
const fullList = ['rain', 'train', 'paint', 'snail', 'chain', 'brain', 'plain', 'grain', 'stain', 'drain'];
const extract = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `App function missing: ${start}`);
  return source.slice(a, b);
};
const functions = [
  ['function resetQuizState()', 'function shuffleArray('],
  ['async function resetQuiz()', 'function moveToNextWord('],
  ['async function switchToWordSet(', '// Function to toggle voice input'],
  ['function practiceIndividualWord(', '// Function to update UI for individual word practice'],
  ['function exitIndividualWordPractice()', '// Function to detect and clean up duplicate word sets'],
  ['function startPracticeMode()', '// Function to update UI for practice mode'],
  ['function exitPracticeMode()', '// Function to check if student wants to continue practicing'],
  ['function showEndOfQuizFeedback()', '// --- Load Words from Firestore ---'],
].map(([a, b]) => extract(a, b)).join('\n');

function harness() {
  const records = new Map(), boxes = [], errors = [], notices = [];
  const state = { petWrites: 0, resultSaves: 0 };
  const db = {
    collection: collection => ({ doc: user => ({ collection, user, get: async () => snapshot(user) }) }),
    runTransaction: async fn => fn({
      get: async ref => snapshot(ref.user),
      set: (ref, data) => { assert.equal(ref.collection, 'animals'); records.set(ref.user, data); state.petWrites += 1; },
    }),
  };
  const snapshot = user => ({ exists: records.has(user), data: () => records.get(user) });
  const context = vm.createContext({
    console: { log() {}, warn() {}, error: (...args) => errors.push(args) },
    document: {
      addEventListener() {},
      createElement: () => ({ hidden: false, innerHTML: '', setAttribute() {}, remove() { this.removed = true; } }),
      getElementById: id => id === 'modalBody' ? { prepend: box => boxes.push(box) } : { style: {} },
    },
    window: { db },
    setTimeout() {},
    localStorage: { setItem() {} },
    userName: '22-TEST', words: [...fullList], userAnswers: [], hintUsed: [],
    currentWordIndex: 0, currentWordSetId: 'synthetic-set', currentWordSetName: 'Synthetic list',
    userAssignmentId: 'synthetic-set', selectedWordSetId: null, availableWordSets: [],
    isPracticeMode: false, isIndividualWordPractice: false, originalPracticeState: null,
    practiceWords: [], originalWords: [], quizComplete: false, isVoiceInputActive: false,
    sameWord: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
    verifyWordSetAssignment: async () => true,
    getWordsFromAssignment: async () => ({ words: [...fullList], setId: 'synthetic-set', setName: 'Synthetic list' }),
    saveQuizResults: () => { state.resultSaves += 1; },
    showModal() {}, closeModal() {},
    showNotification: (...args) => notices.push(args),
    shuffleArray() {}, updateDisplay() {}, updateWordSetPanel() {}, updatePracticeModeUI() {},
    updateWordSetDisplay() {}, stopInactivityTracking() {}, resetInactivityTimer() {},
    clearResultsPanel() {}, stopVoiceInput() {}, speakWord() {},
  });
  vm.runInContext(animals + '\n' + functions, context);
  const run = code => vm.runInContext(code, context);
  const complete = async (attempts, hints) => {
    context.userAnswers = context.words.map((word, i) => ({ attempts: attempts ? attempts(word, i) : [word], correct: true }));
    context.hintUsed = context.words.map((word, i) => hints ? hints(word, i) : []);
    run('showEndOfQuizFeedback();');
    await new Promise(setImmediate);
  };
  return { context, run, complete, records, boxes, state, errors, notices };
}

test('ordinary complete list retains the existing pet award', async () => {
  const h = harness(); await h.complete();
  assert.equal(h.state.resultSaves, 1); assert.equal(h.state.petWrites, 1);
});
test('single-word practice followed by choosing a full list earns a pet', async () => {
  const h = harness(); h.run('practiceIndividualWord(words[0]);');
  await h.run('switchToWordSet("new-set", "Synthetic list", '+JSON.stringify(fullList)+');');
  assert.equal(h.context.words.length, 10);
  assert.equal(h.context.isIndividualWordPractice, false);
  assert.equal(h.context.originalPracticeState, null);
  await h.complete(); assert.equal(h.state.resultSaves, 1); assert.equal(h.state.petWrites, 1);
});
test('single-word practice followed by resetQuiz clears the obsolete mode', async () => {
  const h = harness(); h.run('practiceIndividualWord(words[0]);'); await h.run('resetQuiz();');
  assert.equal(h.context.words.length, 10);
  assert.equal(h.context.isIndividualWordPractice, false);
  assert.equal(h.context.originalPracticeState, null);
  await h.complete(); assert.equal(h.state.petWrites, 1);
});
test('choosing a full list exits Focus Practice and permits normal saving', async () => {
  const h = harness(); h.context.isPracticeMode = true;
  await h.run('switchToWordSet("new-set", "Synthetic list", '+JSON.stringify(fullList)+');');
  assert.equal(h.context.isPracticeMode, false);
  await h.complete(); assert.equal(h.state.resultSaves, 1); assert.equal(h.state.petWrites, 1);
});
test('failed reload preserves the current single-word state and logs an error', async () => {
  const h = harness(); h.run('practiceIndividualWord(words[0]);');
  h.context.getWordsFromAssignment = async () => { throw new Error('Synthetic load failure'); };
  await h.run('resetQuiz();');
  assert.equal(h.context.words.length, 1); assert.equal(h.context.isIndividualWordPractice, true);
  assert.notEqual(h.context.originalPracticeState, null); assert.equal(h.errors.length, 1);
  await h.complete(); assert.equal(h.state.petWrites, 0);
});
test('a genuine single-word practice still cannot earn a pet', async () => {
  const h = harness(); h.run('practiceIndividualWord(words[0]);'); await h.complete();
  assert.equal(h.context.isIndividualWordPractice, true); assert.equal(h.state.petWrites, 0);
});
test('returning from an individual word to Focus Practice preserves Focus Practice', async () => {
  const h = harness(); h.context.isPracticeMode = true;
  h.run('practiceIndividualWord(words[0]); exitIndividualWordPractice(); resetQuizState();');
  assert.equal(h.context.isPracticeMode, true); assert.equal(h.context.isIndividualWordPractice, false);
  await h.complete(); assert.equal(h.state.resultSaves, 0); assert.equal(h.state.petWrites, 0);
});
test('starting Focus Practice still keeps its mode across the shared quiz reset', () => {
  const h = harness(); h.context.userAnswers = fullList.map(word => ({ attempts: ['incorrect', word], correct: true }));
  h.context.hintUsed = fullList.map(() => []); h.run('startPracticeMode();');
  assert.equal(h.context.isPracticeMode, true); assert.equal(h.context.words.length, 10);
});
test('first try, no hints, minimum length, and eligible cohort remain required', async t => {
  for (const [name, setup, attempts, hints] of [
    ['retry', () => {}, word => ['incorrect', word], null],
    ['hint', () => {}, null, (_, i) => i === 0 ? [0] : []],
    ['short list', h => { h.context.words = fullList.slice(0, 7); }, null, null],
    ['other cohort', h => { h.context.userName = '21-TEST'; }, null, null],
  ]) await t.test(name, async () => { const h = harness(); setup(h); await h.complete(attempts, hints); assert.equal(h.state.petWrites, 0); });
});
test('the existing daily limit and full collection cap are unchanged', async t => {
  await t.test('one pet per Hong Kong day', async () => {
    const h = harness(); h.records.set('22-TEST', { owned: [{ id: 'snail', day: h.context.window.Animals.hktDay() }] });
    await h.complete(); assert.equal(h.state.petWrites, 0); assert.match(h.boxes[0].innerHTML, /already joined you today/);
  });
  await t.test('all seven pets', async () => {
    const h = harness(); h.records.set('22-TEST', { owned: h.context.window.Animals.ANIMALS.map(a => ({ id: a.id, day: '2000-01-01' })) });
    await h.complete(); assert.equal(h.state.petWrites, 0); assert.match(h.boxes[0].innerHTML, /all 7 animals/);
  });
});
