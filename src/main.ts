// Fix for KaiOS/Firefox 48 "Cannot set property X of #<Window> which has only a getter"
// This allows polyfills (like whatwg-fetch) to safely overwrite these properties.
['fetch', 'Headers', 'Request', 'Response'].forEach(function(prop) {
    if (typeof window !== 'undefined' && (window as any)[prop]) {
        try {
            Object.defineProperty(window, prop, {
                value: (window as any)[prop],
                writable: true,
                configurable: true
            });
        } catch (e) {
            console.error('Failed to redefine ' + prop + ':', e);
        }
    }
});

import { adjustVolume, forceVolumeChannel } from './volume';
import { performSearch, processDirectLink, catchYoutubeURL, parseDownloads, VideoItem, DirectLinkInfo, proxify } from './extractor';
import './style.css';

// --- CONSTANTS (ICONS) ---
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="60" height="60" fill="rgba(255,255,255,0.8)"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="60" height="60" fill="rgba(255,255,255,0.8)"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

const SVG_VIDEO = '<svg viewBox="0 0 24 24" width="60" height="60" fill="#E91E63"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>';
const SVG_AUDIO = '<svg viewBox="0 0 24 24" width="60" height="60" fill="#00B0FF"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>';
const SVG_FILE = '<svg viewBox="0 0 24 24" width="60" height="60" fill="#999"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>';

// --- GLOBALS ---
let currentView = 'HOME';
let items: HTMLElement[] = [];
let currentIndex = 0;
let savedIndex = 0;
let listContainer: HTMLElement;
let savedQuery = '';
let lastSearchResults: VideoItem[] = [];
let searchTimeout: any = null;

