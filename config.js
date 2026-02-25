(async function() {
    'use strict';
    
    window.AG_RED = "#ff4a4a";
    window.AG_FONT = '"Ubuntu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    
    window.DEFAULT_SETTINGS = {
        autoNext: true, autoFS: true, autoSkip: true, autoPlay: true,
        showNav: true, showSkipBtn: true, showCenterBtn: true, showDBL: true,
        hideTime: 2000, extId: chrome.runtime.id,
        keys: {
            fs: "f",
            next: "n",
            prev: "p",
            skip: "s",
            rewind: "arrowleft",
            forward: "arrowright"
        }
    };

    window.getSettings = async function() {
        const res = await chrome.storage.local.get(['ag_settings']);
        if (!res.ag_settings) return window.DEFAULT_SETTINGS;
        const merged = {...window.DEFAULT_SETTINGS, ...res.ag_settings};
        merged.keys = {...window.DEFAULT_SETTINGS.keys, ...(res.ag_settings.keys || {})};
        return merged;
    };

    window.isValidOrigin = function(origin) {
        return origin.includes('animego.org') || 
               origin.includes('animego.me') || 
               origin.includes('kodik.info') || 
               origin.includes('dbcode.info');
    };
})();
