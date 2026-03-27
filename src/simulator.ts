import './simulator.css';

export function initSimulator() {
    // Check if we are already on a KaiOS device
    const isKaiOS = navigator.userAgent.includes('KAIOS') || navigator.userAgent.includes('KaiOS') || ('mozApps' in navigator);
    if (isKaiOS) return; // Don't show the simulator on a real device

    const sim = document.createElement('div');
    sim.id = 'kaios-simulator';
    sim.innerHTML = `
        <div class="sim-row">
            <button class="sim-btn soft-btn" data-key="SoftLeft">SL</button>
            <button class="sim-btn dpad-btn" data-key="ArrowUp">▲</button>
            <button class="sim-btn soft-btn" data-key="SoftRight">SR</button>
        </div>
        <div class="sim-row">
            <button class="sim-btn dpad-btn" data-key="ArrowLeft">◀</button>
            <button class="sim-btn center-btn" data-key="Enter">OK</button>
            <button class="sim-btn dpad-btn" data-key="ArrowRight">▶</button>
        </div>
        <div class="sim-row">
            <button class="sim-btn action-btn" data-key="Backspace">BACK</button>
            <button class="sim-btn dpad-btn" data-key="ArrowDown">▼</button>
            <button class="sim-btn num-btn" data-key="1">1</button>
        </div>
    `;

    document.body.appendChild(sim);

    // Prevent focus stealing from input fields when clicking simulator buttons
    sim.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });

    sim.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('button');
        if (!btn) return;
        
        const key = btn.getAttribute('data-key');
        if (key) {
            // Dispatch the keydown event
            const event = new KeyboardEvent('keydown', {
                key: key,
                bubbles: true,
                cancelable: true
            });
            
            // Dispatch to active element (like an input) or fallback to window
            (document.activeElement || window).dispatchEvent(event);
        }
    });
}