// --- INIT ---
function initApp() {
    listContainer = document.getElementById('list') as HTMLElement;
    
    forceVolumeChannel();
    renderHome(false);
    
    // Only load the simulator in development mode
    const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
    if (isDev) {
        import('./simulator').then(({ initSimulator }) => {
            initSimulator();
        });
    }

    window.addEventListener('keydown', function(e) {
        if (currentView === 'PLAYER') {
            if(e.key === 'VolumeUp' || e.key === 'VolumeDown') {
                return; 
            }
            e.preventDefault();
            handlePlayerKeys(e.key);
            return;
        }

        switch(e.key) {
            case 'ArrowDown': case 'Down': move(1); e.preventDefault(); break;
            case 'ArrowUp': case 'Up': move(-1); e.preventDefault(); break;
            case 'Enter': case 'Accept': handleEnter(); break;
            case 'SoftLeft': handleLeft(); break;
            case 'SoftRight': handleRight(); break;
            case 'Backspace': case 'EndCall':
                if(document.activeElement?.tagName !== 'INPUT') {
                    e.preventDefault();
                    handleBack();
                }
                break;
        }
    });

    const nav = navigator as any;
    if (nav.mozSetMessageHandler) {
        nav.mozSetMessageHandler('activity', function (req: any) {
            if (req.source.name === 'share') {
                const url = req.source.data.url;
                if(url) {
                    renderHome(false);
                    const inp = document.getElementById('searchInput') as HTMLInputElement;
                    if(inp) inp.value = url;
                    processInput(url);
                }
            }
        });
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// --- NAV ---
function refreshNav() {
    items = Array.from(document.querySelectorAll('.item'));
    if (currentIndex >= items.length) currentIndex = items.length - 1;
    if (currentIndex < 0) currentIndex = 0;
    updateSelection(currentIndex);
}

function move(dir: number) {
    if (items.length === 0) return;
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && activeEl.tagName === 'INPUT') activeEl.blur(); 
    currentIndex += dir;
    if (currentIndex >= items.length) currentIndex = 0;
    else if (currentIndex < 0) currentIndex = items.length - 1;
    updateSelection(currentIndex);
}

function updateSelection(index: number) {
    if (items.length === 0) return;
    for (let i = 0; i < items.length; i++) items[i].classList.remove('active');
    const curr = items[index];
    if(curr) {
        curr.classList.add('active');
        scrollToCenter(curr, listContainer);
    }
}

function scrollToCenter(el: HTMLElement, container: HTMLElement) {
    const elTop = el.offsetTop;
    const elH = el.offsetHeight;
    const conH = container.clientHeight;
    container.scrollTop = elTop - (conH / 2) + (elH / 2);
}

function handleEnter() {
    const el = items[currentIndex];
    if(!el) return;
    const input = el.querySelector('input');
    if(input) { input.focus(); return; }
    if(el.classList.contains('video-card')) savedIndex = currentIndex; 
    el.click();
}

function handleBack() {
    if (currentView === 'DOWNLOAD' || currentView === 'HELP') {
        renderHome(true); 
    } else {
        if(lastSearchResults.length > 0) {
            lastSearchResults = [];
            renderHome(false);
        } else {
            window.close();
        }
    }
}

function handleLeft() {
    handleBack();
}

function handleRight() {
    if(currentView === 'HOME') renderHelp();
}

function updateSoftkeys(l: string, c: string, r: string) {
    const skLeft = document.getElementById('sk-left');
    const skCenter = document.getElementById('sk-center');
    const skRight = document.getElementById('sk-right');
    if(skLeft) skLeft.innerText = l;
    if(skCenter) skCenter.innerText = c;
    if(skRight) skRight.innerText = r;
}

// --- RENDERERS ---
function renderHome(restore: boolean) {
    currentView = 'HOME';
    listContainer.innerHTML = '';
    
    const div1 = document.createElement('div');
    div1.className = 'item search-wrapper';
    div1.innerHTML = `<input type="text" id="searchInput" placeholder="Search or Enter URL" value="${savedQuery}">`;
    listContainer.appendChild(div1);

    const div2 = document.createElement('div');
    div2.className = 'item';
    div2.style.textAlign = 'center';
    div2.innerHTML = '<b>GO / SEARCH</b>';
    div2.onclick = function() { 
        const inp = document.getElementById('searchInput') as HTMLInputElement;
        if(inp) processInput(inp.value); 
    };
    listContainer.appendChild(div2);

    const sugDiv = document.createElement('div');
    sugDiv.id = 'sug-container';
    listContainer.appendChild(sugDiv);

    const resDiv = document.createElement('div');
    resDiv.id = 'res-container';
    listContainer.appendChild(resDiv);

    setTimeout(() => {
        const inp = document.getElementById('searchInput') as HTMLInputElement;
        if(!inp) return;
        inp.addEventListener('input', (e: any) => handleInput(e.target.value));
        inp.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') { inp.blur(); processInput(inp.value); }
        });
    }, 100);

    if (restore && lastSearchResults.length > 0) {
        renderVideoList(lastSearchResults);
        currentIndex = savedIndex; 
        updateSoftkeys("Back", "SELECT", "Help");
    } else {
        currentIndex = 0;
        updateSoftkeys("Exit", "SELECT", "Help");
    }
    refreshNav();
}

function renderHelp() {
    currentView = 'HELP';
    listContainer.innerHTML = `
        <div class="item detail-header"><b>Help & Controls</b></div>
        <div class="help-text" style="padding: 10px; font-size: 12px;">
            <b>Search:</b> Type query and press GO.<br><br>
            <b>Player Controls:</b><br>
            - Center: Play/Pause<br>
            - Left/Right: Seek 10s<br>
            - Up/Down: Volume Control<br>
            - Soft Left: Rotate Screen<br>
            - Soft Right: Mute<br>
            - Key '1': Jump to Time<br>
        </div>
        <div class="item" style="text-align:center" onclick="handleBack()"><b>Close</b></div>
    `;
    updateSoftkeys("Back", "SELECT", "");
    currentIndex = 2; 
    refreshNav();
}

function handleInput(val: string) {
    savedQuery = val;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        if(val.length < 2) {
            const sug = document.getElementById('sug-container');
            if(sug) sug.innerHTML = '';
            refreshNav(); return;
        }
        if(val.startsWith("http")) return;

        const xhr = new (window as any).XMLHttpRequest({ mozSystem: true });
        xhr.open('GET', proxify("https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=" + encodeURIComponent(val)), true);
        xhr.onload = function() {
            try {
                const data = JSON.parse(xhr.responseText);
                const list = data[1];
                const cont = document.getElementById('sug-container');
                if(!cont) return;
                cont.innerHTML = "";
                list.slice(0, 3).forEach(function(txt: string) {
                    const d = document.createElement('div');
                    d.className = 'item suggestion-item';
                    d.innerText = txt;
                    d.onclick = function() {
                        const inp = document.getElementById('searchInput') as HTMLInputElement;
                        if(inp) inp.value = txt;
                        cont.innerHTML = ""; processInput(txt);
                    };
                    cont.appendChild(d);
                });
                refreshNav();
            } catch(e) {}
        };
        xhr.send();
    }, 500);
}

