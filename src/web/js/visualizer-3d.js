import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Visualizer3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.waveformMesh = null;
        this.colorScheme = 'purple';
        this.sensitivity = 1.0;

        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 50, 100);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 5, 10);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Add orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 50;

        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 5);
        this.scene.add(directionalLight);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.scene.add(gridHelper);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    updateWaveform(waveformData, resolution) {
        // Remove old mesh
        if (this.waveformMesh) {
            this.scene.remove(this.waveformMesh);
            this.waveformMesh.geometry.dispose();
            this.waveformMesh.material.dispose();
        }

        // Create geometry from waveform data
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        // Create 3D waveform surface
        const width = 20;
        const depth = 30;
        const heightScale = 10;

        for (let i = 0; i < resolution - 1; i++) {
            const x1 = (waveformData[i * 3] - 0.5) * width;
            const y1 = waveformData[i * 3 + 1] * heightScale * this.sensitivity;
            const z1 = (i / resolution - 0.5) * depth;

            const x2 = (waveformData[(i + 1) * 3] - 0.5) * width;
            const y2 = waveformData[(i + 1) * 3 + 1] * heightScale * this.sensitivity;
            const z2 = ((i + 1) / resolution - 0.5) * depth;

            // Create line segment
            positions.push(x1, y1, z1);
            positions.push(x2, y2, z2);

            // Add colors based on height
            const color = this.getColorForHeight(y1 / (heightScale * this.sensitivity));
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Create material
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 2
        });

        // Create line mesh
        this.waveformMesh = new THREE.LineSegments(geometry, material);
        this.scene.add(this.waveformMesh);
    }

    updateFrequency(frequencyData) {
        // Update waveform mesh based on real-time frequency data
        // This can be used to animate the existing waveform
        if (!this.waveformMesh) return;

        // For now, we could add some subtle animation based on frequency
        // This is placeholder for more advanced real-time visualization
    }

    getColorForHeight(normalizedHeight) {
        const h = Math.max(0, Math.min(1, normalizedHeight));

        switch (this.colorScheme) {
            case 'purple':
                return new THREE.Color().setHSL(0.75 + h * 0.1, 0.8, 0.5 + h * 0.3);
            case 'ocean':
                return new THREE.Color().setHSL(0.55 + h * 0.1, 0.7, 0.4 + h * 0.4);
            case 'fire':
                return new THREE.Color().setHSL(h * 0.15, 1.0, 0.5);
            case 'rainbow':
                return new THREE.Color().setHSL(h, 0.8, 0.5);
            default:
                return new THREE.Color().setHSL(0.75, 0.8, 0.5 + h * 0.3);
        }
    }

    setColorScheme(scheme) {
        this.colorScheme = scheme;
        // Re-render with new colors if waveform exists
        // (would need to store waveformData to recompute)
    }

    setSensitivity(value) {
        this.sensitivity = value;
    }

    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}
