import { XRSession } from 'three';
import { Player } from 'shaka-player';
import { VRButton } from './VRButton';
import { ClientToServerEvents, PlayoutData, ServerToClientEvents, User } from '../common/net-scheme';
import { HomeCinemaSession } from './cinema-session';
import { io, Socket } from 'socket.io-client';
import { getBrightnessRegions, ShakaThumbnail } from './backlight';

async function loadVideo() {
    videoPlayer = new Player(videoEl);
    const asset: PlayoutData = assets[selectEl.selectedIndex];

    if (asset.drmUri) {
        videoPlayer.configure({
            drm: {
                servers: {
                    'com.widevine.alpha': asset.drmUri
                }
            }
        });
    }
    listenToPlayerEvents();
    await videoPlayer.load(asset.streamUri);
}

function getThumbnailImageTrack () {
    const imageTracks = videoPlayer?.getImageTracks();
    if (imageTracks && imageTracks.length) {
        const mimeTypesPreference = [
            'image/jpeg',
            'image/png',
            'image/svg+xml',
        ];
        for (const mimeType of mimeTypesPreference) {
            const estimatedBandwidth = videoPlayer?.getStats().estimatedBandwidth;
            if(estimatedBandwidth){
                const bestOptions = (imageTracks).filter((track) => {
                    return track.mimeType?.toLowerCase() === mimeType && track.bandwidth < estimatedBandwidth * 0.01;
                });
                if (bestOptions && bestOptions.length) {
                    return bestOptions[0];
                }
            }
        }
        return imageTracks[0];
    }
}

function startImmersiveSession(session: XRSession) {
    const asset: PlayoutData = assets[selectEl.selectedIndex];
    if (asset.fps === 24) {
        (session as any).updateTargetFrameRate(72);
    } else if (asset.fps === 30) {
        (session as any).updateTargetFrameRate(60);
    }

<<<<<<< HEAD
    immersiveSession = new HomeCinemaSession(session, videoEl, asset.layout);
    immersiveSession.run();
=======
    immersiveSession = new HomeCinemaSession(session, videoEl, asset.layout, { hCount: 10, vCount: 5 });
    immersiveSession.run();    
>>>>>>> 94f5ea0 (Add dummy lights objects)
    session.addEventListener('end', () => {
        immersiveSession = null;
    })

    // TODO: listen to state updates from immersive session and sync with server
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
    if (!sessionStartButton) {
        console.warn('expected valid WebXR button');
        return;
    }
    const button = sessionStartButton;
    socket.on('hello', user => {
        currentUser = user;
        button.innerText = 'ENTER ROOM';
        button.disabled = false;
    });

    socket.on('roomFull', () => {
        button.innerText = 'ROOM FULL';
    });
}

async function handleTimeUpdate(event: any) {
    const imageTrack = getThumbnailImageTrack();
    const thumbnail = await videoPlayer?.getThumbnails(imageTrack?.id || 0, event.path[0].currentTime);
    const newPos = {
        posX: thumbnail!.positionX,
        posY: thumbnail!.positionY,
    }
    if (lastPos.posX != newPos.posX || lastPos.posY != newPos.posY) {
        lastPos = newPos;
        const shakaThumbnail: ShakaThumbnail = {
            imageHeight: thumbnail!.height,
            imageWidth: thumbnail!.width,
            duration: thumbnail!.duration,
            positionX: thumbnail!.positionX,
            positionY: thumbnail!.positionY,
            startTime: thumbnail!.startTime,
            uris: thumbnail!.uris,
        }
        getBrightnessRegions(shakaThumbnail).then((e) => {
            console.log(e);
        });
        console.log('-- thumbnail -- 2');
        console.log(shakaThumbnail);
    }
}

let lastPos = {
    posX: -1,
    posY: -1,
};

async function listenToPlayerEvents() {
    console.log('videoPlayer ----------');
    console.log(videoPlayer);
    document.getElementsByTagName('video')[0]?.addEventListener('timeupdate', async (event: any) => { handleTimeUpdate(event) });
}

const selectEl: HTMLSelectElement = document.getElementById('assetSelect') as HTMLSelectElement;
if (!selectEl) {
    throw new Error('invalid assetSelect element');
}

const videoEl = document.createElement('video');

selectEl.onchange = () => {
    loadVideo();
};

document.querySelector('#shakaDomContainer')?.append(videoEl);
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
    },
    {
        name: 'Sintel Dash Widevine | 24fps',
        fps: 24,
        streamUri: 'https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd',
        layout: 'mono',
        drmUri: 'https://cwip-shaka-proxy.appspot.com/no_auth',
    },
    {
        name: 'BBB with Thumbs',
        fps: 30,
        streamUri: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_with_multiple_tiled_thumbnails.mpd',
        layout: 'mono',
        default: true
    }
];

let immersiveSession: HomeCinemaSession | null = null;
let videoPlayer: Player | null = null;
let currentUser: User | null = null;
let sessionStartButton: HTMLButtonElement | null;

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

buildOptions();

loadVideo();
VRButton.createButton(loadVideo, startImmersiveSession).then(element => {
    // we get a button only if WebXR is supported, otherwise we get an anchor
    if ('disabled' in element) { // button
        sessionStartButton = element;
        listenToServer();
    }

    document.body.appendChild(element);
});

window.addEventListener('beforeunload', () => {
    socket.close();
});
