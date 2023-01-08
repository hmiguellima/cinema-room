import { CinemaSessionAR } from "./ar-scene/cinema-session-ar";
import { CinemaSessionVR } from "./vr-scene/cinema-session-vr";

import { CinemaSession } from "./cinema-session";

let session: CinemaSession;

function initLoop() {
    if (session) {
        session.destroy();
    }

    session = new Session(initLoop);
    session.init();
}

let params = window.document.location.search
    .substring(1)
    .split('&')
    .map(kv => kv.split('='))
    .reduce((m, kv) => m.set(kv[0], kv[1]), new Map<string, string>());

const Session = params.get('mode') === 'ar' ? CinemaSessionAR : CinemaSessionVR;
const btn = document.createElement('button');
document.body.appendChild(btn);
btn.textContent = 'Reload';
btn.addEventListener('click', () => {
    window.location.reload();
});

initLoop();
