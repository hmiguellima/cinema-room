import { WebGLRenderer } from "three";

export class VRButton {
	static createButton(renderer: WebGLRenderer, sessionInit: any) {
		const container = document.createElement('span');

		function createEnterVrButton() {
			const button = document.createElement('button');
			let currentSession:any  = null;

			function onSessionStarted(session: XRSession) {
				session.addEventListener('end', onSessionEnded);
				button.textContent = 'EXIT ROOM';
				currentSession = session;
				renderer.xr.setSession(session as any);
			}

			function onSessionEnded(/*event*/) {
				currentSession.removeEventListener('end', onSessionEnded );
				button.textContent = 'ENTER ROOM';
				currentSession = null;
			}

			button.style.cursor = 'pointer';
			button.style.left = 'calc(50% - 50px)';
			button.style.width = '100px';
			button.textContent = 'ENTER ROOM';

			button.onmouseenter = function () {
				button.style.opacity = '1.0';
			};

			button.onmouseleave = function () {
				button.style.opacity = '0.5';
			};

			button.onclick = async () => {
				if (currentSession === null) {
					// WebXR's requestReferenceSpace only works if the corresponding feature
					// was requested at session creation time. For simplicity, just ask for
					// the interesting ones as optional features, but be aware that the
					// requestReferenceSpace call will fail if it turns out to be unavailable.
					// ('local' is always available for immersive sessions and doesn't need to
					// be requested separately.)

					navigator.xr!.requestSession('immersive-vr', sessionInit).then(onSessionStarted);
				} else {
					currentSession.end();
				}
			};

			button.id = 'VRButton';
			styleElement(button);

			return button;
		}

		function createWebXrWarningElement() {
			const message = document.createElement('a');

			if (window.isSecureContext === false) {
				message.href = document.location.href.replace(/^http:/, 'https:');
				message.innerHTML = 'WEBXR NEEDS HTTPS'; // TODO Improve message
			} else {
				message.href = 'https://immersiveweb.dev/';
				message.innerHTML = 'WEBXR NOT AVAILABLE';
			}
	
			message.style.left = 'calc(50% - 90px)';
			message.style.width = '180px';
			message.style.textDecoration = 'none';
	
			styleElement(message);
	
			return message;	
		}

		function styleElement(element: HTMLElement) {
			element.style.position = 'absolute';
			element.style.bottom = '20px';
			element.style.padding = '12px 6px';
			element.style.border = '1px solid #fff';
			element.style.borderRadius = '4px';
			element.style.background = 'rgba(0,0,0,0.1)';
			element.style.color = '#fff';
			element.style.font = 'normal 13px sans-serif';
			element.style.textAlign = 'center';
			element.style.opacity = '0.5';
			element.style.outline = 'none';
			element.style.zIndex = '999';
		}

		let supportPromise: Promise<boolean>;

		if ('xr' in navigator) {
			supportPromise = (navigator as any).xr.isSessionSupported('immersive-vr');
		} else {
			supportPromise = Promise.resolve(false);
		}

		supportPromise.then(isSupported => {
			if (isSupported) {
				container.appendChild(createEnterVrButton());
			} else {
				container.appendChild(createWebXrWarningElement());
			}
		});

		return container;
	}
}
