# WASM Audio Visualizer - Architecture Documentation

## 시스템 개요

이 프로젝트는 Web Audio API, WebAssembly(C++), Three.js를 조합하여 오디오 파일을 실시간으로 3D 시각화하는 시스템입니다.

---

## 1. 전체 시스템 플로우

```mermaid
flowchart TD
    Start([사용자: 오디오 파일 선택]) --> ReadFile[JavaScript: File API로 파일 읽기]
    ReadFile --> ArrayBuffer[ArrayBuffer 생성]
    ArrayBuffer --> WebAudio{Web Audio API 디코딩}

    WebAudio -->|성공| AudioBuffer[AudioBuffer 생성<br/>PCM 데이터 포함]
    WebAudio -->|실패| Error1[에러: 지원하지 않는 포맷]

    AudioBuffer --> AllocWASM[WASM 메모리 할당<br/>malloc]
    AllocWASM --> CopyPCM[PCM 데이터를 HEAPF32에 복사]
    CopyPCM --> CallWASM[WASM 함수 호출<br/>_loadPCMData]

    CallWASM --> CPPDecoder[C++ AudioDecoder<br/>PCM 데이터 저장]
    CPPDecoder --> Free[WASM 메모리 해제<br/>free]

    Free --> LoadPlayer[AudioPlayer에<br/>AudioBuffer 로드]
    LoadPlayer --> CreateAnalyser[AnalyserNode 생성<br/>FFT Size: 2048]
    CreateAnalyser --> Ready[준비 완료]

    Ready --> UserPlay{사용자: 재생 버튼 클릭}
    UserPlay -->|재생| PlayLoop[재생 루프 시작]

    PlayLoop --> GetFreq[AnalyserNode에서<br/>실시간 주파수 데이터 획득]
    GetFreq --> UpdateBars[Three.js: 스펙트럼 바<br/>높이 업데이트]
    UpdateBars --> Render[Three.js 렌더링<br/>60 FPS]
    Render -->|재생 중| GetFreq

    Render -->|정지| End([종료])

    style Start fill:#e1f5ff
    style End fill:#ffe1e1
    style WebAudio fill:#fff4e1
    style CPPDecoder fill:#e1ffe1
    style Render fill:#f0e1ff
```

---

## 2. 파일 로드 시퀀스

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Main as main.js<br/>(App)
    participant WebAudio as Web Audio API
    participant WASM as WASM Module<br/>(C++)
    participant Player as AudioPlayer
    participant Viz as Visualizer3D

    User->>Main: 파일 선택
    Main->>Main: file.arrayBuffer()

    Note over Main,WebAudio: 1단계: 오디오 디코딩
    Main->>WebAudio: decodeAudioData(arrayBuffer)
    WebAudio-->>Main: AudioBuffer (PCM)

    Note over Main,WASM: 2단계: WASM으로 PCM 전송
    Main->>WASM: _malloc(samples * 4)
    WASM-->>Main: dataPtr
    Main->>WASM: HEAPF32[offset + i] = sample[i]
    Main->>WASM: _loadPCMData(ptr, samples, rate, channels)
    WASM->>WASM: AudioDecoder::loadFromPCM()
    WASM-->>Main: success (1)
    Main->>WASM: _free(dataPtr)

    Note over Main,Player: 3단계: 재생 준비
    Main->>Player: loadFromAudioBuffer(audioBuffer)
    Player->>Player: createAnalyser()<br/>fftSize = 2048
    Player-->>Main: 준비 완료

    Main->>User: 상태: "Loaded" 표시<br/>재생 버튼 활성화
```

---

## 3. 실시간 재생 & 시각화 루프

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Main as main.js<br/>(animate 루프)
    participant Player as AudioPlayer
    participant Analyser as AnalyserNode
    participant Viz as Visualizer3D
    participant GPU as WebGL/GPU

    User->>Main: 재생 버튼 클릭
    Main->>Player: play()
    Player->>Player: source = createBufferSource()
    Player->>Analyser: source.connect(analyser)
    Player->>Player: source.start()

    loop 60 FPS (requestAnimationFrame)
        Main->>Main: animate() 호출
        Main->>Player: isPlaying()
        Player-->>Main: true

        Main->>Player: getFrequencyData()
        Player->>Analyser: getByteFrequencyData()
        Analyser-->>Player: Uint8Array[1024]<br/>(주파수 스펙트럼)
        Player-->>Main: frequencyData

        Main->>Viz: updateFrequency(frequencyData)

        Note over Viz: 스펙트럼 바 업데이트
        Viz->>Viz: 64개 바를 순회하며<br/>주파수 데이터 평균 계산
        Viz->>Viz: scale.y = lerp(current, target, 0.3)<br/>(부드러운 애니메이션)
        Viz->>Viz: color = hsl(height * 120, 70%, 50%)<br/>(높이에 따라 색상 변경)

        Main->>Viz: render()
        Viz->>GPU: renderer.render(scene, camera)
        GPU-->>User: 화면 출력
    end

    User->>Main: 정지 버튼 클릭
    Main->>Player: stop()
    Player->>Player: source.stop()
```

