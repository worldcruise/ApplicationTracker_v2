// MV3 entry point: event-driven, with no durable state held in globals.
import { captureContext, CAPTURE_COMMAND } from "./capture";
export { captureContext } from "./capture";
const captureFailure=()=>chrome.tabs.create({url:chrome.runtime.getURL("workspace.html")+"?captureUnavailable=1"});
chrome.runtime.onInstalled.addListener(()=>{
 void chrome.contextMenus.removeAll().then(()=>chrome.contextMenus.create({id:CAPTURE_COMMAND,title:"Check Application History",contexts:["selection"]})).catch(()=>{/* Reload/install can be retried without losing captures. */});
});
chrome.commands.onCommand.addListener((command,tab)=>{
 if(command===CAPTURE_COMMAND)void (async()=>{const active=tab??(await chrome.tabs.query({active:true,currentWindow:true}))[0];await captureContext("shortcut",active);})().catch(captureFailure);
});
chrome.contextMenus.onClicked.addListener((info,tab)=>{
 if(info.menuItemId===CAPTURE_COMMAND)void captureContext("context_menu",tab,info.selectionText,info.frameId??0).catch(captureFailure);
});
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("workspace.html") });
});
import { settleDownload } from "./download-events";
chrome.downloads.onChanged.addListener(delta=>{
 if(delta.state?.current==="complete"||delta.state?.current==="interrupted")void settleDownload(delta.id,delta.state.current,delta.error?.current).catch(()=>{/* Durable pending state remains for workspace reconciliation. */});
});
