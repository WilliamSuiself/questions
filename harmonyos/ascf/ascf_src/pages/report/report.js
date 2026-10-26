const bank = require('../../utils/questionBank')

Page({
  data: {
    stats: null,
    report: [],
  },

  onShow() {
    const stats = bank.getStats()
    const report = bank.getCategoryReport().sort((a, b) => a.mastery - b.mastery)
    this.setData({ stats, report })
  },
})
