export function adjustVolume(direction: number, showToast: (msg: string) => void) {
    const nav = navigator as any;
    if (nav.volumeManager) {
        if (direction > 0) nav.volumeManager.requestUp();
        else nav.volumeManager.requestDown();
        nav.volumeManager.requestShow();
    } else {
        const v = document.getElementById('main-video') as HTMLVideoElement;
        if (!v) return;
        const current = v.volume;
        if (direction > 0) v.volume = Math.min(1, current + 0.1);
        else v.volume = Math.max(0, current - 0.1);
        showToast("Vol: " + Math.round(v.volume * 100) + "%");
    }
}

export function forceVolumeChannel() {
    const nav = navigator as any;
    if (nav.mozAudioChannelManager) {
        nav.mozAudioChannelManager.volumeControlChannel = 'content';
    }
}