function processInput(val: string) {
    if(!val) return;
    savedQuery = val;
    const s = document.getElementById('sug-container');
    if(s) s.innerHTML = ''; 

    if(val.includes('youtu.be') || val.includes('youtube.com')) {
        catchYoutubeURL(val, handleYoutubeData, (msg) => {
            showToast(msg);
            renderHome(true);
        });
        return;
    }

    if(/^https?:\/\/[^\s]+$/.test(val)) {
        const cont = document.getElementById('res-container');
        if(cont) cont.innerHTML = '<div class="item">Checking Link Info...</div>';
        processDirectLink(val, (info) => {
            renderDirectItem(info);
        }, () => {
            renderDirectItem({ url: val, category: 'UNKNOWN', size: 0, mime: 'Unknown' });
        });
        return;
    }
    
    const cont = document.getElementById('res-container');
    if(cont) cont.innerHTML = '<div class="item">Searching...</div>';
    refreshNav();

    performSearch(val, (videos) => {
        lastSearchResults = videos;
        renderVideoList(videos);
    }, () => {
        const cont = document.getElementById('res-container');
        if(cont) cont.innerHTML = '<div class="item">Network Error</div>';
        refreshNav();
    });
}

function renderVideoList(videos: VideoItem[]) {
    const cont = document.getElementById('res-container');
    if(!cont) return;
    cont.innerHTML = "";
    if (videos.length === 0) {
        cont.innerHTML = '<div class="item">No results.</div>';
    } else {
        updateSoftkeys("Back", "SELECT", "Help");
        videos.forEach((vid) => {
            const d = document.createElement('div');
            d.className = 'item video-card';
            d.innerHTML = `
                 <div class="thumb-box">
                    <img src="${vid.thumb}" class="video-thumb">
                    ${vid.time ? `<div class="vid-time">${vid.time}</div>` : ''}
                 </div>
                 <div class="video-info">
                     <div class="video-title">${vid.title}</div>
                     <div class="video-meta">${vid.channel}</div>
                 </div>
            `;
            d.onclick = function() { 
                catchYoutubeURL("https://www.youtube.com/watch?v=" + vid.id, handleYoutubeData, (msg) => {
                    showToast(msg);
                    renderHome(true);
                }); 
            };
            cont.appendChild(d);
        });
    }
    refreshNav();
}

function handleYoutubeData(data: any) {
    currentView = 'DOWNLOAD';
    const parsed = parseDownloads(data);
    renderDownloads(parsed);
}

function renderDirectItem(info: DirectLinkInfo) {
    currentView = 'DOWNLOAD';
    listContainer.innerHTML = '';
    
    let filename = info.url.split('/').pop()?.split('?')[0] || "downloaded_file";
    const sizeStr = info.size > 0 ? formatBytes(info.size) : "Unknown Size";
    
    let visualHtml = "";
    if (info.category === 'IMAGE') {
        visualHtml = `<img src="${info.url}" class="big-thumb">`;
    } else if (info.category === 'VIDEO') {
        visualHtml = `<div class="icon-thumb">${SVG_VIDEO}</div>`;
    } else if (info.category === 'AUDIO') {
        visualHtml = `<div class="icon-thumb">${SVG_AUDIO}</div>`;
    } else {
        visualHtml = `<div class="icon-thumb">${SVG_FILE}</div>`;
    }

    const header = document.createElement('div');
    header.className = 'item detail-header';
    header.innerHTML = `
        ${visualHtml}<br>
        <div style="word-wrap:break-word; font-size:12px;"><b>${filename}</b></div>
        <small style="color:#bbb">${info.category} &bull; ${sizeStr}</small><br>
        <small style="color:#666">${info.mime}</small>
    `;
    listContainer.appendChild(header);

    if(info.category === 'VIDEO' || info.category === 'AUDIO' || info.category === 'UNKNOWN') {
        const btnStream = document.createElement('div');
        btnStream.className = 'item dl-row';
        btnStream.innerHTML = `<b style="color:#00B0FF">STREAM</b> <span>Play Now</span>`;
        btnStream.onclick = function() { startPlayer(info.url); };
        listContainer.appendChild(btnStream);
    }

    const btnDl = document.createElement('div');
    btnDl.className = 'item dl-row';
    btnDl.innerHTML = `<b style="color:#4CAF50">DOWNLOAD</b> <span>Save to Device</span>`;
    btnDl.onclick = function() { triggerSystemDownload(info.url, filename); };
    listContainer.appendChild(btnDl);

    updateSoftkeys("Back", "SELECT", "");
    currentIndex = 1; 
    refreshNav();
}

