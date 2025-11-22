import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Visualizer3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.spectrumBars = null;
        this.spectrumGroup = null;
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
        this.camera.position.set(0, 15, 25);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Add orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 100;

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

    updateFrequency(frequencyData) {
        if (!frequencyData) return;

        // Create spectrum bars if they don't exist
        if (!this.spectrumBars) {
            this.createSpectrumBars();
        }

        // Update spectrum bars
        const barCount = this.spectrumBars.length;
        const dataPerBar = Math.floor(frequencyData.length / barCount);

        this.spectrumBars.forEach((bar, i) => {
            // Average frequency data for this bar
            let sum = 0;
            const startIdx = i * dataPerBar;
            const endIdx = Math.min(startIdx + dataPerBar, frequencyData.length);

            for (let j = startIdx; j < endIdx; j++) {
                sum += frequencyData[j];
            }

            const average = sum / (endIdx - startIdx) / 255.0; // Normalize to 0-1

            // Calculate target height with sensitivity
            const targetHeight = average * 8 * this.sensitivity;

            // Smooth transition (lerp)
            const currentHeight = bar.scale.y;
            bar.scale.y = currentHeight + (targetHeight - currentHeight) * 0.3;

            // Update color based on height
            const hue = this.getHueForBar(i, barCount, bar.scale.y / (8 * this.sensitivity));
            bar.material.color.setHSL(hue, 0.8, 0.5);
        });
    }

    createSpectrumBars() {
        const barCount = 64;
        const radius = 12;
        this.spectrumBars = [];

        // Create group for spectrum bars
        this.spectrumGroup = new THREE.Group();

        for (let i = 0; i < barCount; i++) {
            // Create bar geometry
            const geometry = new THREE.BoxGeometry(0.4, 1, 0.4);
            const material = new THREE.MeshPhongMaterial({
                color: 0x667eea,
                shininess: 30,
                emissive: 0x222222
            });

            const bar = new THREE.Mesh(geometry, material);

            // Position in circle
            const angle = (i / barCount) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            bar.position.set(x, 0, z);
            bar.rotation.y = -angle; // Face center

            // Store initial scale
            bar.scale.y = 0.1;

            this.spectrumBars.push(bar);
            this.spectrumGroup.add(bar);
        }

        this.scene.add(this.spectrumGroup);
    }

    getHueForBar(index, total, intensity) {
        switch (this.colorScheme) {
            case 'purple':
                return 0.75 + (index / total) * 0.15 + intensity * 0.1;
            case 'ocean':
                return 0.55 + (index / total) * 0.15;
            case 'fire':
                return (index / total) * 0.15 + intensity * 0.1;
            case 'rainbow':
                return (index / total);
            default:
                return 0.75;
        }
    }

    setColorScheme(scheme) {
        this.colorScheme = scheme;

        // Update spectrum bars colors if they exist
        if (this.spectrumBars) {
            this.spectrumBars.forEach((bar, i) => {
                const hue = this.getHueForBar(i, this.spectrumBars.length, 0.5);
                bar.material.color.setHSL(hue, 0.8, 0.5);
            });
        }
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
