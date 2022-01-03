import { XRSession } from 'three';
import { Player } from 'shaka-player';
import { VRButton } from './VRButton';
import { ClientToServerEvents, PlayoutData, ServerToClientEvents } from '../common/net-scheme';
import { HomeCinemaSession } from './cinema-session';
import { io, Socket } from 'socket.io-client';

async function loadVideo() {
    const player = new Player(videoEl);
    const asset: PlayoutData = assets[selectEl.selectedIndex];

    if (asset.drmUri) {
        player.configure({
            drm: {
                servers: {
                    'com.widevine.alpha': asset.drmUri
                }
            }
        });
    }
    await player.load(asset.streamUri);
}

function startImmersiveSession(session: XRSession) {
    const asset: PlayoutData = assets[selectEl.selectedIndex];
    if (asset.fps === 24) { 
        (session as any).updateTargetFrameRate(72);
    } else if (asset.fps === 30) {
        (session as any).updateTargetFrameRate(60);
    }

    immersiveSession = new HomeCinemaSession(session, videoEl, asset.layout);
    immersiveSession.run();    
    session.addEventListener('end', () => {
        immersiveSession = null;
    })
}

function buildOptions() {
    assets.forEach(asset => {
        const optionEl = document.createElement('option');
        optionEl.innerText = asset.name;
        optionEl.selected = Boolean(asset.default);
        selectEl.appendChild(optionEl);
    });
}

function listenToServer() {
    socket.on('');
}

const selectEl: HTMLSelectElement = document.getElementById('assetSelect') as HTMLSelectElement;
if (!selectEl) {
    throw new Error('invalid assetSelect element');
}

const videoEl = document.createElement('video');
videoEl.crossOrigin = 'anonymous';
videoEl.preload = 'auto';
videoEl.autoplay = true;
videoEl.controls = true;

const assets: Array<PlayoutData> = [
    {
        name: 'Jumanji Trailer | 30fps | 1080p',
        fps: 30,
        streamUri: 'https://d1wkjvw8nof1jc.cloudfront.net/jumanji-trailer-1_h1080p/encoded-20-05-09-fri-jan-2018/encoded-20-05-09-fri-jan-2018.mp4',
        layout: 'mono'
    },
    {
        name: 'Big buck bunny | 3D above/bellow | 30fps | 1080p',
        fps: 30,
        streamUri: 'http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_stereo_abl.mp4',
        layout: 'stereo-top-bottom'
    },
    {
        name: 'Dolby Digital 5.1 demo (sound doesn\'t play) | 30fps',
        fps: 30,
        streamUri: 'http://media.developer.dolby.com/DDP/MP4_HPL40_30fps_channel_id_51.mp4',
        layout: 'mono'
    },
    {
        name: 'Dolby Atmos demo (sound doesn\'t play) | 30fps',
        fps: 30,
        streamUri: 'http://media.developer.dolby.com/Atmos/MP4/shattered-3Mb.mp4',
        layout: 'mono'
    },
    {
        name: 'Sintel Dash | 3D Side by Side | 24fps',
        fps: 24,
        streamUri: 'https://g004-vod-us-cmaf-stg-ak.cdn.peacocktv.com/pub/global/sat/3D/FrameCompatibleSBS/master_cmaf.mpd',
        layout: 'stereo-left-right',
        default: true
    },
    {
        name: 'Sintel Dash Widevine | 24fps',
        fps: 24,
        streamUri: 'https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd',
        layout: 'mono',
        drmUri: 'https://cwip-shaka-proxy.appspot.com/no_auth',
    }
];

let immersiveSession: HomeCinemaSession | null;

buildOptions();

const button = VRButton.createButton(loadVideo, startImmersiveSession);
if ('disabled' in button) {
    button.innerText = 'waiting for host...';
    button.disabled = true;
    listenToServer();
}

document.body.appendChild(button);

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