function renderDownloads(parsed: any) {
    listContainer.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'item detail-header';
    header.innerHTML = `
        <img src="${parsed.thumb}" class="big-thumb"><br>
        <b>${parsed.title}</b><br>
        <small>${parsed.author} &bull; ${formatDuration(parsed.time)}</small>
    `;
    listContainer.appendChild(header);

    parsed.options.forEach((opt: any) => {
        const btn = document.createElement('div');
        btn.className = 'item dl-row';
        const col = opt.type === 'VIDEO' ? '#4CAF50' : '#2196F3';
        const sizeStr = formatBytes(opt.size);
        btn.innerHTML = `<b style="color:${col}">${opt.type}</b> <span>${opt.q}</span> <span>${sizeStr}</span>`;
        btn.onclick = function() {
            const choice = confirm("Press OK to Download.\nPress Cancel to Stream.");
            if(choice) triggerSystemDownload(opt.url, parsed.title + "." + opt.ext);
            else startPlayer(opt.url);
        };
        listContainer.appendChild(btn);
    });

    updateSoftkeys("Back", "SELECT", "");
    currentIndex = 0;
    refreshNav();
}

// --- PLAYER LOGIC ---
function startPlayer(url: string) {
    currentView = 'PLAYER';
    const overlay = document.getElementById('player-overlay');
    const v = document.getElementById('main-video') as HTMLVideoElement;
    const spinner = document.getElementById('buffering-spinner');
    
    const list = document.getElementById('list');
    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    if(list) list.style.display = 'none';
    if(appHeader) appHeader.style.display = 'none';
    if(appFooter) appFooter.style.display = 'none';
    
    v.onloadedmetadata = function() {
        const aspect = v.videoWidth / v.videoHeight;
        const scr = screen as any;
        if (scr.mozLockOrientation) {
            if(aspect < 1) scr.mozLockOrientation('portrait-primary');
            else scr.mozLockOrientation('landscape-primary');
        }
    };

    if(spinner) {
        v.onwaiting = function() { spinner.style.display = 'block'; };
        v.onseeking = function() { spinner.style.display = 'block'; };
        v.onplaying = function() { spinner.style.display = 'none'; };
        v.onpause = function() { 
            if(!v.seeking) spinner.style.display = 'none'; 
        };
    }

    if(overlay) overlay.style.display = 'flex';
    v.src = url;
    if(spinner) spinner.style.display = 'block';
    
    v.play().catch(e => console.error("Playback failed", e));
    flashIcon("play");
    updatePlayerUI();
    v.ontimeupdate = updatePlayerUI;
    
    updateSoftkeys("Rotate", "PAUSE", "Mute"); 
}

function closePlayer() {
    const overlay = document.getElementById('player-overlay');
    const v = document.getElementById('main-video') as HTMLVideoElement;
    const spinner = document.getElementById('buffering-spinner');

    v.pause(); v.src = "";
    if(spinner) spinner.style.display = 'none';
    if(overlay) overlay.style.display = 'none';
    
    const scr = screen as any;
    if (scr.mozUnlockOrientation) scr.mozUnlockOrientation();
    
    const list = document.getElementById('list');
    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    if(list) list.style.display = 'block';
    if(appHeader) appHeader.style.display = 'block';
    if(appFooter) appFooter.style.display = 'flex';
    
    currentView = 'DOWNLOAD';
    refreshNav();
}

