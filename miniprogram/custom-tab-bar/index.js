const tabs = ['/pages/home/home', '/pages/review/review', '/pages/focus/focus', '/pages/tools/tools', '/pages/profile/profile'];

Component({
  lifetimes: {
    attached() {
      const pages = getCurrentPages();
      const route = pages.length ? `/${pages[pages.length - 1].route}` : '/pages/home/home';
      const selected = Math.max(0, tabs.indexOf(route));
      this.setData({ selected });
    }
  },

  pageLifetimes: {
    show() {
      const pages = getCurrentPages();
      const route = pages.length ? `/${pages[pages.length - 1].route}` : '/pages/home/home';
      const selected = Math.max(0, tabs.indexOf(route));
      this.setData({ selected });
    }
  },

  data: {
    selected: 0
  },

  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index || 0);
      const path = event.currentTarget.dataset.path;
      this.setData({ selected: index });
      wx.switchTab({ url: path });
    }
  }
});
