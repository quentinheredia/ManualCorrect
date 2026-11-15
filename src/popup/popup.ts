document.getElementById('open-demo')?.addEventListener('click', () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('demo.html') });
  window.close();
});
