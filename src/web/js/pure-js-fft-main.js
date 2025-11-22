import FFT from 'fft.js';
import { Visualizer3D } from './visualizer-3d.js';
import { PerformanceMonitor } from './performance-monitor.js';

class PureJSFFTApp {
    constructor() {
        // Audio data
        this.audioData = null; // Raw PCM samples
        this.sampleRate = 44100;
        this.channels = 2;
        this.duration = 0;

        // Playback
        this.audioElement = null;
        this.isPlaying = false;

        // Components
        this.visualizer = null;
        this.performanceMonitor = null;

        // FFT setup
        this.fftSize = 2048;
        this.fft = null;
        this.fftInput = null;
        this.fftOutput = null;
        this.frequencyData = null;
    }

    async init() {
        try {
            console.log('Starting initialization...');

            // Show loading
            document.getElementById('loading').classList.add('active');
            this.updateStatus('Initializing Pure JavaScript FFT visualizer...');

            // Create HTML5 Audio element
            console.log('Creating audio element...');
            this.audioElement = new Audio();
            this.audioElement.addEventListener('play', () => { this.isPlaying = true; });
            this.audioElement.addEventListener('pause', () => { this.isPlaying = false; });
            this.audioElement.addEventListener('ended', () => { this.isPlaying = false; });
            console.log('Audio element created:', this.audioElement);

            // Initialize components
            console.log('Creating Visualizer3D...');
            this.visualizer = new Visualizer3D('canvas-container');
            console.log('Visualizer3D created:', this.visualizer);

            console.log('Creating PerformanceMonitor...');
            try {
                this.performanceMonitor = new PerformanceMonitor();
                this.performanceMonitor.start(); // Start monitoring
                console.log('PerformanceMonitor created and started:', this.performanceMonitor);
            } catch (perfError) {
                console.error('PerformanceMonitor creation failed:', perfError);
                // Create a dummy performance monitor
                this.performanceMonitor = {
                    beginFrame: () => {},
                    endFrame: () => {},
                    beginFFT: () => {},
                    endFFT: () => {}
                };
            }

            // Initialize FFT
            console.log('Initializing FFT with size:', this.fftSize);
            this.initFFT(this.fftSize);
            console.log('FFT initialized:', this.fft);

            // Setup event listeners
            console.log('Setting up event listeners...');
            this.setupEventListeners();

            // Hide loading
            document.getElementById('loading').classList.remove('active');
            this.updateStatus('Ready. Load an audio file to begin.');

            console.log('Pure JavaScript FFT visualizer initialized successfully');

        } catch (error) {
            console.error('Failed to initialize app:', error);
            console.error('Error stack:', error.stack);
            this.updateStatus('Error: Failed to initialize visualizer. Check console for details.');
        }
    }

    initFFT(size) {
        this.fftSize = size;
        this.fft = new FFT(size);
        this.fftInput = new Array(size);
        this.fftOutput = this.fft.createComplexArray();
        this.frequencyData = new Uint8Array(size / 2);
        console.log(`FFT initialized with size ${size}`);
    }

    setFFTSize(size) {
        this.initFFT(size);
        console.log(`FFT size changed to ${size}`);
    }

    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('audio-file');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Player controls
        document.getElementById('play-btn').addEventListener('click', () => this.play());
        document.getElementById('pause-btn').addEventListener('click', () => this.pause());
        document.getElementById('stop-btn').addEventListener('click', () => this.stop());

        // FFT size control
        const fftSizeSelect = document.getElementById('fft-size');
        fftSizeSelect.addEventListener('change', (e) => {
            const size = parseInt(e.target.value);
            this.setFFTSize(size);
        });

        // Color scheme selector
        const colorSchemeSelect = document.getElementById('color-scheme');
        colorSchemeSelect.addEventListener('change', (e) => {
            const scheme = e.target.value;
            if (this.visualizer) {
                this.visualizer.setColorScheme(scheme);
            }
        });

