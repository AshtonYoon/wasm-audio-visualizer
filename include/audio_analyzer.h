#pragma once

#include <vector>
#include <cstdint>
#include <memory>

namespace audio {

/**
 * FFT-based audio analyzer using dj_fft
 */
class AudioAnalyzer {
public:
    explicit AudioAnalyzer(size_t fft_size = 2048);
    ~AudioAnalyzer();

    // Analyze audio samples and return frequency spectrum
    // Returns pointer to internal buffer, valid until next analyze() call
    const float* analyze(const float* samples, size_t num_samples);

    // Get FFT size
    size_t fft_size() const { return fft_size_; }

    // Get number of frequency bins
    size_t num_bins() const { return fft_size_ / 2; }

    // Set FFT size (reinitializes internal buffers)
    void set_fft_size(size_t size);

    // Get last FFT computation time in milliseconds
    double get_last_fft_time_ms() const { return last_fft_time_ms_; }

private:
    size_t fft_size_;
    std::vector<float> magnitude_;
    std::vector<float> window_;
    double last_fft_time_ms_ = 0.0;
};

} // namespace audio