function handlePlayerKeys(key: string) {
    const v = document.getElementById('main-video') as HTMLVideoElement;
    if(!v) return;
    switch(key) {
        case 'Enter': case 'Accept':
            if(v.paused) { v.play(); flashIcon("play"); } 
            else { v.pause(); flashIcon("pause"); }
            break;
        case 'ArrowLeft': case 'Left': v.currentTime -= 10; break;
        case 'ArrowRight': case 'Right': v.currentTime += 10; break;
        case 'ArrowUp': case 'Up': adjustVolume(1, showToast); break;
        case 'ArrowDown': case 'Down': adjustVolume(-1, showToast); break;
        case '1':
            const t = prompt("Jump to (MM:SS or Sec):");
            if(t) {
                let time = 0;
                if(t.includes(':')) {
                    const parts = t.split(':');
                    time = (parseInt(parts[0]) * 60) + parseInt(parts[1]);
                } else { time = parseInt(t); }
                if(!isNaN(time)) v.currentTime = time;
            }
            break;
        case 'SoftLeft':
            const scr = screen as any;
            if(scr.mozLockOrientation) {
                if(window.innerWidth > window.innerHeight) scr.mozLockOrientation('portrait-primary');
                else scr.mozLockOrientation('landscape-primary');
            }
            showToast("Rotating...");
            break;
        case 'SoftRight':
            v.muted = !v.muted;
            const muteInd = document.getElementById('mute-indicator');
            if(muteInd) muteInd.style.display = v.muted ? 'block' : 'none';
            break;
        case 'Backspace': case 'EndCall':
            closePlayer();
            break;
    }
    updatePlayerUI();
}

function flashIcon(type: string) {
    const icn = document.getElementById('center-icon');
    if(!icn) return;
    if(type === 'play') icn.innerHTML = ICON_PLAY;
    else if(type === 'pause') icn.innerHTML = ICON_PAUSE;
    
    icn.style.display = 'block';
    setTimeout(() => icn.style.display = 'none', 600);
}

function updatePlayerUI() {
    const v = document.getElementById('main-video') as HTMLVideoElement;
    const currSpan = document.getElementById('p-curr');
    const durSpan = document.getElementById('p-dur');
    const fill = document.getElementById('progress-fill');
    if(!v || !currSpan || !durSpan || !fill) return;
    
    const cur = v.currentTime;
    const dur = v.duration || 1;
    
    currSpan.innerText = formatDuration(Math.floor(cur));
    durSpan.innerText = formatDuration(Math.floor(dur));
    
    const pct = (cur / dur) * 100;
    fill.style.width = pct + "%";
}

function triggerSystemDownload(url: string, filename: string) {
    const safeName = filename.replace(/[^a-z0-9\.]/gi, '_');
    try {
        showToast("Requesting Download...");
        const iframe = document.createElement('iframe') as any;
        iframe.setAttribute('mozbrowser', 'true');
        iframe.setAttribute('remote', 'true');
        iframe.src = 'about:blank';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        setTimeout(function() {
            if(typeof iframe.download === 'function') {
                const req = iframe.download(url, { filename: safeName });
                req.onsuccess = () => { showToast("Started!"); setTimeout(()=>iframe.remove(), 2000); };
                req.onerror = () => { showToast("Error. Opening Browser"); window.open(url,'_blank'); iframe.remove(); };
            } else {
                showToast("Downloading not supported. Opening Browser"); 
                window.open(url,'_blank'); 
                iframe.remove();
            }
        }, 500);
    } catch(e: any) { alert(e.message); }
}

function formatBytes(bytes: number) {
    if(!+bytes) return 'N/A';
    const i = Math.floor(Math.log(bytes)/Math.log(1024));
    return parseFloat((bytes/Math.pow(1024,i)).toFixed(1)) + ['B','KB','MB'][i];
}

function formatDuration(seconds: number) {
    if(!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
}

function showToast(msg: string) {
    const t = document.createElement('div');
    t.className = 'toasttext';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
