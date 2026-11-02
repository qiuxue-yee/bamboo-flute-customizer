import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { findImageMaterials } from './pattern.js';

export class FluteViewer {
  constructor(container, display, { onContextLost = () => {} } = {}) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f0f1ed');
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.001, 100);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (cause) {
      const error = new Error('WebGL could not be initialized', { cause });
      error.kind = 'webglUnavailable';
      throw error;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D flute');
    container.appendChild(this.renderer.domElement);
    this.onContextLost = event => {
      event.preventDefault();
      this.stop();
      onContextLost();
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb1b5a4, 0.65));
    const key = new THREE.DirectionalLight(0xfff8ed, 0.8);
    key.position.set(-0.3, 0.8, 1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -0.7, right: 0.7, top: 0.7, bottom: -0.7, near: 0.01, far: 5 });
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.0003;
    key.shadow.radius = 8;
    this.shadowLight = key;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe9efff, 0.25);
    fill.position.set(0.3, -0.7, 0.5);
    this.scene.add(fill);

    this.visual = new THREE.Group();
    this.visual.add(display);
    this.visual.rotation.y = -Math.PI / 2;
    this.visual.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -0.22);
    this.scene.add(this.visual);
    this.visual.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.visual);
    this.center = box.getCenter(new THREE.Vector3());
    this.size = box.getSize(new THREE.Vector3());
    this.detailBox = new THREE.Box3();
    for (const { node } of findImageMaterials(display)) this.detailBox.expandByObject(node);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.04 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(this.center.x, box.min.y - 0.035, this.center.z);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.035;
    this.controls.maxDistance = this.size.length() * 6;
    this.controls.target.copy(this.center);
    this.onKey = this.onKey.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.animate = this.animate.bind(this);
    this.requestRender = this.requestRender.bind(this);
    this.cancelTransition = this.cancelTransition.bind(this);
    this.controls.addEventListener('start', this.cancelTransition);
    this.controls.addEventListener('change', this.requestRender);
    this.renderer.domElement.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.setView('full', false);
    this.start();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.viewMode) this.setView(this.viewMode, false);
    this.requestRender();
  }

  frameFor(mode) {
    const box = mode === 'detail' ? this.detailBox : new THREE.Box3().setFromObject(this.visual);
    const target = box.getCenter(new THREE.Vector3());
    // This angle exposes both the drilled holes and the image side of the tube.
    const direction = (mode === 'detail' ? new THREE.Vector3(0.06, 0.15, 1) : new THREE.Vector3(0.06, 0.9, 0.7)).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    let halfWidth = 0, halfHeight = 0, halfDepth = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const offset = new THREE.Vector3(x, y, z).sub(target);
      halfWidth = Math.max(halfWidth, Math.abs(offset.dot(right)));
      halfHeight = Math.max(halfHeight, Math.abs(offset.dot(up)));
      halfDepth = Math.max(halfDepth, Math.abs(offset.dot(direction)));
    }
    const distance = Math.max(halfHeight, halfWidth / this.camera.aspect)
      / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (mode === 'detail' ? 1.5 : 1.18) + halfDepth;
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }

  setView(mode, animate = true) {
    this.cancelTransition();
    this.viewMode = mode === 'detail' ? 'detail' : 'full';
    const frame = this.frameFor(this.viewMode);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduced) {
      this.controls.target.copy(frame.target);
      this.camera.position.copy(frame.position);
      this.controls.update();
      this.requestRender();
      return;
    }
    this.controls.enableDamping = false;
    this.transition = { start: performance.now(), fromTarget: this.controls.target.clone(),
      fromPosition: this.camera.position.clone(), ...frame };
    this.requestRender();
  }

  cancelTransition() {
    this.transition = null;
    if (this.controls) this.controls.enableDamping = true;
  }

  resetCamera() { this.setView(this.viewMode || 'full'); }

  onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.activeElement !== this.renderer.domElement || document.querySelector('dialog[open]')) return;
    const element = event.target;
    if (element instanceof HTMLElement && (element.isContentEditable
      || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(element.tagName))) return;
    const direction = { arrowleft: [0.08, 0], a: [0.08, 0], arrowright: [-0.08, 0], d: [-0.08, 0],
      arrowup: [0, -0.08], w: [0, -0.08], arrowdown: [0, 0.08], s: [0, 0.08] }[event.key.toLowerCase()];
    if (!direction) return;
    this.cancelTransition();
    event.preventDefault();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += direction[0];
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + direction[1], 0.05, Math.PI - 0.05);
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    this.controls.update();
    this.requestRender();
  }

  animate() {
    this.frame = null;
    if (!this.running) return;
    if (this.transition) {
      const t = Math.min(1, (performance.now() - this.transition.start) / 300);
      const eased = 1 - (1 - t) ** 3;
      this.camera.position.lerpVectors(this.transition.fromPosition, this.transition.position, eased);
      this.controls.target.lerpVectors(this.transition.fromTarget, this.transition.target, eased);
      if (t === 1) this.cancelTransition();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.transition) this.requestRender();
  }
  requestRender() {
    if (this.running && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.animate);
  }
  start() { if (!document.hidden) { this.running = true; this.requestRender(); } }
  stop() { this.running = false; if (this.frame) cancelAnimationFrame(this.frame); this.frame = null; }
  onVisibility() { if (document.hidden) this.stop(); else this.start(); }
  dispose() {
    this.stop(); this.cancelTransition(); this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('keydown', this.onKey);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.controls.removeEventListener('start', this.cancelTransition);
    this.controls.removeEventListener('change', this.requestRender);
    this.controls.dispose();
    this.scene.remove(this.visual);
    this.ground.geometry.dispose(); this.ground.material.dispose();
    this.shadowLight.shadow.map?.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
