# WASM Audio Visualizer

## 1. 팀명 / 팀장 / 팀원 이름

- **팀명**: 음연구소
- **팀장**: 김태경
- **팀원**:
  - 윤여환
  - 이재영

## 2. 프로젝트 개요 및 주요 기능

### 프로젝트 개요

C++ WebAssembly 기반 실시간 3D 오디오 시각화 애플리케이션입니다.
Emscripten을 사용하여 C++ 코드를 WebAssembly로 컴파일하고, cooley-turkey 알고리즘으로 FFT (Fast Fourier Transform) 분석을 수행하며, Three.js를 통해 3D 시각화를 구현합니다.

### 핵심 기술 스택

- **C++20** - 오디오 처리 핵심 로직
- **Emscripten 4.0** - WebAssembly 컴파일 툴체인
- **Three.js** - WebGL 기반 3D 렌더링
- **Web Audio API** - 오디오 재생 및 분석
- **Vite** - 개발 서버 및 빌드 도구

### 주요 기능

1. **실시간 오디오 분석 및 3D 시각화**

   - WAV 오디오 파일 지원
   - 실시간 주파수 분석 (FFT)
   - 64개 스펙트럼 바를 원형으로 배치한 3D 시각화

2. **SIMD 최적화**

   - `-msimd128` 플래그를 통한 WebAssembly SIMD 128-bit 명령어 활용
   - **SIMD 사용 코드 위치:**
     - `CMakeLists.txt:29-30, 35` - 컴파일 플래그 설정
     - `audio_analyzer.cpp:17-39` - `apply_window_simd()` - 4개 float 동시 처리 (윈도우 함수 적용)
     - `audio_analyzer.cpp:45-81` - `compute_magnitude_simd()` - 4개 복소수 동시 처리 (크기 계산)

3. **인터랙티브 컨트롤**

   - 카메라 컨트롤 (orbit, zoom, pan)
   - FFT 크기, 색상, 민감도 조정 가능
   - 재생/일시정지/정지 컨트롤

4. **성능 비교 시스템**
   - WASM 버전 (index.html)
   - Pure JavaScript 버전 (pure-js.html)
   - 실시간 성능 모니터링 (FPS, FFT 처리 시간, 메모리)

## 3. 실행 방법

### 사전 요구사항

- **Node.js 18+** - npm 패키지 관리 및 개발 서버 실행
- **Git** - 저장소 클론 및 서브모듈 관리
- **Homebrew** (macOS) - CMake 설치용

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/ashtonyoon/wasm-audio-visualizer.git
cd wasm-audio-visualizer

# 2. Node.js 의존성 설치
npm install

# 3. WASM 모듈 빌드 (Emscripten 자동 설치 포함)
./build.sh

# 4. 개발 서버 실행
npm run dev

# 5. 브라우저에서 http://localhost:8000 접속
```

### 주요 명령어

```bash
# WASM 모듈만 빌드
npm run build:wasm

# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 빌드 미리보기
npm run preview

