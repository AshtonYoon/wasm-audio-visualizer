#include "audio_analyzer.h"
#include <cmath>
#include <algorithm>
#include <complex>

// Include dj_fft header-only library (CPU version only, no GPU support)
#include "dj_fft.h"

// WebAssembly SIMD support
#ifdef __wasm_simd128__
#include <wasm_simd128.h>
#define SIMD_ENABLED 1
#else
#define SIMD_ENABLED 0
#endif

namespace audio {

#if SIMD_ENABLED
// SIMD-optimized windowing: multiply samples by window function (4 floats at a time)
inline void apply_window_simd(const float* samples, const float* window,
                              std::complex<float>* output, size_t size) {
    size_t i = 0;

    // Process 4 elements at a time with SIMD
    for (; i + 4 <= size; i += 4) {
        v128_t samples_vec = wasm_v128_load(&samples[i]);
        v128_t window_vec = wasm_v128_load(&window[i]);
        v128_t result = wasm_f32x4_mul(samples_vec, window_vec);

        // Store results as complex numbers (real part only, imag = 0)
        float temp[4];
        wasm_v128_store(temp, result);
        for (int j = 0; j < 4; ++j) {
            output[i + j] = std::complex<float>(temp[j], 0.0f);
        }
    }

    // Handle remaining elements (scalar fallback)
    for (; i < size; ++i) {
        output[i] = std::complex<float>(samples[i] * window[i], 0.0f);
    }
}

// SIMD-optimized magnitude calculation: sqrt(real^2 + imag^2) for 4 complex numbers
inline void compute_magnitude_simd(const std::complex<float>* complex_data,
                                   float* magnitude, size_t size) {
    size_t i = 0;

    // Process 4 elements at a time with SIMD
    for (; i + 4 <= size; i += 4) {
        // Load real and imaginary parts
        alignas(16) float real[4], imag[4];
        for (int j = 0; j < 4; ++j) {
            real[j] = complex_data[i + j].real();
            imag[j] = complex_data[i + j].imag();
        }

        v128_t real_vec = wasm_v128_load(real);
        v128_t imag_vec = wasm_v128_load(imag);

        // Calculate real^2 and imag^2
        v128_t real_sq = wasm_f32x4_mul(real_vec, real_vec);
        v128_t imag_sq = wasm_f32x4_mul(imag_vec, imag_vec);

        // Add real^2 + imag^2
        v128_t sum = wasm_f32x4_add(real_sq, imag_sq);

        // Compute sqrt
        v128_t result = wasm_f32x4_sqrt(sum);

        // Store results
        wasm_v128_store(&magnitude[i], result);
    }

    // Handle remaining elements (scalar fallback)
    for (; i < size; ++i) {
        float real = complex_data[i].real();
        float imag = complex_data[i].imag();
        magnitude[i] = std::sqrt(real * real + imag * imag);
    }
}
#endif

AudioAnalyzer::AudioAnalyzer(size_t fft_size)
    : fft_size_(fft_size) {
    magnitude_.resize(fft_size / 2);
    window_.resize(fft_size);

    // Precompute Hann window
    for (size_t i = 0; i < fft_size; ++i) {
        window_[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (fft_size - 1)));
    }
}

AudioAnalyzer::~AudioAnalyzer() = default;

void AudioAnalyzer::set_fft_size(size_t size) {
    if (size == fft_size_) return;

    fft_size_ = size;
    magnitude_.resize(size / 2);
    window_.resize(size);

    // Recompute window
    for (size_t i = 0; i < size; ++i) {
        window_[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (size - 1)));
    }
}

const float* AudioAnalyzer::analyze(const float* samples, size_t num_samples) {
    if (num_samples < fft_size_) {
        // Not enough samples, return zeros
        std::fill(magnitude_.begin(), magnitude_.end(), 0.0f);
        return magnitude_.data();
    }

    // Prepare complex input for dj::fft1d
    std::vector<std::complex<float>> complex_input(fft_size_);

#if SIMD_ENABLED
    // Use SIMD-optimized windowing (4x faster for large FFT sizes)
    apply_window_simd(samples, window_.data(), complex_input.data(), fft_size_);
#else
    // Scalar fallback
    for (size_t i = 0; i < fft_size_; ++i) {
        complex_input[i] = std::complex<float>(samples[i] * window_[i], 0.0f);
    }
#endif

    // Perform FFT using dj::fft1d
    auto complex_output = dj::fft1d(complex_input, dj::fft_dir::DIR_FWD);

#if SIMD_ENABLED
    // Use SIMD-optimized magnitude calculation (4x faster)
    compute_magnitude_simd(complex_output.data(), magnitude_.data(), fft_size_ / 2);
#else
    // Scalar fallback: Compute magnitude spectrum (only first half, as second half is symmetric)
    for (size_t i = 0; i < fft_size_ / 2; ++i) {
        float real = complex_output[i].real();
        float imag = complex_output[i].imag();
        magnitude_[i] = std::sqrt(real * real + imag * imag);
    }
#endif

    return magnitude_.data();
}


} // namespace audio
