/* ========================================
   Viva Studio — Main Application
   UI rendering, routing, and event handling
   ======================================== */

const App = (() => {
  let currentView = 'home';
  let currentCourse = null;
  let currentTopic = null;
  let guideOpen = false;

  // --- Init ---
  async function init() {
    Storage.init();
    renderNav();
    showLoading();

    await Content.loadAll();

    // Check for saved session
    const saved = Practice.resumeSession();
    if (saved) {
      currentView = 'practice';
      renderPracticeView();
    } else {
      navigate('home');
    }

    bindGlobalEvents();

    if (!Storage.isAvailable()) {
      showToast('Progress cannot be saved — your browser may be in private mode.', 'warning');
    }
  }

  // --- Navigation ---
  function navigate(view, params = {}) {
    currentView = view;
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    const main = document.getElementById('main');
    switch (view) {
      case 'home': renderHome(); break;
      case 'study': renderStudy(params); break;
      case 'practice': renderPracticeConfig(params); break;
      case 'review': renderReview(); break;
      default: renderHome();
    }
    window.scrollTo(0, 0);
  }

  // --- Render Nav ---
  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = `
      <div class="nav-brand" onclick="App.navigate('home')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        Viva Studio
      </div>
      <div class="nav-links">
        <button class="nav-link active" data-view="home" onclick="App.navigate('home')">Home</button>
        <button class="nav-link" data-view="study" onclick="App.navigate('study')">Study</button>
        <button class="nav-link" data-view="practice" onclick="App.navigate('practice')">Practice</button>
        <button class="nav-link" data-view="review" onclick="App.navigate('review')">Review</button>
      </div>
      <button class="nav-search-btn" onclick="App.toggleSearch()" title="Search (Ctrl+K)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </button>
    `;
  }

  // --- Home ---
  function renderHome() {
    const main = document.getElementById('main');
    const courses = Content.getCourses();
    const allQs = Content.getAllQuestions();
    const progress = Storage.getProgress();

    // Overall stats
    let totalGot = 0, totalAnswered = 0;
    allQs.forEach(q => {
      const r = progress.questions[q.id];
      if (r && r.rating) { totalAnswered++; if (r.rating === 'got') totalGot++; }
    });

    const needsPractice = Storage.getNeedsPractice();
    const savedSession = Practice.getSession();

    main.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1>Welcome to Viva Studio</h1>
        <p style="color: var(--text-secondary); margin-top: 4px;">
          Prepare for your English viva — study, practise, and review seven courses.
        </p>
      </div>

      ${savedSession ? `
        <div class="card" style="border-color: var(--accent); background: var(--accent-light);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="card-title">⏸ Session in progress</div>
              <div class="card-subtitle">${savedSession.type} — ${savedSession.questions.filter(q => q.rating).length}/${savedSession.size} answered</div>
            </div>
            <button class="btn btn-primary" onclick="App.resumePractice()">Continue</button>
          </div>
        </div>
      ` : ''}

      ${needsPractice.length > 0 ? `
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="card-title">🎯 ${needsPractice.length} questions need practice</div>
              <div class="card-subtitle">Topics you marked as partly known or missed</div>
            </div>
            <button class="btn btn-primary btn-small" onclick="App.startReviewPractice('needsPractice')">Practice now</button>
          </div>
        </div>
      ` : ''}

      <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="App.navigate('practice', {type:'essentials'})">📋 Essentials (2-day prep)</button>
        <button class="btn btn-secondary" onclick="App.navigate('practice', {type:'mixed'})">🔀 Mixed Practice</button>
        <button class="btn btn-outline" onclick="App.navigate('practice', {type:'mockViva'})">🎤 Mock Viva</button>
      </div>

      <div style="margin-bottom: 12px;">
        <h2>Your Courses</h2>
        ${allQs.length > 0 ? `<p style="font-size: 0.85rem; color: var(--text-muted);">${totalAnswered}/${allQs.length} questions attempted · ${totalGot} confident</p>` : ''}
      </div>

      <div class="course-grid">
        ${courses.map(c => {
          const stats = Storage.getCourseStats(c.courseId, allQs);
          const pct = stats.total > 0 ? Math.round((stats.got / stats.total) * 100) : 0;
          return `
            <div class="course-card" onclick="App.navigate('study', {courseId:'${c.courseId}'})">
              <div class="course-code">${c.courseId}</div>
              <div class="course-name">${Content.getCourseName(c.courseId)}</div>
              <div class="course-stats">${c.topics.length} topics · ${c.questions.length} questions</div>
              ${stats.total > 0 ? `
                <div class="progress-bar">
                  <div class="progress-fill ${pct >= 70 ? 'good' : pct >= 40 ? 'partial' : 'weak'}" style="width: ${pct}%"></div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${pct}% confident</div>
              ` : '<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">Not started</div>'}
            </div>
          `;
        }).join('')}
      </div>

      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border);">
        <h3 style="margin-bottom: 12px;">Progress</h3>
        <div class="btn-group">
          <button class="btn btn-outline btn-small" onclick="Storage.exportData(); App.showToast('Progress exported!', 'success')">📤 Export progress</button>
          <button class="btn btn-outline btn-small" onclick="document.getElementById('importFile').click()">📥 Import progress</button>
          <input type="file" id="importFile" accept=".json" style="display:none" onchange="App.handleImport(event)">
        </div>
      </div>
    `;
  }

  // --- Study ---
  function renderStudy(params = {}) {
    const main = document.getElementById('main');
    currentCourse = params.courseId || null;
    currentTopic = params.topicId || null;

    if (!currentCourse) {
      // Course list
      const courses = Content.getCourses();
      main.innerHTML = `
        <h1 style="margin-bottom: 16px;">Study</h1>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">Choose a course to start studying.</p>
        <div class="course-grid">
          ${courses.map(c => `
            <div class="course-card" onclick="App.navigate('study', {courseId:'${c.courseId}'})">
              <div class="course-code">${c.courseId}</div>
              <div class="course-name">${Content.getCourseName(c.courseId)}</div>
              <div class="course-stats">${c.topics.length} topics</div>
            </div>
          `).join('')}
        </div>
      `;
      return;
    }

    const course = Content.getCourse(currentCourse);
    if (!course) { main.innerHTML = '<div class="empty-state"><h3>Course not found</h3></div>'; return; }

    if (currentTopic) {
      renderTopicDetail(course, currentTopic);
      return;
    }

    // Course overview + topic list
    main.innerHTML = `
      <button class="btn btn-outline btn-small" onclick="App.navigate('study')" style="margin-bottom: 16px;">← All courses</button>
      <h1>${course.courseId}: ${Content.getCourseName(course.courseId)}</h1>

      <div class="card" style="margin-top: 16px;">
        <div class="study-section-title"><span class="icon">📖</span> The course in one view</div>
        <div style="line-height: 1.8;">${course.overview}</div>
      </div>

      <h2 style="margin: 20px 0 12px;">Topics</h2>
      ${course.topics.map((t, i) => `
        <div class="card" style="cursor: pointer;" onclick="App.navigate('study', {courseId:'${course.courseId}', topicId:'${t.id}'})">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">${i + 1}</div>
            <div>
              <div style="font-weight: 600;">${t.title}</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${t.coreIdea.substring(0, 120)}${t.coreIdea.length > 120 ? '...' : ''}</div>
            </div>
          </div>
        </div>
      `).join('')}

      <div style="margin-top: 20px;">
        <button class="btn btn-primary" onclick="App.navigate('practice', {type:'course', courseId:'${course.courseId}'})">Practice ${course.courseId}</button>
      </div>
    `;
  }

  function renderTopicDetail(course, topicId) {
    const main = document.getElementById('main');
    const topic = course.topics.find(t => t.id === topicId);
    if (!topic) { main.innerHTML = '<div class="empty-state"><h3>Topic not found</h3></div>'; return; }

    const relatedTopics = (topic.relatedConcepts || []).map(id => {
      const t = Content.getTopic(id);
      return t ? `<span class="topic-chip" onclick="App.navigateToTopic('${id}')">${t.title} (${t.courseId})</span>` : '';
    }).filter(Boolean).join('');

    main.innerHTML = `
      <button class="btn btn-outline btn-small" onclick="App.navigate('study', {courseId:'${course.courseId}'})" style="margin-bottom: 16px;">← ${course.courseId} topics</button>
      <h1>${topic.title}</h1>
      <p style="color: var(--text-muted); font-size: 0.85rem;">${course.courseId}: ${Content.getCourseName(course.courseId)}</p>

      <div class="study-section" style="margin-top: 20px;">
        <div class="study-section-title"><span class="icon">💡</span> Core Idea</div>
        <div class="study-content">${topic.coreIdea}</div>
      </div>

      <div class="study-section">
        <div class="study-section-title"><span class="icon">🗣️</span> Say it in the viva</div>
        <div class="study-content" style="border-left: 3px solid var(--accent); background: var(--accent-light);">${topic.vivaAnswer}</div>
      </div>

      ${topic.example ? `
        <div class="study-section">
          <div class="study-section-title"><span class="icon">📝</span> Example</div>
          <div class="study-content">${topic.example}</div>
        </div>
      ` : ''}

      ${topic.understandMore ? `
        <div class="study-section">
          <div class="expandable-header" onclick="this.nextElementSibling.classList.toggle('open'); this.querySelector('.arrow').textContent = this.nextElementSibling.classList.contains('open') ? '▾' : '▸';">
            <span><span class="icon">📚</span> Understand more</span>
            <span class="arrow">▸</span>
          </div>
          <div class="expandable-body">
            <div class="study-content">${topic.understandMore}</div>
          </div>
        </div>
      ` : ''}

      ${topic.commonConfusion ? `
        <div class="study-section">
          <div class="study-section-title"><span class="icon">⚠️</span> Common Confusion</div>
          <div class="study-content">${topic.commonConfusion}</div>
        </div>
      ` : ''}

      ${relatedTopics ? `
        <div class="study-section">
          <div class="study-section-title"><span class="icon">🔗</span> Related Concepts</div>
          <div class="study-nav">${relatedTopics}</div>
        </div>
      ` : ''}

      ${topic.sourceRef ? `<div class="source-ref">Source: ${topic.sourceRef}</div>` : ''}

      <div style="margin-top: 24px;">
        <button class="btn btn-primary" onclick="App.navigate('practice', {type:'course', courseId:'${course.courseId}', topicId:'${topic.id}'})">Practice this topic</button>
      </div>
    `;
  }

  function navigateToTopic(topicId) {
    const topic = Content.getTopic(topicId);
    if (topic) {
      navigate('study', { courseId: topic.courseId, topicId: topic.id });
    }
  }

  // --- Practice Config ---
  function renderPracticeConfig(params = {}) {
    const main = document.getElementById('main');

    if (params.type === 'essentials' || params.type === 'mixed' || params.type === 'mockViva') {
      startPractice(params);
      return;
    }

    if (params.type === 'course' && params.courseId) {
      startPractice(params);
      return;
    }

    main.innerHTML = `
      <h1 style="margin-bottom: 16px;">Practice</h1>

      <div class="card">
        <h3 style="margin-bottom: 16px;">Configure your session</h3>
        <div class="practice-config">
          <div class="config-group">
            <label class="config-label">Mode</label>
            <select class="config-select" id="practiceMode" onchange="App.updatePracticeConfig()">
              <option value="course">Single course</option>
              <option value="mixed">Mixed (all courses)</option>
              <option value="essentials">Essentials (2-day prep)</option>
              <option value="connections">Cross-course connections</option>
              <option value="mockViva">Mock Viva</option>
            </select>
          </div>

          <div class="config-group" id="courseSelect">
            <label class="config-label">Course</label>
            <select class="config-select" id="practiceCourse">
              ${Content.getCourseCodes().map(c => `<option value="${c}">${c}: ${Content.getCourseName(c)}</option>`).join('')}
            </select>
          </div>

          <div class="config-group" id="sizeSelect">
            <label class="config-label">Questions</label>
            <select class="config-select" id="practiceSize">
              <option value="10">10</option>
              <option value="20" selected>20</option>
              <option value="30">30</option>
            </select>
          </div>

          <div class="config-group" id="vivaTime" style="display:none;">
            <label class="config-label">Duration</label>
            <select class="config-select" id="vivaDuration">
              <option value="8">8 minutes</option>
              <option value="10" selected>10 minutes</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary btn-full" style="margin-top: 16px;" onclick="App.startConfiguredPractice()">Start Practice</button>
      </div>

      <div style="margin-top: 24px;">
        <h2 style="margin-bottom: 12px;">Quick start by course</h2>
        <div class="course-grid">
          ${Content.getCourses().map(c => `
            <div class="course-card" onclick="App.startPractice({type:'course', courseId:'${c.courseId}'})">
              <div class="course-code">${c.courseId}</div>
              <div class="course-name">${Content.getCourseName(c.courseId)}</div>
              <div class="course-stats">${c.questions.length} questions</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function updatePracticeConfig() {
    const mode = document.getElementById('practiceMode').value;
    document.getElementById('courseSelect').style.display = mode === 'course' ? '' : 'none';
    document.getElementById('sizeSelect').style.display = mode === 'mockViva' ? 'none' : '';
    document.getElementById('vivaTime').style.display = mode === 'mockViva' ? '' : 'none';
  }

  function startConfiguredPractice() {
    const mode = document.getElementById('practiceMode').value;
    const courseId = document.getElementById('practiceCourse').value;
    const size = parseInt(document.getElementById('practiceSize').value);
    const vivaDuration = parseInt(document.getElementById('vivaDuration')?.value || 10);

    startPractice({ type: mode, courseId: mode === 'course' ? courseId : null, size, vivaDuration });
  }

  function startPractice(options) {
    const session = Practice.createSession(options);
    if (!session) {
      showToast('No questions found for this selection.', 'warning');
      return;
    }
    currentView = 'practice';
    renderPracticeView();

    if (session.type === 'mockViva') {
      Practice.startVivaTimer(
        (secs) => updateVivaTimer(secs),
        () => onVivaTimeUp()
      );
    }
  }

  function resumePractice() {
    Practice.resumeSession();
    currentView = 'practice';
    renderPracticeView();
  }

  function startReviewPractice(type) {
    startPractice({ type: 'review', reviewType: type, size: 20 });
  }

  // --- Practice View ---
  function renderPracticeView() {
    const main = document.getElementById('main');
    const current = Practice.getCurrentQuestion();
    if (!current) {
      renderSessionSummary();
      return;
    }

    const q = current.data;
    const state = current.state;
    const session = Practice.getSession();
    const isViva = session.type === 'mockViva';
    const answerRevealed = state.rating !== null;

    const diffLabel = ['', 'Basic', 'Intermediate', 'Advanced'][q.difficulty] || '';

    main.innerHTML = `
      ${isViva ? `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div class="viva-timer" id="vivaTimer">🎤 --:--</div>
          <button class="btn btn-outline btn-small" onclick="App.endViva()">End viva</button>
        </div>
      ` : ''}

      <div class="question-counter">
        Question ${current.index + 1} of ${current.total}
        ${!isViva ? `
          <div class="viva-progress" style="margin-top: 8px;">
            ${session.questions.map((sq, i) => {
              let cls = '';
              if (i === current.index) cls = 'current';
              else if (sq.rating === 'got') cls = 'answered';
              else if (sq.rating) cls = 'answered';
              else if (sq.skipped) cls = 'skipped';
              return `<div class="viva-dot ${cls}"></div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>

      <div class="question-card">
        <div class="question-meta">
          <span class="question-badge badge-course">${q.courseId}</span>
          <span class="question-badge badge-type">${q.type}</span>
          <span class="question-badge badge-difficulty-${q.difficulty}">${diffLabel}</span>
          ${q.isEssential ? '<span class="question-badge badge-essential">Essential</span>' : ''}
          <div style="margin-left: auto;">
            <button class="bookmark-btn ${Storage.isBookmarked(q.id) ? 'bookmarked' : ''}" onclick="App.toggleBookmark('${q.id}', this)" title="Bookmark">
              ${Storage.isBookmarked(q.id) ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div class="question-text">${q.question}</div>

        ${!isViva || answerRevealed ? `
          <div class="answer-area">
            <textarea class="answer-textarea" placeholder="Type your answer here (optional)…" oninput="Practice.saveUserAnswer(this.value)">${state.userAnswer || ''}</textarea>
          </div>
        ` : ''}

        ${!answerRevealed ? `
          <div class="btn-group">
            <button class="btn btn-primary" onclick="App.revealAnswer()">Show answer</button>
            <button class="btn btn-secondary" onclick="App.handleIDontKnow()">I don't know</button>
            <button class="btn btn-outline" onclick="App.handleSkip()">Skip</button>
          </div>
        ` : ''}

        <div class="answer-reveal ${answerRevealed ? 'visible' : ''}" id="answerReveal">
          <div class="answer-label">Direct Answer</div>
          <div class="answer-direct">${q.directAnswer}</div>

          <div class="answer-label" style="margin-top: 12px;">Viva Answer</div>
          <div class="answer-viva">${q.vivaAnswer}</div>

          ${q.keyPoints && q.keyPoints.length > 0 ? `
            <div class="answer-label" style="margin-top: 12px;">Key Points to Check</div>
            <div class="key-points">
              ${q.keyPoints.map(p => `<div class="key-point">${p}</div>`).join('')}
            </div>
          ` : ''}

          ${q.explanation ? `
            <div class="answer-explanation">${q.explanation}</div>
          ` : ''}

          ${q.sourceRef ? `<div class="source-ref">Source: ${q.sourceRef}</div>` : ''}
        </div>

        ${answerRevealed && !isViva ? `
          <div class="rating-buttons" id="ratingButtons">
            <button class="rating-btn btn-got-it ${state.rating === 'got' ? 'active' : ''}" onclick="App.rate('got')">✓ Got it</button>
            <button class="rating-btn btn-partly ${state.rating === 'partly' ? 'active' : ''}" onclick="App.rate('partly')">◐ Partly</button>
            <button class="rating-btn btn-missed ${state.rating === 'missed' ? 'active' : ''}" onclick="App.rate('missed')">✗ Missed</button>
          </div>
        ` : ''}

        ${isViva && answerRevealed ? `
          <div class="rating-buttons">
            <button class="rating-btn btn-got-it" onclick="App.vivaNext('got')">✓ Got it</button>
            <button class="rating-btn btn-partly" onclick="App.vivaNext('partly')">◐ Partly</button>
            <button class="rating-btn btn-missed" onclick="App.vivaNext('missed')">✗ Missed</button>
          </div>
        ` : ''}
      </div>

      ${!isViva ? `
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <button class="btn btn-outline btn-small" onclick="App.prevQ()" ${current.index === 0 ? 'disabled' : ''}>← Previous</button>
          ${current.index < current.total - 1 ?
            `<button class="btn btn-primary btn-small" onclick="App.nextQ()">Next →</button>` :
            `<button class="btn btn-primary btn-small" onclick="App.finishSession()">Finish session</button>`
          }
        </div>
      ` : ''}

      <div style="margin-top: 16px;">
        <textarea class="note-input" placeholder="Personal note for this question…" oninput="Storage.saveNote('${q.id}', this.value)">${Storage.getNote(q.id)}</textarea>
      </div>
    `;
  }

  function revealAnswer() {
    document.getElementById('answerReveal').classList.add('visible');
    // Re-render to show rating buttons
    renderPracticeView();
    // Scroll to answer
    setTimeout(() => {
      document.getElementById('answerReveal')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function handleIDontKnow() {
    Practice.iDontKnow();
    renderPracticeView();
  }

  function handleSkip() {
    Practice.skipCurrentQuestion();
    const next = Practice.nextQuestion();
    if (next) renderPracticeView();
    else renderSessionSummary();
  }

  function rate(rating) {
    Practice.rateCurrentQuestion(rating);
    // Auto-advance after small delay
    setTimeout(() => {
      const next = Practice.nextQuestion();
      if (next) renderPracticeView();
      else renderSessionSummary();
    }, 300);
  }

  function vivaNext(rating) {
    Practice.rateCurrentQuestion(rating);
    const next = Practice.nextQuestion();
    if (next) renderPracticeView();
    else {
      Practice.stopVivaTimer();
      renderSessionSummary();
    }
  }

  function nextQ() {
    const next = Practice.nextQuestion();
    if (next) renderPracticeView();
    else renderSessionSummary();
  }

  function prevQ() {
    Practice.prevQuestion();
    renderPracticeView();
  }

  function finishSession() {
    Practice.stopVivaTimer();
    renderSessionSummary();
  }

  function endViva() {
    Practice.stopVivaTimer();
    renderSessionSummary();
  }

  function onVivaTimeUp() {
    showToast('Time is up! Review your answers.', 'warning');
    renderSessionSummary();
  }

  function updateVivaTimer(seconds) {
    const el = document.getElementById('vivaTimer');
    if (!el) return;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.textContent = `🎤 ${m}:${s.toString().padStart(2, '0')}`;
    el.className = 'viva-timer' + (seconds <= 60 ? ' critical' : seconds <= 180 ? ' warning' : '');
  }

  // --- Session Summary ---
  function renderSessionSummary() {
    const summary = Practice.getSessionSummary();
    if (!summary) { navigate('home'); return; }

    const main = document.getElementById('main');
    const total = summary.got + summary.partly + summary.missed;
    const pct = total > 0 ? Math.round((summary.got / total) * 100) : 0;

    const missed = Practice.getMissedQuestions();

    main.innerHTML = `
      <div class="card session-summary">
        <h2>Session Complete!</h2>
        <div class="session-score">${pct}%</div>
        <p style="color: var(--text-secondary);">confidence score</p>

        <div class="session-stats">
          <div class="stat-item stat-got-it">
            <div class="stat-value">${summary.got}</div>
            <div class="stat-label">Got it</div>
          </div>
          <div class="stat-item stat-partly">
            <div class="stat-value">${summary.partly}</div>
            <div class="stat-label">Partly</div>
          </div>
          <div class="stat-item stat-missed">
            <div class="stat-value">${summary.missed}</div>
            <div class="stat-label">Missed</div>
          </div>
          ${summary.skipped > 0 ? `
            <div class="stat-item">
              <div class="stat-value">${summary.skipped}</div>
              <div class="stat-label">Skipped</div>
            </div>
          ` : ''}
        </div>

        <div class="btn-group" style="justify-content: center; margin-top: 24px;">
          ${missed.length > 0 ? `<button class="btn btn-primary" onclick="App.retryMissed()">🔄 Retry missed (${missed.length})</button>` : ''}
          <button class="btn btn-secondary" onclick="App.completeAndHome()">Done</button>
        </div>
      </div>

      ${missed.length > 0 ? `
        <h3 style="margin: 16px 0 12px;">Questions to review</h3>
        ${missed.map(q => `
          <div class="card" style="cursor: pointer;" onclick="App.navigateToTopic('${q.topicId}')">
            <div class="question-meta">
              <span class="question-badge badge-course">${q.courseId}</span>
              <span class="question-badge badge-type">${q.type}</span>
            </div>
            <div style="font-weight: 500;">${q.question}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${q.directAnswer}</div>
          </div>
        `).join('')}
      ` : ''}
    `;
  }

  function retryMissed() {
    const session = Practice.retryMissed();
    if (session) renderPracticeView();
    else showToast('No missed questions to retry.', 'warning');
  }

  function completeAndHome() {
    Practice.completeSession();
    navigate('home');
  }

  // --- Review ---
  function renderReview() {
    const main = document.getElementById('main');
    const needsPractice = Storage.getNeedsPractice();
    const pastMistakes = Storage.getPastMistakes();
    const bookmarks = Storage.getProgress().bookmarks;
    const notes = Storage.getProgress().notes;
    const noteIds = Object.keys(notes);

    main.innerHTML = `
      <h1 style="margin-bottom: 16px;">Review</h1>

      <div class="review-tabs" id="reviewTabs">
        <button class="review-tab active" onclick="App.showReviewTab('needs')" data-tab="needs">
          Needs practice <span class="review-count">${needsPractice.length}</span>
        </button>
        <button class="review-tab" onclick="App.showReviewTab('past')" data-tab="past">
          Past mistakes <span class="review-count">${pastMistakes.length}</span>
        </button>
        <button class="review-tab" onclick="App.showReviewTab('bookmarks')" data-tab="bookmarks">
          Bookmarks <span class="review-count">${bookmarks.length}</span>
        </button>
        <button class="review-tab" onclick="App.showReviewTab('notes')" data-tab="notes">
          Notes <span class="review-count">${noteIds.length}</span>
        </button>
      </div>

      <div id="reviewContent"></div>
    `;

    showReviewTab('needs');
  }

  function showReviewTab(tab) {
    document.querySelectorAll('.review-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    const container = document.getElementById('reviewContent');

    let ids = [];
    if (tab === 'needs') ids = Storage.getNeedsPractice();
    else if (tab === 'past') ids = Storage.getPastMistakes();
    else if (tab === 'bookmarks') ids = Storage.getProgress().bookmarks;
    else if (tab === 'notes') ids = Object.keys(Storage.getProgress().notes);

    if (ids.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${tab === 'bookmarks' ? '☆' : tab === 'notes' ? '📝' : '✓'}</div>
          <h3>${tab === 'needs' ? 'No questions need practice!' : tab === 'past' ? 'No past mistakes!' : tab === 'bookmarks' ? 'No bookmarks yet' : 'No notes yet'}</h3>
          <p>${tab === 'needs' || tab === 'past' ? 'Practice some questions to see them here.' : 'Bookmark questions or add notes during practice.'}</p>
        </div>
      `;
      return;
    }

    const questions = ids.map(id => Content.getQuestion(id)).filter(Boolean);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 0.85rem; color: var(--text-muted);">${questions.length} question${questions.length !== 1 ? 's' : ''}</span>
        ${tab !== 'notes' ? `<button class="btn btn-primary btn-small" onclick="App.startReviewPractice('${tab === 'needs' ? 'needsPractice' : tab === 'past' ? 'pastMistakes' : 'bookmarks'}')">Practice these</button>` : ''}
      </div>

      ${questions.map(q => {
        const note = Storage.getNote(q.id);
        const progress = Storage.getProgress().questions[q.id];
        return `
          <div class="card">
            <div class="question-meta">
              <span class="question-badge badge-course">${q.courseId}</span>
              <span class="question-badge badge-type">${q.type}</span>
              ${progress && progress.rating ? `<span class="question-badge badge-difficulty-${progress.rating === 'got' ? 1 : progress.rating === 'partly' ? 2 : 3}">${progress.rating}</span>` : ''}
            </div>
            <div style="font-weight: 600; margin-bottom: 8px;">${q.question}</div>
            <div style="font-size: 0.9rem; color: var(--text-secondary);">${q.directAnswer}</div>
            ${note ? `<div style="margin-top: 8px; padding: 8px; background: var(--yellow-light); border-radius: var(--radius-sm); font-size: 0.85rem;">📝 ${note}</div>` : ''}
          </div>
        `;
      }).join('')}
    `;
  }

  // --- Search ---
  function toggleSearch() {
    const overlay = document.getElementById('searchOverlay');
    overlay.classList.toggle('visible');
    if (overlay.classList.contains('visible')) {
      const input = overlay.querySelector('.search-input');
      input.value = '';
      input.focus();
      overlay.querySelector('.search-results').innerHTML = '';
    }
  }

  function handleSearch(query) {
    const results = Content.search(query);
    const container = document.querySelector('.search-results');

    if (query.length < 2) {
      container.innerHTML = '<div class="search-empty">Type at least 2 characters to search</div>';
      return;
    }

    if (results.length === 0) {
      container.innerHTML = `<div class="search-empty">No results for "${query}"</div>`;
      return;
    }

    container.innerHTML = results.map(r => `
      <div class="search-result-item" onclick="App.handleSearchClick('${r.type}', '${r.id}', '${r.courseId}')">
        <div class="search-result-type">${r.type} · ${r.courseId}</div>
        <div class="search-result-title">${r.title}</div>
      </div>
    `).join('');
  }

  function handleSearchClick(type, id, courseId) {
    toggleSearch();
    if (type === 'topic') {
      navigate('study', { courseId, topicId: id });
    } else {
      // Navigate to the topic of this question
      const q = Content.getQuestion(id);
      if (q) navigate('study', { courseId, topicId: q.topicId });
    }
  }

  // --- Bookmarks ---
  function toggleBookmark(qId, btnEl) {
    const isNow = Storage.toggleBookmark(qId);
    if (btnEl) {
      btnEl.textContent = isNow ? '★' : '☆';
      btnEl.classList.toggle('bookmarked', isNow);
    }
    showToast(isNow ? 'Bookmarked!' : 'Bookmark removed', 'success');
  }

  // --- Import ---
  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await Storage.importData(file);
      showToast('Progress imported successfully!', 'success');
      navigate('home');
    } catch (err) {
      showToast('Failed to import: ' + err.message, 'error');
    }
    event.target.value = '';
  }

  // --- Ask Guide Panel ---
  function toggleGuide() {
    guideOpen = !guideOpen;
    document.getElementById('guidePanel').classList.toggle('open', guideOpen);
  }

  // --- Utilities ---
  function showLoading() {
    document.getElementById('main').innerHTML = `
      <div style="text-align: center; padding: 80px 20px;">
        <div class="loading-spinner"></div>
        <p style="margin-top: 16px; color: var(--text-muted);">Loading courses…</p>
      </div>
    `;
  }

  function showToast(message, type = '') {
    const container = document.getElementById('toasts');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function bindGlobalEvents() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      }
      if (e.key === 'Escape') {
        const overlay = document.getElementById('searchOverlay');
        if (overlay.classList.contains('visible')) toggleSearch();
        if (guideOpen) toggleGuide();
      }

      // Practice shortcuts
      if (currentView === 'practice' && !e.ctrlKey && !e.altKey) {
        const current = Practice.getCurrentQuestion();
        if (!current) return;
        const state = current.state;

        if (e.key === ' ' && state.rating === null && !document.activeElement.matches('textarea, input')) {
          e.preventDefault();
          revealAnswer();
        }
        if (e.key === '1' && state.rating !== null) rate('got');
        if (e.key === '2' && state.rating !== null) rate('partly');
        if (e.key === '3' && state.rating !== null) rate('missed');
        if (e.key === 'ArrowRight' && !document.activeElement.matches('textarea, input')) nextQ();
        if (e.key === 'ArrowLeft' && !document.activeElement.matches('textarea, input')) prevQ();
      }
    });

    // Click outside search to close
    document.getElementById('searchOverlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('search-overlay')) toggleSearch();
    });
  }

  return {
    init, navigate, navigateToTopic,
    updatePracticeConfig, startConfiguredPractice, startPractice,
    resumePractice, startReviewPractice,
    revealAnswer, handleIDontKnow, handleSkip, rate, vivaNext,
    nextQ, prevQ, finishSession, endViva,
    retryMissed, completeAndHome,
    showReviewTab, toggleSearch, handleSearch, handleSearchClick,
    toggleBookmark, handleImport, toggleGuide,
    showToast
  };
})();

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => App.init());
