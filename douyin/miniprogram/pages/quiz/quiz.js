const bank = require('../../utils/questionBank')

Page({
  data: {
    question: null,
    index: 0,
    total: 10,
    chosen: '',
    answered: false,
    result: null, // { correct, rightKey }
    analysis: '',
    source: null,
    score: 0,
    finished: false,
    stats: null,
    category: '',
    mode: '',
  },

  onLoad(options) {
    const category = options.category ? decodeURIComponent(options.category) : ''
    const count = options.count ? Number(options.count) : 10
    const mode = options.mode || ''

    this.loadOpts = { category, count, mode }
    tt.setNavigationBarTitle({ title: category || (mode === 'wrong' ? '错题重练' : '随机答题') })
    this.setData({ category, mode })
    this.loadQuestions()
  },

  loadQuestions() {
    const { category, count, mode } = this.loadOpts
    let list
    if (mode === 'wrong') {
      const ids = bank.getWrongBook().map((q) => q.id)
      list = bank.pickByIds(ids)
    } else {
      list = bank.pickQuestions({ category, count })
    }
    this.setData({
      total: list.length,
      questions: list,
      question: list[0] || null,
    })
  },

  onPick(e) {
    if (this.data.answered) return
    const key = e.currentTarget.dataset.key
    this.setData({ chosen: key })

    const res = bank.judge(this.data.question, key)
    const detail = bank.getAnalysis(this.data.question.id)
    bank.recordAnswer(this.data.question.id, res.correct)

    this.setData({
      answered: true,
      result: res,
      analysis: detail ? detail.analysis : '',
      source: detail ? detail.source : null,
      score: this.data.score + (res.correct ? 1 : 0),
    })
  },

  onNext() {
    const next = this.data.index + 1
    const list = this.data.questions
    if (next >= list.length) {
      this.setData({ finished: true, stats: bank.getStats() })
      return
    }
    this.setData({
      index: next,
      question: list[next],
      chosen: '',
      answered: false,
      result: null,
      analysis: '',
      source: null,
    })
  },

  onRestart() {
    this.loadQuestions()
    this.setData({ index: 0, score: 0, finished: false, chosen: '', answered: false, result: null })
  },

  /** 返回首页（不管当前页面栈有多深，一次性回到栈底） */
  onBackHome() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      tt.navigateBack({ delta: pages.length - 1 })
    } else {
      tt.redirectTo({ url: '/pages/index/index' })
    }
  },
})
