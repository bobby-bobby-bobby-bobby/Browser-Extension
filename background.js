const DEFAULT_STATS={fps:60,frameMs:16.7,droppedFrames:0,recommendedMode:'canvas2d',renderer:'auto',qualityScale:1,perturbationStrength:32,ocrResistance:38};
let latestStats=DEFAULT_STATS;
async function sendToActiveTab(message){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(tab?.id!==undefined)await chrome.tabs.sendMessage(tab.id,message).catch(()=>{});}
chrome.runtime.onInstalled.addListener(()=>{});
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{if(message.type==='OPTISHIELD_STATS'){latestStats=message.stats;sendResponse({ok:true});return false;}if(message.type==='OPTISHIELD_GET_STATS'){sendResponse({ok:true,stats:latestStats});return false;}if(message.type==='OPTISHIELD_SETTINGS_UPDATED'){sendToActiveTab(message).then(()=>sendResponse({ok:true}));return true;}return false;});
