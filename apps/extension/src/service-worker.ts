// MV3 entry point: event-driven, with no durable state held in globals.
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("workspace.html") });
});
import { settleDownload } from "./download-events";
chrome.downloads.onChanged.addListener(delta=>{
 if(delta.state?.current==="complete"||delta.state?.current==="interrupted")void settleDownload(delta.id,delta.state.current,delta.error?.current).catch(()=>{/* Durable pending state remains for workspace reconciliation. */});
});
