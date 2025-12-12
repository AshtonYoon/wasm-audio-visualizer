import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class Visualizer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.spectrumBars = null;
    this.spectrumGroup = null;
    this.colorScheme = "purple";
    this.sensitivity = 1.0;

    // 로그 스케일 주파수 매핑 설정
    this.minFreq = 20;        // 최소 주파수 (Hz)
    this.maxFreq = 20000;     // 최대 주파수 (Hz)
    this.sampleRate = 48000;  // 샘플레이트 (동적으로 업데이트)
    this.fftSize = 2048;      // FFT 크기 (동적으로 업데이트)

    // 동적 범위 압축 (dB) 설정
    this.minDb = -60;         // 최소 dB (노이즈 플로어)
    this.maxDb = 0;           // 최대 dB

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
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
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
    window.addEventListener("resize", () => this.onWindowResize());
  }

  updateFrequency(frequencyData, sampleRate, fftSize) {
    if (!frequencyData) return;

    // 샘플레이트/FFT 크기 업데이트 (동적으로 설정)
    if (sampleRate) this.sampleRate = sampleRate;
    if (fftSize) this.fftSize = fftSize;

    // Create spectrum bars if they don't exist
    if (!this.spectrumBars) {
      this.createSpectrumBars();
    }

    const barCount = this.spectrumBars.length; // 64
    const binFreqResolution = this.sampleRate / this.fftSize; // Hz per bin

    this.spectrumBars.forEach((bar, i) => {
      // 1. 로그 스케일 주파수 범위 계산
      const logMin = Math.log10(this.minFreq);
      const logMax = Math.log10(this.maxFreq);
      const logRange = logMax - logMin;

      const startLogFreq = logMin + (i / barCount) * logRange;
      const endLogFreq = logMin + ((i + 1) / barCount) * logRange;

      const startFreq = Math.pow(10, startLogFreq);
      const endFreq = Math.pow(10, endLogFreq);

      // 2. 주파수 → 빈 인덱스 변환
      let startBin = Math.floor(startFreq / binFreqResolution);
      let endBin = Math.ceil(endFreq / binFreqResolution);

      // Nyquist 주파수 초과 방지
      startBin = Math.max(0, Math.min(startBin, frequencyData.length - 1));
      endBin = Math.max(startBin + 1, Math.min(endBin, frequencyData.length));

      // 3. 해당 빈 범위의 평균 계산
      let sum = 0;
      let count = 0;
      for (let j = startBin; j < endBin; j++) {
        sum += frequencyData[j];
        count++;
      }
      const average = count > 0 ? sum / count : 0;

      // 4. 동적 범위 압축 (선형 0-255 → dB → 정규화 0-1)
      const normalized = average / 255.0; // 0-1 범위

      // dB 변환: 20 * log10(normalized)
      let db;
      if (normalized > 0) {
        db = 20 * Math.log10(normalized);
      } else {
        db = this.minDb; // -60dB (노이즈 플로어)
      }

      // dB를 0-1 범위로 재정규화
      const dbNormalized = (db - this.minDb) / (this.maxDb - this.minDb);
      const clampedDb = Math.max(0, Math.min(1, dbNormalized));

      // 5. 타겟 높이 계산
      const targetHeight = clampedDb * 8 * this.sensitivity;

      // 6. 부드러운 전환 (lerp)
      const currentHeight = bar.scale.y;
      bar.scale.y = currentHeight + (targetHeight - currentHeight) * 0.3;

      // 7. 색상 업데이트
      const hue = this.getHueForBar(
        i,
        barCount,
        bar.scale.y / (8 * this.sensitivity)
      );
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
        emissive: 0x222222,
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
      case "purple":
        return 0.75 + (index / total) * 0.15 + intensity * 0.1;
      case "ocean":
        return 0.55 + (index / total) * 0.15;
      case "fire":
        return (index / total) * 0.15 + intensity * 0.1;
      case "rainbow":
        return index / total;
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
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
  }
}
