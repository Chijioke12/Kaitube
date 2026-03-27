const isKaiOS = navigator.userAgent.includes('KAIOS') || navigator.userAgent.includes('KaiOS') || ('mozApps' in navigator);

export function proxify(url: string) {
    if (isKaiOS) return url;
    return `/api/proxy?url=${encodeURIComponent(url)}`;
}

export interface VideoItem {
    id: string;
    title: string;
    thumb: string;
    time: string;
    channel: string;
}

export interface DownloadOption {
    type: string;
    q: string;
    size: number;
    url: string;
    ext: string;
}

export interface DirectLinkInfo {
    url: string;
    category: string;
    size: number;
    mime: string;
}

export function performSearch(query: string, onResult: (videos: VideoItem[]) => void, onError: () => void) {
    const body = JSON.stringify({
        "context": { "client": { "hl": "en", "gl": "US", "clientName": "WEB", "clientVersion": "2.20230920.00.00" } },
        "query": query
    });

    const xhr = new (window as any).XMLHttpRequest({ mozSystem: true });
    xhr.open('POST', proxify("https://www.youtube.com/youtubei/v1/search?prettyPrint=false"), true);
    xhr.setRequestHeader("content-type", "application/json");
    
    xhr.onload = (e: any) => {
        try {
            const data = JSON.parse(e.currentTarget.response);
            const itemsFound: any[] = [];
            function scan(obj: any) {
                if (obj && obj.videoRenderer) itemsFound.push(obj.videoRenderer);
                if (typeof obj === 'object') {
                    for (const k in obj) scan(obj[k]);
                }
            }
            scan(data);
            
            const videos: VideoItem[] = itemsFound.map(vid => {
                const title = vid.title.runs ? vid.title.runs[0].text : vid.title.simpleText;
                const id = vid.videoId;
                const thumb = vid.thumbnail.thumbnails[0].url;
                const time = vid.lengthText ? vid.lengthText.simpleText : "";
                let channel = "YouTube";
                if(vid.shortBylineText && vid.shortBylineText.runs) channel = vid.shortBylineText.runs[0].text;
                
                return { id, title, thumb, time, channel };
            });
            onResult(videos);
        } catch (err) {
            onError();
        }
    };
    xhr.onerror = onError;
    xhr.send(body);
}

export function processDirectLink(url: string, onResult: (info: DirectLinkInfo) => void, onError: () => void) {
    const xhr = new (window as any).XMLHttpRequest({ mozSystem: true });
    xhr.open('HEAD', proxify(url), true);
    xhr.onload = function() {
        const type = xhr.getResponseHeader('Content-Type') || 'application/octet-stream';
        const size = parseInt(xhr.getResponseHeader('Content-Length') || '0', 10);
        
        let category = 'FILE';
        if(type.startsWith('video/')) category = 'VIDEO';
        if(type.startsWith('audio/')) category = 'AUDIO';
        if(type.startsWith('image/')) category = 'IMAGE';

        if(category === 'FILE') {
            if(url.match(/\.(mp4|mkv|mov|avi|webm)$/i)) category = 'VIDEO';
            else if(url.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) category = 'AUDIO';
            else if(url.match(/\.(jpg|png|gif|jpeg|webp)$/i)) category = 'IMAGE';
        }

        onResult({ url, category, size, mime: type });
    };
    xhr.onerror = function() {
        onResult({ url, category: 'UNKNOWN', size: 0, mime: 'Unknown' });
    };
    xhr.send();
}

export function catchYoutubeURL(url: string, onResult: (data: any) => void, onError: (msg: string) => void) {
    const xhr = new (window as any).XMLHttpRequest({ mozSystem: true });
    xhr.open('GET', proxify(url), true);
    xhr.responseType = 'text';
    xhr.onload = (e: any) => {
        try {
            const resp = e.currentTarget.response;
            const match = /"VISITOR_DATA":\s*"([^"]+)"/.exec(resp);
            const vgtor = match ? match[1] : ""; 
            catchYoutubeURI(vgtor, url, onResult, onError);
        } catch(err) { 
            catchYoutubeURI("", url, onResult, onError); 
        }
    };
    xhr.onerror = () => onError("Connection Failed");
    xhr.send();
}

function catchYoutubeURI(vgtor: string, uri: string, onResult: (data: any) => void, onError: (msg: string) => void) {
    let vdoId = "";
    try {
        const urlObj = new URL(uri);
        if (urlObj.hostname.includes('youtu.be')) vdoId = urlObj.pathname.substring(1);
        else if (urlObj.pathname.includes('/shorts/')) vdoId = urlObj.pathname.split('/shorts/')[1].split('/')[0];
        else if (urlObj.searchParams && urlObj.searchParams.has('v')) vdoId = urlObj.searchParams.get('v') || "";
    } catch(e) {}

    if(!vdoId) { 
        onError("Invalid Link"); 
        return; 
    }

    const body = JSON.stringify({
        "playbackContext": { "contentPlaybackContext": { "html5Preference": "HTML5_PREF_WANTS" } },
        "context": {
            "client": {
                "hl": "en", "clientName": "ANDROID_VR", "clientVersion": "1.60.19",
                "deviceMake": "Oculus", "deviceModel": "Quest 3", "osName": "Android", "osVersion": "12L",
                "visitorData": vgtor
            }
        },
        "videoId": vdoId
    });

    const xhr = new (window as any).XMLHttpRequest({ mozSystem: true });
    xhr.open('POST', proxify("https://www.youtube.com/youtubei/v1/player?prettyPrint=false"), true);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.responseType = 'json';
    xhr.onload = (e: any) => {
        const data = e.currentTarget.response;
        if(!data || !data.streamingData) {
             onError("Restricted"); 
             return;
        }
        onResult(data);
    };
    xhr.onerror = () => onError("Network Error");
    xhr.send(body);
}

export function parseDownloads(data: any): { title: string, thumb: string, time: number, author: string, options: DownloadOption[] } {
    const details = data.videoDetails;
    const title = details.title;
    const thumb = details.thumbnail.thumbnails.pop().url;
    const time = parseInt(details.lengthSeconds, 10);
    const author = details.author;

    const options: DownloadOption[] = [];
    if(data.streamingData.formats) {
        data.streamingData.formats.forEach((f: any) => {
            options.push({ type:'VIDEO', q:f.qualityLabel, size: parseInt(f.contentLength || '0', 10), url:f.url, ext:'mp4' });
        });
    }
    if(data.streamingData.adaptiveFormats) {
        data.streamingData.adaptiveFormats.forEach((f: any) => {
            if(f.mimeType && f.mimeType.startsWith('audio/mp4')) {
                const br = f.bitrate ? Math.round(f.bitrate/1000)+'k' : 'HQ';
                options.push({ type:'AUDIO', q:br, size: parseInt(f.contentLength || '0', 10), url:f.url, ext:'m4a' });
            }
        });
    }

    return { title, thumb, time, author, options };
}
