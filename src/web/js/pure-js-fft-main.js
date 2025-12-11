import { PureFFT } from './pure-fft.js';
import { Visualizer3D } from './visualizer-3d.js';
import { PerformanceMonitor } from './performance-monitor.js';

class PureJSFFTApp {
    constructor() {
        // 오디오 데이터
        this.audioData = null; // Raw PCM 샘플
        this.sampleRate = 44100;
        this.channels = 2;
        this.duration = 0;

        // 재생
        this.audioElement = null;
        this.isPlaying = false;

        // 컴포넌트
        this.visualizer = null;
        this.performanceMonitor = null;

        // FFT 설정
        this.fftSize = 2048;
        this.fft = null;
        this.fftInput = null;
        this.fftOutput = null;
        this.frequencyData = null;
    }

    async init() {
        try {
            console.log('초기화 시작...');

            // 로딩 표시
            document.getElementById('loading').classList.add('active');
            this.updateStatus('순수 JavaScript DFT 비주얼라이저 초기화 중...');

            // HTML5 Audio 엘리먼트 생성
            console.log('오디오 엘리먼트 생성 중...');
            this.audioElement = new Audio();
            this.audioElement.addEventListener('play', () => { this.isPlaying = true; });
            this.audioElement.addEventListener('pause', () => { this.isPlaying = false; });
            this.audioElement.addEventListener('ended', () => { this.isPlaying = false; });
            console.log('오디오 엘리먼트 생성 완료:', this.audioElement);

            // 컴포넌트 초기화
            console.log('Visualizer3D 생성 중...');
            this.visualizer = new Visualizer3D('canvas-container');
            console.log('Visualizer3D 생성 완료:', this.visualizer);

            console.log('PerformanceMonitor 생성 중...');
            try {
                this.performanceMonitor = new PerformanceMonitor();
                this.performanceMonitor.start(); // 모니터링 시작
                console.log('PerformanceMonitor 생성 및 시작 완료:', this.performanceMonitor);
            } catch (perfError) {
                console.error('PerformanceMonitor 생성 실패:', perfError);
                // 더미 성능 모니터 생성
                this.performanceMonitor = {
                    beginFrame: () => {},
                    endFrame: () => {},
                    beginFFT: () => {},
                    endFFT: () => {}
                };
            }

            // FFT 초기화
            console.log('FFT 초기화 중, 크기:', this.fftSize);
            this.initFFT(this.fftSize);
            console.log('FFT 초기화 완료:', this.fft);

            // 이벤트 리스너 설정
            console.log('이벤트 리스너 설정 중...');
            this.setupEventListeners();

            // 로딩 숨기기
            document.getElementById('loading').classList.remove('active');
            this.updateStatus('준비 완료. 오디오 파일을 로드하세요.');

            console.log('순수 JavaScript FFT 비주얼라이저 초기화 완료');

        } catch (error) {
            console.error('앱 초기화 실패:', error);
            console.error('에러 스택:', error.stack);
            this.updateStatus('에러: 비주얼라이저 초기화 실패. 콘솔을 확인하세요.');
        }
    }

    initFFT(size) {
        this.fftSize = size;
        this.fft = new PureFFT(size);
        this.fftInput = new Float32Array(size);
        this.fftOutput = this.fft.createComplexArray();
        this.frequencyData = new Uint8Array(size / 2);
        console.log(`순수 JavaScript FFT 초기화 완료, 크기: ${size}`);
    }

    setFFTSize(size) {
        this.initFFT(size);
        console.log(`FFT 크기 변경: ${size}`);
    }

