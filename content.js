(async function() {
    'use strict';
    
    const isKodik = /kodik|dbcode|cloud|storage|tube/.test(window.location.hostname);
    const AG_RED = "#ff4a4a";
    const AG_FONT = '"Ubuntu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    
    const DEFAULT_SETTINGS = {
        autoNext: true, autoFS: true, autoSkip: true, autoPlay: true,
        showNav: true, showSkipBtn: true, showCenterBtn: true, showDBL: true,
        hideTime: 2000, extId: chrome.runtime.id 
    };

    async function getSettings() {
        const res = await chrome.storage.local.get(['ag_settings']);
        return res.ag_settings ? {...DEFAULT_SETTINGS, ...res.ag_settings} : DEFAULT_SETTINGS;
    }

    let settings = await getSettings();

    if (isKodik) {
        // --- ЛОГИКА ВНУТРИ ПЛЕЕРА (IFRAME) ---
        let hideTimeout, rewindSum = 0, rewindTimer = null, clickCount = 0, clickTimer = null;
        let canAutoPlay = false;
        let skipData = { op: { start: 0, end: 0 }, ed: { start: 0, end: 0 } };

        window.addEventListener('message', (e) => {
            if (e.data?.type === 'AG_MARATHON_CONFIRM') {
                canAutoPlay = true;
                const playBtn = document.querySelector('.play_button');
                if (playBtn && !playBtn.dataset.agAutoclicked) {
                    playBtn.dataset.agAutoclicked = '1';
                    setTimeout(() => { if (playBtn) playBtn.click(); }, 600);
                }
            }
            if (e.data?.type === 'AG_FS_STATE') document.body.dataset.agFsState = e.data.active;
            if (e.data?.type === 'AS_DATA_UPDATE') { 
                skipData = e.data.data;
                const v = document.querySelector('video');
                if (v) updateTimelineZones(v);
            }
        });

        window.parent.postMessage({type: 'AG_PLAYER_READY'}, '*');

        const playObserver = new MutationObserver(() => {
            if (!settings.autoPlay) return;
            const playBtn = document.querySelector('.play_button');
            if (playBtn && !playBtn.dataset.agAutoclicked) {
                if (canAutoPlay) {
                    playBtn.dataset.agAutoclicked = '1';
                    setTimeout(() => { if (playBtn) playBtn.click(); }, 600);
                } else {
                    playBtn.addEventListener('click', () => {
                        window.parent.postMessage({type: 'AG_START_MARATHON'}, '*');
                    }, { once: true });
                }
            }
        });
        playObserver.observe(document.body, {childList: true, subtree: true});

        function sendFs(action) { window.parent.postMessage({type: 'AG_PSEUDO_FS', action: action}, '*'); }
        function doRewind(s, v) {
            rewindSum += s; showFlash(`${rewindSum > 0 ? '+' : ''}${rewindSum}с`);
            clearTimeout(rewindTimer);
            rewindTimer = setTimeout(() => { v.currentTime += rewindSum; rewindSum = 0; if (v.paused) v.play(); }, 450);
        }
        function showFlash(t) {
            const f = document.getElementById('ag-flash'); if (!f) return;
            f.textContent = t; f.style.opacity = '1';
            clearTimeout(window.fH); window.fH = setTimeout(() => f.style.opacity = '0', 800);
        }

        // ФУНКЦИЯ ОТРИСОВКИ ЗОН И ПОДСКАЗОК
        function updateTimelineZones(v) {
            if (!v || !v.duration) return;
            const timeline = document.querySelector('.fp-timeline');
            if (!timeline) return;

            // Создаем тултип в стиле твоего скриншота
            let tooltip = document.getElementById('ag-timeline-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'ag-timeline-tooltip';
                tooltip.style = `
                    position: fixed; padding: 5px 10px; background: white; 
                    color: black; border-radius: 4px; font-size: 13px; z-index: 1000000; 
                    pointer-events: none; display: none; transform: translate(-50%, -135%);
                    font-family: sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    font-weight: 500;
                `;
                // Хвостик подсказки
                const arrow = document.createElement('div');
                arrow.style = `
                    position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
                    width: 0; height: 0; border-left: 6px solid transparent;
                    border-right: 6px solid transparent; border-top: 6px solid white;
                `;
                tooltip.appendChild(arrow);
                document.body.appendChild(tooltip);
            }

            let container = document.getElementById('ag-timeline-zones');
            if (!container) {
                container = document.createElement('div');
                container.id = 'ag-timeline-zones';
                container.style = "position:absolute; inset:0; pointer-events:none; z-index:0;";
                timeline.appendChild(container);
            } else {
                container.innerHTML = '';
            }

            const formatTime = (s) => {
                const m = Math.floor(s / 60);
                const sec = Math.floor(s % 60);
                return `${m}:${sec < 10 ? '0' : ''}${sec}`;
            }

            const createZone = (start, end, label) => {
                if (start <= 0 || end <= 0) return;
                const left = (start / v.duration) * 100;
                const width = ((end - start) / v.duration) * 100;
                
                const zone = document.createElement('div');
                zone.style = `
                    position:absolute; top:0; bottom:0;
                    left:${left}%; width:${width}%;
                    background: rgba(255, 255, 255, 0.25);
                    border-left: 1px solid rgba(255,255,255,0.1);
                    border-right: 1px solid rgba(255,255,255,0.1);
                    pointer-events: auto; cursor: pointer;
                `;

                zone.onmouseenter = () => { tooltip.style.display = 'block'; };
                zone.onmousemove = (e) => {
                    // Рассчитываем время в точке курсора для подсказки
                    const rect = timeline.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    const currentTime = v.duration * percent;
                    
                    tooltip.innerHTML = `${formatTime(currentTime)}: ${label}`;
                    // Чтобы хвостик не отрывался
                    const arrow = tooltip.querySelector('div');
                    if(arrow) tooltip.appendChild(arrow); 
                    
                    tooltip.style.left = e.clientX + 'px';
                    tooltip.style.top = (rect.top + window.scrollY) + 'px';
                };
                zone.onmouseleave = () => { tooltip.style.display = 'none'; };

                container.appendChild(zone);
            };

            createZone(skipData.op.start, skipData.op.end, "Опенинг");
            createZone(skipData.ed.start, v.duration, "Эндинг");
        }

        function setupSmartSkip(v) {
            if (document.getElementById('ag-smart-skip')) return;
            const btn = document.createElement('div');
            btn.id = 'ag-smart-skip';
            btn.style = `
                position:fixed; bottom:75px; right:25px; z-index:2147483647; 
                padding:10px 20px; background:rgba(0,0,0,0.7); color:#fff; 
                border:1px solid rgba(255,255,255,0.35); border-radius:4px; 
                cursor:pointer; font-family:sans-serif; font-size:14px; 
                display:none; pointer-events:auto; transition:0.2s; user-select:none;
            `;
            btn.onmouseover = () => { btn.style.background = "rgba(255,255,255,0.15)"; btn.style.borderColor = "rgba(255,255,255,0.8)"; };
            btn.onmouseout = () => { btn.style.background = "rgba(0,0,0,0.7)"; btn.style.borderColor = "rgba(255,255,255,0.35)"; };
            document.body.appendChild(btn);

            setInterval(() => {
                const cur = v.currentTime;
                updateTimelineZones(v);
                const nativeSkip = Array.from(document.querySelectorAll('[class*="skip"]'))
                    .find(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden' && el.innerText.trim().length > 0;
                    });
                if (nativeSkip) { btn.style.display = "none"; return; }
                let skipTarget = null;
                if (skipData.op.start > 0 && cur >= skipData.op.start && cur <= skipData.op.end) {
                    btn.innerText = "Пропустить опенинг"; skipTarget = skipData.op.end;
                } else if (skipData.ed.start > 0 && cur >= skipData.ed.start && cur <= (v.duration - 5)) {
                    btn.innerText = "Пропустить эндинг"; skipTarget = v.duration - 1;
                }
                if (skipTarget) {
                    if (settings.autoSkip) { v.currentTime = skipTarget; btn.style.display = "none"; } 
                    else { btn.style.display = "block"; btn.onclick = (e) => { e.stopPropagation(); v.currentTime = skipTarget; }; }
                } else { btn.style.display = "none"; }
            }, 500);
        }

        function handleZone(e, type, v) {
            if (!settings.showDBL) return;
            e.stopPropagation(); e.preventDefault();
            clickCount++;
            if (clickCount >= 2) {
                if (type === 'prev') doRewind(-5, v);
                if (type === 'next') doRewind(5, v);
                if (type === 'mid') sendFs('toggle');
                clickCount = 0; clearTimeout(clickTimer);
            } else {
                clearTimeout(clickTimer);
                clickTimer = setTimeout(() => {
                    if (clickCount === 1) { v.paused ? v.play() : v.pause(); }
                    clickCount = 0;
                }, 250);
            }
        }

        function drawUI(v) {
            if (document.getElementById('ag-ui')) return;
            setupSmartSkip(v);
            const style = document.createElement("style");
            style.innerText = `
                #ag-ui { position:absolute; inset:0; pointer-events:none; z-index:9999990; opacity:0; transition:0.5s; display:flex; align-items:center; justify-content:center; font-family:${AG_FONT}; }
                .ag-btn { position:absolute; pointer-events:auto; cursor:pointer; background:rgba(30,30,30,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); color:#fff; display:flex; align-items:center; justify-content:center; transition:0.2s; border-radius:15px; user-select:none; opacity:0.3; z-index:9999997; }
                .ag-btn:hover { opacity:0.8; color:${AG_RED}; border-color:${AG_RED}33; }
                .ag-nav { width:80px; height:140px; font-size:35px; top:50%; transform:translateY(-50%); display: ${settings.showNav ? 'flex' : 'none'}; }
                #ag-skip { left:0; top:calc(50% + 150px); transform:translateY(-50%); width:80px; height:140px; font-size:45px; display: ${settings.showSkipBtn ? 'flex' : 'none'}; transition: 0.4s; }
                body[data-ag-fs-state="true"] #ag-skip { top: auto; bottom: 80px; transform: translateY(0); }
                .ag-center-btn { position:relative; width:60px; height:60px; font-size:18px; border-radius:50%; margin:0 40px; display: ${settings.showCenterBtn ? 'flex' : 'none'}; }
                #ag-flash { position:absolute; top:30%; left:50%; transform:translateX(-50%); color:white; font-size:32px; font-weight:bold; opacity:0; text-shadow:0 0 10px #000; z-index:10000; }
                .ag-click-zone { position:absolute; top:0; height:75%; pointer-events:auto; z-index:9999980; }
                #ag-fs-patch { position:absolute; bottom:0; right:0; width:60px; height:60px; pointer-events:auto; z-index:9999999; cursor:pointer; }
                #ag-tooltip { position:absolute; bottom:65px; right:10px; background:rgba(21,21,21,0.9); color:#fff; padding:4px 9px; border-radius:4px; font-size:12px; opacity:0; transition:0.1s; pointer-events:none; white-space:nowrap; border:1px solid #333; }
                #ag-fs-patch:hover + #ag-tooltip { opacity:1; }
                .ag-num { position:absolute; top:12px; font-size:16px; font-weight:bold; opacity:0.9; }
            `;
            document.head.appendChild(style);
            const ui = document.createElement('div'); ui.id = 'ag-ui';
            ui.innerHTML = `<div class="ag-btn ag-nav" style="left:0" id="ag-p"><span>&lt;</span><div id="ag-pn" class="ag-num"></div></div><div class="ag-btn ag-nav" style="right:0" id="ag-n"><span>&gt;</span><div id="ag-nn" class="ag-num"></div></div><div class="ag-btn" id="ag-skip"><span>»</span></div><div class="ag-btn ag-center-btn" id="ag-c1">«5</div><div class="ag-btn ag-center-btn" id="ag-c2">5»</div><div id="ag-flash"></div><div class="ag-click-zone" style="left:0; width:20%;" id="z-p"></div><div class="ag-click-zone" style="right:0; width:20%;" id="z-n"></div><div class="ag-click-zone" style="left:20%; width:60%;" id="z-m"></div><div id="ag-fs-patch"></div><div id="ag-tooltip">Better UI: Расширить плеер</div>`;
            document.body.appendChild(ui);
            document.getElementById('ag-fs-patch').onclick = () => sendFs('toggle');
            document.getElementById('ag-p').onclick = () => window.parent.postMessage({type:'AG_NAV', dir:'prev'}, '*');
            document.getElementById('ag-n').onclick = () => window.parent.postMessage({type:'AG_NAV', dir:'next'}, '*');
            document.getElementById('ag-skip').onclick = () => v.currentTime += 90;
            document.getElementById('ag-c1').onclick = () => doRewind(-5, v);
            document.getElementById('ag-c2').onclick = () => doRewind(5, v);
            document.getElementById('z-p').onclick = (e) => handleZone(e, 'prev', v);
            document.getElementById('z-n').onclick = (e) => handleZone(e, 'next', v);
            document.getElementById('z-m').onclick = (e) => handleZone(e, 'mid', v);
            window.addEventListener('mousemove', () => {
                ui.style.opacity='1'; clearTimeout(hideTimeout);
                hideTimeout=setTimeout(()=>ui.style.opacity='0', settings.hideTime);
            });
            window.addEventListener('message', (e) => {
                if (e.data?.type === 'AG_DATA') {
                    const getN = (s) => s ? s.match(/\d+/)?.[0] : "";
                    if (document.getElementById('ag-pn')) document.getElementById('ag-pn').textContent = getN(e.data.prevTitle);
                    if (document.getElementById('ag-nn')) document.getElementById('ag-nn').textContent = getN(e.data.nextTitle);
                }
            });
            setInterval(() => window.parent.postMessage({type:'AG_GET_DATA'}, '*'), 2000);
        }

        setInterval(() => {
            const v = document.querySelector('video');
            if (v && !v.dataset.agInit) { 
                v.dataset.agInit = '1'; drawUI(v); 
                v.addEventListener('play', () => { if(settings.autoFS) sendFs('enable'); }, {once:true});
                v.onended = () => { if(settings.autoNext) window.parent.postMessage({type:'AG_NAV', dir:'next'}, '*'); }; 
            }
            if (settings.autoSkip) { 
                document.querySelectorAll('[class*="skip"]').forEach(btn => { 
                    const text = btn.textContent.toLowerCase();
                    if ((text.includes('пропустить') || text.includes('skip')) && !btn.dataset.agDone) {
                        btn.dataset.agDone = '1';
                        const seekTime = btn.getAttribute('data-seek-to');
                        const video = document.querySelector('video');
                        if (seekTime && video) { video.currentTime = parseFloat(seekTime); } 
                        else {
                            const opts = { bubbles: true, cancelable: true, view: window };
                            btn.dispatchEvent(new MouseEvent('mousedown', opts));
                            btn.dispatchEvent(new MouseEvent('mouseup', opts));
                            btn.click();
                        }
                    }
                }); 
            }
        }, 800);
    } else {
        // --- ЛОГИКА ANIMEGO (Сайт) ---
        const style = document.createElement('style');
        style.innerText = `.ag-pseudo-fs-active { position:fixed!important; inset:0!important; z-index:2147483647!important; background:#000!important; width:100vw!important; height:100vh!important; margin:0!important; padding:0!important; }.ag-pseudo-fs-active .player-video__online, .ag-pseudo-fs-active .player-video, .ag-pseudo-fs-active .player-video__main { height:100%!important; width:100%!important; padding:0!important; margin:0!important; }.ag-pseudo-fs-active iframe { width:100%!important; height:100%!important; position:absolute!important; inset:0!important; border:none!important; }.ag-pseudo-fs-active .player-video-bar, .ag-pseudo-fs-active .player-video__side { display:none!important; }body.ag-no-scroll { overflow:hidden!important; }#ag-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999999; display:none; backdrop-filter:blur(4px); }#ag-settings-modal { position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1a1a1a; color:#fff; padding:24px; border-radius:24px; z-index:10000001; display:none; width:440px; font-family:${AG_FONT}; border:1px solid #333; box-shadow:0 20px 60px rgba(0,0,0,0.8); max-height: 90vh; overflow-y: auto; }.ag-set-group { color:${AG_RED}; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-top:24px; border-bottom:1px solid #333; padding-bottom:5px; opacity:0.8; }.ag-set-row { display:flex; justify-content:space-between; align-items:center; margin:15px 0 4px 0; font-size:15px; font-weight:bold; }.ag-set-desc { font-size:11px; color:#888; margin-bottom:12px; line-height:1.4; padding-right:40px; }.ag-switch { position:relative; width:34px; height:18px; cursor:pointer; }.ag-switch input { opacity:0; width:0; height:0; }.ag-slider { position:absolute; inset:0; background:#333; border-radius:20px; transition:.3s; }.ag-slider:before { position:absolute; content:""; height:12px; width:12px; left:3px; bottom:3px; background:white; transition:.3s; border-radius:50%; }input:checked + .ag-slider { background:${AG_RED}; }input:checked + .ag-slider:before { transform:translateX(16px); }.ag-footer-btns { display:flex; gap:12px; margin-top:25px; }.ag-btn-main { flex:1; padding:12px; border-radius:12px; cursor:pointer; border:none; font-weight:bold; font-family:${AG_FONT}; }#ag-save { background:${AG_RED}; color:white; }#ag-reset { background:#2a2a2a; color:#888; }`;
        document.head.appendChild(style);

        const getAnimeId = () => {
            const match = window.location.pathname.match(/\/anime\/([^\/]+)/);
            return match ? match[1] : null;
        };

        async function syncAniSkip() {
            const titleEl = document.querySelector('.entity__title h1');
            const sel = document.querySelector("select[name='series']");
            const currentEp = (sel && sel.options && sel.options[sel.selectedIndex]) 
    ? sel.options[sel.selectedIndex].textContent.match(/\d+/)?.[0] 
    : "1";
            if (titleEl && window.agLastEpSkip !== currentEp) {
                window.agLastEpSkip = currentEp;
                const rawTitle = titleEl.innerText.split('/')[0].trim();
                try {
                    const shiki = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(rawTitle)}&limit=1`).then(r => r.json());
                    if (shiki.length > 0) {
                        const res = await fetch(`https://api.aniskip.com/v2/skip-times/${shiki[0].id}/${parseFloat(currentEp)}?types=op&types=ed&episodeLength=0`).then(r => r.json());
                        if (res.found) {
                            const op = res.results.find(r => r.skipType === 'op');
                            const ed = res.results.find(r => r.skipType === 'ed');
                            const data = {
                                op: op ? { start: op.interval.startTime, end: op.interval.endTime } : { start: 0, end: 0 },
                                ed: ed ? { start: ed.interval.startTime, end: ed.interval.endTime } : { start: 0, end: 0 }
                            };
                            document.querySelector('iframe')?.contentWindow.postMessage({ type: 'AS_DATA_UPDATE', data }, '*');
                        }
                    }
                } catch (e) { console.log('Skip Error:', e); }
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
            const target = (enable === 'toggle') ? !isActive : (enable === 'enable');
            container.classList.toggle('ag-pseudo-fs-active', target);
            document.body.classList.toggle('ag-no-scroll', target);
            chrome.runtime.sendMessage({ action: target ? "fullscreen_on" : "fullscreen_off" });
            container.querySelector('iframe')?.contentWindow.postMessage({type: 'AG_FS_STATE', active: target}, '*');
        };

        const handleResume = () => {
            const btn = document.querySelector('.resume-button');
            if (btn && !btn.dataset.agDone) {
                btn.dataset.agDone = '1';
                btn.addEventListener('click', () => {
                    const currentId = getAnimeId();
                    if (currentId) sessionStorage.setItem('ag_active_marathon_id', currentId);
                    if (settings.autoFS) setTimeout(() => setPseudoFS('enable'), 300);
                });
            }
        };

        window.addEventListener('message', (e) => {
            if (e.data?.type === 'AG_PLAYER_READY' || e.data?.type === 'AG_GET_DATA') {
                if (checkMarathon()) e.source.postMessage({ type: 'AG_MARATHON_CONFIRM' }, '*');
                const sel = document.querySelector("select[name='series']");
                let pT = "", nT = "";
                if (sel) {
                    const i = sel.selectedIndex;
                    if (sel.options[i-1]) pT = sel.options[i-1].textContent;
                    if (sel.options[i+1]) nT = sel.options[i+1].textContent;
                }
                e.source.postMessage({ type: 'AG_DATA', prevTitle: pT, nextTitle: nT }, '*');
                syncAniSkip();
            }
            if (e.data?.type === 'AG_START_MARATHON') {
                const currentId = getAnimeId();
                if (currentId) sessionStorage.setItem('ag_active_marathon_id', currentId);
            }
            if (e.data?.type === 'AG_PSEUDO_FS') setPseudoFS(e.data.action);
            if (e.data?.type === 'AG_NAV') {
                const btn = document.querySelector(e.data.dir === 'next' ? '.next.m-ep-arrow' : '.prev.m-ep-arrow');
                if (btn) btn.click();
            }
        });

        const overlay = document.createElement('div'); overlay.id = 'ag-modal-overlay';
        const modal = document.createElement('div'); modal.id = 'ag-settings-modal';
        document.body.append(overlay, modal);

        const renderRow = (id, title, desc) => `<div class="ag-set-row"><span>${title}</span><label class="ag-switch"><input type="checkbox" id="s-${id}" ${settings[id]?'checked':''}> <span class="ag-slider"></span></label></div><div class="ag-set-desc">${desc}</div>`;
        
        const openSettings = () => {
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="color:${AG_RED}; margin:0; font-size:18px;">Better UI ⚙️</h4>
            <span style="color: #555; font-size: 11px; font-family: ${AG_FONT};">by l_red_i</span>
        </div>
                <div class="ag-set-group">Марафон и Автоматика</div>
                ${renderRow('autoPlay', 'Авто-плей', 'Автоматически нажимает Play при переходе между сериями.')}
                ${renderRow('autoNext', 'Авто-переход', 'Переключает на следующую серию, когда текущая заканчивается.')}
                ${renderRow('autoFS', 'Фуллскрин', 'Авто-разворачивание плеера на всё окно при старте.')}
                ${renderRow('autoSkip', 'Авто-скип', 'Автоматически пропускает опенинги (через AniSkip).')}
                <div class="ag-set-group">Интерфейс и Кнопки</div>
                ${renderRow('showNav', 'Стрелки серий', 'Крупные кнопки < и > по бокам плеера.')}
                ${renderRow('showSkipBtn', 'Кнопка +90с', 'Кнопка быстрого прыжка вперед (для опенингов).')}
                ${renderRow('showCenterBtn', 'Кнопки перемотки', 'Дополнительные кнопки -5с / +5с в центре.')}
                ${renderRow('showDBL', 'Двойной клик', 'Перемотка по краям и фуллскрин в центре по 2-му клику.')}
                <div class="ag-set-group">Тайминги</div>
                <div class="ag-set-row"><span>Скрывать меню через: <span id="v-ht">${settings.hideTime/1000}</span>с</span></div>
                <input type="range" id="s-hideTime" min="500" max="5000" step="500" value="${settings.hideTime}" style="width:100%; accent-color:${AG_RED}">
                <div class="ag-footer-btns">
                    <button id="ag-reset" class="ag-btn-main">Сброс</button>
                    <button id="ag-save" class="ag-btn-main">Сохранить</button>
                </div>`;
            overlay.style.display = modal.style.display = 'block';
            document.getElementById('s-hideTime').oninput = (e) => document.getElementById('v-ht').textContent = e.target.value/1000;
            document.getElementById('ag-save').onclick = () => {
                const newS = { hideTime: parseInt(document.getElementById('s-hideTime').value) };
                ['autoPlay', 'autoNext', 'autoFS', 'autoSkip', 'showNav', 'showSkipBtn', 'showCenterBtn', 'showDBL'].forEach(k => newS[k] = document.getElementById(`s-${k}`).checked);
                chrome.storage.local.set({ag_settings: newS}, () => location.reload());
            };
            document.getElementById('ag-reset').onclick = () => { chrome.storage.local.set({ag_settings: DEFAULT_SETTINGS}, () => location.reload()); };
        };

        overlay.onclick = () => overlay.style.display = modal.style.display = 'none';

        setInterval(() => {
            const kodikBtn = document.querySelector('button[data-provider-title*="Kodik"]');
            if (kodikBtn && !kodikBtn.classList.contains('active') && !kodikBtn.dataset.agDone) {
                kodikBtn.dataset.agDone = '1'; kodikBtn.click();
            }
            handleResume();
            syncAniSkip();
            const tabs = document.getElementById('video-player');
            if (tabs && !document.getElementById('ag-settings-btn')) {
                const li = document.createElement('li'); li.className='nav-item';
                li.innerHTML = `<button class="nav-link fs-5" id="ag-settings-btn" type="button" style="color:${AG_RED}">⚙️</button>`;
                tabs.appendChild(li);
                li.onclick = openSettings;
            }
        }, 800);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setPseudoFS('disable'); overlay.click(); } });
    }
})();