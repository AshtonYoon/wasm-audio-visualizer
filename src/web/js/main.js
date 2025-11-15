import WasmModule from '../../../public/audio-visualizer.js';
import { AudioPlayer } from './audio-player.js';
import { Visualizer3D } from './visualizer-3d.js';
import { UIControls } from './ui-controls.js';
import { PerformanceMonitor } from './performance-monitor.js';

class App {
    constructor() {
        this.wasmModule = null;
        this.audioPlayer = null;
        this.visualizer = null;
        this.uiControls = null;
        this.performanceMonitor = null;
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
            this.performanceMonitor = new PerformanceMonitor();

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
            console.log(`Loading file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            console.log(`ArrayBuffer loaded, size: ${arrayBuffer.byteLength} bytes`);

            // Decode with Web Audio API (supports all formats)
            if (!this.audioPlayer.audioContext) {
                this.audioPlayer.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            this.updateStatus(`Decoding ${file.name}...`);
            console.log('Decoding with Web Audio API...');

            let audioBuffer;
            try {
                audioBuffer = await this.audioPlayer.audioContext.decodeAudioData(arrayBuffer.slice(0));
            } catch (decodeError) {
                console.error('Web Audio API decode error:', decodeError);
                throw new Error(`Failed to decode ${file.name}. Format may not be supported by your browser.`);
            }

            console.log(`✓ Decoded: ${file.name}, ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);

            // Load PCM data to WASM for visualization
            this.updateStatus(`Loading to WASM...`);
            const success = this.loadPCMToWasm(audioBuffer);

            if (!success) {
                throw new Error('Failed to load audio data to WASM visualization engine.');
            }

            console.log('✓ PCM data loaded to WASM');

            // Get audio info from WASM
            const sampleCount = this.wasmModule._getSampleCount();
            const sampleRate = this.wasmModule._getSampleRate();
            const channels = this.wasmModule._getChannels();

            console.log(`WASM loaded: ${sampleCount} samples, ${sampleRate} Hz, ${channels} ch`);

            // Load audio into Web Audio API for playback
            await this.audioPlayer.loadFromAudioBuffer(audioBuffer);

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

    loadPCMToWasm(audioBuffer) {
        try {
            console.log('Loading PCM to WASM...');

            // Get channel data (use first channel for mono, or mix to mono)
            const channelData = audioBuffer.getChannelData(0);
            const numSamples = channelData.length;

            console.log(`PCM data: ${numSamples} samples, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);

            // Allocate memory in WASM for float32 array
            const dataPtr = this.wasmModule._malloc(numSamples * 4); // 4 bytes per float
            console.log(`Allocated ${numSamples * 4} bytes at pointer ${dataPtr}`);

            // Copy PCM data to WASM memory
            const offset = dataPtr / 4; // HEAPF32 is indexed in float units
            for (let i = 0; i < numSamples; i++) {
                this.wasmModule.HEAPF32[offset + i] = channelData[i];
            }
            console.log('PCM data copied to WASM memory');

            // Call WASM function to load PCM data
            const success = this.wasmModule._loadPCMData(
                dataPtr,
                numSamples,
                audioBuffer.sampleRate,
                audioBuffer.numberOfChannels
            );

            console.log(`WASM _loadPCMData returned: ${success}`);

            // Free allocated memory
            this.wasmModule._free(dataPtr);

            return success === 1;
        } catch (error) {
            console.error('Error loading PCM to WASM:', error);
            return false;
        }
    }

    play() {
        if (this.audioPlayer) {
            this.audioPlayer.play();
            this.updateStatus('Playing...');
            this.performanceMonitor.start();
        }
    }

    pause() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.updateStatus('Paused');
            this.performanceMonitor.pause();
        }
    }

    stop() {
        if (this.audioPlayer) {
            this.audioPlayer.stop();
            this.updateStatus('Stopped');
            this.performanceMonitor.stop();
        }
    }

    animate = () => {
        requestAnimationFrame(this.animate);

        this.performanceMonitor.beginFrame();

        // Update visualizer (camera controls, etc.)
        if (this.visualizer) {
            this.visualizer.render();
        }

        // Update visualization with current audio data if playing
        if (this.audioPlayer && this.audioPlayer.isPlaying()) {
            this.performanceMonitor.beginFFT();

            // Use WASM FFT for spectrum analysis
            const wasmFrequencyData = this.getWasmFrequencyData();

            this.performanceMonitor.endFFT();

            if (wasmFrequencyData && this.visualizer) {
                this.visualizer.updateFrequency(wasmFrequencyData);
            }
        }

        this.performanceMonitor.endFrame();
    }

    getWasmFrequencyData() {
        if (!this.wasmModule || !this.audioPlayer) return null;

        // Get current playback time and convert to sample offset
        const currentTime = this.audioPlayer.getCurrentTime();
        const sampleRate = this.wasmModule._getSampleRate();
        const sampleOffset = Math.floor(currentTime * sampleRate);

        // Get FFT size from analyser (or use default)
        const fftSize = this.audioPlayer.analyser ? this.audioPlayer.analyser.fftSize : 2048;

        // Use batch FFT for better performance (reduce function call overhead)
        const batchSize = 4; // Process 4 frames at once
        const hopSize = Math.floor(fftSize / 4); // 75% overlap

        const batchPtr = this.wasmModule._getBatchFFTData(sampleOffset, batchSize, hopSize, fftSize);

        if (!batchPtr) {
            // Fallback to Web Audio API if WASM FFT fails
            return this.audioPlayer.getFrequencyData();
        }

        // Copy FFT data from WASM memory
        const numBins = fftSize / 2;
        const offset = batchPtr / 4; // HEAPF32 is indexed in float units

        // Convert float magnitudes to Uint8Array (0-255) like Web Audio API
        if (!this.wasmFrequencyData || this.wasmFrequencyData.length !== numBins) {
            this.wasmFrequencyData = new Uint8Array(numBins);
        }

        // Average the batch results for smoother visualization
        const avgMagnitudes = new Float32Array(numBins);
        for (let frame = 0; frame < batchSize; frame++) {
            const frameOffset = offset + (frame * numBins);
            for (let i = 0; i < numBins; i++) {
                avgMagnitudes[i] += this.wasmModule.HEAPF32[frameOffset + i];
            }
        }

        // Find max magnitude for normalization
        let maxMagnitude = 0;
        for (let i = 0; i < numBins; i++) {
            avgMagnitudes[i] /= batchSize;
            if (avgMagnitudes[i] > maxMagnitude) {
                maxMagnitude = avgMagnitudes[i];
            }
        }

        // Normalize and convert to 0-255 range
        const scale = maxMagnitude > 0 ? 255 / maxMagnitude : 0;
        for (let i = 0; i < numBins; i++) {
            this.wasmFrequencyData[i] = Math.min(255, Math.floor(avgMagnitudes[i] * scale));
        }

        return this.wasmFrequencyData;
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