    setupEventListeners() {
        // 파일 입력
        const fileInput = document.getElementById('audio-file');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // 플레이어 컨트롤
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('stop-btn').addEventListener('click', () => this.stop());

        // FFT 크기 컨트롤
        const fftSizeSelect = document.getElementById('fft-size');
        fftSizeSelect.addEventListener('change', (e) => {
            const size = parseInt(e.target.value);
            this.setFFTSize(size);
        });

        // 색상 스킴 선택기
        const colorSchemeSelect = document.getElementById('color-scheme');
        colorSchemeSelect.addEventListener('change', (e) => {
            const scheme = e.target.value;
            if (this.visualizer) {
                this.visualizer.setColorScheme(scheme);
            }
        });

        // 감도 슬라이더
        const sensitivitySlider = document.getElementById('sensitivity');
        const sensitivityValue = document.getElementById('sensitivity-value');
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sensitivityValue.textContent = value.toFixed(1);
            if (this.visualizer) {
                this.visualizer.setSensitivity(value);
            }
        });

        // 애니메이션 루프 시작
        this.animate();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.updateStatus(`${file.name} 로딩 중...`);
            console.log(`파일 로드 중: ${file.name}, 타입: ${file.type}, 크기: ${file.size} bytes`);

            const loadStart = performance.now();

            // ArrayBuffer로 파일 읽기
            const arrayBuffer = await file.arrayBuffer();
            console.log(`ArrayBuffer 로드 완료, 크기: ${arrayBuffer.byteLength} bytes`);

            // WAV 파일 파싱
            this.updateStatus(`${file.name} 파싱 중...`);
            console.log('WAV 파일 파싱 중...');

            try {
                const wavData = this.parseWAV(arrayBuffer);
                this.audioData = wavData.audioData;
                this.sampleRate = wavData.sampleRate;
                this.channels = wavData.channels;
                this.duration = wavData.duration;
            } catch (parseError) {
                console.error('WAV 파싱 에러:', parseError);
                throw new Error(`${file.name} 파싱 실패. WAV 포맷만 지원됩니다.`);
            }

            const loadTime = performance.now() - loadStart;
            console.log(`✓ 파싱 완료: ${file.name}, ${this.duration.toFixed(2)}초, ${this.sampleRate}Hz, ${this.channels}채널`);
            console.log(`로드 시간: ${loadTime.toFixed(2)}ms`);

            // 재생을 위한 오디오 엘리먼트 설정
            const url = URL.createObjectURL(file);
            this.audioElement.src = url;
            this.audioElement.load();

            // 컨트롤 활성화
            document.getElementById('play-pause-btn').disabled = false;
            document.getElementById('stop-btn').disabled = false;

            this.updateStatus(`재생 준비 완료: ${file.name}`);

        } catch (error) {
            console.error('오디오 파일 로드 실패:', error);
            this.updateStatus(`에러: ${error.message}`);
        }
    }

    parseWAV(arrayBuffer) {
        const view = new DataView(arrayBuffer);

        // RIFF 헤더 확인
        const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
        if (riff !== 'RIFF') {
            throw new Error('유효한 WAV 파일이 아닙니다 (RIFF 헤더 누락)');
        }

        // WAVE 포맷 확인
        const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
        if (wave !== 'WAVE') {
            throw new Error('유효한 WAV 파일이 아닙니다 (WAVE 포맷 누락)');
        }

        // fmt 청크 찾기
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

                console.log(`WAV 포맷: ${channels}채널, ${sampleRate}Hz, ${bitsPerSample}bit`);

                // data 청크 찾기
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
                        // PCM 데이터 추출
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
                            audioData[sampleIndex++] = sum / channels; // 평균을 내어 모노로 변환
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

                throw new Error('WAV 파일에서 data 청크를 찾을 수 없습니다');
            }

            offset += 8 + chunkSize;
        }

        throw new Error('WAV 파일에서 fmt 청크를 찾을 수 없습니다');
    }

    togglePlayPause() {
        if (!this.audioData || !this.audioElement) return;

        const playPauseBtn = document.getElementById('play-pause-btn');

        if (this.isPlaying) {
            this.audioElement.pause();
            playPauseBtn.textContent = '▶ 재생';
            console.log('재생 일시정지');
        } else {
            this.audioElement.play();
            playPauseBtn.textContent = '⏸ 일시정지';
            console.log('재생 시작');
        }
    }

    stop() {
        if (!this.audioElement) return;

        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const playPauseBtn = document.getElementById('play-pause-btn');
        playPauseBtn.textContent = '▶ 재생';

        console.log('재생 정지');
    }

    getCurrentTime() {
        return this.audioElement ? this.audioElement.currentTime : 0;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.performanceMonitor.beginFrame();

        if (this.isPlaying && this.audioData) {
            // JavaScript FFT를 사용하여 주파수 데이터 가져오기
            this.performanceMonitor.beginFFT();
            const frequencyData = this.getFrequencyData();
            this.performanceMonitor.endFFT();

            if (frequencyData && this.visualizer) {
                this.visualizer.updateFrequency(frequencyData);
            }
        }

        // 비주얼라이저 렌더링
        if (this.visualizer) {
            this.visualizer.render();
        }

        this.performanceMonitor.endFrame();
    }

    getFrequencyData() {
        if (!this.audioData || !this.isPlaying) return null;

        // 현재 재생 위치 가져오기
        const currentTime = this.getCurrentTime();
        const sampleOffset = Math.floor(currentTime * this.sampleRate);

        // Raw PCM 데이터 사용
        const channelData = this.audioData;

        // FFT용 샘플 추출
        const numSamples = this.fftSize;
        if (sampleOffset + numSamples > channelData.length) {
            return null; // 샘플 부족
        }

        // Hann 윈도우 적용 및 입력 준비
        for (let i = 0; i < numSamples; i++) {
            // Hann 윈도우 함수
            const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (numSamples - 1)));
            this.fftInput[i] = channelData[sampleOffset + i] * windowValue;
        }

        // FFT 수행
        this.fft.realTransform(this.fftOutput, this.fftInput);

        // 크기 계산
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

        // 0-255 범위로 정규화
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

// DOM 준비 시 앱 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new PureJSFFTApp();
        app.init();
    });
} else {
    const app = new PureJSFFTApp();
    app.init();
}
