(async function () {
    'use strict';
    const { AG_RED, AG_FONT, DEFAULT_SETTINGS, isValidOrigin, getSettings } = window;
    let settings = await getSettings();

    if (settings.global_enabled === false) return;

    // ==========================================
    // --- ЛОГИКА ANIMEGO (Сайт) ---
    // ==========================================

    // Добавляем красивый плюс к логотипу (оригинальный span.name скрыт, логотип отрисован через SVG)
    const brandLink = document.querySelector('.header-navbar__brand');
    if (brandLink && !document.getElementById('ag-logo-plus')) {
        const plusSpan = document.createElement('span');
        plusSpan.id = 'ag-logo-plus';
        plusSpan.innerText = '+';
        plusSpan.style.cssText = `color: ${AG_RED}; font-weight: 900; font-size: 32px; line-height: 0.8; margin-left: 2px; padding-bottom: 2px; font-family: 'Nunito', 'Segoe UI', sans-serif; display: inline-block;`;
        brandLink.appendChild(plusSpan);
        brandLink.style.display = 'inline-flex';
        brandLink.style.alignItems = 'center';
    }

    // Перехватываем клик по кнопке "Случайное аниме" для принудительной перезагрузки страницы
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a[href*="/anime/random"]');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = window.location.origin + '/anime/random';
        }
    }, true);

    const style = document.createElement('style');
    style.innerText = `
        .ag-pseudo-fs-active, .ag-pseudo-fs-active * { transition: none !important; animation: none !important; }
        .ag-pseudo-fs-active { position:fixed!important; inset:0!important; z-index:2147483647!important; background:#000!important; width:100%!important; height:100%!important; margin:0!important; padding:0!important; max-width:none!important; max-height:none!important; transform:none!important; border-radius:0!important; }
        .ag-pseudo-fs-active .player-video__online, .ag-pseudo-fs-active .player-video, .ag-pseudo-fs-active .player-video__main { height:100%!important; width:100%!important; padding:0!important; margin:0!important; max-width:none!important; max-height:none!important; transform:none!important; border-radius:0!important; }
        .ag-pseudo-fs-active iframe { width:100%!important; height:100%!important; position:absolute!important; inset:0!important; border:none!important; max-width:none!important; max-height:none!important; transform:none!important; border-radius:0!important; }
        .ag-pseudo-fs-active .player-video-bar, .ag-pseudo-fs-active .player-video__side { display:none!important; }
        body.ag-no-scroll { overflow:hidden!important; }
        body.ag-modal-open { overflow:hidden!important; }
        body.ag-fs-transitioning, body.ag-fs-transitioning * { transition: none !important; animation: none !important; }
        #ag-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999999; display:none; backdrop-filter:blur(4px); }
        #ag-settings-modal { position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1a1a1a; color:#fff; padding:24px; border-radius:24px; z-index:10000001; display:none; width:440px; font-family:${AG_FONT}; border:1px solid #333; box-shadow:0 20px 60px rgba(0,0,0,0.8); max-height: 90vh; overflow-y: auto; }
        .ag-set-group { color:${AG_RED}; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-top:24px; border-bottom:1px solid #333; padding-bottom:5px; opacity:0.8; }
        .ag-set-row { display:flex; justify-content:space-between; align-items:center; margin:15px 0 4px 0; font-size:15px; font-weight:bold; }
        .ag-set-desc { font-size:11px; color:#888; margin-bottom:12px; line-height:1.4; padding-right:40px; }
        .ag-switch { position:relative; width:34px; height:18px; cursor:pointer; }
        .ag-switch input { opacity:0; width:0; height:0; }
        .ag-slider { position:absolute; inset:0; background:#333; border-radius:20px; transition:.3s; }
        .ag-slider:before { position:absolute; content:""; height:12px; width:12px; left:3px; bottom:3px; background:white; transition:.3s; border-radius:50%; }
        input:checked + .ag-slider { background:${AG_RED}; }
        input:checked + .ag-slider:before { transform:translateX(16px); }
        .ag-footer-btns { display:flex; gap:12px; margin-top:25px; }
        .ag-btn-main { flex:1; padding:12px; border-radius:12px; cursor:pointer; border:none; font-weight:bold; font-family:${AG_FONT}; }
        #ag-save { background:${AG_RED}; color:white; }
        #ag-reset { background:#2a2a2a; color:#888; }
        /* Стили для кнопок хоткеев */
        .ag-key-btn { background:#333; border:1px solid #444; color:#fff; padding:4px 10px; border-radius:6px; font-size:12px; cursor:pointer; min-width:60px; text-align:center; transition:0.2s; font-family:monospace; text-transform:uppercase; }
        .ag-key-btn:hover { border-color:${AG_RED}; color:${AG_RED}; }
        .ag-key-btn.listening { background:${AG_RED}; color:white; border-color:${AG_RED}; animation: pulse 1s infinite; }
        @keyframes pulse { 0% {opacity:1;} 50% {opacity:0.7;} 100% {opacity:1;} }
    `;
    document.head.appendChild(style);

    const getAnimeId = () => {
        const match = window.location.pathname.match(/\/anime\/([^\/]+)/);
        return match ? match[1] : null;
    };

    let cachedSkipData = null;
    let lastFetchedEp = null;

    async function syncAniSkip(forceSendToWindow = null) {
        const titleEl = document.querySelector('.entity__title h1');
        const sel = document.querySelector("select[name='series']");
        const currentEp = (sel && sel.options && sel.options[sel.selectedIndex])
            ? sel.options[sel.selectedIndex].textContent.match(/\d+/)?.[0]
            : "1";

        if (forceSendToWindow && cachedSkipData && lastFetchedEp === currentEp) {
            forceSendToWindow.postMessage({ type: 'AS_DATA_UPDATE', data: cachedSkipData }, '*');
            return;
        }

        if (titleEl && window.agLastEpSkip !== currentEp) {
            window.agLastEpSkip = currentEp;
            const rawTitle = titleEl.innerText.split('/')[0].trim();
            try {
                const shiki = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(rawTitle)}&limit=1`).then(r => r.json());

                if (shiki.length > 0) {
                    const ratingContainer = document.querySelector('.entity__rating');
                    if (ratingContainer && !document.getElementById('ag-shiki-btn')) {
                        const shikiUrl = `https://shikimori.one${shiki[0].url}`;
                        const malUrl = `https://myanimelist.net/anime/${shiki[0].id}`;

                        const createBtn = (id, text, url, bgColor) => {
                            const btn = document.createElement('a');
                            btn.id = id;
                            btn.href = url;
                            btn.target = '_blank';
                            btn.className = 'btn d-inline-flex align-items-center';
                            btn.style.cssText = `background-color: ${bgColor}; color: white; font-weight: 600; border-radius: 4px; padding: 0 12px; font-size: 13px; height: 32px; text-decoration: none; margin-top: auto; margin-bottom: auto; border: none; transition: opacity 0.2s;`;
                            btn.onmouseover = () => btn.style.opacity = '0.8';
                            btn.onmouseout = () => btn.style.opacity = '1';
                            btn.innerText = text;
                            return btn;
                        };

                        let malScoreStr = '?';
                        try {
                            const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${shiki[0].id}`);
                            const jikan = await jikanRes.json();
                            if (jikan.data && jikan.data.score) {
                                malScoreStr = jikan.data.score;
                            }
                        } catch (e) {
                            console.error("Error fetching MAL score:", e);
                        }

                        ratingContainer.appendChild(createBtn('ag-shiki-btn', `Shikimori ★ ${shiki[0].score || '?'}`, shikiUrl, '#212121'));
                        ratingContainer.appendChild(createBtn('ag-mal-btn', `MyAnimeList ★ ${malScoreStr}`, malUrl, '#2e51a2'));
                    }

                    const res = await fetch(`https://api.aniskip.com/v2/skip-times/${shiki[0].id}/${parseFloat(currentEp)}?types=op&types=ed&episodeLength=0`).then(r => r.json());
                    const data = { op: { start: 0, end: 0 }, ed: { start: 0, end: 0 } };

                    if (res.found) {
                        const op = res.results.find(r => r.skipType === 'op');
                        const ed = res.results.find(r => r.skipType === 'ed');
                        if (op) data.op = { start: op.interval.startTime, end: op.interval.endTime };
                        if (ed) data.ed = { start: ed.interval.startTime, end: ed.interval.endTime };
                    }

                    cachedSkipData = data;
                    lastFetchedEp = currentEp;

                    const iframe = document.querySelector('iframe');
                    if (iframe?.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'AS_DATA_UPDATE', data }, '*');
                    }
                    if (forceSendToWindow) {
                        forceSendToWindow.postMessage({ type: 'AS_DATA_UPDATE', data }, '*');
                    }
                }
            } catch (e) {
                console.log('Skip Error:', e);
            }
        }
    }

    const checkMarathon = () => {
        const activeId = sessionStorage.getItem('ag_active_marathon_id');
        const currentId = getAnimeId();
        return (activeId && currentId && activeId === currentId);
    };

    const setPseudoFS = (enable) => {
        const container = document.querySelector('.player__video');
        if (!container) return;
        const isActive = container.classList.contains('ag-pseudo-fs-active');

        const shouldDisable = (enable === 'disable') || (enable === 'toggle' && isActive);

        // Отключаем все CSS-анимации на сайте на время переключения
        document.body.classList.add('ag-fs-transitioning');

        const screenW = window.screen.width;
        const screenH = window.screen.height;

        if (shouldDisable) {
            chrome.runtime.sendMessage({ action: "fullscreen_off" });
            container.querySelector('iframe')?.contentWindow.postMessage({ type: 'AG_FS_STATE', active: false }, '*');

            // Ждем окончания анимации окна перед тем как вернуть плеер в поток
            let resizeTimer;
            let fallbackTimer;

            const onResize = () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(finishExit, 100);
            };

            const finishExit = () => {
                clearTimeout(fallbackTimer);
                clearTimeout(resizeTimer);
                container.classList.remove('ag-pseudo-fs-active');
                document.body.classList.remove('ag-no-scroll');
                document.body.style.paddingRight = '';
                container.style.removeProperty('width');
                container.style.removeProperty('height');
                document.body.classList.remove('ag-fs-transitioning');
                window.removeEventListener('resize', onResize);
            };

            window.addEventListener('resize', onResize);
            // Fallback timeout in case resize events don't fire or finish quickly
            fallbackTimer = setTimeout(finishExit, 600);
        } else {
            // Компенсируем ширину скроллбара, чтобы страница под плеером не дергалась
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }

            // Фиксируем размер контейнера на время анимации окна (вход в фуллскрин)
            container.style.setProperty('width', screenW + 'px', 'important');
            container.style.setProperty('height', screenH + 'px', 'important');

            container.classList.add('ag-pseudo-fs-active');
            document.body.classList.add('ag-no-scroll');
            chrome.runtime.sendMessage({ action: "fullscreen_on" });
            container.querySelector('iframe')?.contentWindow.postMessage({ type: 'AG_FS_STATE', active: true }, '*');

            // После завершения анимации окна убираем жесткие размеры
            setTimeout(() => {
                container.style.removeProperty('width');
                container.style.removeProperty('height');
                document.body.classList.remove('ag-fs-transitioning');
            }, 400);
        }

        // Принудительный reflow
        void document.body.offsetHeight;
    };

    const handleResume = () => {
        const btn = document.querySelector('.resume-button');
        if (btn && !btn.dataset.agDone) {
            btn.dataset.agDone = '1';

            const activateMarathon = () => {
                const currentId = getAnimeId();
                if (currentId) sessionStorage.setItem('ag_active_marathon_id', currentId);
                if (settings.autoFS) {
                    setTimeout(() => {
                        setPseudoFS('enable');
                        // Ensure iframe knows about the full-screen state
                        const container = document.querySelector('.player__video');
                        if (container) {
                            container.querySelector('iframe')?.contentWindow.postMessage({ type: 'AG_FS_STATE', active: true }, '*');
                        }
                    }, 300);
                }
            };

            btn.addEventListener('mousedown', activateMarathon);
            btn.addEventListener('click', activateMarathon);
        }
    };

    window.addEventListener('message', (e) => {
        if (!isValidOrigin(e.origin)) return;

        if (e.data?.type === 'AG_PLAYER_READY' || e.data?.type === 'AG_GET_DATA') {
            if (checkMarathon()) e.source.postMessage({ type: 'AG_MARATHON_CONFIRM' }, '*');
            const sel = document.querySelector("select[name='series']");
            let pT = "", nT = "";
            if (sel) {
                const i = sel.selectedIndex;
                if (sel.options[i - 1]) pT = sel.options[i - 1].textContent;
                if (sel.options[i + 1]) nT = sel.options[i + 1].textContent;
            }
            e.source.postMessage({ type: 'AG_DATA', prevTitle: pT, nextTitle: nT }, '*');
            syncAniSkip(e.source);
        }
        if (e.data?.type === 'AG_START_MARATHON') {
            const currentId = getAnimeId();
            if (currentId) sessionStorage.setItem('ag_active_marathon_id', currentId);
            if (settings.autoFS) {
                setTimeout(() => {
                    setPseudoFS('enable');
                    const container = document.querySelector('.player__video');
                    if (container) {
                        container.querySelector('iframe')?.contentWindow.postMessage({ type: 'AG_FS_STATE', active: true }, '*');
                    }
                }, 300);
            }
        }
        if (e.data?.type === 'AG_PSEUDO_FS') setPseudoFS(e.data.action);

        if (e.data?.type === 'AG_NAV') {
            const btn = document.querySelector(e.data.dir === 'next' ? '.next.m-ep-arrow' : '.prev.m-ep-arrow');
            if (btn) {
                if (e.data.dir === 'next') {
                    const currentId = getAnimeId();
                    if (currentId) sessionStorage.setItem('ag_active_marathon_id', currentId);
                }
                btn.click();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setPseudoFS('disable');
    });

    const overlay = document.createElement('div'); overlay.id = 'ag-modal-overlay';
    const modal = document.createElement('div'); modal.id = 'ag-settings-modal';
    document.body.append(overlay, modal);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'AG_GET_PAGE_INFO') {
            const titleEl = document.querySelector('.entity__title h1');
            const animeTitle = titleEl ? titleEl.innerText.split('/')[0].trim() : null;

            // Пытаемся получить текущий эпизод
            const sel = document.querySelector("select[name='series']");
            const currentEp = (sel && sel.options && sel.options[sel.selectedIndex])
                ? sel.options[sel.selectedIndex].textContent.match(/\d+/)?.[0]
                : "1";

            sendResponse({ title: animeTitle, episode: currentEp });
        }
        if (request.type === 'AG_OPEN_SETTINGS') {
            openSettings();
        }
    });

    const renderRow = (id, title, desc) => `<div class="ag-set-row"><span>${title}</span><label class="ag-switch"><input type="checkbox" id="s-${id}" ${settings[id] ? 'checked' : ''}> <span class="ag-slider"></span></label></div><div class="ag-set-desc">${desc}</div>`;
    const renderKeyRow = (action, title, desc) => `<div class="ag-set-row"><span>${title}</span><button class="ag-key-btn" data-action="${action}">${settings.keys[action]}</button></div><div class="ag-set-desc">${desc}</div>`;

    let activeKeyListener = null;

    const openSettings = () => {
        const html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="color:${AG_RED}; margin:0; font-size:18px;">Better UI ⚙️</h4>
                <span style="color: #555; font-size: 11px; font-family: ${AG_FONT};">by l_red_i</span>
            </div>
            
            <div class="ag-set-group">Марафон и Автоматика</div>
            ${renderRow('autoPlay', 'Авто-плей', 'Автоматически нажимает Play.')}
            ${renderRow('autoNext', 'Авто-переход', 'Переключает серию в конце.')}
            ${renderRow('autoFS', 'Псевдо-фуллскрин', 'Улучшенный фуллскрин без рамок. Если выключено — используется обычный.')}
            ${renderRow('autoSkip', 'Авто-скип', 'Пропуск опенингов (AniSkip).')}
            
            <div class="ag-set-group">Интерфейс</div>
            ${renderRow('showNav', 'Стрелки серий', 'Кнопки < и > по бокам.')}
            ${renderRow('showSkipBtn', 'Кнопка +90с', 'Кнопка пропуска опенинга.')}
            ${renderRow('showCenterBtn', 'Кнопки перемотки', 'Дополнительные кнопки -5с / +5с в центре.')}
            ${renderRow('showDBL', 'Двойной клик', 'Перемотка по краям и фуллскрин в центре по 2-му клику.')}
            
            <div class="ag-set-group">Тайминги</div>
            <div class="ag-set-row"><span>Меню исчезает через: <span id="v-ht">${settings.hideTime / 1000}</span>с</span></div>
            <input type="range" id="s-hideTime" min="500" max="5000" step="500" value="${settings.hideTime}" style="width:100%; accent-color:${AG_RED}">

            <div class="ag-set-group">Управление / Hotkeys</div>
            ${renderKeyRow('fs', 'На весь экран', 'Разворачивает плеер в кастомный полноэкранный режим.')}
            ${renderKeyRow('skip', 'Пропустить (Skip)', 'Пропускает опенинг/эндинг или перематывает на 85 секунд вперед.')}
            ${renderKeyRow('next', 'След. серия', 'Переключает на следующую серию.')}
            ${renderKeyRow('prev', 'Пред. серия', 'Переключает на предыдущую серию.')}
            ${renderKeyRow('forward', 'Вперед на 5с', 'Перематывает видео на 5 секунд вперед.')}
            ${renderKeyRow('rewind', 'Назад на 5с', 'Перематывает видео на 5 секунд назад.')}
            
            <div class="ag-footer-btns">
                <button id="ag-reset" class="ag-btn-main" style="background:#2a2a2a; color:#888;">Выключить всё</button>
            </div>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        modal.replaceChildren(...doc.body.childNodes);

        overlay.style.display = modal.style.display = 'block';
        document.body.classList.add('ag-modal-open');

        const saveSettings = () => {
            const newS = {
                hideTime: parseInt(document.getElementById('s-hideTime').value),
                keys: settings.keys
            };
            ['autoPlay', 'autoNext', 'autoFS', 'autoSkip', 'showNav', 'showSkipBtn', 'showCenterBtn', 'showDBL'].forEach(k => newS[k] = document.getElementById(`s-${k}`).checked);

            chrome.storage.local.set({ ag_settings: newS });
            settings = newS;

            const iframe = document.querySelector('iframe');
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'AG_SETTINGS_UPDATE', settings: newS }, '*');
            }
        };

        ['autoPlay', 'autoNext', 'autoFS', 'autoSkip', 'showNav', 'showSkipBtn', 'showCenterBtn', 'showDBL'].forEach(k => {
            document.getElementById(`s-${k}`).addEventListener('change', saveSettings);
        });

        const hideTimeSlider = document.getElementById('s-hideTime');
        hideTimeSlider.oninput = (e) => document.getElementById('v-ht').textContent = e.target.value / 1000;
        hideTimeSlider.addEventListener('change', saveSettings);

        modal.querySelectorAll('.ag-key-btn').forEach(btn => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                btn.innerText = "Жду...";
                btn.classList.add('listening');

                if (activeKeyListener) {
                    document.removeEventListener('keydown', activeKeyListener, true);
                }

                activeKeyListener = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (['control', 'alt', 'shift', 'meta'].includes(e.key.toLowerCase())) return;

                    const pressed = [];
                    if (e.ctrlKey) pressed.push('ctrl');
                    if (e.altKey) pressed.push('alt');
                    if (e.shiftKey) pressed.push('shift');
                    pressed.push(e.key.toLowerCase());

                    const combo = pressed.join('+');
                    settings.keys[action] = combo;

                    btn.innerText = combo;
                    btn.classList.remove('listening');
                    document.removeEventListener('keydown', activeKeyListener, true);
                    activeKeyListener = null;
                    saveSettings();
                };
                document.addEventListener('keydown', activeKeyListener, true);
            };
        });

        document.getElementById('ag-reset').onclick = () => {
            const resetSettings = { ...settings };
            ['autoPlay', 'autoNext', 'autoFS', 'autoSkip', 'showNav', 'showSkipBtn', 'showCenterBtn', 'showDBL'].forEach(k => {
                resetSettings[k] = false;
                const checkbox = document.getElementById(`s-${k}`);
                if (checkbox) checkbox.checked = false;
            });

            chrome.storage.local.set({ ag_settings: resetSettings });
            settings = resetSettings;
            const iframe = document.querySelector('iframe');
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'AG_SETTINGS_UPDATE', settings: resetSettings }, '*');
            }
        };
    };

    overlay.onclick = () => {
        if (activeKeyListener) {
            document.removeEventListener('keydown', activeKeyListener, true);
            activeKeyListener = null;
        }
        overlay.style.display = modal.style.display = 'none';
        document.body.classList.remove('ag-modal-open');
    }

    // Оптимизация: используем MutationObserver вместо setInterval
    let syncTimeout = null;
    const mainObserver = new MutationObserver(() => {
        // Попытка найти кнопку Kodik (так как селекторы AnimeGo могли измениться)
        const kodikBtn = document.querySelector('span[data-provider="2"]') ||
            document.querySelector('li[data-provider="2"]') ||
            document.querySelector('[data-provider-title*="Kodik"]');

        if (kodikBtn && !kodikBtn.classList.contains('active') && !kodikBtn.dataset.agDone) {
            kodikBtn.dataset.agDone = '1';
            kodikBtn.click();
        }
        handleResume();

        // Debounce syncAniSkip to avoid spamming API during heavy DOM changes
        if (!syncTimeout) {
            syncTimeout = setTimeout(() => {
                syncAniSkip();
                syncTimeout = null;
            }, 500);
        }

        const tabs = document.getElementById('video-player');
        if (tabs && !document.getElementById('ag-settings-btn')) {
            const li = document.createElement('li'); li.className = 'nav-item';
            const btn = document.createElement('button');
            btn.className = 'nav-link fs-5';
            btn.id = 'ag-settings-btn';
            btn.type = 'button';
            btn.style.color = AG_RED;
            btn.textContent = '⚙️';
            li.appendChild(btn);
            tabs.appendChild(li);
            li.onclick = openSettings;
        }
    });
    mainObserver.observe(document.body, { childList: true, subtree: true });

    // Вызываем единоразово при загрузке страницы, чтобы кнопки в блоке рейтинга появлялись сразу, не дожидаясь скролла пользователя
    syncAniSkip();

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setPseudoFS('disable'); overlay.click(); } });
})();
