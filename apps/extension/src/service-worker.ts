// MV3 entry point: event-driven, with no durable state held in globals.
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("workspace.html") });
});
