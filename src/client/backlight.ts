import { rgbToHsl } from './utils';

export interface ShakaThumbnail {
    imageHeight: number,
    imageWidth: number,
    height?: number,
    positionX: number,
    positionY: number,
    startTime: number,
    duration: number,
    uris: Array<string>,
    width?: number,
};

const config = {
    gridWidth: 2,
    gridHeight: 2,
    pixelDepthFromEdge: 3,
};

export function getBrightnessRegions(thumbnail: ShakaThumbnail) {
    return new Promise((resolve) => {

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = thumbnail.uris[0];
    const canvas = document.createElement('canvas');
    canvas.height = thumbnail.positionY + thumbnail.imageHeight;
    canvas.width = thumbnail.positionX + thumbnail.imageWidth;
    const ctx = canvas.getContext("2d");
    img.addEventListener("load", () => {
        img.style.display = "none";
        ctx!.drawImage(img, 0, 0);
        console.log('image loaded');

        const gridElementPixelHeight = Math.ceil(thumbnail.imageHeight / config.gridHeight);
        const gridElementPixelWidth = Math.ceil(thumbnail.imageWidth / config.gridWidth);

        //top
        const top: Array<number> = [];
        let cursor = thumbnail.positionX;
        while(cursor < thumbnail.positionX+thumbnail.imageWidth) {
            const pixel = ctx!.getImageData(cursor, thumbnail.positionY, 1, config.pixelDepthFromEdge);
            console.log(cursor, thumbnail.positionY, 1, config.pixelDepthFromEdge, pixel);
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
        cursor = thumbnail.positionX;
        while(cursor < thumbnail.positionX+thumbnail.imageWidth) {
            const pixel = ctx!.getImageData(
                cursor,
                (thumbnail.positionY+thumbnail.imageHeight),
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
        cursor = thumbnail.positionY;
        while(cursor < thumbnail.positionY+thumbnail.imageHeight) {
            const pixel = ctx!.getImageData(
                thumbnail.positionX+thumbnail.imageWidth,
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
        cursor = thumbnail.positionY;
        while(cursor < thumbnail.positionY+thumbnail.imageHeight) {
            const pixel = ctx!.getImageData(
                thumbnail.positionX,
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
        resolve({top, bottom, left, right});
    });

})
}


