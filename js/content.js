/* ========================================
   Viva Studio — Content Manager
   Loads and indexes all course data
   ======================================== */

const Content = (() => {
  const COURSES = ['E403', 'E404', 'E405', 'E410', 'E411', 'E412', 'E413'];
  const COURSE_NAMES = {
    E403: 'Critical and Cultural Theory',
    E404: 'Sociolinguistics',
    E405: 'Semantics and Pragmatics',
    E410: 'Phonetics and Phonology',
    E411: 'Morphology and Syntax',
    E412: 'Psycholinguistics',
    E413: 'Research Methods in AL & ELT'
  };

  let data = {};          // { E403: { courseId, courseTitle, overview, topics, questions } }
  let allQuestions = [];   // flat array of all questions
  let allTopics = [];      // flat array of all topics
  let searchIndex = [];    // pre-built search entries
  let loaded = false;
  let loadPromise = null;

  async function loadAll() {
    if (loadPromise) return loadPromise;
    loadPromise = _doLoad();
    return loadPromise;
  }

  async function _doLoad() {
    const results = await Promise.all(
      COURSES.map(async (code) => {
        try {
          const resp = await fetch(`data/${code}.json`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.json();
        } catch (err) {
          console.warn(`Failed to load ${code}:`, err);
          return null;
        }
      })
    );

    results.forEach((courseData, i) => {
      if (courseData) {
        data[COURSES[i]] = courseData;
      }
    });

    // Build flat arrays
    allQuestions = [];
    allTopics = [];
    COURSES.forEach(code => {
      if (data[code]) {
        data[code].topics.forEach(t => {
          t.courseId = code;
          allTopics.push(t);
        });
        data[code].questions.forEach(q => {
          q.courseId = q.courseId || code;
          allQuestions.push(q);
        });
      }
    });

    // Build search index
    _buildSearchIndex();
    loaded = true;
  }

  function _buildSearchIndex() {
    searchIndex = [];

    allTopics.forEach(t => {
      searchIndex.push({
        type: 'topic',
        id: t.id,
        courseId: t.courseId,
        title: t.title,
        text: [t.title, t.coreIdea, t.vivaAnswer, t.commonConfusion].join(' ').toLowerCase(),
        item: t
      });
    });

    allQuestions.forEach(q => {
      searchIndex.push({
        type: 'question',
        id: q.id,
        courseId: q.courseId,
        title: q.question,
        text: [q.question, q.directAnswer, q.vivaAnswer, (q.keyPoints || []).join(' ')].join(' ').toLowerCase(),
        item: q
      });
    });
  }

  function search(query, limit = 20) {
    if (!query || query.length < 2) return [];
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (terms.length === 0) return [];

    const results = [];
    searchIndex.forEach(entry => {
      let score = 0;
      terms.forEach(term => {
        if (entry.text.includes(term)) score++;
        if (entry.title.toLowerCase().includes(term)) score += 2;
      });
      if (score > 0) {
        results.push({ ...entry, score });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  function getCourse(code) { return data[code]; }
  function getCourses() { return COURSES.map(c => data[c]).filter(Boolean); }
  function getCourseCodes() { return COURSES; }
  function getCourseName(code) { return COURSE_NAMES[code] || code; }
  function getTopic(topicId) { return allTopics.find(t => t.id === topicId); }
  function getTopics(courseId) { return allTopics.filter(t => t.courseId === courseId); }
  function getQuestion(qId) { return allQuestions.find(q => q.id === qId); }
  function getAllQuestions() { return allQuestions; }

  function getQuestions(filters = {}) {
    let qs = [...allQuestions];
    if (filters.courseId) qs = qs.filter(q => q.courseId === filters.courseId);
    if (filters.courseIds) qs = qs.filter(q => filters.courseIds.includes(q.courseId));
    if (filters.topicId) qs = qs.filter(q => q.topicId === filters.topicId);
    if (filters.difficulty) qs = qs.filter(q => q.difficulty === filters.difficulty);
    if (filters.type) qs = qs.filter(q => q.type === filters.type);
    if (filters.essential) qs = qs.filter(q => q.isEssential);
    if (filters.ids) qs = qs.filter(q => filters.ids.includes(q.id));
    return qs;
  }

  function getEssentials() {
    return allQuestions.filter(q => q.isEssential);
  }

  function getConnectionQuestions() {
    return allQuestions.filter(q => q.type === 'connection' || (q.crossCourseLinks && q.crossCourseLinks.length > 0));
  }

  function isLoaded() { return loaded; }

  return {
    loadAll, getCourse, getCourses, getCourseCodes, getCourseName,
    getTopic, getTopics, getQuestion, getAllQuestions, getQuestions,
    getEssentials, getConnectionQuestions, search, isLoaded
  };
})();
