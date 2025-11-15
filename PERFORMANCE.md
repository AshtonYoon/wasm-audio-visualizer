# Web Audio API FFT가 WASM FFT보다 더 빠른 이유

🧩 결론
브라우저의 Web Audio API FFT는 브라우저 내부 네이티브(C/C++/SIMD) DSP 엔진을 직접 호출하는 반면, WASM FFT는 JS ↔ WASM 오버헤드 + 메모리 복사 비용 + SIMD 최적화 부족 때문에 더 느리게 동작할 수 있다.

## 1. Web Audio API는 네이티브 DSP 엔진을 직접 사용한다

WebAudio의 AnalyserNode FFT는 자바스크립트가 실행하는 것이 아니라:
브라우저 네이티브 레이어(C/C++ DSP 엔진)
AVX/NEON SIMD 최적화
오디오 스트림 파이프라인에 통합된 zero-copy buffer 구조
을 사용한다.
즉, 수년 동안 최적화되어온 브라우저 레벨 DSP 스택이기 때문에 성능에서 WASM을 압도할 수밖에 없다.

## 2. WASM은 호출 비용 자체가 크다

WASM 내부 연산은 빠르지만, 다음 비용이 숨어있다:
JS → WASM 함수 호출 오버헤드
입력 버퍼를 WASM 메모리에 복사해야 하는 비용
WASM → JS 결과 복사 비용
FFT는 매번 많은 float 데이터를 넘겨야 해서 이 오버헤드가 성능을 많이 잡아먹는다.
반면 Web Audio API는 오디오 버퍼가 브라우저 내부에서 그대로 흐르기 때문에 복사 비용이 거의 없다.

## 3. WASM FFT는 SIMD 최적화가 부족할 가능성이 높다

만약 네 FFT 코드가 아래 최적화를 사용하지 않았다면, 성능 차이가 커지는 게 정상이다:
WebAssembly SIMD
radix-4 / radix-8 FFT 구조
in-place 메모리 레이아웃
Cooley–Tukey 알고리즘 최적화
loop unrolling
WebAudio의 네이티브 FFT는 이런 최적화가 이미 적용된 상태다.

## 4. WASM 메모리는 효율적이지 않다 (추가 비용 존재)

WASM은 linear memory 기반이라 다음 비용이 발생한다:
malloc/free
TypedArray view 생성
입력/출력 복사 비용
WebAudio는 오디오 파이프라인 내부에서 zero-copy에 가깝게 처리한다.

## 5. Web Audio API FFT는 "특화된" FFT라 더 빠르다

AnalyserNode는 다음 목적에 최적화돼 있다:
오디오 분석
실시간 시각화
magnitude 계산
즉, 특화된 경량 FFT이기 때문에 범용 FFT WASM보다 빠르게 동작할 수 있다.

## 📌 요약: 왜 WebAudio FFT가 더 빠를까?

항목 Web Audio API WASM FFT
실행 위치 브라우저 네이티브 (C++) WebAssembly VM
SIMD 풀 SIMD 최적화 직접 구현해야 함
메모리 이동 거의 zero-copy JS↔WASM 복사 필요
호출 비용 매우 낮음 함수 호출 오버헤드 존재
용도 오디오 FFT 전용 범용 FFT
스레드 전용 오디오 스레드 JS/WASM 메인 스레드

## 🚀 WASM을 더 빠르게 만들려면?

다음 최적화로 WebAudio 수준에 근접하거나 능가할 수 있다:
WebAssembly SIMD 사용
radix-4/8 기반 FFT 최적화
입력 버퍼를 WASM 메모리에 유지해 zero-copy 설계
AudioWorklet과 결합해 오디오 스레드에서 직접 처리
SharedArrayBuffer 사용
원하면 네가 사용한 FFT WASM 코드를 분석해 최적화 가능한 부분을 구체적으로 잡아줄 수 있어.
