// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fullscreen_on") {
        chrome.windows.getCurrent((window) => {
            // Переводим именно в настоящий Fullscreen (как F11)
            chrome.windows.update(window.id, { state: "fullscreen" });
        });
        sendResponse({ success: true });
    } 
    
    if (message.action === "fullscreen_off") {
        chrome.windows.getCurrent((window) => {
            // Возвращаем в обычное развернутое состояние
            chrome.windows.update(window.id, { state: "maximized" });
        });
        sendResponse({ success: true });
    }
    return true; 
});