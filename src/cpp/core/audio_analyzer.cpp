#include "audio_analyzer.h"
#include <algorithm>
#include <cmath>
#include <complex>
#include <wasm_simd128.h>
#include <emscripten.h>

namespace audio {

// SIMD 최적화된 윈도우 함수 적용 (4개 float를 동시에 처리)
// samples: 입력 샘플 배열
// window: 윈도우 함수 배열 (Hann, Hamming 등)
// output: 출력 복소수 배열
// size: 배열 크기
inline void apply_window_simd(const float *samples, const float *window,
                              std::complex<float> *output, size_t size) {
  size_t i = 0;

  // SIMD로 4개 요소씩 처리 (4배 빠름)
  for (; i + 4 <= size; i += 4) {
    v128_t samples_vec = wasm_v128_load(&samples[i]); // 4개 샘플 로드
    v128_t window_vec = wasm_v128_load(&window[i]);   // 4개 윈도우 값 로드
    v128_t result = wasm_f32x4_mul(samples_vec, window_vec); // 4개 동시 곱셈

    // 결과를 복소수로 저장 (실수부만, 허수부 = 0)
    float temp[4];
    wasm_v128_store(temp, result);
    for (int j = 0; j < 4; ++j) {
      output[i + j] = std::complex<float>(temp[j], 0.0f);
    }
  }

  // 남은 요소들은 스칼라로 처리 (fallback)
  for (; i < size; ++i) {
    output[i] = std::complex<float>(samples[i] * window[i], 0.0f);
  }
}

// SIMD 최적화된 크기 계산: sqrt(real^2 + imag^2)을 4개 복소수에 대해 동시 처리
// complex_data: 입력 복소수 배열 (FFT 결과)
// magnitude: 출력 크기 배열
// size: 배열 크기
inline void compute_magnitude_simd(const std::complex<float> *complex_data,
                                   float *magnitude, size_t size) {
  size_t i = 0;

  // SIMD로 4개 요소씩 처리 (4배 빠름)
  for (; i + 4 <= size; i += 4) {
    // 실수부와 허수부 분리
    alignas(16) float real[4], imag[4];
    for (int j = 0; j < 4; ++j) {
      real[j] = complex_data[i + j].real();
      imag[j] = complex_data[i + j].imag();
    }

    v128_t real_vec = wasm_v128_load(real); // 4개 실수부 로드
    v128_t imag_vec = wasm_v128_load(imag); // 4개 허수부 로드

    // real^2와 imag^2 계산 (4개 동시)
    v128_t real_sq = wasm_f32x4_mul(real_vec, real_vec);
    v128_t imag_sq = wasm_f32x4_mul(imag_vec, imag_vec);

    // real^2 + imag^2 (4개 동시 덧셈)
    v128_t sum = wasm_f32x4_add(real_sq, imag_sq);

    // sqrt 계산 (4개 동시)
    v128_t result = wasm_f32x4_sqrt(sum);

    // 결과 저장
    wasm_v128_store(&magnitude[i], result);
  }

  // 남은 요소들은 스칼라로 처리 (fallback)
  for (; i < size; ++i) {
    float real = complex_data[i].real();
    float imag = complex_data[i].imag();
    magnitude[i] = std::sqrt(real * real + imag * imag);
  }
}

// Bit-reversal 테이블과 Twiddle factor 사전 계산
// FFT는 Cooley-Tukey 알고리즘 사용
void AudioAnalyzer::init_fft_tables() {
  const size_t n = fft_size_;
  const size_t log2n = static_cast<size_t>(std::log2(n));

  // Bit-reversal 테이블 계산
  bit_reversed_.resize(n);
  for (size_t i = 0; i < n; ++i) {
    uint32_t reversed = 0;
    uint32_t temp = i;

    for (size_t j = 0; j < log2n; ++j) {
      reversed = (reversed << 1) | (temp & 1);
      temp >>= 1;
    }

    bit_reversed_[i] = reversed;
  }

  // Twiddle factors 사전 계산
  // W_N^k = e^(-2πik/N) = cos(2πk/N) - i*sin(2πk/N)
  twiddle_cos_.resize(n / 2);
  twiddle_sin_.resize(n / 2);

  for (size_t k = 0; k < n / 2; ++k) {
    const float angle = -2.0f * M_PI * k / n;
    twiddle_cos_[k] = std::cos(angle);
    twiddle_sin_[k] = std::sin(angle);
  }
}

// Cooley-Tukey FFT 알고리즘 구현
// 시간 복잡도: O(N log N)
void AudioAnalyzer::compute_fft(std::vector<std::complex<float>>& data) {
  const size_t n = data.size();

  // 1단계: Bit-reversal 순서로 입력 재배치
  std::vector<std::complex<float>> temp(n);
  for (size_t i = 0; i < n; ++i) {
    temp[bit_reversed_[i]] = data[i];
  }
  data = std::move(temp);

  // 2단계: Butterfly 연산 수행 (log2(N) 스테이지)
  for (size_t len = 2; len <= n; len *= 2) {
    const size_t half_len = len / 2;
    const size_t angle_step = n / len;

    // 각 블록에 대해
    for (size_t i = 0; i < n; i += len) {
      // 블록 내의 각 쌍에 대해 butterfly 연산
      for (size_t j = 0; j < half_len; ++j) {
        const size_t k = i + j;
        const size_t l = i + j + half_len;

        // Twiddle factor
        const size_t twiddle_idx = j * angle_step;
        const float twiddle_real = twiddle_cos_[twiddle_idx];
        const float twiddle_imag = twiddle_sin_[twiddle_idx];

        // 복소수 곱셈: t = twiddle * data[l]
        const float out_l_real = data[l].real();
        const float out_l_imag = data[l].imag();

        const float t_real = twiddle_real * out_l_real - twiddle_imag * out_l_imag;
        const float t_imag = twiddle_real * out_l_imag + twiddle_imag * out_l_real;

        // Butterfly 연산
        const float out_k_real = data[k].real();
        const float out_k_imag = data[k].imag();

        data[k] = std::complex<float>(out_k_real + t_real, out_k_imag + t_imag);
        data[l] = std::complex<float>(out_k_real - t_real, out_k_imag - t_imag);
      }
    }
  }
}

// FFT 분석기 생성자
// fft_size: FFT 크기 (2의 거듭제곱, 예: 512, 1024, 2048)
AudioAnalyzer::AudioAnalyzer(size_t fft_size) : fft_size_(fft_size) {
  magnitude_.resize(fft_size / 2); // 주파수 스펙트럼은 FFT 크기의 절반 (대칭성)
  window_.resize(fft_size);

  // Hann 윈도우 함수 미리 계산 (스펙트럼 누설 방지)
  for (size_t i = 0; i < fft_size; ++i) {
    window_[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (fft_size - 1)));
  }

