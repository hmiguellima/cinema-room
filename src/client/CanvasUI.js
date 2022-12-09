import { Mesh, 
    CanvasTexture, 
    MeshBasicMaterial, 
    PlaneGeometry, 
    Raycaster,
    Vector3, 
} from 'three';

/*An element is defined by 
type: text | button | image | shape
hover: hex
active: hex
position: x, y, left, right, top, bottom
width: pixels, will inherit from body if missing
height: pixels, will inherit from body if missing
overflow: fit | scroll | hidden
textAlign: center | left | right
fontSize: pixels
fontColor: hex
fontFamily: string
padding: pixels
backgroundColor: hex
borderRadius: pixels
clipPath: svg path
border: width color style
*/
class CanvasUI{
constructor(content, config){
    this.raycaster = new Raycaster();
    this.tmpVector1 = new Vector3();
	this.tmpVector2 = new Vector3();
	this.tmpVector3 = new Vector3();

    const defaultconfig = {
        panelSize: { width: 0.250, height: 0.125},
        width: 256,
        height: 128,
        opacity: 0.7,
        body:{
            fontFamily:'Arial', 
            fontSize:30, 
            padding:20, 
            backgroundColor: '#000', 
            fontColor:'#fff', 
            borderRadius: 6
        }
    }
    this.config = (config===undefined) ? defaultconfig : config;
    
    if (this.config.width === undefined) this.config.width = 512;
    if (this.config.height === undefined) this.config.height = 512;
    if (this.config.body === undefined) this.config.body = {fontFamily:'Arial', size:30, padding:20, backgroundColor: '#000', fontColor:'#fff', borderRadius: 6};
    
    const body = this.config.body;
    if (body.borderRadius === undefined) body.borderRadius = 6;
    if (body.fontFamily === undefined) body.fontFamily = "Arial";
    if (body.padding === undefined) body.padding = 20;
    if (body.fontSize === undefined) body.fontSize = 30;
    if (body.backgroundColor === undefined) body.backgroundColor = '#000';
    if (body.fontColor === undefined) body.fontColor = '#fff';
    
    Object.entries( this.config ).forEach( ( [ name, value]) => {
        if ( typeof(value) === 'object' && name !== 'panelSize' ) {
            const pos = (value.position!==undefined) ? value.position : { x: 0, y: 0 };
            
            if (pos.left !== undefined && pos.x === undefined ) pos.x = pos.left;
            if (pos.top !== undefined && pos.y === undefined ) pos.y = pos.top;

            const width = (value.width!==undefined) ? value.width : this.config.width;
            const height = (value.height!==undefined) ? value.height : this.config.height;

            if (pos.right !== undefined && pos.x === undefined ) pos.x = this.config.width - pos.right - width;
            if (pos.bottom !== undefined && pos.y === undefined ) pos.y = this.config.height - pos.bottom - height;
            
            if (pos.x === undefined) pos.x = 0;
            if (pos.y === undefined) pos.y = 0;
            
            value.position = pos;
            
            if (value.type === undefined) value.type = 'text';
        }
    })
    
    
    const canvas = this.createOffscreenCanvas(this.config.width, this.config.height);
    this.context = canvas.getContext('2d');
    this.context.save();
    
    const opacity = ( this.config.opacity !== undefined ) ? this.config.opacity : 0.7;
    
    const planeMaterial = new MeshBasicMaterial({ transparent: true, opacity });
    this.panelSize = ( this.config.panelSize !== undefined) ? this.config.panelSize : { width:1, height:1 }
    const planeGeometry = new PlaneGeometry(this.panelSize.width, this.panelSize.height);
    
    this.mesh = new Mesh(planeGeometry, planeMaterial);
    
    this.texture = new CanvasTexture(canvas);
    this.mesh.material.map = this.texture;
        
    const inputs = Object.values( this.config ).filter( ( value )=>{
        return  value.type === "input-text";
    });
    
    if (content === undefined){
        this.content = { body: "" };
        this.config.body.type = "text";
    }else{
        this.content = content;
    }
    
    this.selectedElement = undefined;
    
    this.needsUpdate = true;
    
    this.update();
}

setClip( elm ){
    const context = this.context;
    
    context.restore();
    context.save();
    
    if (elm.clipPath !== undefined){
        const path = new Path2D( elm.clipPath );
        context.clip( path );
    }else{
        const pos = (elm.position!==undefined) ? elm.position : { x:0, y: 0 };
        const borderRadius = elm.borderRadius || 0;
        const width = elm.width || this.config.width;
        const height = elm.height || this.config.height;
       
        context.beginPath();
        
        if (borderRadius !== 0){
            const angle = Math.PI/2;
            //start top left
            context.moveTo(pos.x + borderRadius, pos.y );
            context.arc( pos.x + borderRadius, pos.y + borderRadius, borderRadius, angle, angle*2, true);
            context.lineTo( pos.x, pos.y + height - borderRadius );
            context.arc( pos.x + borderRadius, pos.y + height - borderRadius, borderRadius, 0, angle, true);
            context.lineTo( pos.x + width - borderRadius, pos.y + height);
            context.arc( pos.x + width - borderRadius, pos.y + height - borderRadius, borderRadius, angle*3, angle*4, true);
            context.lineTo( pos.x + width, pos.y + borderRadius );
            context.arc( pos.x + width - borderRadius, pos.y + borderRadius, borderRadius, angle*2, angle*3, true);
            context.closePath();
            context.clip();
        }else{
            context.rect( pos.x, pos.y, width, height );
            context.clip();
        }
        
        
    }
    
}

setPosition(x, y, z){
    if (this.mesh === undefined) return;
    this.mesh.position.set(x, y, z);
}

setRotation(x, y, z){
    if (this.mesh === undefined) return;
    this.mesh.rotation.set(x, y, z);
}

setFingerJoints(joints) {
    this.fingerJoints = joints;
}

updateElement( name, content ){
    let elm = this.content[name];
    
    if (elm===undefined){
        console.warn( `CanvasGUI.updateElement: No ${name} found`);
        return;
    }
    
    if (typeof elm === 'object'){
        elm.content = content;
    }else{
        elm = content;
    }
    
    this.content[name] = elm;
    
    this.needsUpdate = true;
}

get panel(){
    return this.mesh;
}

getElementAtLocation( x, y ){
    const self = this;
    const elms = Object.entries( this.config ).filter( ([ name, elm ]) => {
        if (typeof elm === 'object' && name !== 'panelSize' && name !== 'body'){
            const pos = elm.position;
            const width = (elm.width !== undefined) ? elm.width : self.config.width;
            const height = (elm.height !== undefined) ? elm.height : self.config.height;
            return (x>=pos.x && x<(pos.x+width) && y>=pos.y && y<(pos.y + height));
        }
    });
    const elm = (elms.length==0) ? null : this.config[elms[0][0]];
    //console.log(`selected = ${elm}`);
    return elm;
}

updateConfig( name, property, value ){  
    let elm = this.config[name];
    
    if (elm===undefined){
        console.warn( `CanvasUI.updateconfig: No ${name} found`);
        return;
    }
    
    elm[property] = value;
    
    this.needsUpdate = true;
}

hover( uv ){
    if (uv === undefined){
        if (this.selectedElement !== undefined){
            this.selectedElement = undefined;
            this.needsUpdate = true;
        }
    }else{
        const x = uv.x * (this.config.width || 512);
        const y = (1 - uv.y) * (this.config.height || 512);
        //console.log( `hover uv:${uv.x.toFixed(2)},${uv.y.toFixed(2)}>>texturePos:${x.toFixed(0)}, ${y.toFixed(0)}`);
        const elm = this.getElementAtLocation( x, y );
        if (elm===null){
            if ( this.selectedElement !== undefined ){
                this.selectedElement = undefined;
                this.needsUpdate = true;
            }
        }else if( this.selectedElement !== elm ){
            this.selectedElement = elm;
            this.needsUpdate = true;
        }
    }
}

select(){
    if (this.selectedElement !== undefined){
        const elm = this.selectedElement;
        if (elm.onSelect) elm.onSelect();
        this.selectedElement = undefined;
    }
}

handleHand() {
    const rightIndexTip = this.fingerJoints['index-finger-tip'];
    const rightIndexPhalanxDistal = this.fingerJoints['index-finger-phalanx-distal'];

    const fingerPhalanx = rightIndexPhalanxDistal.getWorldPosition(this.tmpVector1);
    const fingerTip = rightIndexTip.getWorldPosition(this.tmpVector2);
    const fingerDir = this.tmpVector3.subVectors(fingerTip, fingerPhalanx);

    this.raycaster.ray.origin.copy(fingerPhalanx);
    this.raycaster.ray.direction.copy(fingerDir);

    const intersected = this.raycaster.intersectObject(this.mesh)[0];

    if (intersected && intersected.distance < 0.05) {
        this.hover(intersected.uv);
        if (this.selectedElement && intersected.distance < 0.01) {
            this.selectedElement.onSelect?.();
        }
    } else {
        this.hover();
    }
}

update(){    
    if (this.mesh===undefined) return;
        
    if (this.fingerJoints) this.handleHand();

    if ( !this.needsUpdate ) return;
    
    let context = this.context;
    
    context.clearRect(0, 0, this.config.width, this.config.height);
    
    const bgColor = ( this.config.body.backgroundColor ) ? this.config.body.backgroundColor : "#000";
    const fontFamily = ( this.config.body.fontFamily ) ? this.config.body.fontFamily : "Arial";
    const fontColor = ( this.config.body.fontColor ) ? this.config.body.fontColor : "#fff";
    const fontSize = ( this.config.body.fontSize ) ? this.config.body.fontSize : 30;
    this.setClip(this.config.body);
    context.fillStyle = bgColor;
    context.fillRect( 0, 0, this.config.width, this.config.height);
    
    const self = this;
    
    Object.entries(this.content).forEach( ([name, content]) => {
        const config = (self.config[name]!==undefined) ? self.config[name] : self.config.body;
        const display = (config.display !== undefined) ? config.display : 'block';
        
        if (display !== 'none'){
            const pos = (config.position!==undefined) ? config.position : { x: 0, y: 0 };                
            const width = (config.width!==undefined) ? config.width : self.config.width;
            const height = (config.height!==undefined) ? config.height : self.config.height;

            if (config.type == "button" && !content.toLowerCase().startsWith("<path>")){
                if ( config.borderRadius === undefined) config.borderRadius = 6;
                if ( config.textAlign === undefined ) config.textAlign = "center";
            }
            
            self.setClip( config );
            
            const svgPath = content.toLowerCase().startsWith("<path>");
            const hover = self.selectedElement !== undefined && this.selectedElement === config;
            
            if ( config.backgroundColor !== undefined){
                if (hover && config.type== "button" && config.hover !== undefined){
                    context.fillStyle = config.hover;
                }else{
                    context.fillStyle = config.backgroundColor;
                }
                context.fillRect( pos.x, pos.y, width, height );
            }

            if (config.type == "text" || config.type == "button" || config.type == "input-text"){
                let stroke = false;
                if (hover){
                    if (!svgPath && config.type == "button"){
                        context.fillStyle = (config.fontColor !== undefined) ? config.fontColor : fontColor;
                    }else{
                        context.fillStyle = (config.hover !== undefined) ? config.hover : ( config.fontColor !== undefined) ? config.fontColor : fontColor;
                    }
                    stroke = (config.hover === undefined);
                }else{
                    context.fillStyle = (config.fontColor !== undefined) ? config.fontColor : fontColor;
                }
                
                if ( svgPath ){
                    const code = content.toUpperCase().substring(6, content.length - 7);
                    context.save();
                    context.translate( pos.x, pos.y );
                    const path = new Path2D(code);
                    context.fillStyle = config.fontColor;
                    context.fill(path);
                    context.restore();
                }else{
                    self.wrapText( name, content )
                }

                if (stroke){
                    context.beginPath();
                    context.strokeStyle = "#fff";
                    context.lineWidth = 2;
                    context.rect( pos.x, pos.y, width, height);
                    context.stroke();
                }
            }else if (config.type == "img"){
                if (config.img === undefined){
                    this.loadImage(content).then(img =>{
                        console.log(`w: ${img.width} | h: ${img.height}`);
                        config.img = img;
                        self.needsUpdate = true;
                        self.update();           
                    }).catch(err => console.error(err));
                }else{
                    const aspect = config.img.width/config.img.height;
                    const h = width/aspect;
                    context.drawImage( config.img, pos.x, pos.y, width, h );           
                }
            }
        }
    })
    
    this.needsUpdate = false;
    this.texture.needsUpdate = true;
}

loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", err => reject(err));
    img.src = src;
  });
}

createOffscreenCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
}

fillRoundedRect( x, y, w, h, radius ){
    const ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

wrapText(name, txt){
    //console.log( `wrapText: ${name}:${txt}`);
    const words = txt.split(' ');
    let line = '';
    const lines = [];
    const config = (this.config[name]!==undefined) ? this.config[name] : this.config.body;
    const width = (config.width!==undefined) ? config.width : this.config.width;
    const height = (config.height!==undefined) ? config.height : this.config.height;
    const pos = (config.position!==undefined) ? config.position : { x:0, y:0 };
    const padding = (config.padding!==undefined) ? config.padding : (this.config.body.padding!==undefined) ? this.config.body.padding : 10;
    const paddingTop = (config.paddingTop!==undefined) ? config.paddingTop : padding;
    const paddingLeft = (config.paddingLeft!==undefined) ? config.paddingLeft : padding;
    const paddingBottom = (config.paddingBottom!==undefined) ? config.paddingBottom : padding;
    const paddingRight = (config.paddingRight!==undefined) ? config.paddingRight : padding;
    const rect = { x:pos.x+paddingLeft, y:pos.y+paddingTop, width: width - paddingLeft - paddingRight, height: height - paddingTop - paddingBottom };
    const textAlign = (config.textAlign !== undefined) ? config.textAlign : (this.config.body.textAlign !== undefined) ? this.config.body.textAlign : "left";
    const fontSize = (config.fontSize !== undefined ) ? config.fontSize : ( this.config.body.fontSize !== undefined) ? this.config.body.fontSize : 30;
    const fontFamily = (config.fontFamily!==undefined) ? config.fontFamily : (this.config.body.fontFamily!==undefined) ? this.config.body.fontFamily : 'Arial';
    const leading = (config.leading !== undefined) ? config.leading : (this.config.body.leading !== undefined) ? this.config.body.leading : 8;
    const lineHeight = fontSize + leading;
    
    const context = this.context;
    
    context.textAlign = textAlign;
    
    context.font = `${fontSize}px '${fontFamily}'`;
    
    words.forEach( function(word){
        let testLine = (words.length>1) ? `${line}${word} ` : word;
        let metrics = context.measureText(testLine);
        if (metrics.width > rect.width && word.length>1) {
            if (line.length==0 && metrics.width > rect.width){
                //word too long
                while(metrics.width > rect.width){
                    let count = 0;
                    do{
                        count++
                        testLine = word.substr(0, count);
                        metrics = context.measureText(testLine);
                    }while(metrics.width < rect.width && count < (word.length-1));
                    count--;
                    testLine = word.substr(0, count);
                    lines.push( testLine );
                    word = word.substr(count);
                    if (count<=1) break;
                    metrics = context.measureText(word);
                }
                if (word != "") lines.push(word);
            }else{
                lines.push(line);
                line = `${word} `;
            }
        }else {
            line = testLine;
        }
    });
    
    if (line != '') lines.push(line);
    
    const textHeight = lines.length * lineHeight;
    let scrollY = 0;
    
    if (textHeight>rect.height && config.overflow === 'scroll'){
        //Show a scroll bar
        if ( config.scrollY === undefined ) config.scrollY = 0;
        const fontColor = ( config.fontColor !== undefined ) ? config.fontColor : this.config.body.fontColor;
        context.fillStyle = "#aaa";
        this.fillRoundedRect( pos.x + width - 12, pos.y, 12, height, 6 );
        context.fillStyle = "#666";
        const scale = rect.height / textHeight;
        const thumbHeight = scale * height;
        const thumbY = -config.scrollY * scale;
        this.fillRoundedRect( pos.x + width - 12, pos.y + thumbY, 12, thumbHeight, 6);
        context.fillStyle = fontColor;
        scrollY = config.scrollY;
        config.minScrollY = rect.height - textHeight;
    }
    
    let y = scrollY + rect.y + fontSize/2;
    let x;
    
    switch( textAlign ){
        case "center":
            x = rect.x + rect.width/2;
            break;
        case "right":
            x = rect.x + rect.width;
            break;
        default:
            x = rect.x;
            break;
    }
    
    lines.forEach( (line) => {
        if ((y + lineHeight) > 0) context.fillText(line, x, y);
        y += lineHeight;
    });
}
}

export { CanvasUI };
