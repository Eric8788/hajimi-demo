const QUESTION_SECONDS = 45;
const QUESTIONS_PER_LEVEL = 10;
const START_LIVES = 3;
const STORAGE_KEY = "vocab-runner-arcade-v2";

const vocabApi = {
  units() {
    return window.VOCAB_UNITS || [];
  },
  unit(index) {
    return this.units()[index];
  },
  words(index) {
    return this.unit(index)?.words || [];
  },
  allWords() {
    return this.units().flatMap((unit) => unit.words);
  },
  count() {
    return this.units().length;
  },
};

const state = {
  activeUnit: 0,
  queue: [],
  currentIndex: 0,
  correct: 0,
  answered: 0,
  combo: 0,
  bestCombo: 0,
  lives: START_LIVES,
  timeLeft: QUESTION_SECONDS,
  running: false,
  locked: true,
  timerId: null,
  lastTermsByUnit: {},
  progress: loadProgress(),
};

const els = {
  levelList: document.querySelector("#levelList"),
  totalDistance: document.querySelector("#totalDistance"),
  bestUnit: document.querySelector("#bestUnit"),
  unitName: document.querySelector("#unitName"),
  challengeStatus: document.querySelector("#challengeStatus"),
  timer: document.querySelector("#timer"),
  combo: document.querySelector("#combo"),
  lives: document.querySelector("#lives"),
  track: document.querySelector(".track"),
  runner: document.querySelector("#runner"),
  obstacle: document.querySelector("#obstacle"),
  obstacleWord: document.querySelector("#obstacleWord"),
  questionCount: document.querySelector("#questionCount"),
  accuracy: document.querySelector("#accuracy"),
  modeChip: document.querySelector("#modeChip"),
  questionText: document.querySelector("#questionText"),
  exampleText: document.querySelector("#exampleText"),
  answerArea: document.querySelector("#answerArea"),
  feedback: document.querySelector("#feedback"),
  startButton: document.querySelector("#startButton"),
  skipButton: document.querySelector("#skipButton"),
  resetButton: document.querySelector("#resetButton"),
  celebrationModal: document.querySelector("#celebrationModal"),
  celebrateReplay: document.querySelector("#celebrateReplay"),
  celebrateClose: document.querySelector("#celebrateClose"),
};

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.unlocked === "number") return saved;
  } catch (_error) {
    // Start fresh if localStorage was edited by hand.
  }
  return { unlocked: 0, best: {}, totalDistance: 0, celebratedAll: false };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalize(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[。！？!?]/g, "")
    .replace(/[.。…]+$/g, "")
    .replace(/\s+/g, " ");
}

function unitLabel(index) {
  return vocabApi.unit(index)?.unit.replace("Unit ", "U") || "Unit";
}

function allWords() {
  return vocabApi.allWords();
}

function selectLevel(index) {
  if (index > state.progress.unlocked || state.running) return;
  state.activeUnit = index;
  setupIdleScreen();
  renderLevels();
}

function setupIdleScreen() {
  stopTimer();
  state.queue = [];
  state.currentIndex = 0;
  state.correct = 0;
  state.answered = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.lives = START_LIVES;
  state.timeLeft = QUESTION_SECONDS;
  state.running = false;
  state.locked = true;

  els.unitName.textContent = vocabApi.unit(state.activeUnit).unit;
  els.challengeStatus.textContent = `${QUESTION_SECONDS}s per question`;
  els.modeChip.textContent = "Arcade Review";
  els.questionText.textContent = "Answer quickly to jump over each vocabulary obstacle.";
  els.exampleText.textContent = `Each question has ${QUESTION_SECONDS} seconds. Correct answers clear obstacles. Wrong answers cost one heart. Finish ${QUESTIONS_PER_LEVEL} obstacles to complete the unit.`;
  els.answerArea.innerHTML = "";
  els.feedback.textContent = "Press Start Run when students are ready.";
  els.feedback.className = "feedback";
  els.startButton.textContent = "Start Run";
  els.startButton.disabled = false;
  els.skipButton.disabled = true;
  els.obstacleWord.textContent = "Ready";
  resetObstacle();
  updateHud();
}

function startRun() {
  state.queue = buildQuestionQueue(vocabApi.words(state.activeUnit), state.lastTermsByUnit[state.activeUnit] || []);
  state.lastTermsByUnit[state.activeUnit] = state.queue.map((item) => item.term);
  state.currentIndex = 0;
  state.correct = 0;
  state.answered = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.lives = START_LIVES;
  state.timeLeft = QUESTION_SECONDS;
  state.running = true;
  state.locked = false;

  els.startButton.disabled = true;
  els.skipButton.disabled = false;
  els.challengeStatus.textContent = "Run";
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.track.classList.add("fast");
  els.runner.classList.add("running");
  renderQuestion();
  updateHud();
}

