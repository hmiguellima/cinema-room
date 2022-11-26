import { CinemaSessionAR } from "./cinema-session-ar";


function initLoop() {
    new CinemaSessionAR(initLoop);
}

initLoop();