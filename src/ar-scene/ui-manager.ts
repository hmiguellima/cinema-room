import { Color, Scene } from "three";
import * as ThreeMeshUI from "three-mesh-ui";

export class UIManager {
    constructor(scene: Scene) {
        this.createSamplePanel(scene);
    }

    public render() {
        ThreeMeshUI.update();
    }

    private createSamplePanel(scene: Scene) {
        // Container block, in which we put the two buttons.
        // We don't define width and height, it will be set automatically from the children's dimensions
        // Note that we set contentDirection: "row-reverse", in order to orient the buttons horizontally
    
        // @ts-ignore

        const container = new ThreeMeshUI.Block( {
            justifyContent: 'center',
            contentDirection: 'row-reverse',
            fontFamily: './assets/Roboto-msdf.json',
            fontTexture: './assets/Roboto-msdf.png',
            fontSize: 0.07,
            padding: 0.02,
            borderRadius: 0.11
        } );
    
        container.position.set( 0, 0.6, -1.2 );
        container.rotation.x = -0.55;
        
        scene.add( container );
    
        // BUTTONS
    
        // We start by creating objects containing options that we will use with the two buttons,
        // in order to write less code.
    
        const buttonOptions = {
            width: 0.4,
            height: 0.15,
            justifyContent: 'center',
            offset: 0.05,
            margin: 0.02,
            borderRadius: 0.075
        };
    
        // Options for component.setupState().
        // It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).
    
        const hoveredStateAttributes = {
            state: 'hovered',
            attributes: {
                offset: 0.035,
                backgroundColor: new Color( 0x999999 ),
                backgroundOpacity: 1,
                fontColor: new Color( 0xffffff )
            },
        };
    
        const idleStateAttributes = {
            state: 'idle',
            attributes: {
                offset: 0.035,
                backgroundColor: new Color( 0x666666 ),
                backgroundOpacity: 0.3,
                fontColor: new Color( 0xffffff )
            },
        };
    
        // Buttons creation, with the options objects passed in parameters.
    
        const buttonNext = new ThreeMeshUI.Block( buttonOptions );
        const buttonPrevious = new ThreeMeshUI.Block( buttonOptions );
    
        // Add text to buttons
    
        buttonNext.add(
            new ThreeMeshUI.Text( { content: 'next' } )
        );
    
        buttonPrevious.add(
            new ThreeMeshUI.Text( { content: 'previous' } )
        );
    
        // Create states for the buttons.
        // In the loop, we will call component.setState( 'state-name' ) when mouse hover or click
    
        const selectedAttributes = {
            offset: 0.02,
            backgroundColor: new Color( 0x777777 ),
            fontColor: new Color( 0x222222 )
        };
    
        // @ts-ignore
        buttonNext.setupState( {
            state: 'selected',
            attributes: selectedAttributes,
            onSet: () => {
                console.log('**** next selected');
            }
        } );

        // @ts-ignore
        buttonNext.setupState( hoveredStateAttributes );
        // @ts-ignore
        buttonNext.setupState( idleStateAttributes );
    
        //
    
        // @ts-ignore
        buttonPrevious.setupState( {
            state: 'selected',
            attributes: selectedAttributes,
            onSet: () => {
                console.log('**** previous selected'); 
            }
        } );

        // @ts-ignore
        buttonPrevious.setupState( hoveredStateAttributes );
        // @ts-ignore
        buttonPrevious.setupState( idleStateAttributes );
    
        //
    
        container.add( buttonNext, buttonPrevious );
        // objsToTest.push( buttonNext, buttonPrevious );
    
    }
}