import { ArrayCamera } from 'three/src/cameras/ArrayCamera.js';
import { EventDispatcher } from 'three/src/core/EventDispatcher.js';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';
import { Vector3 } from 'three/src/math/Vector3.js';
import { Vector4 } from 'three/src/math/Vector4.js';
import { WebGLAnimation } from 'three/src/renderers/webgl/WebGLAnimation.js';
import { WebXRController } from 'three/src/renderers/webxr/WebXRController.js';

class WebXRManager extends EventDispatcher {

	constructor( renderer, gl ) {

		super();

		const scope = this;
		const state = renderer.state;

		let session = null;
		let framebufferScaleFactor = 1.0;

		let referenceSpace = null;
		let referenceSpaceType = 'local-floor';

		let pose = null;
		let glBinding = null;
		let glFramebuffer = null;
		let glProjLayer = null;

		const controllers = [];
		const inputSourcesMap = new Map();

		//

		const cameraL = new PerspectiveCamera();
		cameraL.layers.enable( 1 );
		cameraL.viewport = new Vector4();

		const cameraR = new PerspectiveCamera();
		cameraR.layers.enable( 2 );
		cameraR.viewport = new Vector4();

		const cameras = [ cameraL, cameraR ];

		const cameraVR = new ArrayCamera();
		cameraVR.layers.enable( 1 );
		cameraVR.layers.enable( 2 );

		let _currentDepthNear = null;
		let _currentDepthFar = null;

		//

		this.cameraAutoUpdate = true;
		this.enabled = false;

		this.isPresenting = false;

		this.getController = function ( index ) {

			let controller = controllers[ index ];

			if ( controller === undefined ) {

				controller = new WebXRController();
				controllers[ index ] = controller;

			}

			return controller.getTargetRaySpace();

		};

		this.getControllerGrip = function ( index ) {

			let controller = controllers[ index ];

			if ( controller === undefined ) {

				controller = new WebXRController();
				controllers[ index ] = controller;

			}

			return controller.getGripSpace();

		};

		this.getHand = function ( index ) {

			let controller = controllers[ index ];

			if ( controller === undefined ) {

				controller = new WebXRController();
				controllers[ index ] = controller;

			}

			return controller.getHandSpace();

		};

		//

		function onSessionEvent( event ) {

			const controller = inputSourcesMap.get( event.inputSource );

			if ( controller ) {

				controller.dispatchEvent( { type: event.type, data: event.inputSource } );

			}

		}

		function onSessionEnd() {

			inputSourcesMap.forEach( function ( controller, inputSource ) {

				controller.disconnect( inputSource );

			} );

			inputSourcesMap.clear();

			_currentDepthNear = null;
			_currentDepthFar = null;

			// restore framebuffer/rendering state

			state.bindXRFramebuffer( null );
			renderer.setRenderTarget( renderer.getRenderTarget() );

			//

			animation.stop();

			scope.isPresenting = false;

			scope.dispatchEvent( { type: 'sessionend' } );

		}

		this.setFramebufferScaleFactor = function ( value ) {

			framebufferScaleFactor = value;

			if ( scope.isPresenting === true ) {

				console.warn( 'THREE.WebXRManager: Cannot change framebuffer scale while presenting.' );

			}

		};

		this.setReferenceSpaceType = function ( value ) {

			referenceSpaceType = value;

			if ( scope.isPresenting === true ) {

				console.warn( 'THREE.WebXRManager: Cannot change reference space type while presenting.' );

			}

		};

		this.getReferenceSpace = function () {

			return referenceSpace;

		};

		this.getSession = function () {

			return session;

		};

		this.setSession = async function ( value ) {

			session = value;

			if ( session !== null ) {

				session.addEventListener( 'select', onSessionEvent );
				session.addEventListener( 'selectstart', onSessionEvent );
				session.addEventListener( 'selectend', onSessionEvent );
				session.addEventListener( 'squeeze', onSessionEvent );
				session.addEventListener( 'squeezestart', onSessionEvent );
				session.addEventListener( 'squeezeend', onSessionEvent );
				session.addEventListener( 'end', onSessionEnd );
				session.addEventListener( 'inputsourceschange', onInputSourcesChange );

				const attributes = gl.getContextAttributes();

				if ( attributes.xrCompatible !== true ) {

					await gl.makeXRCompatible();

				}

				if ( session.renderState.layers === undefined ) {

					const layerInit = {
						antialias: attributes.antialias,
						alpha: attributes.alpha,
						depth: attributes.depth,
						stencil: attributes.stencil,
						framebufferScaleFactor: framebufferScaleFactor
					};

					// eslint-disable-next-line no-undef
					const baseLayer = new XRWebGLLayer( session, gl, layerInit );

					session.updateRenderState( { baseLayer: baseLayer } );

				} else {

					let depthFormat = 0;

					if ( attributes.depth ) {

						depthFormat = attributes.stencil ? gl.DEPTH_STENCIL : gl.DEPTH_COMPONENT;

					}

					const projectionlayerInit = {
						colorFormat: attributes.alpha ? gl.RGBA : gl.RGB,
						depthFormat: depthFormat,
						scaleFactor: framebufferScaleFactor
					};

					// eslint-disable-next-line no-undef
					glBinding = new XRWebGLBinding( session, gl );

					glProjLayer = glBinding.createProjectionLayer( projectionlayerInit );

					glFramebuffer = gl.createFramebuffer();

					session.updateRenderState( { layers: [ glProjLayer ] } );

				}

				referenceSpace = await session.requestReferenceSpace( referenceSpaceType );

				animation.setContext( session );
				animation.start();

				scope.isPresenting = true;

				scope.dispatchEvent( { type: 'sessionstart' } );

				return glProjLayer;

			}

		};

		function onInputSourcesChange( event ) {

			const inputSources = session.inputSources;

			// Assign inputSources to available controllers

			for ( let i = 0; i < controllers.length; i ++ ) {

				inputSourcesMap.set( inputSources[ i ], controllers[ i ] );

			}

			// Notify disconnected

			for ( let i = 0; i < event.removed.length; i ++ ) {

				const inputSource = event.removed[ i ];
				const controller = inputSourcesMap.get( inputSource );

				if ( controller ) {

					controller.dispatchEvent( { type: 'disconnected', data: inputSource } );
					inputSourcesMap.delete( inputSource );

				}

			}

			// Notify connected

			for ( let i = 0; i < event.added.length; i ++ ) {

				const inputSource = event.added[ i ];
				const controller = inputSourcesMap.get( inputSource );

				if ( controller ) {

					controller.dispatchEvent( { type: 'connected', data: inputSource } );

				}

			}

		}

		//

		const cameraLPos = new Vector3();
		const cameraRPos = new Vector3();

		/**
		 * Assumes 2 cameras that are parallel and share an X-axis, and that
		 * the cameras' projection and world matrices have already been set.
		 * And that near and far planes are identical for both cameras.
		 * Visualization of this technique: https://computergraphics.stackexchange.com/a/4765
		 */
		function setProjectionFromUnion( camera, cameraL, cameraR ) {

			cameraLPos.setFromMatrixPosition( cameraL.matrixWorld );
			cameraRPos.setFromMatrixPosition( cameraR.matrixWorld );

			const ipd = cameraLPos.distanceTo( cameraRPos );

			const projL = cameraL.projectionMatrix.elements;
			const projR = cameraR.projectionMatrix.elements;

			// VR systems will have identical far and near planes, and
			// most likely identical top and bottom frustum extents.
			// Use the left camera for these values.
			const near = projL[ 14 ] / ( projL[ 10 ] - 1 );
			const far = projL[ 14 ] / ( projL[ 10 ] + 1 );
			const topFov = ( projL[ 9 ] + 1 ) / projL[ 5 ];
			const bottomFov = ( projL[ 9 ] - 1 ) / projL[ 5 ];

			const leftFov = ( projL[ 8 ] - 1 ) / projL[ 0 ];
			const rightFov = ( projR[ 8 ] + 1 ) / projR[ 0 ];
			const left = near * leftFov;
			const right = near * rightFov;

			// Calculate the new camera's position offset from the
			// left camera. xOffset should be roughly half `ipd`.
			const zOffset = ipd / ( - leftFov + rightFov );
			const xOffset = zOffset * - leftFov;

			// TODO: Better way to apply this offset?
			cameraL.matrixWorld.decompose( camera.position, camera.quaternion, camera.scale );
			camera.translateX( xOffset );
			camera.translateZ( zOffset );
			camera.matrixWorld.compose( camera.position, camera.quaternion, camera.scale );
			camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();

			// Find the union of the frustum values of the cameras and scale
			// the values so that the near plane's position does not change in world space,
			// although must now be relative to the new union camera.
			const near2 = near + zOffset;
			const far2 = far + zOffset;
			const left2 = left - xOffset;
			const right2 = right + ( ipd - xOffset );
			const top2 = topFov * far / far2 * near2;
			const bottom2 = bottomFov * far / far2 * near2;

			camera.projectionMatrix.makePerspective( left2, right2, top2, bottom2, near2, far2 );

		}

		function updateCamera( camera, parent ) {

			if ( parent === null ) {

				camera.matrixWorld.copy( camera.matrix );

			} else {

				camera.matrixWorld.multiplyMatrices( parent.matrixWorld, camera.matrix );

			}

			camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();

		}

		this.updateCamera = function ( camera ) {

			if ( session === null ) return;

			cameraVR.near = cameraR.near = cameraL.near = camera.near;
			cameraVR.far = cameraR.far = cameraL.far = camera.far;

			if ( _currentDepthNear !== cameraVR.near || _currentDepthFar !== cameraVR.far ) {

				// Note that the new renderState won't apply until the next frame. See #18320

				session.updateRenderState( {
					depthNear: cameraVR.near,
					depthFar: cameraVR.far
				} );

				_currentDepthNear = cameraVR.near;
				_currentDepthFar = cameraVR.far;

			}

			const parent = camera.parent;
			const cameras = cameraVR.cameras;

			updateCamera( cameraVR, parent );

			for ( let i = 0; i < cameras.length; i ++ ) {

				updateCamera( cameras[ i ], parent );

			}

			cameraVR.matrixWorld.decompose( cameraVR.position, cameraVR.quaternion, cameraVR.scale );

			// update user camera and its children

			camera.position.copy( cameraVR.position );
			camera.quaternion.copy( cameraVR.quaternion );
			camera.scale.copy( cameraVR.scale );
			camera.matrix.copy( cameraVR.matrix );
			camera.matrixWorld.copy( cameraVR.matrixWorld );

			const children = camera.children;

			for ( let i = 0, l = children.length; i < l; i ++ ) {

				children[ i ].updateMatrixWorld( true );

			}

			// update projection matrix for proper view frustum culling

			if ( cameras.length === 2 ) {

				setProjectionFromUnion( cameraVR, cameraL, cameraR );

			} else {

				// assume single camera setup (AR)

				cameraVR.projectionMatrix.copy( cameraL.projectionMatrix );

			}

		};

		this.getCamera = function () {

			return cameraVR;

		};

		// Animation Loop

		let onAnimationFrameCallback = null;

		function onAnimationFrame( time, frame ) {

			pose = frame.getViewerPose( referenceSpace );

			if ( pose !== null ) {

				const views = pose.views;

				const baseLayer = session.renderState.baseLayer;

				if ( session.renderState.layers === undefined ) {

					state.bindXRFramebuffer( baseLayer.framebuffer );

				}

				let cameraVRNeedsUpdate = false;

				// check if it's necessary to rebuild cameraVR's camera list

				if ( views.length !== cameraVR.cameras.length ) {

					cameraVR.cameras.length = 0;

					cameraVRNeedsUpdate = true;


				}

				for ( let i = 0; i < views.length; i ++ ) {

					const view = views[ i ];

					let viewport = null;

					if ( session.renderState.layers === undefined ) {

						viewport = baseLayer.getViewport( view );

					} else {

						const glSubImage = glBinding.getViewSubImage( glProjLayer, view );

						state.bindXRFramebuffer( glFramebuffer );

						gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glSubImage.colorTexture, 0 );

						if ( glSubImage.depthStencilTexture !== undefined ) {

							gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, glSubImage.depthStencilTexture, 0 );

						}

						viewport = glSubImage.viewport;

					}

					const camera = cameras[ i ];

					camera.matrix.fromArray( view.transform.matrix );

					camera.projectionMatrix.fromArray( view.projectionMatrix );

					camera.viewport.set( viewport.x, viewport.y, viewport.width, viewport.height );

					if ( i === 0 ) {

						cameraVR.matrix.copy( camera.matrix );

					}

					if ( cameraVRNeedsUpdate === true ) {

						cameraVR.cameras.push( camera );

					}

				}

			}

			//

			const inputSources = session.inputSources;

			for ( let i = 0; i < controllers.length; i ++ ) {

				const controller = controllers[ i ];
				const inputSource = inputSources[ i ];

				controller.update( inputSource, frame, referenceSpace );

			}

			if ( onAnimationFrameCallback ) onAnimationFrameCallback( time, frame );

		}

		const animation = new WebGLAnimation();
		animation.setAnimationLoop( onAnimationFrame );

		this.setAnimationLoop = function ( callback ) {

			onAnimationFrameCallback = callback;

		};

		this.dispose = function () {};

	}

}

export { WebXRManager };