# 빌드 결과물 삭제
npm run clean
```

### 사용 방법

1. **오디오 파일 로드**: "Choose Audio File" 버튼 클릭하여 WAV 파일 선택
2. **시각화 확인**: 자동으로 3D 파형이 표시됨
3. **재생 컨트롤**: Play/Pause/Stop 버튼으로 오디오 제어
4. **카메라 조작**:
   - 마우스 드래그: 회전
   - 스크롤: 줌
   - 우클릭 드래그: 팬
5. **설정 조정**: FFT 크기, 색상 스킴, 민감도 조절

## 4. 역할 분담

| 이름   | 담당 역할 | 주요 구현 내용                                                                 |
| ------ | --------- | ------------------------------------------------------------------------------ |
| 김태경 | 팀장      | SIMD 최적화, 빌드 시스템, 성능 벤치마킹                                        |
| 윤여환 | 팀원      | Three.js 3D 시각화, UI 컨트롤, 성능 모니터, Pure JS 버전 구현, WASM API 바인딩 |
| 이재영 | 팀원      | FFT 분석 엔진, 오디오 디코더                                                   |

---

윤여환: 프론트엔드 개발

담당 역할: Web 프론트엔드 및 UI/UX 개발

주요 구현 내용:

- Three.js 3D 시각화 구현 (visualizer-3d.js)
  - 64개 스펙트럼 바의 원형 배치
  - 카메라 컨트롤 (OrbitControls)
- Web Audio API 통합 (audio-player.js)
  - 오디오 파일 로딩 및 재생
  - AnalyserNode를 통한 FFT 분석
- 사용자 인터페이스 (ui-controls.js)
  - 재생 컨트롤 (Play/Pause/Stop)
  - FFT 크기, 색상, 민감도 설정 UI
- 성능 모니터링 시스템 (performance-monitor.js)
  - FPS, FFT 처리 시간, 메모리 표시
- Pure JavaScript 버전 구현 (pure-js.html, pure-js-main.js)
- WASM API 바인딩 (wasm_api.cpp)
  - JavaScript와 통신하는 API 함수
  - loadAudio(), getFFTData() 등

---

김태경

담당 역할: 성능 최적화 및 빌드 시스템 구축

주요 구현 내용:

- SIMD 최적화
  - -msimd128 플래그 설정
  - 벡터화 연산 최적화
- 빌드 시스템 (CMakeLists.txt, build.sh)
  - Emscripten 빌드 설정
  - 자동화 스크립트 작성
  - emsdk 자동 설치
- 성능 벤치마킹
  - WASM vs Pure JS 성능 비교 측정

---

이재영

담당 역할: WASM 핵심 오디오 처리 엔진 개발

주요 구현 내용:

- FFT 분석 엔진 (audio_analyzer.cpp)
  - SIMD 최적화 적용
  - 주파수 스펙트럼 분석
- 오디오 디코더 (audio_decoder.cpp)
  - WAV 파일 파싱 및 디코딩
  - PCM 데이터 추출

## 5. 개발 중 어려웠던 점과 해결 방법

### 5.1 WASM 빌드 및 Emscripten 설정

**어려웠던 점:**

- Emscripten 툴체인 설치 및 환경 설정의 복잡성
  - emsdk 설치 경로 및 환경 변수 설정
- CMake 빌드 시스템과 Emscripten의 통합
  - 생소한 빌드 스크립트 작성 방법

### 5.2 WASM ↔ JavaScript 데이터 전달

**어려웠던 점:**

- 오디오 파일 시각화 전반의 흐름 파악이 어려웠음

**해결 방법:**

- 구현 이전 각 레이어의 역할 분리, 흐름도 작성

1. `[js]` 파일 선택
2. `[js]` ArrayBuffer로 읽기
3. `[wasm]` 메모리에 복사 (malloc)
4. `[wasm]` loadAudio() 호출 (WAV 디코딩)
5. `[wasm]` 메모리 해제 (free)
6. `[wasm]` getSamples()로 PCM 데이터 가져오기
7. `[wasm]` createAudioBufferFromWasm()로 AudioBuffer 생성
8. `[js]` AudioPlayer에 로드 (재생용)

## 6. 가산점 항목

### 성능 비교 분석 시스템

- **두 가지 구현 버전 제공**

  - WASM 버전 (`index.html`): C++ FFT with SIMD
  - Pure JavaScript 버전 (`pure-js-fft`): Web Audio API AnalyserNode
  - 사용자가 직접 성능 비교 가능

- **실시간 성능 모니터링**
  - FPS (Frames Per Second) 측정
  - FFT 처리 시간 측정
  - 메모리 사용량 추적

## 7. 성능 측정 결과

### 테스트 환경

- **CPU**: Apple M4
- **브라우저**: Chrome 143
- **오디오 파일**: WAV, 48kHz, Stereo, 46.5MB (46493696 bytes)
- **FFT 크기**: 32768
- **측정 방식**: 30초 재생 평균값
- **측정 도구**: chrome-devtools MCP

### 성능 비교 (WASM vs Pure JavaScript)

| 측정 항목                 | WASM (C++) | Pure JavaScript FFT | 비고                                                                           |
| ------------------------- | ---------- | ------------------- | ------------------------------------------------------------------------------ |
| **FFT 처리 시간 (Total)** | ~1.682ms   | ~2.567ms            | WASM가 약 1.52배 빠름 (JS 오버헤드 포함)                                       |
| **렌더링 FPS**            | 120 FPS    | 120 FPS             | 양쪽 모두 한 프레임당 작업시간이 8.3ms 이내로 처리되기 때문에 최고 프레임 유지 |
| **메모리 사용량**         | ~519.35MB  | ~126.86MB           | Pure JS 메모리 사용량이 약 4.1배 정도 적음                                     |

## 프로젝트 구조

```
wasm-audio-visualizer/
├── src/
│   ├── cpp/                    # C++ WASM 소스 코드
│   │   ├── core/               # 오디오 처리 핵심
│   │   │   ├── audio_decoder.cpp      # WAV 디코더
│   │   │   ├── audio_analyzer.cpp     # FFT 분석
│   │   └── bindings/
│   │       └── wasm_api.cpp           # WASM API
│   ├── web/                    # 웹 프론트엔드
│   │   └── js/
│   │       ├── main.js                # WASM 버전 메인
│   │       ├── pure-js-main.js        # Pure JS 버전
│   │       ├── audio-player.js        # 오디오 플레이어
│   │       ├── visualizer-3d.js       # 3D 시각화
│   │       ├── ui-controls.js         # UI 컨트롤
│   │       └── performance-monitor.js # 성능 모니터
├── include/                    # C++ 헤더
├── build/                      # CMake 빌드 출력
├── public/                     # 정적 파일
├── CMakeLists.txt              # CMake 설정
├── build.sh                    # 빌드 스크립트
└── vite.config.js              # Vite 설정
```

## 크레딧

- [Emscripten](https://emscripten.org/) - WebAssembly 툴체인
- [Three.js](https://threejs.org/) - 3D 라이브러리