---

## 4. 컴포넌트 아키텍처

```mermaid
graph TB
    subgraph Browser["브라우저 환경"]
        subgraph UI["UI Layer (HTML/CSS)"]
            FileInput[파일 입력]
            Controls[재생 컨트롤]
            Canvas[Canvas 요소]
        end

        subgraph JS["JavaScript Layer"]
            Main[main.js<br/>App 클래스]
            Player[audio-player.js<br/>AudioPlayer]
            Viz[visualizer-3d.js<br/>Visualizer3D]
            UI_Controls[ui-controls.js<br/>UIControls]
        end

        subgraph WebAPI["Web APIs"]
            FileAPI[File API]
            AudioAPI[Web Audio API<br/>- AudioContext<br/>- AnalyserNode<br/>- decodeAudioData]
            WebGL[WebGL API]
        end

        subgraph ThreeJS["Three.js"]
            Scene[Scene]
            Camera[PerspectiveCamera]
            Renderer[WebGLRenderer]
            Geometry[BufferGeometry]
            Materials[Materials]
        end
    end

    subgraph WASM["WebAssembly (C++)"]
        subgraph API["WASM Bindings"]
            WasmAPI[wasm_api.cpp<br/>- loadPCMData<br/>- getFFTData]
        end

        subgraph Core["Core Components"]
            Decoder[AudioDecoder<br/>- WAV 디코더<br/>- PCM 저장]
            Analyzer[AudioAnalyzer<br/>- dj_fft<br/>- FFT 분석]
        end

        subgraph Lib["Third Party"]
            DJFFT[dj_fft<br/>SIMD 최적화 FFT]
        end
    end

    %% Connections
    FileInput --> Main
    Controls --> Main
    Canvas --> Viz

    Main --> FileAPI
    Main --> Player
    Main --> Viz
    Main --> UI_Controls

    FileAPI --> Main
    Player --> AudioAPI
    AudioAPI --> Player

    Main -.->|PCM 데이터 전송| WasmAPI
    WasmAPI -.->|FFT 데이터| Main

    WasmAPI --> Decoder
    WasmAPI --> Analyzer

    Analyzer --> DJFFT

    Viz --> Scene
    Viz --> Camera
    Viz --> Renderer
    Viz --> Geometry
    Viz --> Materials

    Renderer --> WebGL
    WebGL --> Canvas

    style Browser fill:#e3f2fd
    style WASM fill:#e8f5e9
    style WebAPI fill:#fff3e0
    style ThreeJS fill:#f3e5f5
```

---

## 5. 데이터 플로우 (메모리 관점)

```mermaid
flowchart LR
    subgraph Input["입력"]
        File[오디오 파일<br/>MP3/WAV/OGG<br/>압축 데이터]
    end

    subgraph JSMem["JavaScript Memory"]
        AB[ArrayBuffer<br/>압축 데이터]
        AudioBuf[AudioBuffer<br/>PCM Float32<br/>채널별 분리]
        FreqData[Uint8Array<br/>주파수 스펙트럼<br/>0-255 값]
    end

    subgraph WASMMem["WASM Memory (Linear Memory)"]
        HEAP[HEAPF32<br/>공유 메모리 영역]
        PCMData[vector&lt;float&gt;<br/>PCM 샘플]
        FFTData[float*<br/>FFT 결과<br/>magnitude 배열]
    end

    subgraph GPU["GPU Memory"]
        VBO[Vertex Buffer<br/>바 정점]
        Texture[텍스처<br/>머티리얼]
    end

    File -->|File API| AB
    AB -->|decodeAudioData| AudioBuf
    AudioBuf -->|복사| HEAP
    HEAP -->|loadPCMData| PCMData
    PCMData -->|getFFTData| FFTData
    FFTData -->|복사| HEAP
    HEAP -->|읽기| JSMem

    AudioBuf -->|AnalyserNode| FreqData

    FreqData -.->|Three.js| VBO
    VBO --> GPU

    style Input fill:#ffebee
    style JSMem fill:#e3f2fd
    style WASMMem fill:#e8f5e9
    style GPU fill:#f3e5f5
```

---

## 6. 주요 기술 스택별 역할

| 기술 | 역할 | 주요 기능 |
|------|------|-----------|
| **Web Audio API** | 오디오 디코딩 & 분석 | - decodeAudioData: 모든 포맷 디코딩<br/>- AnalyserNode: 실시간 FFT<br/>- AudioContext: 오디오 재생 |
| **WebAssembly (C++)** | 고성능 오디오 처리 | - PCM 데이터 저장<br/>- dj_fft를 이용한 FFT 분석 |
| **Three.js** | 3D 시각화 | - 64개 스펙트럼 바 (원형 배치)<br/>- OrbitControls로 카메라 제어 |
| **dj_fft** | SIMD 최적화 FFT | - WebAssembly SIMD 128 사용<br/>- 고속 주파수 분석 |
| **Emscripten** | C++ → WASM 컴파일 | - pthread 지원 (멀티스레드)<br/>- ES6 모듈 생성<br/>- 메모리 관리 (malloc/free) |