function buildQuestionQueue(words, previousTerms = []) {
  const modes = ["meaning", "word", "spell"];
  const previous = new Set(previousTerms);
  const freshWords = shuffle(words.filter((word) => !previous.has(word.term)));
  const refillWords = shuffle(words.filter((word) => previous.has(word.term)));
  return freshWords
    .concat(refillWords, shuffle(words))
    .slice(0, QUESTIONS_PER_LEVEL)
    .map((word, index) => ({ ...word, mode: modes[index % modes.length] }));
}

function startTimer() {
  stopTimer();
  state.timerId = window.setInterval(() => {
    state.timeLeft -= 1;
    updateHud();
    if (state.timeLeft <= 0) handleQuestionTimeout();
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function renderLevels() {
  els.levelList.innerHTML = "";
  vocabApi.units().forEach((unit, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-card";
    if (index === state.activeUnit) button.classList.add("active");
    if (index > state.progress.unlocked) button.classList.add("locked");
    button.innerHTML = `
      <strong>${unitLabel(index)} · ${unit.unit.replace(/^Unit \d+\s*/, "")}</strong>
      <span>${levelStatus(index)}</span>
    `;
    button.addEventListener("click", () => selectLevel(index));
    els.levelList.appendChild(button);
  });

  els.totalDistance.textContent = `${state.progress.totalDistance || 0}m`;
  els.bestUnit.textContent = unitLabel(state.activeUnit);
}

function renderQuestion() {
  if (!state.running) return;
  if (state.currentIndex >= QUESTIONS_PER_LEVEL) {
    finishRun("complete");
    return;
  }

  const item = state.queue[state.currentIndex];
  state.timeLeft = QUESTION_SECONDS;
  state.locked = false;
  els.answerArea.innerHTML = "";
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.obstacleWord.textContent = obstacleLabel(item.mode);
  launchObstacle();
  startTimer();

  if (item.mode === "meaning") {
    els.modeChip.textContent = "Meaning Jump";
    els.questionText.textContent = `What does "${item.term}" mean?`;
    els.exampleText.textContent = item.example;
    renderChoices(item.meaning, getMeaningDistractors(item));
  } else if (item.mode === "word") {
    const blank = blankExample(item);
    els.modeChip.textContent = "Word Dodge";
    els.questionText.textContent = blank.question;
    els.exampleText.textContent = blank.text;
    renderChoices(item.term, getTermDistractors(item));
  } else {
    const blank = blankExample(item);
    els.modeChip.textContent = "Spelling Jump";
    els.questionText.textContent = `Type the English word or phrase for: ${item.meaning}`;
    els.exampleText.textContent = blank.text;
    renderSpellingInput();
  }

  updateHud();
}

function renderChoices(answer, distractors) {
  const choices = shuffle([answer, ...distractors]).slice(0, 4);
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice;
    button.addEventListener("click", () => submitAnswer(choice));
    els.answerArea.appendChild(button);
  });
}

function renderSpellingInput() {
  const row = document.createElement("div");
  row.className = "spelling-row";

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = "Type answer before the obstacle reaches you";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitAnswer(input.value);
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-button";
  button.textContent = "Jump";
  button.addEventListener("click", () => submitAnswer(input.value));

  row.append(input, button);
  els.answerArea.appendChild(row);
  input.focus();
}

function getMeaningDistractors(item) {
  return shuffle(allWords().filter((word) => word.meaning !== item.meaning))
    .slice(0, 3)
    .map((word) => word.meaning);
}

function getTermDistractors(item) {
  return shuffle(vocabApi.words(state.activeUnit).filter((word) => word.term !== item.term))
    .slice(0, 3)
    .map((word) => word.term);
}

function submitAnswer(value) {
  if (!state.running || state.locked) return;
  state.locked = true;
  stopTimer();
  state.answered += 1;

  const item = state.queue[state.currentIndex];
  const correct = isCorrectAnswer(value, item);
  disableCurrentInputs(value, correct);

  if (correct) {
    state.correct += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    els.feedback.textContent = state.combo >= 3 ? `Combo x${state.combo}. Clean jump.` : "Correct. Jump!";
    els.feedback.className = "feedback good";
    playClearAnimation();
  } else {
    state.combo = 0;
    state.lives -= 1;
    const answer = item.mode === "meaning" ? item.meaning : item.term;
    els.feedback.textContent = `Hit. Answer: ${answer}`;
    els.feedback.className = "feedback bad";
    playCrashAnimation();
  }

  updateHud();
  if (state.lives <= 0) {
    window.setTimeout(() => finishRun("lives"), 560);
    return;
  }
  window.setTimeout(nextQuestion, 700);
}

function disableCurrentInputs(value, correct) {
  const item = state.queue[state.currentIndex];
  [...els.answerArea.querySelectorAll(".choice-button")].forEach((button) => {
    const answer = item.mode === "meaning" ? item.meaning : item.term;
    if (normalize(button.textContent) === normalize(answer)) button.classList.add("correct");
    if (normalize(button.textContent) === normalize(value) && !correct) button.classList.add("wrong");
    button.disabled = true;
  });
  const input = els.answerArea.querySelector("input");
  if (input) input.disabled = true;
  const checkButton = els.answerArea.querySelector(".primary-button");
  if (checkButton) checkButton.disabled = true;
}

function nextQuestion() {
  if (!state.running) return;
  state.currentIndex += 1;
  if (state.currentIndex >= QUESTIONS_PER_LEVEL) {
    finishRun("complete");
    return;
  }
  renderQuestion();
}

function skipQuestion() {
  if (!state.running || state.locked) return;
  submitAnswer("");
}

function finishRun(reason) {
  if (!state.running) return;
  stopTimer();
  state.running = false;
  state.locked = true;
  els.track.classList.remove("fast");
  els.runner.classList.remove("running");
  resetObstacle();

  const distance = state.correct * 100 + state.bestCombo * 10;
  const passed = state.currentIndex >= QUESTIONS_PER_LEVEL && state.correct >= 6;
  const best = Math.max(state.progress.best[state.activeUnit] || 0, distance);
  state.progress.best[state.activeUnit] = best;
  state.progress.totalDistance = Object.values(state.progress.best).reduce((sum, value) => sum + value, 0);
  if (passed && state.activeUnit === state.progress.unlocked && state.activeUnit < vocabApi.count() - 1) {
    state.progress.unlocked += 1;
  }
  const allUnitsComplete = passed && state.activeUnit === vocabApi.count() - 1 && !state.progress.celebratedAll;
  if (allUnitsComplete) {
    state.progress.celebratedAll = true;
  }
  saveProgress();
  renderLevels();

  els.modeChip.textContent = passed ? "Stage Clear" : "Run Over";
  els.questionText.textContent = resultHeadline(reason, passed, distance);
  els.exampleText.textContent = `Correct: ${state.correct} | Questions: ${state.answered} | Best combo: x${state.bestCombo}`;
  els.answerArea.innerHTML = "";
  renderFinishOptions(passed);
  els.feedback.textContent = passed ? "Next unit unlocked. Students earned a faster lane." : "Try this unit again and answer at least 6 correctly.";
  els.feedback.className = `feedback ${passed ? "good" : "bad"}`;
  els.startButton.textContent = passed && state.activeUnit < vocabApi.count() - 1 ? "Next Unit" : "Replay";
  els.startButton.disabled = false;
  els.skipButton.disabled = true;
  els.challengeStatus.textContent = `${distance}m`;
  updateHud();
  if (allUnitsComplete) {
    window.setTimeout(showCelebration, 550);
  }
}

function renderFinishOptions(passed) {
  const row = document.createElement("div");
  row.className = "finish-options";

  if (passed && state.activeUnit < vocabApi.count() - 1) {
    const next = document.createElement("button");
    next.type = "button";
    next.className = "primary-button";
    next.textContent = "Next Level";
    next.addEventListener("click", () => {
      selectLevel(state.activeUnit + 1);
      startRun();
    });
    row.appendChild(next);
  }

  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = passed ? "secondary-button" : "primary-button";
  replay.textContent = "Replay";
  replay.addEventListener("click", startRun);
  row.appendChild(replay);

  const select = document.createElement("button");
  select.type = "button";
  select.className = "secondary-button";
  select.textContent = "Level Select";
  select.addEventListener("click", setupIdleScreen);
  row.appendChild(select);

  els.answerArea.appendChild(row);
}

function levelStatus(index) {
  if (index > state.progress.unlocked) return "Locked";
  if (state.progress.best[index]) return `Unlocked · Best ${state.progress.best[index]}m · Replay`;
  if (index < state.progress.unlocked) return "Unlocked · Replay";
  return "Ready";
}

function showCelebration() {
  els.celebrationModal.hidden = false;
}

function hideCelebration() {
  els.celebrationModal.hidden = true;
}

function resultHeadline(reason, passed, distance) {
  if (passed) return `Stage clear: ${distance}m.`;
  if (reason === "lives") return `Three hits. You ran ${distance}m.`;
  return `Run complete. You ran ${distance}m.`;
}

function updateHud() {
  els.timer.textContent = `${state.timeLeft}s`;
  els.combo.textContent = `x${state.combo}`;
  els.lives.textContent = "♥ ".repeat(Math.max(0, state.lives)).trim() || "0";
  els.questionCount.textContent = state.running ? `Obstacle ${Math.min(state.currentIndex + 1, QUESTIONS_PER_LEVEL)} / ${QUESTIONS_PER_LEVEL}` : "Ready";
  const accuracy = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
  els.accuracy.textContent = `Accuracy ${accuracy}%`;
  els.totalDistance.textContent = `${state.progress.totalDistance || 0}m`;
  els.bestUnit.textContent = unitLabel(state.activeUnit);
}

function launchObstacle() {
  resetObstacle();
  els.obstacle.style.setProperty("--obstacle-speed", `${QUESTION_SECONDS}s`);
  window.requestAnimationFrame(() => els.obstacle.classList.add("active"));
}

function obstacleLabel(mode) {
  if (mode === "spell") return "Spell!";
  if (mode === "word") return "Choose!";
  return "Meaning!";
}

function resetObstacle() {
  els.obstacle.classList.remove("active", "clear", "crash");
  void els.obstacle.offsetWidth;
}

function playClearAnimation() {
  els.obstacle.classList.remove("active");
  els.obstacle.classList.add("clear");
  els.runner.classList.remove("jump");
  void els.runner.offsetWidth;
  els.runner.classList.add("jump");
}

function playCrashAnimation() {
  els.obstacle.classList.remove("active");
  els.obstacle.classList.add("crash");
  els.runner.classList.remove("hit");
  void els.runner.offsetWidth;
  els.runner.classList.add("hit");
}

function isCorrectAnswer(value, item) {
  const answer = item.mode === "meaning" ? item.meaning : item.term;
  return acceptableAnswers(answer, item.mode).some((candidate) => normalize(value) === normalize(candidate));
}

function acceptableAnswers(answer, mode) {
  const answers = new Set([answer]);
  if (mode !== "spell") return [...answers];

  answers.add(answer.replace(/^to\s+/, ""));
  answers.add(answer.replace(/\bsth\.?\b/gi, "").trim());
  answers.add(answer.replace(/\bsb\.?\b/gi, "").trim());
  answers.add(answer.replace(/\bsomeone\b/gi, "").trim());
  answers.add(answer.replace(/\bsomething\b/gi, "").trim());
  answers.add(answer.replace(/\bsth\.?\b/gi, "something").trim());
  answers.add(answer.replace(/\bsb\.?\b/gi, "someone").trim());
  answers.add(answer.replace(/\s+\.\.+$/g, "").trim());

  return [...answers].filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blankExample(item) {
  const variants = [
    item.term,
    item.term.replace(/^to\s+/, ""),
    item.term.replace("someone", "students"),
    item.term.replace("sb.", "me"),
    item.term.replace("sth.", "my homework"),
  ].filter(Boolean);

  for (const variant of variants) {
    const pattern = new RegExp(escapeRegExp(variant), "i");
    if (pattern.test(item.example)) {
      return {
        question: "Choose the word or phrase that completes the sentence.",
        text: item.example.replace(pattern, "______"),
      };
    }
  }
  return {
    question: "Choose the word or phrase that matches the clue.",
    text: `Clue: ${item.meaning}. Answer: ______`,
  };
}

function handleStartButton() {
  if (state.running) return;
  if (els.startButton.textContent === "Next Unit" && state.activeUnit < vocabApi.count() - 1) {
    selectLevel(state.activeUnit + 1);
  }
  startRun();
}

function resetProgress() {
  stopTimer();
  localStorage.removeItem(STORAGE_KEY);
  state.progress = loadProgress();
  state.activeUnit = 0;
  setupIdleScreen();
  renderLevels();
}

els.startButton.addEventListener("click", handleStartButton);
els.skipButton.addEventListener("click", skipQuestion);
els.resetButton.addEventListener("click", resetProgress);
els.celebrateClose.addEventListener("click", hideCelebration);
els.celebrateReplay.addEventListener("click", () => {
  hideCelebration();
  selectLevel(0);
  startRun();
});
els.celebrationModal.addEventListener("click", (event) => {
  if (event.target === els.celebrationModal) hideCelebration();
});
els.obstacle.addEventListener("animationend", (event) => {
  if (event.animationName === "obstacle-approach" && state.running && !state.locked) {
    submitAnswer("");
  }
});

function handleQuestionTimeout() {
  if (!state.running || state.locked) return;
  submitAnswer("");
}

setupIdleScreen();
renderLevels();
