/* ========================================
   Viva Studio — Storage Manager
   ======================================== */

const Storage = (() => {
  const PREFIX = 'viva_';
  let available = false;

  function init() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      available = true;
    } catch (e) {
      available = false;
    }
    return available;
  }

  function isAvailable() { return available; }

  function get(key, fallback = null) {
    if (!available) return fallback;
    try {
      const val = localStorage.getItem(PREFIX + key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  }

  function set(key, value) {
    if (!available) return false;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }

  function remove(key) {
    if (!available) return;
    localStorage.removeItem(PREFIX + key);
  }

  // --- Progress ---
  function getProgress() {
    return get('progress', {
      questions: {},   // { qId: { rating, attempts, lastAttempt, history: [] } }
      bookmarks: [],
      notes: {},       // { qId: noteText }
      sessions: [],    // { id, type, courseIds, questions, startedAt, completedAt }
      currentSession: null
    });
  }

  function saveProgress(progress) { set('progress', progress); }

  function rateQuestion(qId, rating) {
    const p = getProgress();
    if (!p.questions[qId]) {
      p.questions[qId] = { rating: null, attempts: 0, lastAttempt: null, history: [] };
    }
    const q = p.questions[qId];
    q.history.push({ rating: q.rating, at: q.lastAttempt });
    q.rating = rating;
    q.attempts++;
    q.lastAttempt = new Date().toISOString();
    saveProgress(p);
    return q;
  }

  function toggleBookmark(qId) {
    const p = getProgress();
    const idx = p.bookmarks.indexOf(qId);
    if (idx >= 0) { p.bookmarks.splice(idx, 1); }
    else { p.bookmarks.push(qId); }
    saveProgress(p);
    return idx < 0;
  }

  function isBookmarked(qId) {
    return getProgress().bookmarks.includes(qId);
  }

  function saveNote(qId, text) {
    const p = getProgress();
    if (text.trim()) { p.notes[qId] = text; }
    else { delete p.notes[qId]; }
    saveProgress(p);
  }

  function getNote(qId) {
    return getProgress().notes[qId] || '';
  }

  function saveSession(session) {
    const p = getProgress();
    p.currentSession = session;
    saveProgress(p);
  }

  function completeSession(session) {
    const p = getProgress();
    p.currentSession = null;
    session.completedAt = new Date().toISOString();
    p.sessions.push(session);
    saveProgress(p);
  }

  function getCurrentSession() {
    return getProgress().currentSession;
  }

  // --- Export / Import ---
  function exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: getProgress()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viva-studio-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.version && data.progress) {
            saveProgress(data.progress);
            resolve(data);
          } else {
            reject(new Error('Invalid file format'));
          }
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // --- Stats ---
  function getCourseStats(courseId, questions) {
    const p = getProgress();
    const courseQs = questions.filter(q => q.id.startsWith(courseId));
    let got = 0, partly = 0, missed = 0, unanswered = 0;
    courseQs.forEach(q => {
      const r = p.questions[q.id];
      if (!r || r.rating === null) unanswered++;
      else if (r.rating === 'got') got++;
      else if (r.rating === 'partly') partly++;
      else if (r.rating === 'missed') missed++;
    });
    return { total: courseQs.length, got, partly, missed, unanswered };
  }

  function getNeedsPractice() {
    const p = getProgress();
    return Object.entries(p.questions)
      .filter(([, v]) => v.rating === 'partly' || v.rating === 'missed')
      .map(([id]) => id);
  }

  function getPastMistakes() {
    const p = getProgress();
    return Object.entries(p.questions)
      .filter(([, v]) => v.history.some(h => h.rating === 'partly' || h.rating === 'missed'))
      .map(([id]) => id);
  }

  init();

  return {
    init, isAvailable, get, set, remove,
    getProgress, saveProgress, rateQuestion,
    toggleBookmark, isBookmarked, saveNote, getNote,
    saveSession, completeSession, getCurrentSession,
    exportData, importData,
    getCourseStats, getNeedsPractice, getPastMistakes
  };
})();
