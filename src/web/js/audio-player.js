export class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.source = null;
        this.analyser = null;
        this.audioBuffer = null;
        this.startTime = 0;
        this.pauseTime = 0;
        this._isPlaying = false;
        this.frequencyData = null;
    }

    async loadFile(arrayBuffer) {
        // Create audio context if not exists
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Decode audio data
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        // Create analyser node
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.connect(this.audioContext.destination);
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        }

        console.log(`Audio decoded: ${this.audioBuffer.duration.toFixed(2)}s`);
    }

    async loadFromAudioBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;

        // Create audio context if not exists
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Create analyser node
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.connect(this.audioContext.destination);
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        }

        console.log(`Audio loaded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);
    }

    play() {
        if (!this.audioBuffer) return;

        // Stop current playback if any
        if (this.source) {
            this.source.stop();
        }

        // Create new source
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.analyser);

        // Start playback
        const offset = this.pauseTime;
        this.source.start(0, offset);
        this.startTime = this.audioContext.currentTime - offset;
        this._isPlaying = true;

        // Handle end of playback
        this.source.onended = () => {
            if (this._isPlaying) {
                this._isPlaying = false;
                this.pauseTime = 0;
            }
        };
    }

    pause() {
        if (!this.source || !this._isPlaying) return;

        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.source.stop();
        this._isPlaying = false;
    }

    stop() {
        if (!this.source) return;

        this.source.stop();
        this.pauseTime = 0;
        this._isPlaying = false;
    }

    getFrequencyData() {
        if (!this.analyser) return null;

        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    isPlaying() {
        return this._isPlaying;
    }

    getCurrentTime() {
        if (!this._isPlaying) return this.pauseTime;
        return this.audioContext.currentTime - this.startTime;
    }
}
