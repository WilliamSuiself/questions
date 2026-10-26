const bank = require('../../utils/questionBank')

const MAX_MISTAKES = 3

Page({
  data: {
    question: null,
    score: 0, // 答对题数
    mistakes: 0,
    maxMistakes: MAX_MISTAKES,
    livesArray: Array.from({ length: MAX_MISTAKES }, (_, i) => i),
    chosen: '',
    answered: false,
    result: null,
    analysis: '',
    source: null,
    over: false,
    willEnd: false, // 本题答完、按下一步之后就结束本局（用于按钮文案）
    best: 0,
    isNewBest: false,
  },

  onLoad() {
    this.setData({ best: bank.getChallengeBest() })
    this.start()
  },

  start() {
    this.usedIds = []
    this.setData({
      score: 0,
      mistakes: 0,
      chosen: '',
      answered: false,
      result: null,
      analysis: '',
      source: null,
      over: false,
      willEnd: false,
      isNewBest: false,
    })
    this.nextQuestion()
  },

  /** 抽一道没答过的题；如果题库被用完了就清空记录重新循环 */
  nextQuestion() {
    let [q] = bank.pickQuestions({ count: 1, excludeIds: this.usedIds })
    if (!q) {
      this.usedIds = []
      ;[q] = bank.pickQuestions({ count: 1 })
    }
    this.usedIds.push(q.id)
    this.setData({ question: q })
  },

  onPick(e) {
    if (this.data.answered) return
    const key = e.currentTarget.dataset.key
    this.setData({ chosen: key })

    const res = bank.judge(this.data.question, key)
    const detail = bank.getAnalysis(this.data.question.id)
    bank.recordAnswer(this.data.question.id, res.correct)

    const mistakes = this.data.mistakes + (res.correct ? 0 : 1)
    const score = this.data.score + (res.correct ? 1 : 0)

    // 这里只标记「下一步会结束」，先让本题的讲解正常展示出来，
    // 真正切到结算页放在 onNext 里，避免第 3 次答错时讲解一闪而过。
    this.setData({
      answered: true,
      result: res,
      analysis: detail ? detail.analysis : '',
      source: detail ? detail.source : null,
      score,
      mistakes,
      willEnd: mistakes >= MAX_MISTAKES,
    })
  },

  onNext() {
    if (this.data.over) return
    if (this.data.willEnd) {
      const { isNewBest } = bank.recordChallengeScore(this.data.score)
      this.setData({ over: true, best: bank.getChallengeBest(), isNewBest })
      return
    }
    this.setData({
      chosen: '',
      answered: false,
      result: null,
      analysis: '',
      source: null,
    })
    this.nextQuestion()
  },

  onRestart() {
    this.start()
  },

  onBackHome() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      has.navigateBack({ delta: pages.length - 1 })
    } else {
      has.redirectTo({ url: '/pages/index/index' })
    }
  },
})
