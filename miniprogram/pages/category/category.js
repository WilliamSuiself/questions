const bank = require('../../utils/questionBank')

Page({
  data: {
    categories: [],
  },

  onLoad() {
    const counts = bank.getCategoryCounts()
    const categories = bank.CATEGORIES.map((name) => ({ name, total: counts[name] || 0 }))
    this.setData({ categories })
  },

  onPick(e) {
    const category = e.currentTarget.dataset.name
    wx.navigateTo({ url: `/pages/quiz/quiz?category=${encodeURIComponent(category)}&count=10` })
  },
})
