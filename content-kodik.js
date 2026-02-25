(async function() {
    'use strict';
    
    let settings = await window.getSettings();

    // ==========================================
    // --- ЛОГИКА ВНУТРИ ПЛЕЕРА (IFRAME) ---
    // ==========================================
    let hideTimeout, rewindSum = 0, rewindTimer = null, clickCount = 0, clickTimer = null;
    let canAutoPlay = false; 
    let skipData = { op: { start: 0, end: 0 }, ed: { start: 0, end: 0 } };
    let currentSkipTarget = null;

    function applyVisualSettings() {
        const navs = document.querySelectorAll('.ag-nav');
        navs.forEach(el => el.style.display = settings.showNav ? 'flex' : 'none');
        
        const skipBtn = document.getElementById('ag-skip');
        if (skipBtn) skipBtn.style.display = settings.showSkipBtn ? 'flex' : 'none';
        
        const centerBtns = document.querySelectorAll('.ag-center-btn');
        centerBtns.forEach(el => el.style.display = settings.showCenterBtn ? 'flex' : 'none');
    }

    document.addEventListener('keydown', (e) => {
        if (e.repeat) return; 
        
        const pressed = [];
        if (e.ctrlKey) pressed.push('ctrl');
        if (e.altKey) pressed.push('alt');
        if (e.shiftKey) pressed.push('shift');
        if (!['control', 'alt', 'shift', 'meta'].includes(e.key.toLowerCase())) {
            pressed.push(e.key.toLowerCase());
        }
        const combo = pressed.join('+');

        const v = document.querySelector('video');
        if (!v) return;

        if (combo === settings.keys.fs) {
            e.preventDefault(); e.stopPropagation();
            window.parent.postMessage({type: 'AG_PSEUDO_FS', action: 'toggle'}, '*');
        }
        else if (combo === settings.keys.forward) {
            e.preventDefault(); e.stopPropagation();
            doRewind(5, v);
        }
        else if (combo === settings.keys.rewind) {
            e.preventDefault(); e.stopPropagation();
            doRewind(-5, v);
        }
        else if (combo === settings.keys.next) {
            e.preventDefault(); e.stopPropagation();
            window.parent.postMessage({type:'AG_NAV', dir:'next'}, '*');
        }
        else if (combo === settings.keys.prev) {
            e.preventDefault(); e.stopPropagation();
            window.parent.postMessage({type:'AG_NAV', dir:'prev'}, '*');
        }
        else if (combo === settings.keys.skip) {
            e.preventDefault(); e.stopPropagation();
            if (currentSkipTarget) {
                v.currentTime = currentSkipTarget;
                showFlash("Skipped!");
            } else {
                v.currentTime += 85; 
                showFlash("Skip +85s");
            }
        }
        else if (e.key === 'Escape') {
            window.parent.postMessage({type: 'AG_PSEUDO_FS', action: 'disable'}, '*');
        }
    });

    window.addEventListener('message', (e) => {
        if (!window.isValidOrigin(e.origin)) return; // Security check

        if (e.data?.type === 'AG_MARATHON_CONFIRM') {
            canAutoPlay = true; 
            if (!settings.autoPlay) return;
            const playBtn = document.querySelector('.play_button');
            if (playBtn && !playBtn.dataset.agAutoclicked) {
                playBtn.dataset.agAutoclicked = '1';
                setTimeout(() => { if (playBtn) playBtn.click(); }, 600);
            }
        }
        if (e.data?.type === 'AG_FS_STATE') {
            document.body.dataset.agFsState = e.data.active;
            document.body.classList.add('ag-fs-transitioning');
            setTimeout(() => document.body.classList.remove('ag-fs-transitioning'), 300);
        }
        
        if (e.data?.type === 'AS_DATA_UPDATE') { 
            skipData = e.data.data;
            const v = document.querySelector('video');
            if (v) updateTimelineZones(v);
        }

        if (e.data?.type === 'AG_SETTINGS_UPDATE') {
            settings = e.data.settings;
            applyVisualSettings();
            const ui = document.getElementById('ag-ui');
            if (ui) { ui.style.opacity = '1'; clearTimeout(hideTimeout); hideTimeout=setTimeout(()=>ui.style.opacity='0', settings.hideTime); }
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

    function updateTimelineZones(v) {
        if (!v || !v.duration) return;
        const timeline = document.querySelector('.fp-timeline');
        if (!timeline) return;

        let tooltip = document.getElementById('ag-timeline-tooltip');
        let tooltipText = document.getElementById('ag-timeline-tooltip-text');
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
            tooltipText = document.createElement('span');
            tooltipText.id = 'ag-timeline-tooltip-text';
            tooltip.appendChild(tooltipText);
            
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
            container.replaceChildren();
        }

        const formatTime = (s) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec < 10 ? '0' : ''}${sec}`;
        }

        const createZone = (start, end, label) => {
            if (start < 0 || end <= 0) return;
            
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
                const rect = timeline.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                const currentTime = v.duration * percent;
                const textSpan = document.getElementById('ag-timeline-tooltip-text');
                if (textSpan) textSpan.textContent = `${formatTime(currentTime)}: ${label}`;
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

        let lastTimeUpdate = 0;
        v.addEventListener('timeupdate', () => {
            const now = Date.now();
            if (now - lastTimeUpdate < 500) return; // Оптимизация: запускаем логику не чаще 2 раз в секунду
            lastTimeUpdate = now;
            
            const cur = v.currentTime;
            
            // Оптимизация: offsetParent работает быстрее, чем getComputedStyle
            const nativeSkip = Array.from(document.querySelectorAll('[class*="skip"]'))
                .find(el => el.offsetParent !== null && el.innerText.trim().length > 0);
            
            if (nativeSkip) { 
                btn.style.display = "none"; 
                currentSkipTarget = null;
                return; 
            }
            
            let skipTarget = null;
            
            if (skipData.op.end > 0 && cur >= skipData.op.start && cur <= skipData.op.end) {
                btn.innerText = "Пропустить опенинг"; skipTarget = skipData.op.end;
            } else if (skipData.ed.start > 0 && cur >= skipData.ed.start && cur <= (v.duration - 5)) {
                btn.innerText = "Пропустить эндинг"; skipTarget = v.duration - 1;
            }
            
            currentSkipTarget = skipTarget;

            if (skipTarget) {
                if (settings.autoSkip) { v.currentTime = skipTarget; btn.style.display = "none"; } 
                else { btn.style.display = "block"; btn.onclick = (e) => { e.stopPropagation(); v.currentTime = skipTarget; }; }
            } else { btn.style.display = "none"; }
        });
        
        v.addEventListener('loadedmetadata', () => updateTimelineZones(v));
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
            #ag-ui { position:absolute; inset:0; pointer-events:none; z-index:9999990; opacity:0; transition:0.5s; display:flex; align-items:center; justify-content:center; font-family:${window.AG_FONT}; }
            .ag-btn { position:absolute; pointer-events:auto; cursor:pointer; background:rgba(30,30,30,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); color:#fff; display:flex; align-items:center; justify-content:center; transition:0.2s; border-radius:15px; user-select:none; opacity:0.3; z-index:9999997; }
            .ag-btn:hover { opacity:0.8; color:${window.AG_RED}; border-color:${window.AG_RED}33; }
            .ag-nav { width:80px; height:140px; font-size:35px; top:50%; transform:translateY(-50%); } 
            #ag-skip { left:0; top:calc(50% + 150px); transform:translateY(-50%); width:80px; height:140px; font-size:45px; transition: 0.4s; }
            body[data-ag-fs-state="true"] #ag-skip { top: auto; bottom: 80px; transform: translateY(0); }
            .ag-center-btn { position:relative; width:60px; height:60px; font-size:18px; border-radius:50%; margin:0 40px; }
            #ag-flash { position:absolute; top:30%; left:50%; transform:translateX(-50%); color:white; font-size:32px; font-weight:bold; opacity:0; text-shadow:0 0 10px #000; z-index:10000; }
            .ag-click-zone { position:absolute; top:0; height:75%; pointer-events:auto; z-index:9999980; }
            #ag-fs-patch { position:absolute; bottom:0; right:0; width:60px; height:60px; pointer-events:auto; z-index:9999999; cursor:pointer; }
            #ag-tooltip { position:absolute; bottom:65px; right:10px; background:rgba(21,21,21,0.9); color:#fff; padding:4px 9px; border-radius:4px; font-size:12px; opacity:0; transition:0.1s; pointer-events:none; white-space:nowrap; border:1px solid #333; }
            #ag-fs-patch:hover + #ag-tooltip { opacity:1; }
            .ag-num { position:absolute; top:12px; font-size:16px; font-weight:bold; opacity:0.9; }
            body.ag-fs-transitioning, body.ag-fs-transitioning * { transition: none !important; animation: none !important; }
        `;
        document.head.appendChild(style);
        const ui = document.createElement('div'); ui.id = 'ag-ui';
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div class="ag-btn ag-nav" style="left:0" id="ag-p"><span>&lt;</span><div id="ag-pn" class="ag-num"></div></div><div class="ag-btn ag-nav" style="right:0" id="ag-n"><span>&gt;</span><div id="ag-nn" class="ag-num"></div></div><div class="ag-btn" id="ag-skip"><span>»</span></div><div class="ag-btn ag-center-btn" id="ag-c1">«5</div><div class="ag-btn ag-center-btn" id="ag-c2">5»</div><div id="ag-flash"></div><div class="ag-click-zone" style="left:0; width:20%;" id="z-p"></div><div class="ag-click-zone" style="right:0; width:20%;" id="z-n"></div><div class="ag-click-zone" style="left:20%; width:60%;" id="z-m"></div><div id="ag-fs-patch"></div><div id="ag-tooltip">Better UI: Расширить плеер</div>`, 'text/html');
        ui.replaceChildren(...doc.body.childNodes);
        document.body.appendChild(ui);
        
        applyVisualSettings();

        document.getElementById('ag-fs-patch').onclick = () => sendFs('toggle');
        document.getElementById('ag-p').onclick = () => window.parent.postMessage({type:'AG_NAV', dir:'prev'}, '*');
        document.getElementById('ag-n').onclick = () => window.parent.postMessage({type:'AG_NAV', dir:'next'}, '*');
        document.getElementById('ag-skip').onclick = () => v.currentTime += 90;
        document.getElementById('ag-c1').onclick = () => doRewind(-5, v);
        document.getElementById('ag-c2').onclick = () => doRewind(5, v);
        document.getElementById('z-p').onclick = (e) => handleZone(e, 'prev', v);
        document.getElementById('z-n').onclick = (e) => handleZone(e, 'next', v);
        document.getElementById('z-m').onclick = (e) => handleZone(e, 'mid', v);
        
        // Throttled mousemove
        let moveTimer;
        window.addEventListener('mousemove', () => {
            if (moveTimer) return;
            moveTimer = setTimeout(() => { moveTimer = null; }, 150);
            if (ui.style.opacity !== '1') ui.style.opacity = '1'; 
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => ui.style.opacity = '0', settings.hideTime);
        });
        window.addEventListener('message', (e) => {
            if (!window.isValidOrigin(e.origin)) return;
            if (e.data?.type === 'AG_DATA') {
                const getN = (s) => s ? s.match(/\d+/)?.[0] : "";
                if (document.getElementById('ag-pn')) document.getElementById('ag-pn').textContent = getN(e.data.prevTitle);
                if (document.getElementById('ag-nn')) document.getElementById('ag-nn').textContent = getN(e.data.nextTitle);
            }
        });
        setInterval(() => window.parent.postMessage({type:'AG_GET_DATA'}, '*'), 2000);
    }

    // Оптимизация: используем MutationObserver вместо setInterval
    const iframeObserver = new MutationObserver(() => {
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
    });
    iframeObserver.observe(document.body, { childList: true, subtree: true });
})();
