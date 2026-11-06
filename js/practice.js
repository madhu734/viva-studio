/* ========================================
   Viva Studio — Practice Engine
   Handles session creation, question selection,
   mock viva timing, and retry logic
   ======================================== */

const Practice = (() => {

  let currentSession = null;
  let currentIndex = 0;
  let vivaTimer = null;
  let vivaStartTime = null;
  let vivaDuration = 0;

  // --- Session creation ---
  function createSession(options = {}) {
    const {
      type = 'course',       // 'course' | 'mixed' | 'connections' | 'essentials' | 'mockViva' | 'review'
      courseId = null,
      courseIds = null,
      topicId = null,
      difficulty = null,
      questionType = null,
      size = 20,
      reviewType = null,     // 'needsPractice' | 'pastMistakes' | 'bookmarks'
      vivaDuration: vd = 10  // minutes for mock viva
    } = options;

    let pool = [];

    if (type === 'review') {
      pool = _getReviewPool(reviewType);
    } else if (type === 'essentials') {
      pool = Content.getEssentials();
    } else if (type === 'connections') {
      pool = Content.getConnectionQuestions();
    } else if (type === 'mixed') {
      pool = _getMixedPool(courseIds || Content.getCourseCodes(), size);
    } else if (type === 'mockViva') {
      pool = _getVivaPool(courseIds || Content.getCourseCodes());
    } else {
      pool = Content.getQuestions({ courseId, topicId, difficulty, type: questionType });
    }

    if (pool.length === 0) return null;

    // Shuffle
    pool = _shuffle(pool);

    // Limit size (except mock viva which has its own sizing)
    if (type !== 'mockViva') {
      pool = pool.slice(0, Math.min(size, pool.length));
    }

    currentSession = {
      id: 'sess_' + Date.now(),
      type,
      courseId,
      courseIds: courseIds || (courseId ? [courseId] : Content.getCourseCodes()),
      questions: pool.map(q => ({
        id: q.id,
        rating: null,
        skipped: false,
        userAnswer: ''
      })),
      questionData: pool,
      size: pool.length,
      startedAt: new Date().toISOString(),
      completedAt: null,
      vivaDuration: type === 'mockViva' ? vd * 60 : 0 // seconds
    };

    currentIndex = 0;
    Storage.saveSession(currentSession);
    return currentSession;
  }

  function _getReviewPool(reviewType) {
    let ids = [];
    if (reviewType === 'needsPractice') ids = Storage.getNeedsPractice();
    else if (reviewType === 'pastMistakes') ids = Storage.getPastMistakes();
    else if (reviewType === 'bookmarks') ids = Storage.getProgress().bookmarks;
    return Content.getQuestions({ ids });
  }

  function _getMixedPool(courseIds, size) {
    const progress = Storage.getProgress();
    const perCourse = Math.ceil(size / courseIds.length);
    let pool = [];

    courseIds.forEach(cid => {
      const courseQs = Content.getQuestions({ courseId: cid });
      const needsPractice = courseQs.filter(q => {
        const r = progress.questions[q.id];
        return r && (r.rating === 'partly' || r.rating === 'missed');
      });
      const unseen = courseQs.filter(q => !progress.questions[q.id]);
      const gotIt = courseQs.filter(q => {
        const r = progress.questions[q.id];
        return r && r.rating === 'got';
      });

      // Half weak, half new; fill with got-it if needed
      const half = Math.ceil(perCourse / 2);
      let selected = [];
      selected.push(..._shuffle(needsPractice).slice(0, half));
      selected.push(..._shuffle(unseen).slice(0, half));
      if (selected.length < perCourse) {
        selected.push(..._shuffle(gotIt).slice(0, perCourse - selected.length));
      }
      pool.push(...selected);
    });

    return pool;
  }

  function _getVivaPool(courseIds) {
    // Mock viva: 12-15 questions, mix of types, with follow-up chains
    const allQs = Content.getQuestions({ courseIds });
    const chains = allQs.filter(q => q.followUp);
    const standalone = allQs.filter(q => !q.followUp);
    
    let pool = [];
    // Pick 3-4 chain starters
    const chainStarters = _shuffle(chains).slice(0, 4);
    chainStarters.forEach(q => {
      pool.push(q);
      let next = q.followUp;
      let depth = 0;
      while (next && depth < 3) {
        const followQ = Content.getQuestion(next);
        if (followQ) {
          pool.push(followQ);
          next = followQ.followUp;
        } else break;
        depth++;
      }
    });

    // Fill remaining with standalone
    const remaining = 15 - pool.length;
    if (remaining > 0) {
      const usedIds = new Set(pool.map(q => q.id));
      const extra = _shuffle(standalone.filter(q => !usedIds.has(q.id))).slice(0, remaining);
      pool.push(...extra);
    }

    return pool.slice(0, 15);
  }

  function _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // --- Navigation ---
  function getCurrentQuestion() {
    if (!currentSession) return null;
    return {
      data: currentSession.questionData[currentIndex],
      state: currentSession.questions[currentIndex],
      index: currentIndex,
      total: currentSession.size
    };
  }

  function nextQuestion() {
    if (!currentSession || currentIndex >= currentSession.size - 1) return null;
    currentIndex++;
    Storage.saveSession(currentSession);
    return getCurrentQuestion();
  }

  function prevQuestion() {
    if (!currentSession || currentIndex <= 0) return null;
    currentIndex--;
    return getCurrentQuestion();
  }

  function goToQuestion(index) {
    if (!currentSession || index < 0 || index >= currentSession.size) return null;
    currentIndex = index;
    return getCurrentQuestion();
  }

  // --- Rating ---
  function rateCurrentQuestion(rating) {
    if (!currentSession) return;
    const state = currentSession.questions[currentIndex];
    state.rating = rating;
    Storage.rateQuestion(state.id, rating);
    Storage.saveSession(currentSession);
  }

  function skipCurrentQuestion() {
    if (!currentSession) return;
    currentSession.questions[currentIndex].skipped = true;
    Storage.saveSession(currentSession);
  }

  function iDontKnow() {
    if (!currentSession) return;
    currentSession.questions[currentIndex].rating = 'missed';
    Storage.rateQuestion(currentSession.questions[currentIndex].id, 'missed');
    Storage.saveSession(currentSession);
  }

  function saveUserAnswer(text) {
    if (!currentSession) return;
    currentSession.questions[currentIndex].userAnswer = text;
    Storage.saveSession(currentSession);
  }

  // --- Session state ---
  function isSessionComplete() {
    if (!currentSession) return false;
    return currentIndex >= currentSession.size - 1 &&
      currentSession.questions.every(q => q.rating !== null || q.skipped);
  }

  function getSessionSummary() {
    if (!currentSession) return null;
    const qs = currentSession.questions;
    return {
      total: qs.length,
      got: qs.filter(q => q.rating === 'got').length,
      partly: qs.filter(q => q.rating === 'partly').length,
      missed: qs.filter(q => q.rating === 'missed').length,
      skipped: qs.filter(q => q.skipped).length,
      unanswered: qs.filter(q => q.rating === null && !q.skipped).length
    };
  }

  function getMissedQuestions() {
    if (!currentSession) return [];
    return currentSession.questions
      .filter(q => q.rating === 'partly' || q.rating === 'missed')
      .map(q => Content.getQuestion(q.id))
      .filter(Boolean);
  }

  function completeSession() {
    if (!currentSession) return;
    Storage.completeSession(currentSession);
    const summary = getSessionSummary();
    currentSession = null;
    currentIndex = 0;
    return summary;
  }

  function resumeSession() {
    const saved = Storage.getCurrentSession();
    if (!saved) return null;

    // Rebuild questionData from saved IDs
    saved.questionData = saved.questions.map(q => Content.getQuestion(q.id)).filter(Boolean);
    if (saved.questionData.length !== saved.questions.length) {
      // Data mismatch, discard session
      Storage.saveSession(null);
      return null;
    }

    currentSession = saved;
    // Find first unanswered
    currentIndex = saved.questions.findIndex(q => q.rating === null && !q.skipped);
    if (currentIndex === -1) currentIndex = saved.questions.length - 1;
    return currentSession;
  }

  function getSession() { return currentSession; }

  // --- Mock Viva Timer ---
  function startVivaTimer(onTick, onEnd) {
    if (!currentSession || currentSession.type !== 'mockViva') return;
    vivaStartTime = Date.now();
    vivaDuration = currentSession.vivaDuration * 1000; // ms

    vivaTimer = setInterval(() => {
      const elapsed = Date.now() - vivaStartTime;
      const remaining = Math.max(0, vivaDuration - elapsed);
      const seconds = Math.ceil(remaining / 1000);

      if (onTick) onTick(seconds);

      if (remaining <= 0) {
        clearInterval(vivaTimer);
        vivaTimer = null;
        if (onEnd) onEnd();
      }
    }, 1000);
  }

  function stopVivaTimer() {
    if (vivaTimer) {
      clearInterval(vivaTimer);
      vivaTimer = null;
    }
  }

  function getVivaTimeRemaining() {
    if (!vivaStartTime) return 0;
    const elapsed = Date.now() - vivaStartTime;
    return Math.max(0, Math.ceil((vivaDuration - elapsed) / 1000));
  }

  function retryMissed() {
    const missed = getMissedQuestions();
    if (missed.length === 0) return null;

    currentSession = {
      id: 'sess_retry_' + Date.now(),
      type: 'retry',
      courseIds: [...new Set(missed.map(q => q.courseId))],
      questions: missed.map(q => ({
        id: q.id,
        rating: null,
        skipped: false,
        userAnswer: ''
      })),
      questionData: missed,
      size: missed.length,
      startedAt: new Date().toISOString(),
      completedAt: null,
      vivaDuration: 0
    };

    currentIndex = 0;
    Storage.saveSession(currentSession);
    return currentSession;
  }

  return {
    createSession, getCurrentQuestion, nextQuestion, prevQuestion, goToQuestion,
    rateCurrentQuestion, skipCurrentQuestion, iDontKnow, saveUserAnswer,
    isSessionComplete, getSessionSummary, getMissedQuestions,
    completeSession, resumeSession, getSession, retryMissed,
    startVivaTimer, stopVivaTimer, getVivaTimeRemaining
  };
})();
