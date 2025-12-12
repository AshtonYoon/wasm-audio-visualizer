import WasmModule from "../../../public/audio-visualizer.js";
import { AudioPlayer } from "./audio-player.js";
import { Visualizer3D } from "./visualizer-3d.js";
import { UIControls } from "./ui-controls.js";
import { PerformanceMonitor } from "./performance-monitor.js";

class App {
  constructor() {
    this.wasmModule = null;
    this.audioPlayer = null;
    this.visualizer = null;
    this.uiControls = null;
    this.performanceMonitor = null;
    this.audioData = null;

    // 성능 최적화: 사전 할당 버퍼 (zero-copy 설계)
    this.wasmFrequencyData = null;
    this.avgMagnitudesBuffer = null;
    this.currentFFTSize = 0;

    // FFT 데이터 스무딩을 위한 버퍼
    this.smoothedFrequencyData = null;
    this.smoothingFactor = 0.3; // 0.3 = 30% 이전 값, 70% 새 값 (부드러운 전환)
    this.smoothedMaxMagnitude = 1.0; // 스무딩된 최대 크기 (정규화용)

    // 조회 오버헤드 방지를 위한 WASM 함수 참조 캐싱
    this.wasmFunctions = {
      getSampleCount: null,
      getSampleRate: null,
      getChannels: null,
      getSamples: null,
      loadAudio: null,
      getBatchFFTData: null,
      getFFTDataAtOffset: null,
      getLastFFTTime: null,
      malloc: null,
      free: null,
    };
  }

  async init() {
    try {
      // 로딩 표시
      document.getElementById("loading").classList.add("active");
      this.updateStatus("WASM 모듈 로딩 중...");

      // WASM 모듈 로드
      this.wasmModule = await WasmModule();
      console.log("WASM 모듈 로드 완료");

      // 성능을 위한 WASM 함수 참조 캐싱
      this.cacheWasmFunctions();

      // 컴포넌트 초기화
      this.audioPlayer = new AudioPlayer();
      this.visualizer = new Visualizer3D("canvas-container");
      this.uiControls = new UIControls(this);
      this.performanceMonitor = new PerformanceMonitor();

      // 이벤트 리스너 설정
      this.setupEventListeners();

      // 로딩 숨기기
      document.getElementById("loading").classList.remove("active");
      this.updateStatus("준비 완료. 오디오 파일을 로드하세요.");
    } catch (error) {
      console.error("앱 초기화 실패:", error);
      this.updateStatus("에러: WASM 모듈 로드 실패. 콘솔을 확인하세요.");
    }
  }

  cacheWasmFunctions() {
    // 조회 오버헤드 방지를 위해 자주 사용하는 WASM 함수 참조 캐싱
    this.wasmFunctions.getSampleCount = this.wasmModule._getSampleCount;
    this.wasmFunctions.getSampleRate = this.wasmModule._getSampleRate;
    this.wasmFunctions.getChannels = this.wasmModule._getChannels;
    this.wasmFunctions.getSamples = this.wasmModule._getSamples;
    this.wasmFunctions.loadAudio = this.wasmModule._loadAudio;
    this.wasmFunctions.getBatchFFTData = this.wasmModule._getBatchFFTData;
    this.wasmFunctions.getFFTDataAtOffset = this.wasmModule._getFFTDataAtOffset;
    this.wasmFunctions.getLastFFTTime = this.wasmModule._getLastFFTTime;
    this.wasmFunctions.malloc = this.wasmModule._malloc;
    this.wasmFunctions.free = this.wasmModule._free;
  }

