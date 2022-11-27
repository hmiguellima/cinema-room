import { CinemaSessionAR } from "./cinema-session-ar";

let session: CinemaSessionAR;

function initLoop() {
    session = new CinemaSessionAR(initLoop);
}

initLoop();

const btn = document.createElement('button');
document.body.appendChild(btn);
btn.textContent = 'Reload';
btn.addEventListener('click', () => {
    window.location.reload();
});