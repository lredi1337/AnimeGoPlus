document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('global-toggle');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');

    // Load config state
    const res = await chrome.storage.local.get(['ag_settings']);
    let settings = res.ag_settings || {};
    if (settings.global_enabled === undefined) settings.global_enabled = true;

    toggle.checked = settings.global_enabled;

    toggle.addEventListener('change', async (e) => {
        settings.global_enabled = e.target.checked;
        await chrome.storage.local.set({ ag_settings: settings });

        // Notify open tabs to reload
        chrome.tabs.query({ url: ["*://animego.me/*", "*://animego.org/*"] }, function (tabs) {
            tabs.forEach(tab => chrome.tabs.reload(tab.id));
        });

        updateStatus();
    });

    // Check active tab status
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let activeTab = tabs[0];

        // Quick links functionality
        document.getElementById('btn-shiki').onclick = () => {
            window.open('https://shikimori.one/animes', '_blank');
        };
        document.getElementById('btn-mal').onclick = () => {
            window.open('https://myanimelist.net/', '_blank');
        };

        if (activeTab && (activeTab.url.includes("animego.me") || activeTab.url.includes("animego.org"))) {
            statusDot.className = 'status-indicator active';
            statusText.textContent = 'Работает на этой странице';

            // Ask for page info
            chrome.tabs.sendMessage(activeTab.id, { type: 'AG_GET_PAGE_INFO' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    document.getElementById('music-loading').textContent = "Не удалось загрузить данные об аниме. Убедитесь, что страница полностью прогрузилась.";
                    return;
                }

                if (response.title) {
                    fetchOPED(response.title, response.episode || "1");
                } else {
                    document.getElementById('music-loading').textContent = "Аниме не найдено на этой странице.";
                }
            });

        } else {
            statusDot.className = 'status-indicator inactive';
            statusText.textContent = 'Откройте плеер AnimeGO';
            document.getElementById('music-loading').textContent = 'Доступно только на странице просмотра.';
        }
    });

    async function fetchOPED(title, currentEpStr) {
        try {
            // First, find shiki ID
            let shikiRes = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(title)}&limit=1`);
            let shikiData = await shikiRes.json();

            if (shikiData.length > 0 && shikiData[0].id) {
                const malId = shikiData[0].id; // Shikimori IDs match MAL IDs

                // Перенаправляем кнопки Shikimori и MAL сразу на страницу тайтла
                document.getElementById('btn-shiki').onclick = () => {
                    window.open(`https://shikimori.one${shikiData[0].url}`, '_blank');
                };
                document.getElementById('btn-mal').onclick = () => {
                    window.open(`https://myanimelist.net/anime/${malId}`, '_blank');
                };

                // Fetch OP/ED from Jikan
                let jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/themes`);
                let jikanData = await jikanRes.json();

                document.getElementById('music-loading').style.display = 'none';
                const content = document.getElementById('music-content');
                content.style.display = 'block';

                const opList = document.getElementById('op-list');
                const edList = document.getElementById('ed-list');

                const currentEp = parseInt(currentEpStr, 10);

                if (jikanData.data) {
                    renderTracks(jikanData.data.openings || [], opList, "Опенинг", currentEp);
                    renderTracks(jikanData.data.endings || [], edList, "Эндинг", currentEp);
                }

                if (!opList.innerHTML && !edList.innerHTML) {
                    content.innerHTML = '<div class="loading-text">Информации по трекам для текущей серии не найдено :(</div>';
                }
            } else {
                document.getElementById('music-loading').textContent = "Не удалось найти ID аниме.";
            }
        } catch (err) {
            console.error(err);
            document.getElementById('music-loading').textContent = "Ошибка загрузки API.";
        }
    }

    function renderTracks(tracks, container, label, currentEp) {
        if (!tracks || tracks.length === 0) return;

        let foundValidTrack = false;

        tracks.forEach((track, i) => {
            // Разбор эпизодов из Jikan строки: "(eps 1-12)" или "(ep 13)"
            let isTrackForCurrentEp = true; // По умолчанию считаем, что подходит ко всем, если не указано иное

            const epMatch = track.match(/\(eps?\s+([\d-]+)\)/i);
            if (epMatch && epMatch[1]) {
                const range = epMatch[1].split('-');
                if (range.length === 2) {
                    const start = parseInt(range[0], 10);
                    const end = parseInt(range[1], 10);
                    if (currentEp < start || currentEp > end) {
                        isTrackForCurrentEp = false;
                    }
                } else {
                    const exact = parseInt(range[0], 10);
                    if (currentEp !== exact) {
                        isTrackForCurrentEp = false;
                    }
                }
            }

            if (!isTrackForCurrentEp) return;
            foundValidTrack = true;

            const div = document.createElement('div');
            div.className = 'track-item';

            // Очищаем название от "(eps ...)"
            let cleanedName = track.replace(/\s*\(eps?.*?\)/i, '').trim();

            div.innerHTML = `
                <div class="track-label">${label}</div>
                <div class="track-name">${cleanedName}</div>
                <button class="btn-youtube">Слушать на YouTube</button>
            `;

            div.querySelector('.btn-youtube').onclick = () => {
                // Использование оператора DuckDuckGo "I'm feeling lucky" (\)
                // с поиском по YouTube (!yt), чтобы сразу открыть первое видео
                const query = `\\!yt ${cleanedName}`;
                window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, '_blank');
            };

            container.appendChild(div);
        });
    }

    function updateStatus() {
        if (!settings.global_enabled) {
            statusDot.className = 'status-indicator inactive';
            statusText.textContent = 'Расширение выключено';
            statusDot.style.backgroundColor = '#f44336';
        }
    }

    updateStatus();
});
