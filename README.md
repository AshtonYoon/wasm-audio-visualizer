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
Emscripten을 사용하여 C++ 코드를 WebAssembly로 컴파일하고, dj_fft 라이브러리로 FFT (Fast Fourier Transform) 분석을 수행하며, Three.js를 통해 3D 시각화를 구현합니다.

### 핵심 기술 스택

- **C++20** - 오디오 처리 핵심 로직
- **Emscripten 4.0** - WebAssembly 컴파일 툴체인
- **dj_fft** - SIMD 최적화 FFT 라이브러리 (header-only)
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
   - dj_fft의 SIMD 최적화 FFT 알고리즘
   - **SIMD 사용 코드 위치:**
     - `CMakeLists.txt:29-30, 35` - 컴파일 플래그 설정
     - `audio_analyzer.cpp:10-15` - SIMD 지원 감지 (`__wasm_simd128__`)
     - `audio_analyzer.cpp:21-43` - `apply_window_simd()` - 4개 float 동시 처리 (윈도우 함수 적용)
     - `audio_analyzer.cpp:46-82` - `compute_magnitude_simd()` - 4개 복소수 동시 처리 (크기 계산)
     - `dj_fft.h` - FFT 연산 자체에 SIMD 최적화 내장

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
| 김태경 | 팀장      | 메모리 풀, SIMD 최적화, 빌드 시스템, 성능 벤치마킹                             |
| 윤여환 | 팀원      | Three.js 3D 시각화, UI 컨트롤, 성능 모니터, Pure JS 버전 구현, WASM API 바인딩 |
| 이재영 | 팀원      | FFT 분석 엔진, 오디오 디코더, 버퍼 관리                                        |

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
  - loadPCMData(), getFFTData() 등

---

김태경

담당 역할: 성능 최적화 및 빌드 시스템 구축

주요 구현 내용:

- 메모리 관리 (memory_pool.cpp)
  - Memory Pool 구현
  - malloc/free 최적화
  - 메모리 누수 방지
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
  - dj_fft 라이브러리 통합
  - SIMD 최적화 적용
  - 주파수 스펙트럼 분석
- 오디오 디코더 (audio_decoder.cpp)
  - WAV 파일 파싱 및 디코딩
  - PCM 데이터 추출
- 오디오 버퍼 관리 (audio_buffer.cpp)
  - 순환 버퍼 구현
  - 실시간 데이터 스트리밍

## 5. 개발 중 어려웠던 점과 해결 방법

### 5.1 WASM 빌드 및 Emscripten 설정

**어려웠던 점:**

- Emscripten 툴체인 설치 및 환경 설정의 복잡성
  - emsdk 설치 경로 및 환경 변수 설정
  - 빌드 시스템 통합의 어려움
- CMake 빌드 시스템과 Emscripten의 통합
  - C++ 컴파일러가 아닌 emcc를 사용해야 하는 제약

### 5.2 WASM ↔ JavaScript 데이터 전달

**어려웠던 점:**

- **JS-WASM 함수 호출 오버헤드**
  - 매 프레임 FFT 호출 시 성능 저하
  - 함수 호출 자체의 비용
- **TypedArray 복사 로직**
  - JavaScript에서 WASM 메모리로 오디오 데이터 복사
  - WASM에서 JavaScript로 FFT 결과 복사
  - Float32Array 변환 비용
- **메모리 관리 및 누수 방지**
  - 매 프레임마다 메모리 할당이 필요함
    - 오디오 시각화 → 60 FPS
    - → 매 프레임마다 FFT 실행
    - → 매번 메모리 할당/해제 필요
    - 일반 malloc/free 사용 시:
    - 초당 60번 × malloc() + free() = 초당 120번의 시스템 콜
      - → 느림 💀

**해결 방법:**

- **Memory Pool 구현 (`memory_pool.cpp`)**

  - 미리 할당된 메모리 풀에서 재사용
  - malloc/free 호출 횟수 최소화

## 6. 가산점 항목

### 성능 비교 분석 시스템

- **두 가지 구현 버전 제공**

  - WASM 버전 (`index.html`): C++ FFT with SIMD
  - Pure JavaScript 버전 (`pure-js.html`): Web Audio API AnalyserNode
  - 사용자가 직접 성능 비교 가능

- **실시간 성능 모니터링**
  - FPS (Frames Per Second) 측정
  - FFT 처리 시간 측정
  - 메모리 사용량 추적

