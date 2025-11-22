import { AudioPlayer } from './audio-player.js';
import { Visualizer3D } from './visualizer-3d.js';
import { UIControls } from './ui-controls.js';
import { PerformanceMonitor } from './performance-monitor.js';

class PureJSApp {
    constructor() {
        this.audioPlayer = null;
        this.visualizer = null;
        this.uiControls = null;
        this.performanceMonitor = null;
    }

    async init() {
        try {
            // Show loading
            document.getElementById('loading').classList.add('active');
            this.updateStatus('Initializing Pure JavaScript visualizer...');

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

            console.log('Pure JavaScript visualizer initialized successfully');

        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.updateStatus('Error: Failed to initialize visualizer. Check console for details.');
        }
    }

    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('audio-file');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Player controls
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayPause());
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

            const loadStart = performance.now();

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

            const loadTime = performance.now() - loadStart;
            console.log(`✓ Decoded: ${file.name}, ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);
            console.log(`Load time: ${loadTime.toFixed(2)}ms`);

            // Get audio info directly from AudioBuffer
            const sampleCount = audioBuffer.length;
            const sampleRate = audioBuffer.sampleRate;
            const channels = audioBuffer.numberOfChannels;

            console.log(`Audio info: ${sampleCount} samples, ${sampleRate} Hz, ${channels} ch`);

            // Load audio into Web Audio API for playback
            await this.audioPlayer.loadFromAudioBuffer(audioBuffer);

            // Enable controls
            document.getElementById('play-pause-btn').disabled = false;
            document.getElementById('stop-btn').disabled = false;

            this.updateStatus(`Loaded: ${file.name} (${sampleRate} Hz, ${channels}ch, ${loadTime.toFixed(0)}ms)`);

        } catch (error) {
            console.error('Error loading file:', error);
            this.updateStatus(`Error: ${error.message}`);
        }
    }

    togglePlayPause() {
        if (!this.audioPlayer) return;

        const playPauseBtn = document.getElementById('play-pause-btn');

        if (this.audioPlayer.isPlaying()) {
            this.audioPlayer.pause();
            this.updateStatus('Paused');
            this.performanceMonitor.pause();
            playPauseBtn.textContent = '▶ Play';
        } else {
            this.audioPlayer.play();
            this.updateStatus('Playing...');
            this.performanceMonitor.start();
            playPauseBtn.textContent = '⏸ Pause';
        }
    }

    stop() {
        if (this.audioPlayer) {
            this.audioPlayer.stop();
            this.updateStatus('Stopped');
            this.performanceMonitor.stop();

            const playPauseBtn = document.getElementById('play-pause-btn');
            playPauseBtn.textContent = '▶ Play';
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
            const analyzerData = this.audioPlayer.getFrequencyData();
            this.performanceMonitor.endFFT();

            if (analyzerData && this.visualizer) {
                this.visualizer.updateFrequency(analyzerData);
            }
        }

        this.performanceMonitor.endFrame();
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new PureJSApp();
        app.init();
    });
} else {
    const app = new PureJSApp();
    app.init();
}
