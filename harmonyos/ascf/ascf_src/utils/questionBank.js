/**
 * 题库工具层 —— 微信小程序端
 *
 * 职责边界：只负责「取题 / 判分 / 错题本 / 统计」，
 * 不负责 UI。UI 层只消费这里暴露的状态。
 *
 * 数据来源：
 *   小程序包内 miniprogram/data/questions.json（开发期直接 require，
 *   由仓库根目录的 data/questions.json 通过 scripts/sync-miniprogram.mjs 同步而来，
 *   改完题库务必重跑该脚本，否则小程序里看到的还是旧题）
 *   线上建议用 split-public.mjs 拆出的 questions.public.json（不含答案），
 *   答案由云函数在提交作答时下发并判分。
 */

const QUESTIONS = require('../data/questions.json')

const STORAGE_KEYS = {
  wrong: 'sg_quiz_wrong_book', // 错题本：{ [id]: { wrongCount, lastWrongAt } }
  fav: 'sg_quiz_favorites', // 收藏：{ [id]: true }
  stats: 'sg_quiz_stats', // 统计：{ answered, correct, streak, maxStreak }
  challengeBest: 'sg_quiz_challenge_best', // 夺标模式历史最高分（答对题数）
  answered: 'sg_quiz_answered_ids', // 练过的题：{ [id]: lastAnsweredAt }，不管对错都记，用来算「有没有练过」
}

function shuffle(list) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 取题
 * @param {object} opts
 * @param {number} [opts.count=10]      抽多少题
 * @param {string} [opts.category]     限定分类
 * @param {1|2|3} [opts.difficulty]    限定难度
 * @param {string[]} [opts.excludeIds] 需要排除的题 id（已答过的）
 * @param {boolean} [opts.shuffleOptions=true] 是否打乱选项顺序
 * @returns {object[]}
 */
const LETTERS = ['A', 'B', 'C', 'D']

function formatQuestion(q, shuffleOptions) {
  const item = {
    id: q.id,
    type: q.type,
    stem: q.stem,
    difficulty: q.difficulty,
    category: q.category,
    tags: q.tags,
  }
  // 打乱的是原始 A/B/C/D 对应的文本顺序；展示用的字母永远按屏幕位置重新贴成 A→D，
  // 保证界面上看到的 A/B/C/D 永远从上到下顺序出现，不会出现「A 选项排第三个」这种观感乱序。
  // originalKey 只用来内部判分，不直接等同于正确答案，不会提前暴露答案。
  const originalKeys = shuffleOptions ? shuffle(Object.keys(q.options)) : Object.keys(q.options)
  item.options = originalKeys.map((originalKey, i) => ({
    key: LETTERS[i],
    text: q.options[originalKey],
    originalKey,
  }))
  return item
}

function pickQuestions(opts = {}) {
  const { count = 10, category, difficulty, excludeIds = [], shuffleOptions = true } = opts

  let pool = QUESTIONS.slice()
  if (category) pool = pool.filter((q) => q.category === category)
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty)
  if (excludeIds.length) {
    const set = new Set(excludeIds)
    pool = pool.filter((q) => !set.has(q.id))
  }

  const picked = shuffle(pool).slice(0, count)
  return picked.map((q) => formatQuestion(q, shuffleOptions))
}

/**
 * 按 id 列表取题（错题本重练用），id 顺序会被打乱
 */
function pickByIds(ids, opts = {}) {
  const { shuffleOptions = true } = opts
  const set = new Set(ids)
  const pool = shuffle(QUESTIONS.filter((q) => set.has(q.id)))
  return pool.map((q) => formatQuestion(q, shuffleOptions))
}

/**
 * 本地判分（仅开发期用；线上应在服务端判，答案不下发到端上）
 * chosenKey / 返回的 rightKey 都是「展示用」的 A/B/C/D（即屏幕上的徽标字母），
 * 不是题库原始的 answer 字母，两者在选项被打乱后往往不是同一个值。
 * @returns {{correct:boolean, rightKey:string}}
 */
function judge(question, chosenKey) {
  const raw = QUESTIONS.find((q) => q.id === question.id)
  if (!raw) return { correct: false, rightKey: '' }
  const chosenOpt = question.options.find((o) => o.key === chosenKey)
  const rightOpt = question.options.find((o) => o.originalKey === raw.answer)
  return {
    correct: !!chosenOpt && chosenOpt.originalKey === raw.answer,
    rightKey: rightOpt ? rightOpt.key : '',
  }
}

function getAnalysis(questionId) {
  const raw = QUESTIONS.find((q) => q.id === questionId)
  return raw ? { analysis: raw.analysis, source: raw.source } : null
}

/* ---------------- 错题本 / 收藏 / 统计 ---------------- */