## 7. 성능 측정 결과

### 테스트 환경

- **CPU**: Apple M3
- **브라우저**: Chrome 141
- **오디오 파일**: WAV, 44.1kHz, Stereo
- **FFT 크기**: 2048
- **측정 방식**: 100 프레임 평균값

### 성능 비교 (WASM vs Pure JavaScript)

| 측정 항목            | WASM (C++) | Pure JavaScript DFT | 비고                             |
| -------------------- | ---------- | ------------------- | -------------------------------- |
| **FFT 처리 시간**    | ~0.5ms     | ~3.4ms              | WASM이 약 6.8배 빠름             |
| **프레임 시간**      | ~0.22ms    | ~0.24ms             | 거의 동일                        |
| **렌더링 FPS**       | 120 FPS    | 120 FPS             | 동일 (Three.js WebGL)            |
| **메모리 사용량**    | ~139MB     | ~44MB               | Pure JS가 메모리 효율적          |
| **오디오 로딩 시간** | ~100-200ms | ~5ms                | Pure JS가 WAV 파싱만 수행        |

### 성능 분석 요약

#### WASM FFT가 Pure JavaScript DFT보다 빠른 이유

WASM C++ FFT 구현이 Pure JavaScript DFT 구현보다 약 6.8배 빠른 성능을 보였습니다.

1. **최적화된 FFT 알고리즘**

   - WASM: Cooley-Tukey FFT 알고리즘 (O(N log N))
   - Pure JS: Direct DFT 계산 (O(N²))
   - FFT 크기 2048의 경우 이론적으로 ~186배 더 효율적

2. **SIMD 최적화 및 네이티브 성능**

   - WASM: dj_fft 라이브러리의 SIMD 최적화 활용
   - 컴파일된 C++ 코드의 네이티브 속도
   - WebAssembly SIMD 128-bit 명령어 지원

3. **사전 계산된 삼각함수 테이블**
   - DFT: 모든 k*n 조합에 대한 cos/sin 테이블 사전 계산
   - 하지만 O(N²) 복잡도로 인해 성능 한계

#### WASM의 장점

1. **뛰어난 FFT 성능**

   - C++ 최적화 FFT 알고리즘으로 Pure JavaScript 대비 6.8배 빠른 처리
   - SIMD 최적화를 통한 병렬 연산
   - 실시간 오디오 처리에 적합

2. **커스텀 알고리즘 구현 가능**

   - dj_fft와 같은 고성능 C/C++ 라이브러리 활용
   - 특화된 오디오 처리 로직 구현
   - 복잡한 DSP 알고리즘 통합

3. **예측 가능한 성능**
   - JavaScript JIT 컴파일러의 변동성 없이 일관된 성능
   - 메모리 풀을 통한 안정적인 메모리 관리

### 참고 문서

자세한 성능 분석 및 최적화 방법은 다음 문서를 참조하세요:

- [PERFORMANCE.md](PERFORMANCE.md) - WASM vs Web Audio API 성능 비교 분석
- [ARCHITECTURE.md](ARCHITECTURE.md) - 시스템 아키텍처 및 데이터 흐름 (한국어)

---

## 프로젝트 구조

```
wasm-audio-visualizer/
├── src/
│   ├── cpp/                    # C++ WASM 소스 코드
│   │   ├── core/               # 오디오 처리 핵심
│   │   │   ├── audio_decoder.cpp      # WAV 디코더
│   │   │   ├── audio_analyzer.cpp     # FFT 분석
│   │   │   └── audio_buffer.cpp       # 순환 버퍼
│   │   ├── utils/
│   │   │   └── memory_pool.cpp        # 메모리 풀
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
│   └── third_party/
│       └── dj_fft/                    # FFT 라이브러리
├── include/                    # C++ 헤더
├── build/                      # CMake 빌드 출력
├── public/                     # 정적 파일
├── CMakeLists.txt              # CMake 설정
├── build.sh                    # 빌드 스크립트
└── vite.config.js              # Vite 설정
```

## 크레딧

- [dj_fft](https://github.com/jdupuy/dj_fft) by Jonathan Dupuy - SIMD 최적화 FFT 라이브러리
- [Emscripten](https://emscripten.org/) - WebAssembly 툴체인
- [Three.js](https://threejs.org/) - 3D 라이브러리