---

## 7. 성능 최적화 포인트

```mermaid
mindmap
  root((성능 최적화))
    WASM 최적화
      SIMD 128 활성화
        -msimd128 플래그
        dj_fft SIMD 사용
      멀티스레딩
        pthread 지원
        PTHREAD_POOL_SIZE=2
      컴파일 최적화
        -O3 최적화 레벨
    JavaScript 최적화
      메모리 재사용
        TypedArray 재사용
        AnalyserNode frequencyData
      효율적 복사
        HEAPF32 직접 접근
        malloc/free 최소화
    렌더링 최적화
      60 FPS 유지
        requestAnimationFrame
      Lerp 보간
        부드러운 애니메이션
        0.3 lerp factor
      BufferGeometry
        GPU 효율적 렌더링
```

---

## 8. 에러 처리 플로우

```mermaid
flowchart TD
    Start([파일 로드 시작]) --> Read{파일 읽기}
    Read -->|실패| E1[Error: 파일 읽기 실패]
    Read -->|성공| Decode{Web Audio 디코딩}

    Decode -->|실패| E2[Error: 지원하지 않는 포맷<br/>또는 손상된 파일]
    Decode -->|성공| WasmLoad{WASM 로드}

    WasmLoad -->|실패| E3[Error: WASM 메모리<br/>할당 실패]
    WasmLoad -->|성공| Success([로드 성공])

    E1 --> Display[상태 표시:<br/>콘솔 로그 + UI 메시지]
    E2 --> Display
    E3 --> Display

    Display --> Cleanup[리소스 정리]
    Cleanup --> End([종료])

    Success --> Ready[재생 준비 완료]

    style E1 fill:#ffcdd2
    style E2 fill:#ffcdd2
    style E3 fill:#ffcdd2
    style Success fill:#c8e6c9
```

---

## 9. 파일 구조

```
wasm-audio-visualizer/
├── src/
│   ├── cpp/                    # C++ WASM 소스
│   │   ├── core/               # 핵심 오디오 처리
│   │   │   ├── audio_decoder.cpp      # PCM/WAV 디코더
│   │   │   ├── audio_analyzer.cpp     # FFT 분석 (dj_fft)
│   │   │   └── audio_buffer.cpp       # 오디오 버퍼 관리
│   │   ├── bindings/           # JavaScript ↔ C++ 바인딩
│   │   │   └── wasm_api.cpp    # EMSCRIPTEN_KEEPALIVE 함수들
│   │   └── third_party/
│   │       └── dj_fft/         # SIMD 최적화 FFT 라이브러리
│   └── web/                    # JavaScript 프론트엔드
│       ├── js/
│       │   ├── main.js         # 메인 앱 로직
│       │   ├── audio-player.js # Web Audio API 래퍼
│       │   ├── visualizer-3d.js # Three.js 시각화
│       │   └── ui-controls.js  # UI 컨트롤러
│       └── css/
│           └── style.css
├── public/                     # 빌드 출력 & 정적 파일
│   ├── audio-visualizer.wasm   # 컴파일된 WASM 바이너리
│   ├── audio-visualizer.js     # Emscripten 생성 JS 래퍼
│   └── *.mp3, *.wav            # 샘플 오디오
├── build/                      # CMake 빌드 디렉토리
├── CMakeLists.txt             # CMake 빌드 설정
├── index.html                 # 메인 HTML
└── server.js                  # 개발 서버
```

---

## 10. 주요 함수 호출 관계

```mermaid
graph LR
    subgraph JavaScript
        handleFileSelect[handleFileSelect]
        loadPCMToWasm[loadPCMToWasm]
        play[play]
        animate[animate]
    end

    subgraph "WASM API (C++)"
        _loadPCMData[_loadPCMData]
        _getFFTData[_getFFTData]
        _getSampleCount[_getSampleCount]
    end

    subgraph "C++ Core"
        loadFromPCM[AudioDecoder::loadFromPCM]
        analyze[AudioAnalyzer::analyze]
    end

    handleFileSelect --> loadPCMToWasm
    loadPCMToWasm --> _loadPCMData
    _loadPCMData --> loadFromPCM

    play --> animate
    animate --> _getFFTData
    _getFFTData --> analyze

    handleFileSelect --> _getSampleCount
```

---

## 빌드 및 실행

### 빌드 명령어
```bash
# Emscripten 환경 활성화
source ~/Projects/emsdk/emsdk_env.sh

# CMake 설정 및 빌드
mkdir build && cd build
emcmake cmake ..
emmake make
emmake make install

# 개발 서버 실행
cd ..
node server.js
```

### 브라우저 접속
```
http://localhost:8000
```

---

## 참고 자료

- [Emscripten Documentation](https://emscripten.org/docs/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Three.js Documentation](https://threejs.org/docs/)
- [dj_fft GitHub](https://github.com/jdupuy/dj_fft)