function readStore(key, fallback) {
  try {
    return has.getStorageSync(key) || fallback
  } catch (e) {
    return fallback
  }
}

function writeStore(key, value) {
  try {
    has.setStorageSync(key, value)
  } catch (e) {
    // 存储失败不影响答题主流程，静默降级
  }
}

/** 记录一次作答结果 */
function recordAnswer(questionId, correct) {
  const answeredIds = readStore(STORAGE_KEYS.answered, {})
  answeredIds[questionId] = Date.now()
  writeStore(STORAGE_KEYS.answered, answeredIds)

  const stats = readStore(STORAGE_KEYS.stats, { answered: 0, correct: 0, streak: 0, maxStreak: 0 })
  stats.answered += 1
  if (correct) {
    stats.correct += 1
    stats.streak += 1
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak)
    removeFromWrongBook(questionId)
  } else {
    stats.streak = 0
    const wrong = readStore(STORAGE_KEYS.wrong, {})
    const prev = wrong[questionId] || { wrongCount: 0, lastWrongAt: 0 }
    wrong[questionId] = { wrongCount: prev.wrongCount + 1, lastWrongAt: Date.now() }
    writeStore(STORAGE_KEYS.wrong, wrong)
  }
  writeStore(STORAGE_KEYS.stats, stats)
  return stats
}

function getWrongBook() {
  const wrong = readStore(STORAGE_KEYS.wrong, {})
  return Object.keys(wrong)
    .map((id) => {
      const q = QUESTIONS.find((x) => x.id === id)
      return q ? { ...q, ...wrong[id] } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.lastWrongAt - a.lastWrongAt)
}

function toggleFavorite(id) {
  const fav = readStore(STORAGE_KEYS.fav, {})
  if (fav[id]) delete fav[id]
  else fav[id] = true
  writeStore(STORAGE_KEYS.fav, fav)
  return !!fav[id]
}

/** 清空错题本 */
function clearWrongBook() {
  writeStore(STORAGE_KEYS.wrong, {})
}

/** 从错题本移除单题（答对后可调用） */
function removeFromWrongBook(id) {
  const wrong = readStore(STORAGE_KEYS.wrong, {})
  if (wrong[id]) {
    delete wrong[id]
    writeStore(STORAGE_KEYS.wrong, wrong)
  }
}

function getStats() {
  const s = readStore(STORAGE_KEYS.stats, { answered: 0, correct: 0, streak: 0, maxStreak: 0 })
  s.accuracy = s.answered ? Math.round((s.correct / s.answered) * 100) : 0
  return s
}

/**
 * 按分类统计掌握度，用于「学习报告」页。
 * 掌握度只在「练过的题」范围内计算：没做过的分类不算 100% 掌握，
 * 而是标记 practiced:false，交给 UI 显示成「未练习」，避免显得比实际更懂。
 */
function getCategoryReport() {
  const wrong = readStore(STORAGE_KEYS.wrong, {})
  const answeredIds = readStore(STORAGE_KEYS.answered, {})
  const map = {}
  QUESTIONS.forEach((q) => {
    if (!map[q.category]) map[q.category] = { category: q.category, total: 0, wrong: 0, attempted: 0 }
    map[q.category].total += 1
    if (wrong[q.id]) map[q.category].wrong += 1
    if (answeredIds[q.id]) map[q.category].attempted += 1
  })
  return Object.values(map).map((c) => ({
    ...c,
    practiced: c.attempted > 0,
    mastery: c.attempted ? Math.round(((c.attempted - c.wrong) / c.attempted) * 100) : 0,
  }))
}

/** 各分类题量，用于分类练习页展示 */
function getCategoryCounts() {
  const map = {}
  QUESTIONS.forEach((q) => {
    map[q.category] = (map[q.category] || 0) + 1
  })
  return map
}

/* ---------------- 夺标模式：从 0 分开始，答错 3 题结束，比谁答对得多 ---------------- */

function getChallengeBest() {
  return readStore(STORAGE_KEYS.challengeBest, 0)
}

/** 结算一局夺标模式，答对题数比历史最高分高就刷新纪录 */
function recordChallengeScore(score) {
  const best = getChallengeBest()
  if (score > best) {
    writeStore(STORAGE_KEYS.challengeBest, score)
    return { best: score, isNewBest: true }
  }
  return { best, isNewBest: false }
}

module.exports = {
  pickQuestions,
  pickByIds,
  getCategoryCounts,
  judge,
  getAnalysis,
  recordAnswer,
  getWrongBook,
  clearWrongBook,
  removeFromWrongBook,
  toggleFavorite,
  getStats,
  getCategoryReport,
  getChallengeBest,
  recordChallengeScore,
  TOTAL: QUESTIONS.length,
  CATEGORIES: [...new Set(QUESTIONS.map((q) => q.category))],
}