        // Sensitivity slider
        const sensitivitySlider = document.getElementById('sensitivity');
        const sensitivityValue = document.getElementById('sensitivity-value');
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sensitivityValue.textContent = value.toFixed(1);
            if (this.visualizer) {
                this.visualizer.setSensitivity(value);
            }
        });

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

            // Parse WAV file
            this.updateStatus(`Parsing ${file.name}...`);
            console.log('Parsing WAV file...');

            try {
                const wavData = this.parseWAV(arrayBuffer);
                this.audioData = wavData.audioData;
                this.sampleRate = wavData.sampleRate;
                this.channels = wavData.channels;
                this.duration = wavData.duration;
            } catch (parseError) {
                console.error('WAV parsing error:', parseError);
                throw new Error(`Failed to parse ${file.name}. Only WAV format is supported.`);
            }

            const loadTime = performance.now() - loadStart;
            console.log(`✓ Parsed: ${file.name}, ${this.duration.toFixed(2)}s, ${this.sampleRate}Hz, ${this.channels}ch`);
            console.log(`Load time: ${loadTime.toFixed(2)}ms`);

            // Set up audio element for playback
            const url = URL.createObjectURL(file);
            this.audioElement.src = url;
            this.audioElement.load();

            // Enable controls
            document.getElementById('play-btn').disabled = false;
            document.getElementById('pause-btn').disabled = false;
            document.getElementById('stop-btn').disabled = false;

            this.updateStatus(`Ready to play: ${file.name}`);

        } catch (error) {
            console.error('Failed to load audio file:', error);
            this.updateStatus(`Error: ${error.message}`);
        }
    }

    parseWAV(arrayBuffer) {
        const view = new DataView(arrayBuffer);

        // Check RIFF header
        const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
        if (riff !== 'RIFF') {
            throw new Error('Not a valid WAV file (missing RIFF header)');
        }

        // Check WAVE format
        const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
        if (wave !== 'WAVE') {
            throw new Error('Not a valid WAV file (missing WAVE format)');
        }

        // Find fmt chunk
        let offset = 12;
        while (offset < view.byteLength) {
            const chunkId = String.fromCharCode(
                view.getUint8(offset),
                view.getUint8(offset + 1),
                view.getUint8(offset + 2),
                view.getUint8(offset + 3)
            );
            const chunkSize = view.getUint32(offset + 4, true);

            if (chunkId === 'fmt ') {
                const channels = view.getUint16(offset + 10, true);
                const sampleRate = view.getUint32(offset + 12, true);
                const bitsPerSample = view.getUint16(offset + 22, true);

                console.log(`WAV format: ${channels}ch, ${sampleRate}Hz, ${bitsPerSample}bit`);

                // Find data chunk
                let dataOffset = offset + 8 + chunkSize;
                while (dataOffset < view.byteLength) {
                    const dataChunkId = String.fromCharCode(
                        view.getUint8(dataOffset),
                        view.getUint8(dataOffset + 1),
                        view.getUint8(dataOffset + 2),
                        view.getUint8(dataOffset + 3)
                    );
                    const dataChunkSize = view.getUint32(dataOffset + 4, true);

                    if (dataChunkId === 'data') {
                        // Extract PCM data
                        const numSamples = dataChunkSize / (bitsPerSample / 8) / channels;
                        const audioData = new Float32Array(numSamples);

                        let sampleIndex = 0;
                        const bytesPerSample = bitsPerSample / 8;
                        const dataStart = dataOffset + 8;

                        for (let i = 0; i < numSamples; i++) {
                            let sum = 0;
                            for (let ch = 0; ch < channels; ch++) {
                                const byteOffset = dataStart + (i * channels + ch) * bytesPerSample;
                                let sample = 0;

                                if (bitsPerSample === 16) {
                                    sample = view.getInt16(byteOffset, true) / 32768.0;
                                } else if (bitsPerSample === 8) {
                                    sample = (view.getUint8(byteOffset) - 128) / 128.0;
                                } else if (bitsPerSample === 24) {
                                    const byte1 = view.getUint8(byteOffset);
                                    const byte2 = view.getUint8(byteOffset + 1);
                                    const byte3 = view.getInt8(byteOffset + 2);
                                    sample = ((byte3 << 16) | (byte2 << 8) | byte1) / 8388608.0;
                                } else if (bitsPerSample === 32) {
                                    sample = view.getFloat32(byteOffset, true);
                                }

                                sum += sample;
                            }
                            audioData[sampleIndex++] = sum / channels; // Convert to mono by averaging
                        }

                        return {
                            audioData,
                            sampleRate,
                            channels,
                            duration: numSamples / sampleRate
                        };
                    }

                    dataOffset += 8 + dataChunkSize;
                }

                throw new Error('No data chunk found in WAV file');
            }

            offset += 8 + chunkSize;
        }

        throw new Error('No fmt chunk found in WAV file');
    }

    play() {
        if (!this.audioData || !this.audioElement) return;

        this.audioElement.play();
        console.log('Playback started');
    }

    pause() {
        if (!this.audioElement) return;

        this.audioElement.pause();
        console.log('Playback paused');
    }

    stop() {
        if (!this.audioElement) return;

        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        console.log('Playback stopped');
    }

    getCurrentTime() {
        return this.audioElement ? this.audioElement.currentTime : 0;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.performanceMonitor.beginFrame();

        if (this.isPlaying && this.audioData) {
            // Get frequency data using JavaScript FFT
            this.performanceMonitor.beginFFT();
            const frequencyData = this.getFrequencyData();
            this.performanceMonitor.endFFT();

            if (frequencyData && this.visualizer) {
                this.visualizer.updateFrequency(frequencyData);
            }
        }

        // Render the visualizer
        if (this.visualizer) {
            this.visualizer.render();
        }

        this.performanceMonitor.endFrame();
    }

    getFrequencyData() {
        if (!this.audioData || !this.isPlaying) return null;

        // Get current playback position
        const currentTime = this.getCurrentTime();
        const sampleOffset = Math.floor(currentTime * this.sampleRate);

        // Use raw PCM data
        const channelData = this.audioData;

        // Extract samples for FFT
        const numSamples = this.fftSize;
        if (sampleOffset + numSamples > channelData.length) {
            return null; // Not enough samples
        }

        // Apply Hann window and prepare input
        for (let i = 0; i < numSamples; i++) {
            // Hann window function
            const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (numSamples - 1)));
            this.fftInput[i] = channelData[sampleOffset + i] * windowValue;
        }

        // Perform FFT
        this.fft.realTransform(this.fftOutput, this.fftInput);

        // Calculate magnitudes
        const numBins = this.fftSize / 2;
        let maxMagnitude = 0;

        for (let i = 0; i < numBins; i++) {
            const real = this.fftOutput[i * 2];
            const imag = this.fftOutput[i * 2 + 1];
            const magnitude = Math.sqrt(real * real + imag * imag);

            if (magnitude > maxMagnitude) {
                maxMagnitude = magnitude;
            }

            this.frequencyData[i] = magnitude;
        }

        // Normalize to 0-255 range
        const scale = maxMagnitude > 0 ? 255 / maxMagnitude : 0;
        for (let i = 0; i < numBins; i++) {
            this.frequencyData[i] = Math.min(255, Math.floor(this.frequencyData[i] * scale));
        }

        return this.frequencyData;
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new PureJSFFTApp();
        app.init();
    });
} else {
    const app = new PureJSFFTApp();
    app.init();
}
