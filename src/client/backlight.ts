import { rgbToHsl } from './utils';

const shakaThumbnail = {
    imageHeight: 58,
    imageWidth: 102,
    height: 1152,
    positionX: 0,
    positionY: 0,
    startTime: 1,
    duration: 1,
    uris: ['https://dash.akamaized.net/akamai/bbb_30fps/thumbnails_256x144/tile_1.jpg'],
    width: 1024,
};
const config = {
    thumbnail: shakaThumbnail,
    gridWidth: 12,
    gridHeight: 12,
    pixelDepthFromEdge: 3,
};

export function getBrightnessRegions() {
    return new Promise((resolove) => {
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = config.thumbnail.uris[0];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext("2d");
    img.addEventListener("load", () => {
        img.style.display = "none";
        ctx!.drawImage(img, 0, 0);
        console.log('image loaded');

        const gridElementPixelHeight = Math.ceil(config.thumbnail.imageHeight / config.gridHeight);
        const gridElementPixelWidth = Math.ceil(config.thumbnail.imageWidth / config.gridWidth);

        //top
        const top: Array<number> = [];
        let cursor = config.thumbnail.positionX;
        while(cursor < config.thumbnail.positionX+config.thumbnail.imageWidth) {
            const pixel = ctx!.getImageData(cursor, config.thumbnail.positionY, 1, config.pixelDepthFromEdge);
            let rBucket: number = 0;
            let gBucket: number = 0;
            let bBucket: number = 0;
            for(let i = 0;i<config.pixelDepthFromEdge;i++) {
                const base = (4*i);
                rBucket+=pixel.data[base+0];
                gBucket+=pixel.data[base+1];
                bBucket+=pixel.data[base+2];
            }
            const r = rBucket / config.pixelDepthFromEdge;
            const g = gBucket / config.pixelDepthFromEdge;
            const b = bBucket / config.pixelDepthFromEdge;
            const [h, s, l] = rgbToHsl(r, g, b);
            top.push(l);
            cursor += gridElementPixelWidth;
        }
        //bottom
        const bottom: Array<number> = [];
        cursor = config.thumbnail.positionX;
        while(cursor < config.thumbnail.positionX+config.thumbnail.imageWidth) {
            const pixel = ctx!.getImageData(
                cursor, 
                (config.thumbnail.positionY+config.thumbnail.imageHeight), 
                1, 
                -config.pixelDepthFromEdge);
            let rBucket: number = 0;
            let gBucket: number = 0;
            let bBucket: number = 0;
            for(let i = 0;i<config.pixelDepthFromEdge;i++) {
                const base = (4*i);
                rBucket+=pixel.data[base+0];
                gBucket+=pixel.data[base+1];
                bBucket+=pixel.data[base+2];
            }
            const r = rBucket / config.pixelDepthFromEdge;
            const g = gBucket / config.pixelDepthFromEdge;
            const b = bBucket / config.pixelDepthFromEdge;
            const [h, s, l] = rgbToHsl(r, g, b);
            bottom.push(l);
            cursor += gridElementPixelWidth;
        }
        //right
        const right: Array<number> = [];
        cursor = config.thumbnail.positionY;
        while(cursor < config.thumbnail.positionY+config.thumbnail.imageHeight) {
            const pixel = ctx!.getImageData(
                config.thumbnail.positionX+config.thumbnail.imageWidth, 
                cursor, 
                -config.pixelDepthFromEdge, 
                1);
            let rBucket: number = 0;
            let gBucket: number = 0;
            let bBucket: number = 0;
            for(let i = 0;i<config.pixelDepthFromEdge;i++) {
                const base = (4*i);
                rBucket+=pixel.data[base+0];
                gBucket+=pixel.data[base+1];
                bBucket+=pixel.data[base+2];
            }
            const r = rBucket / config.pixelDepthFromEdge;
            const g = gBucket / config.pixelDepthFromEdge;
            const b = bBucket / config.pixelDepthFromEdge;
            const [h, s, l] = rgbToHsl(r, g, b);
            right.push(l);
            cursor += gridElementPixelHeight;
        }
        //left
        const left: Array<number> = [];
        cursor = config.thumbnail.positionY;
        while(cursor < config.thumbnail.positionY+config.thumbnail.imageHeight) {
            const pixel = ctx!.getImageData(
                config.thumbnail.positionX, 
                cursor,
                config.pixelDepthFromEdge, 
                1);
            let rBucket: number = 0;
            let gBucket: number = 0;
            let bBucket: number = 0;
            for(let i = 0;i<config.pixelDepthFromEdge;i++) {
                const base = (4*i);
                rBucket+=pixel.data[base+0];
                gBucket+=pixel.data[base+1];
                bBucket+=pixel.data[base+2];
            }
            const r = rBucket / config.pixelDepthFromEdge;
            const g = gBucket / config.pixelDepthFromEdge;
            const b = bBucket / config.pixelDepthFromEdge;
            const [h, s, l] = rgbToHsl(r, g, b);
            left.push(l);
            cursor += gridElementPixelHeight;
        }
        resolove([top, bottom, left, right]);
    });

})
}


