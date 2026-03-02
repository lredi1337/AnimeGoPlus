// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "search_anime") {
        fetch(`https://animego.org/search/anime?q=${encodeURIComponent(message.query)}`)
            .then(res => res.text())
            .then(html => {
                // Ищем нормальную ссылку на аниме в результатах поиска
                // AnimeGo добавляет класс "d-block ani-grid__item-picture ..." к таким картинкам
                // Выглядит как <a class="..." href="/anime/...">
                const match = html.match(/class="[^"]*ani-grid__item-picture[^"]*" href="(\/anime\/[^"]+)"/);
                if (match && match[1]) {
                    // Формируем полную ссылку
                    sendResponse({ url: `https://animego.org${match[1]}` });
                } else {
                    sendResponse({ url: `https://animego.org/search/anime?q=${encodeURIComponent(message.query)}` });
                }
            })
            .catch(err => {
                sendResponse({ url: `https://animego.org/search/anime?q=${encodeURIComponent(message.query)}` });
            });
        return true;
    }

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