  setupEventListeners() {
    // 파일 입력
    const fileInput = document.getElementById("audio-file");
    fileInput.addEventListener("change", (e) => this.handleFileSelect(e));

    // 플레이어 컨트롤
    document
      .getElementById("play-pause-btn")
      .addEventListener("click", () => this.togglePlayPause());
    document
      .getElementById("stop-btn")
      .addEventListener("click", () => this.stop());

    // 애니메이션 루프 시작
    this.animate();
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.updateStatus(`${file.name} 로딩 중...`);
      console.log(
        `파일 로드 중: ${file.name}, 타입: ${file.type}, 크기: ${file.size} bytes`
      );

      // ArrayBuffer로 파일 읽기
      const arrayBuffer = await file.arrayBuffer();
      console.log(
        `ArrayBuffer 로드 완료, 크기: ${arrayBuffer.byteLength} bytes`
      );

      // WASM audio_decoder로 디코딩
      this.updateStatus(`${file.name} 디코딩 중...`);
      console.log("WASM audio_decoder로 디코딩 중...");

      // ArrayBuffer를 Uint8Array로 변환
      const uint8Array = new Uint8Array(arrayBuffer);

      // WASM 메모리에 파일 데이터 복사
      const dataPtr = this.wasmFunctions.malloc(uint8Array.length);
      const heap = new Uint8Array(
        this.wasmModule.HEAPU8.buffer,
        dataPtr,
        uint8Array.length
      );
      heap.set(uint8Array);

      // WASM loadAudio 함수 호출
      const success = this.wasmFunctions.loadAudio(dataPtr, uint8Array.length);

      // 할당된 메모리 해제
      this.wasmFunctions.free(dataPtr);

      if (!success) {
        throw new Error(`${file.name} 디코딩 실패. WAV 파일만 지원됩니다.`);
      }

      // WASM에서 오디오 정보 가져오기
      const sampleCount = this.wasmFunctions.getSampleCount();
      const sampleRate = this.wasmFunctions.getSampleRate();
      const channels = this.wasmFunctions.getChannels();

      console.log(
        `✓ 디코딩 완료: ${file.name}, ${sampleCount} 샘플, ${sampleRate}Hz, ${channels}채널`
      );

      // WASM에서 디코딩된 PCM 샘플을 가져와서 AudioBuffer 생성 (재생용)
      this.updateStatus(`AudioBuffer 생성 중...`);
      const audioBuffer = await this.createAudioBufferFromWasm(
        sampleCount,
        sampleRate,
        channels
      );

      console.log("✓ AudioBuffer 생성 완료");

      // 재생을 위해 Web Audio API에 오디오 로드
      await this.audioPlayer.loadFromAudioBuffer(audioBuffer);

      // 컨트롤 활성화
      document.getElementById("play-pause-btn").disabled = false;
      document.getElementById("stop-btn").disabled = false;

      this.updateStatus(
        `로드 완료: ${file.name} (${sampleRate} Hz, ${channels}채널)`
      );
    } catch (error) {
      console.error("파일 로드 에러:", error);
      this.updateStatus(`에러: ${error.message}`);
    }
  }

  async createAudioBufferFromWasm(sampleCount, sampleRate, channels) {
    // WASM에서 디코딩된 PCM 샘플 가져오기
    const samplesPtr = this.wasmFunctions.getSamples();
    if (!samplesPtr) {
      throw new Error("WASM에서 샘플을 가져올 수 없습니다");
    }

    // AudioContext 생성 (재생용)
    if (!this.audioPlayer.audioContext) {
      this.audioPlayer.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    // AudioBuffer 생성
    const audioBuffer = this.audioPlayer.audioContext.createBuffer(
      channels,
      sampleCount,
      sampleRate
    );

    // WASM 메모리에서 PCM 데이터 읽기
    const offset = samplesPtr / 4; // HEAPF32는 float 단위로 인덱싱됨
    const heapF32 = this.wasmModule.HEAPF32;

    // 각 채널에 데이터 복사
    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < sampleCount; i++) {
        // 인터리브된 데이터에서 채널별로 읽기
        channelData[i] = heapF32[offset + i * channels + ch];
      }
    }

    console.log("✓ AudioBuffer 생성 완료 (WASM PCM → AudioBuffer)");
    return audioBuffer;
  }

  togglePlayPause() {
    if (!this.audioPlayer) return;

    const playPauseBtn = document.getElementById("play-pause-btn");

    if (this.audioPlayer.isPlaying()) {
      this.audioPlayer.pause();
      this.updateStatus("일시정지");
      this.performanceMonitor.pause();
      playPauseBtn.textContent = "▶ 재생";
    } else {
      this.audioPlayer.play();
      this.updateStatus("재생 중...");
      this.performanceMonitor.start();
      playPauseBtn.textContent = "⏸ 일시정지";
    }
  }

  stop() {
    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this.updateStatus("정지");
      this.performanceMonitor.stop();

      const playPauseBtn = document.getElementById("play-pause-btn");
      playPauseBtn.textContent = "▶ 재생";
    }
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    this.performanceMonitor.beginFrame();

    // 비주얼라이저 업데이트 (카메라 컨트롤 등)
    if (this.visualizer) {
      this.visualizer.render();
    }

    // 재생 중이면 현재 오디오 데이터로 시각화 업데이트
    if (this.audioPlayer && this.audioPlayer.isPlaying()) {
      this.performanceMonitor.beginFFT();

      // 스펙트럼 분석에 WASM FFT 사용
      const wasmFrequencyData = this.getWasmFrequencyData();

      this.performanceMonitor.endFFT();

      if (wasmFrequencyData && this.visualizer) {
        const sampleRate = this.wasmFunctions.getSampleRate();
        const fftSize = this.audioPlayer?.analyser?.fftSize || 2048;
        this.visualizer.updateFrequency(wasmFrequencyData, sampleRate, fftSize);
      }
    }

    this.performanceMonitor.endFrame();
  };

  getWasmFrequencyData() {
    if (!this.wasmModule || !this.audioPlayer) return null;

    // 현재 재생 시간을 샘플 오프셋으로 변환 (캐시된 함수 사용)
    const currentTime = this.audioPlayer.getCurrentTime();
    const sampleRate = this.wasmFunctions.getSampleRate();
    const sampleOffset = Math.floor(currentTime * sampleRate);

    // analyser에서 FFT 크기 가져오기 (또는 기본값 사용)
    const fftSize = this.audioPlayer.analyser
      ? this.audioPlayer.analyser.fftSize
      : 2048;
    const numBins = fftSize / 2;

    // FFT 크기가 변경된 경우에만 버퍼 재할당 (zero-copy 최적화)
    if (this.currentFFTSize !== fftSize) {
      this.currentFFTSize = fftSize;
      this.wasmFrequencyData = new Uint8Array(numBins);
      this.avgMagnitudesBuffer = new Float32Array(numBins);
      this.smoothedFrequencyData = new Uint8Array(numBins);
    }

    // 단일 프레임 WASM FFT 함수 호출 (캐시된 함수 사용)
    const fftPtr = this.wasmFunctions.getFFTDataAtOffset(sampleOffset, fftSize);

    if (!fftPtr) {
      // WASM FFT 실패 시 Web Audio API로 폴백
      return this.audioPlayer.getFrequencyData();
    }

    // 순수 FFT 연산 시간 가져오기 (함수 호출 오버헤드 제외)
    // if (this.wasmFunctions.getLastFFTTime) {
    //   const pureFFTTime = this.wasmFunctions.getLastFFTTime();
    //   if (pureFFTTime > 0 && this.performanceMonitor) {
    //     this.performanceMonitor.setPureWasmFftTime(pureFFTTime);
    //   }
    // }

    // WASM 메모리에서 FFT 데이터 복사
    const offset = fftPtr / 4; // HEAPF32는 float 단위로 인덱싱됨
    const heapF32 = this.wasmModule.HEAPF32;

    // 크기가 변경된 경우에만 버퍼 재할당 (zero-copy 최적화)
    if (!this.wasmFrequencyData || this.wasmFrequencyData.length !== numBins) {
      this.wasmFrequencyData = new Uint8Array(numBins);
    }

    // 결합 루프: 값을 캐싱하면서 최대 크기 찾기 (WASM 메모리 액세스 감소)
    let maxMagnitude = 0;
    for (let i = 0; i < numBins; i++) {
      const magnitude = heapF32[offset + i];
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
      }
    }

    // 최대 크기도 스무딩 적용 (급격한 스케일 변화 방지)
    this.smoothedMaxMagnitude =
      this.smoothedMaxMagnitude * 0.9 + maxMagnitude * 0.1;

    // 스무딩된 최대값으로 정규화 (0-255 범위)
    const scale =
      this.smoothedMaxMagnitude > 0 ? 255 / this.smoothedMaxMagnitude : 0;
    for (let i = 0; i < numBins; i++) {
      const magnitude = heapF32[offset + i];
      this.wasmFrequencyData[i] = Math.min(255, Math.floor(magnitude * scale));
    }

    // 시간적 스무딩 적용 (exponential smoothing)
    // smoothed = old * smoothingFactor + new * (1 - smoothingFactor)
    const inverseFactor = 1 - this.smoothingFactor;
    for (let i = 0; i < numBins; i++) {
      this.smoothedFrequencyData[i] = Math.floor(
        this.smoothedFrequencyData[i] * this.smoothingFactor +
          this.wasmFrequencyData[i] * inverseFactor
      );
    }

    return this.smoothedFrequencyData;
  }

  updateStatus(message) {
    document.getElementById("status").textContent = message;
  }
}

// DOM 준비 시 앱 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}
