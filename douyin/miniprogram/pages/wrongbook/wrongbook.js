const bank = require('../../utils/questionBank')

Page({
  data: {
    list: [],
  },

  onShow() {
    this.setData({ list: bank.getWrongBook() })
  },

  onPractice() {
    if (!this.data.list.length) return
    tt.navigateTo({ url: '/pages/quiz/quiz?mode=wrong' })
  },

  onClear() {
    tt.showModal({
      title: '清空错题本',
      content: '清空后将无法恢复，确定继续吗？',
      success: (res) => {
        if (res.confirm) {
          bank.clearWrongBook()
          this.setData({ list: [] })
        }
      },
    })
  },
})
