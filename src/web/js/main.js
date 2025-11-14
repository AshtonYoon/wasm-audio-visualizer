import WasmModule from '../../../public/audio-visualizer.js';
import { AudioPlayer } from './audio-player.js';
import { Visualizer3D } from './visualizer-3d.js';
import { UIControls } from './ui-controls.js';

class App {
    constructor() {
        this.wasmModule = null;
        this.audioPlayer = null;
        this.visualizer = null;
        this.uiControls = null;
        this.audioData = null;
    }

    async init() {
        try {
            // Show loading
            document.getElementById('loading').classList.add('active');
            this.updateStatus('Loading WASM module...');

            // Load WASM module
            this.wasmModule = await WasmModule();
            console.log('WASM module loaded successfully');

            // Initialize components
            this.audioPlayer = new AudioPlayer();
            this.visualizer = new Visualizer3D('canvas-container');
            this.uiControls = new UIControls(this);

            // Setup event listeners
            this.setupEventListeners();

            // Hide loading
            document.getElementById('loading').classList.remove('active');
            this.updateStatus('Ready. Load an audio file to begin.');

        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.updateStatus('Error: Failed to load WASM module. Check console for details.');
        }
    }

    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('audio-file');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Player controls
        document.getElementById('play-btn').addEventListener('click', () => this.play());
        document.getElementById('pause-btn').addEventListener('click', () => this.pause());
        document.getElementById('stop-btn').addEventListener('click', () => this.stop());

        // Start animation loop
        this.animate();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.updateStatus(`Loading ${file.name}...`);

            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Allocate memory in WASM
            const dataPtr = this.wasmModule._malloc(uint8Array.length);
            this.wasmModule.HEAPU8.set(uint8Array, dataPtr);

            // Load audio in WASM
            const success = this.wasmModule._loadAudio(dataPtr, uint8Array.length);
            this.wasmModule._free(dataPtr);

            if (!success) {
                throw new Error('Failed to decode audio file. Only WAV format is currently supported.');
            }

            // Get audio info
            const sampleCount = this.wasmModule._getSampleCount();
            const sampleRate = this.wasmModule._getSampleRate();
            const channels = this.wasmModule._getChannels();

            console.log(`Audio loaded: ${sampleCount} samples, ${sampleRate} Hz, ${channels} ch`);

            // Get waveform data for visualization
            const resolution = 1024;
            const waveformPtr = this.wasmModule._getWaveformData(resolution);

            if (waveformPtr) {
                // Copy waveform data from WASM memory
                const waveformData = new Float32Array(
                    this.wasmModule.HEAPF32.buffer,
                    waveformPtr,
                    resolution * 3  // x, y, z for each point
                );

                // Update visualizer
                this.visualizer.updateWaveform(waveformData, resolution);
            }

            // Load audio into Web Audio API for playback
            // Note: We need to decode again for Web Audio API as WASM only stores samples
            await this.audioPlayer.loadFile(arrayBuffer);

            // Enable controls
            document.getElementById('play-btn').disabled = false;
            document.getElementById('pause-btn').disabled = false;
            document.getElementById('stop-btn').disabled = false;

            this.updateStatus(`Loaded: ${file.name} (${sampleRate} Hz, ${channels}ch)`);

        } catch (error) {
            console.error('Error loading file:', error);
            this.updateStatus(`Error: ${error.message}`);
        }
    }

    play() {
        if (this.audioPlayer) {
            this.audioPlayer.play();
            this.updateStatus('Playing...');
        }
    }

    pause() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.updateStatus('Paused');
        }
    }

    stop() {
        if (this.audioPlayer) {
            this.audioPlayer.stop();
            this.updateStatus('Stopped');
        }
    }

    animate = () => {
        requestAnimationFrame(this.animate);

        // Update visualizer (camera controls, etc.)
        if (this.visualizer) {
            this.visualizer.render();
        }

        // Update visualization with current audio data if playing
        if (this.audioPlayer && this.audioPlayer.isPlaying()) {
            const analyzerData = this.audioPlayer.getFrequencyData();
            if (analyzerData && this.visualizer) {
                this.visualizer.updateFrequency(analyzerData);
            }
        }
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new App();
        app.init();
    });
} else {
    const app = new App();
    app.init();
}
