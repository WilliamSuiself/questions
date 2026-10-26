const bank = require('../../utils/questionBank')

Page({
  data: {
    total: bank.TOTAL,
    categoryCount: bank.CATEGORIES.length,
    stats: null,
    wrongCount: 0,
    challengeBest: 0,
  },

  onShow() {
    const stats = bank.getStats()
    const wrongBook = bank.getWrongBook()
    this.setData({ stats, wrongCount: wrongBook.length, challengeBest: bank.getChallengeBest() })
  },

  onGoChallenge() {
    has.navigateTo({ url: '/pages/challenge/challenge' })
  },

  onStartRandom() {
    has.navigateTo({ url: '/pages/quiz/quiz?count=10' })
  },

  onGoCategory() {
    has.navigateTo({ url: '/pages/category/category' })
  },

  onGoWrongBook() {
    has.navigateTo({ url: '/pages/wrongbook/wrongbook' })
  },

  onGoReport() {
    has.navigateTo({ url: '/pages/report/report' })
  },

  onShareAppMessage() {
    return {
      title: '三国问答 —— 来挑战夺标模式，答错 3 题就出局',
      path: '/pages/index/index',
      imageUrl: '/images/logo.png',
    }
  },
})
