(function () {
    function injectAnimeGoButton() {
        if (document.getElementById('animego-redirect-btn')) return;

        let title = '';
        const hostname = window.location.hostname;
        let targetContainer;

        if (hostname.includes('shikimori')) {
            const h1 = document.querySelector('h1');
            if (h1 && h1.textContent) {
                // Извлекаем первое название (обычно русское)
                title = h1.textContent.split('/')[0].trim();
            }
            // Ищем контейнер с постером на Шикимори.
            // Левый блок с постером имеет класс .c-poster или .c-image.
            // Вставляем не внутрь <picture>, а в конец всей обертки постера (чтобы React его не затирал при lazy-load'е)
            targetContainer = document.querySelector('.c-image') || document.querySelector('.c-poster');
        } else if (hostname.includes('myanimelist')) {
            const h1 = document.querySelector('.title-name, h1.title-name, h1');
            if (h1 && h1.textContent) {
                title = h1.textContent.trim();
            }
            // На MAL постер лежит в ссылке внутри div'а со стилем text-align: center слева
            // Обычно класс у картинки .lazyloaded или .ac, ищем её родительский div
            const img = document.querySelector('div[style*="text-align: center;"] > a[href*="/pics"] > img') || document.querySelector('.js-scrollfix-bottom-rel .borderClass > div > a > img');
            if (img) {
                targetContainer = img.closest('div');
            }
        }

        if (!title || !targetContainer) return;

        const btnContainer = document.createElement('div');
        btnContainer.id = 'animego-redirect-container';
        // На Шикимори .c-image сам по себе блочный, поэтому margin-top хватит
        btnContainer.style.cssText = `
            margin-top: 15px;
            width: 100%;
            display: flex;
            justify-content: center;
        `;

        const btn = document.createElement('a');
        btn.id = 'animego-redirect-btn';
        btn.href = '#';

        btn.onclick = (e) => {
            e.preventDefault();
            const originalText = btn.innerHTML;
            btn.innerHTML = '▶ Ищем на&nbsp;<b>AnimeGO</b>...';
            btn.style.pointerEvents = 'none';

            chrome.runtime.sendMessage({ action: "search_anime", query: title }, (response) => {
                const targetUrl = (response && response.url)
                    ? response.url
                    : `https://animego.org/search/anime?q=${encodeURIComponent(title)}`;
                window.open(targetUrl, '_blank');
                btn.innerHTML = originalText;
                btn.style.pointerEvents = 'auto';
            });
        };

        btn.innerHTML = '▶ Смотреть на&nbsp;<b>AnimeGO</b>';
        // Сохраняем тайтл прямо в кнопку, чтобы Interval мог проверить актуальность
        btn.setAttribute('data-target-title', title);

        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            background: linear-gradient(135deg, #1e1e1e 0%, #2e2e2e 100%);
            color: #fff;
            padding: 10px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            border: 1px solid #444;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            text-align: center;
            box-sizing: border-box;
        `;

        btn.onmouseover = () => {
            btn.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)';
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 6px 8px rgba(0,0,0,0.3)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'linear-gradient(135deg, #1e1e1e 0%, #2e2e2e 100%)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
        };

        btnContainer.appendChild(btn);

        // Вставляем контейнер просто в конец блока.
        // Shikimori меньше будет ругаться, если мы добавим элемент в самый конец .c-image, а не разорвем его внутренности.
        targetContainer.appendChild(btnContainer);
    }

    function injectButtonWithRetry() {
        injectAnimeGoButton();
        setTimeout(injectAnimeGoButton, 1000);
        setTimeout(injectAnimeGoButton, 2000);
    }

    // Упрощенная и более агрессивная проверка (Shikimori сильно перестраивает DOM)
    // Раз в 1 секунду проверяем, находимся ли мы на странице аниме и нужна ли кнопка
    setInterval(() => {
        const currentUrl = location.href;
        // Путь может быть /animes/123 или /ru/animes/123 или /anime/123
        const isAnimePage = currentUrl.match(/\/(animes|anime)\/\d+/) !== null;

        if (isAnimePage) {
            let hasTarget = false;
            let currentRealTitle = '';

            if (location.hostname.includes('shikimori')) {
                const h1 = document.querySelector('h1');
                const titleGot = h1 && h1.textContent && h1.textContent.trim().length > 0;
                if (titleGot) currentRealTitle = h1.textContent.split('/')[0].trim();

                const wrapper = document.querySelector('.c-image') || document.querySelector('.c-poster');
                hasTarget = titleGot && wrapper !== null;
            } else {
                const h1 = document.querySelector('.title-name, h1.title-name, h1');
                const titleGot = h1 && h1.textContent && h1.textContent.trim().length > 0;
                if (titleGot) currentRealTitle = h1.textContent.trim();

                const img = document.querySelector('div[style*="text-align: center;"] > a[href*="/pics"] > img') || document.querySelector('.js-scrollfix-bottom-rel .borderClass > div > a > img');
                hasTarget = titleGot && img !== null;
            }

            const oldBtn = document.getElementById('animego-redirect-btn');

            if (hasTarget && !oldBtn) {
                // Кнопки нет, но заголовок и постер готовы — ставим
                injectAnimeGoButton();
            } else if (hasTarget && oldBtn) {
                // Кнопка есть. Проверим, не устарела ли она (вдруг заголовок сменился, а кнопка висит от старого)
                const currentBtnTarget = oldBtn.getAttribute('data-target-title');

                // Если кнопка запомнила старое название, а мы уже на новом тайтле — пересоздаем
                if (currentBtnTarget !== currentRealTitle) {
                    const oldContainer = document.getElementById('animego-redirect-container');
                    if (oldContainer) oldContainer.remove();
                    if (oldBtn) oldBtn.remove();
                    injectAnimeGoButton();
                }
            }
        } else {
            // Если мы не на странице аниме (например, ушли в каталог), удаляем кнопку
            const oldContainer = document.getElementById('animego-redirect-container');
            if (oldContainer) oldContainer.remove();
            const oldBtn = document.getElementById('animego-redirect-btn');
            if (oldBtn) oldBtn.remove();
        }
    }, 1000);

    // Первичный запуск на случай если скрипт загрузился когда страница уже готова
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectButtonWithRetry);
    } else {
        injectButtonWithRetry();
    }
})();
