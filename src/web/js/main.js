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

    // 조회 오버헤드 방지를 위한 WASM 함수 참조 캐싱
    this.wasmFunctions = {
      getSampleCount: null,
      getSampleRate: null,
      getChannels: null,
      getBatchFFTData: null,
      getFFTDataAtOffset: null,
      malloc: null,
      free: null,
      loadPCMData: null,
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
    this.wasmFunctions.getBatchFFTData = this.wasmModule._getBatchFFTData;
    this.wasmFunctions.getFFTDataAtOffset = this.wasmModule._getFFTDataAtOffset;
    this.wasmFunctions.malloc = this.wasmModule._malloc;
    this.wasmFunctions.free = this.wasmModule._free;
    this.wasmFunctions.loadPCMData = this.wasmModule._loadPCMData;
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

      // Web Audio API로 디코딩 (모든 포맷 지원)
      if (!this.audioPlayer.audioContext) {
        this.audioPlayer.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      this.updateStatus(`${file.name} 디코딩 중...`);
      console.log("Web Audio API로 디코딩 중...");

      let audioBuffer;
      try {
        audioBuffer = await this.audioPlayer.audioContext.decodeAudioData(
          arrayBuffer.slice(0)
        );
      } catch (decodeError) {
        console.error("Web Audio API 디코드 에러:", decodeError);
        throw new Error(
          `${file.name} 디코딩 실패. 브라우저에서 지원하지 않는 포맷일 수 있습니다.`
        );
      }

      console.log(
        `✓ 디코딩 완료: ${file.name}, ${audioBuffer.duration.toFixed(2)}초, ${
          audioBuffer.sampleRate
        }Hz, ${audioBuffer.numberOfChannels}채널`
      );

      // 시각화를 위해 PCM 데이터를 WASM에 로드
      this.updateStatus(`WASM에 로딩 중...`);
      const success = this.loadPCMToWasm(audioBuffer);

      if (!success) {
        throw new Error("WASM 시각화 엔진에 오디오 데이터 로드 실패.");
      }

      console.log("✓ PCM 데이터를 WASM에 로드 완료");

      // WASM에서 오디오 정보 가져오기 (캐시된 함수 참조 사용)
      const sampleCount = this.wasmFunctions.getSampleCount();
      const sampleRate = this.wasmFunctions.getSampleRate();
      const channels = this.wasmFunctions.getChannels();

      console.log(
        `WASM 로드 완료: ${sampleCount} 샘플, ${sampleRate} Hz, ${channels} 채널`
      );

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

  loadPCMToWasm(audioBuffer) {
    try {
      console.log("WASM에 PCM 로딩 중...");

      // 채널 데이터 가져오기 (모노의 경우 첫 번째 채널 사용, 또는 모노로 믹스)
      const channelData = audioBuffer.getChannelData(0);
      const numSamples = channelData.length;

      console.log(
        `PCM 데이터: ${numSamples} 샘플, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}채널`
      );

      // WASM에 float32 배열을 위한 메모리 할당 (캐시된 함수 사용)
      const dataPtr = this.wasmFunctions.malloc(numSamples * 4); // float당 4바이트
      console.log(`포인터 ${dataPtr}에 ${numSamples * 4} 바이트 할당`);

      // WASM 메모리에 PCM 데이터 복사
      const offset = dataPtr / 4; // HEAPF32는 float 단위로 인덱싱됨
      for (let i = 0; i < numSamples; i++) {
        this.wasmModule.HEAPF32[offset + i] = channelData[i];
      }
      console.log("PCM 데이터를 WASM 메모리에 복사 완료");

      // PCM 데이터 로드를 위해 WASM 함수 호출 (캐시된 함수 사용)
      const success = this.wasmFunctions.loadPCMData(
        dataPtr,
        numSamples,
        audioBuffer.sampleRate,
        audioBuffer.numberOfChannels
      );

      console.log(`WASM _loadPCMData 반환값: ${success}`);

      // 할당된 메모리 해제 (캐시된 함수 사용)
      this.wasmFunctions.free(dataPtr);

      return success === 1;
    } catch (error) {
      console.error("WASM에 PCM 로드 에러:", error);
      return false;
    }
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
        this.visualizer.updateFrequency(wasmFrequencyData);
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
    }

    // 단일 프레임 WASM FFT 함수 호출 (캐시된 함수 사용)
    const fftPtr = this.wasmFunctions.getFFTDataAtOffset(sampleOffset, fftSize);

    if (!fftPtr) {
      // WASM FFT 실패 시 Web Audio API로 폴백
      return this.audioPlayer.getFrequencyData();
    }

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

    // 한 번에 정규화하고 0-255 범위로 변환
    const scale = maxMagnitude > 0 ? 255 / maxMagnitude : 0;
    for (let i = 0; i < numBins; i++) {
      const magnitude = heapF32[offset + i];
      this.wasmFrequencyData[i] = Math.min(255, Math.floor(magnitude * scale));
    }

    return this.wasmFrequencyData;
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
