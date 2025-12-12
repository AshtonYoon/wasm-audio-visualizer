#include "audio_analyzer.h"
#include <cmath>
#include <algorithm>
#include <complex>
#include <wasm_simd128.h>

// dj_fft 헤더 전용 라이브러리 포함 (CPU 버전만 지원, GPU 미지원)
#include "dj_fft.h"

namespace audio {

// SIMD 최적화된 윈도우 함수 적용 (4개 float를 동시에 처리)
// samples: 입력 샘플 배열
// window: 윈도우 함수 배열 (Hann, Hamming 등)
// output: 출력 복소수 배열
// size: 배열 크기
inline void apply_window_simd(const float* samples, const float* window,
                              std::complex<float>* output, size_t size) {
    size_t i = 0;

    // SIMD로 4개 요소씩 처리 (4배 빠름)
    for (; i + 4 <= size; i += 4) {
        v128_t samples_vec = wasm_v128_load(&samples[i]);  // 4개 샘플 로드
        v128_t window_vec = wasm_v128_load(&window[i]);    // 4개 윈도우 값 로드
        v128_t result = wasm_f32x4_mul(samples_vec, window_vec);  // 4개 동시 곱셈

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
inline void compute_magnitude_simd(const std::complex<float>* complex_data,
                                   float* magnitude, size_t size) {
    size_t i = 0;

    // SIMD로 4개 요소씩 처리 (4배 빠름)
    for (; i + 4 <= size; i += 4) {
        // 실수부와 허수부 분리
        alignas(16) float real[4], imag[4];
        for (int j = 0; j < 4; ++j) {
            real[j] = complex_data[i + j].real();
            imag[j] = complex_data[i + j].imag();
        }

        v128_t real_vec = wasm_v128_load(real);  // 4개 실수부 로드
        v128_t imag_vec = wasm_v128_load(imag);  // 4개 허수부 로드

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

// FFT 분석기 생성자
// fft_size: FFT 크기 (2의 거듭제곱, 예: 512, 1024, 2048)
AudioAnalyzer::AudioAnalyzer(size_t fft_size)
    : fft_size_(fft_size) {
    magnitude_.resize(fft_size / 2);  // 주파수 스펙트럼은 FFT 크기의 절반 (대칭성)
    window_.resize(fft_size);

    // Hann 윈도우 함수 미리 계산 (스펙트럼 누설 방지)
    for (size_t i = 0; i < fft_size; ++i) {
        window_[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (fft_size - 1)));
    }
}

AudioAnalyzer::~AudioAnalyzer() = default;

// FFT 크기 변경
// size: 새로운 FFT 크기
void AudioAnalyzer::set_fft_size(size_t size) {
    if (size == fft_size_) return;  // 같은 크기면 무시

    fft_size_ = size;
    magnitude_.resize(size / 2);
    window_.resize(size);

    // 윈도우 함수 재계산
    for (size_t i = 0; i < size; ++i) {
        window_[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (size - 1)));
    }
}

// FFT 분석 수행
// samples: 입력 오디오 샘플 배열
// num_samples: 샘플 개수
// 반환값: 주파수 크기 스펙트럼 배열 포인터 (길이는 fft_size/2)
const float* AudioAnalyzer::analyze(const float* samples, size_t num_samples) {
    if (num_samples < fft_size_) {
        // 샘플이 부족하면 0으로 채워진 결과 반환
        std::fill(magnitude_.begin(), magnitude_.end(), 0.0f);
        return magnitude_.data();
    }

    // dj::fft1d를 위한 복소수 입력 준비
    std::vector<std::complex<float>> complex_input(fft_size_);

    // SIMD 최적화된 윈도우 함수 적용 (큰 FFT 크기에서 4배 빠름)
    apply_window_simd(samples, window_.data(), complex_input.data(), fft_size_);

    // dj::fft1d를 사용하여 FFT 수행 (dj_fft 라이브러리의 SIMD 최적화 활용)
    auto complex_output = dj::fft1d(complex_input, dj::fft_dir::DIR_FWD);

    // SIMD 최적화된 크기 계산 (4배 빠름)
    compute_magnitude_simd(complex_output.data(), magnitude_.data(), fft_size_ / 2);

    return magnitude_.data();
}


} // namespace audio
