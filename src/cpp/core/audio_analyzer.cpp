#include "audio_analyzer.h"
#include <cmath>
#include <algorithm>
#include <complex>

// Include dj_fft header-only library (CPU version only, no GPU support)
#include "dj_fft.h"

namespace audio {

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
    for (size_t i = 0; i < fft_size_; ++i) {
        complex_input[i] = std::complex<float>(samples[i] * window_[i], 0.0f);
    }

    // Perform FFT using dj::fft1d
    auto complex_output = dj::fft1d(complex_input, dj::fft_dir::DIR_FWD);

    // Compute magnitude spectrum (only first half, as second half is symmetric)
    for (size_t i = 0; i < fft_size_ / 2; ++i) {
        float real = complex_output[i].real();
        float imag = complex_output[i].imag();
        magnitude_[i] = std::sqrt(real * real + imag * imag);
    }

    return magnitude_.data();
}


} // namespace audio