  // FFT 테이블 초기화
  init_fft_tables();
}

AudioAnalyzer::~AudioAnalyzer() = default;

// FFT 크기 변경
// size: 새로운 FFT 크기
void AudioAnalyzer::set_fft_size(size_t size) {
  if (size == fft_size_)
    return; // 같은 크기면 무시

  fft_size_ = size;
  magnitude_.resize(size / 2);
  window_.resize(size);

  // 윈도우 함수 재계산
  for (size_t i = 0; i < size; ++i) {
    window_[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (size - 1)));
  }

  // FFT 테이블 재초기화
  init_fft_tables();
}

// FFT 분석 수행
// samples: 입력 오디오 샘플 배열
// num_samples: 샘플 개수
// 반환값: 주파수 크기 스펙트럼 배열 포인터 (길이는 fft_size/2)
const float *AudioAnalyzer::analyze(const float *samples, size_t num_samples) {
  if (num_samples < fft_size_) {
    // 샘플이 부족하면 0으로 채워진 결과 반환
    std::fill(magnitude_.begin(), magnitude_.end(), 0.0f);
    return magnitude_.data();
  }

  // FFT를 위한 복소수 입력 준비
  std::vector<std::complex<float>> complex_input(fft_size_);

  // SIMD 최적화된 윈도우 함수 적용 (큰 FFT 크기에서 4배 빠름)
  apply_window_simd(samples, window_.data(), complex_input.data(), fft_size_);

  // FFT 연산 시간 측정 시작
  double fft_start = emscripten_get_now();

  // Cooley-Tukey 알고리즘을 사용하여 FFT 수행
  compute_fft(complex_input);

  // FFT 연산 시간 측정 종료
  double fft_end = emscripten_get_now();
  last_fft_time_ms_ = fft_end - fft_start;

  // SIMD 최적화된 크기 계산 (4배 빠름)
  compute_magnitude_simd(complex_input.data(), magnitude_.data(),
                         fft_size_ / 2);

  return magnitude_.data();
}

} // namespace audio
