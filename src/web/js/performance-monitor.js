/**
 * Performance monitoring class for tracking FPS, frame time, FFT computation time, and memory usage
 */
export class PerformanceMonitor {
    constructor() {
        // FPS tracking
        this.frameCount = 0;
        this.lastFpsTime = performance.now();
        this.fps = 0;

        // Frame time tracking
        this.frameStartTime = 0;
        this.frameTimes = [];
        this.maxFrameTimesSamples = 60;
        this.avgFrameTime = 0;

        // FFT time tracking (total time including JS overhead)
        this.fftStartTime = 0;
        this.fftTimes = [];
        this.maxFftTimesSamples = 60;
        this.avgFftTime = 0;

        // Pure WASM FFT time tracking (pure computation only)
        this.pureWasmFftTimes = [];
        this.avgPureWasmFftTime = 0;

        // Memory tracking
        this.memoryCheckInterval = 1000; // Check every second
        this.lastMemoryCheck = 0;
        this.currentMemory = 0;

        // State
        this.isRunning = false;
        this.isPaused = false;

        // UI update interval
        this.uiUpdateInterval = 250; // Update UI every 250ms
        this.lastUiUpdate = 0;

        // Get DOM elements
        this.fpsElement = document.getElementById('fps-value');
        this.frameTimeElement = document.getElementById('frame-time-value');
        this.fftTimeElement = document.getElementById('fft-time-value');
        this.pureWasmFftTimeElement = document.getElementById('pure-wasm-fft-time-value');
        this.memoryElement = document.getElementById('memory-value');
    }

    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.lastFpsTime = performance.now();
        this.frameCount = 0;
    }

    pause() {
        this.isPaused = true;
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.reset();
    }

    reset() {
        this.frameCount = 0;
        this.fps = 0;
        this.frameTimes = [];
        this.fftTimes = [];
        this.pureWasmFftTimes = [];
        this.avgFrameTime = 0;
        this.avgFftTime = 0;
        this.avgPureWasmFftTime = 0;
        this.updateUI();
    }

    beginFrame() {
        if (!this.isRunning || this.isPaused) return;
        this.frameStartTime = performance.now();
    }

    endFrame() {
        if (!this.isRunning || this.isPaused) return;

        const currentTime = performance.now();
        const frameTime = currentTime - this.frameStartTime;

        // Track frame time
        this.frameTimes.push(frameTime);
        if (this.frameTimes.length > this.maxFrameTimesSamples) {
            this.frameTimes.shift();
        }
        this.avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

        // Calculate FPS
        this.frameCount++;
        if (currentTime >= this.lastFpsTime + 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsTime));
            this.frameCount = 0;
            this.lastFpsTime = currentTime;
        }

        // Check memory periodically
        if (currentTime >= this.lastMemoryCheck + this.memoryCheckInterval) {
            this.checkMemory();
            this.lastMemoryCheck = currentTime;
        }

        // Update UI periodically
        if (currentTime >= this.lastUiUpdate + this.uiUpdateInterval) {
            this.updateUI();
            this.lastUiUpdate = currentTime;
        }
    }

    beginFFT() {
        if (!this.isRunning || this.isPaused) return;
        this.fftStartTime = performance.now();
    }

    endFFT() {
        if (!this.isRunning || this.isPaused) return;

        const fftTime = performance.now() - this.fftStartTime;
        this.fftTimes.push(fftTime);
        if (this.fftTimes.length > this.maxFftTimesSamples) {
            this.fftTimes.shift();
        }
        this.avgFftTime = this.fftTimes.reduce((a, b) => a + b, 0) / this.fftTimes.length;
    }

    setPureWasmFftTime(time) {
        if (!this.isRunning || this.isPaused) return;

        this.pureWasmFftTimes.push(time);
        if (this.pureWasmFftTimes.length > this.maxFftTimesSamples) {
            this.pureWasmFftTimes.shift();
        }
        this.avgPureWasmFftTime = this.pureWasmFftTimes.reduce((a, b) => a + b, 0) / this.pureWasmFftTimes.length;
    }

    checkMemory() {
        if (performance.memory) {
            this.currentMemory = performance.memory.usedJSHeapSize / 1048576; // Convert to MB
        }
    }

    updateUI() {
        if (this.fpsElement) {
            this.fpsElement.textContent = this.fps;
        }

        if (this.frameTimeElement) {
            this.frameTimeElement.textContent = this.avgFrameTime.toFixed(2) + ' ms';
        }

        if (this.fftTimeElement) {
            this.fftTimeElement.textContent = this.avgFftTime.toFixed(3) + ' ms';
        }

        if (this.pureWasmFftTimeElement) {
            this.pureWasmFftTimeElement.textContent = this.avgPureWasmFftTime.toFixed(4) + ' ms';
        }

        if (this.memoryElement) {
            this.memoryElement.textContent = this.currentMemory.toFixed(2) + ' MB';
        }
    }

    getStats() {
        return {
            fps: this.fps,
            avgFrameTime: this.avgFrameTime,
            avgFftTime: this.avgFftTime,
            avgPureWasmFftTime: this.avgPureWasmFftTime,
            currentMemory: this.currentMemory,
            frameTimes: [...this.frameTimes],
            fftTimes: [...this.fftTimes],
            pureWasmFftTimes: [...this.pureWasmFftTimes]
        };
    }

    logStats() {
        const stats = this.getStats();
        console.log('=== Performance Stats ===');
        console.log(`FPS: ${stats.fps}`);
        console.log(`Avg Frame Time: ${stats.avgFrameTime.toFixed(2)} ms`);
        console.log(`Avg FFT Time (Total): ${stats.avgFftTime.toFixed(3)} ms`);
        console.log(`Avg FFT Time (Pure WASM): ${stats.avgPureWasmFftTime.toFixed(4)} ms`);
        console.log(`Memory: ${stats.currentMemory.toFixed(2)} MB`);

        if (stats.frameTimes.length > 0) {
            const minFrameTime = Math.min(...stats.frameTimes);
            const maxFrameTime = Math.max(...stats.frameTimes);
            console.log(`Frame Time (min/max): ${minFrameTime.toFixed(2)} / ${maxFrameTime.toFixed(2)} ms`);
        }

        if (stats.fftTimes.length > 0) {
            const minFftTime = Math.min(...stats.fftTimes);
            const maxFftTime = Math.max(...stats.fftTimes);
            console.log(`FFT Time Total (min/max): ${minFftTime.toFixed(3)} / ${maxFftTime.toFixed(3)} ms`);
        }

        if (stats.pureWasmFftTimes.length > 0) {
            const minPureWasmFftTime = Math.min(...stats.pureWasmFftTimes);
            const maxPureWasmFftTime = Math.max(...stats.pureWasmFftTimes);
            console.log(`FFT Time Pure WASM (min/max): ${minPureWasmFftTime.toFixed(4)} / ${maxPureWasmFftTime.toFixed(4)} ms`);
        }
    }
}
