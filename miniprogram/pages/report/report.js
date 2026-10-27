const bank = require('../../utils/questionBank')

Page({
  data: {
    stats: null,
    report: [],
  },

  onShow() {
    const stats = bank.getStats()
    // 排序：练过的按掌握度从低到高（最该补的排前面），没练过的统一垫底，
    // 不跟「真练过但全错」的 0% 混在一起误导人。
    const report = bank.getCategoryReport().sort((a, b) => {
      if (a.practiced !== b.practiced) return a.practiced ? -1 : 1
      return a.mastery - b.mastery
    })
    this.setData({ stats, report })
  },
})
