#include "waveform_generator.h"
#include <algorithm>
#include <cmath>

namespace audio {

WaveformGenerator::WaveformGenerator()
    : last_resolution_(-1) {
}

WaveformGenerator::~WaveformGenerator() = default;

const float* WaveformGenerator::generate(
    const float* samples,
    size_t num_samples,
    int resolution,
    float time_window_ms
) {
    if (resolution != last_resolution_) {
        // Resize vertex buffer
        // Each point needs (x, y, z) * resolution points across time
        vertices_.resize(resolution * 3);
        last_resolution_ = resolution;
    }

    // Calculate how many samples to skip for desired resolution
    size_t samples_per_point = std::max(size_t(1), num_samples / resolution);

    for (int i = 0; i < resolution; ++i) {
        size_t sample_idx = i * samples_per_point;

        if (sample_idx >= num_samples) {
            // No more samples, fill with zeros
            vertices_[i * 3 + 0] = static_cast<float>(i) / resolution;  // x (normalized time)
            vertices_[i * 3 + 1] = 0.0f;                                  // y (amplitude)
            vertices_[i * 3 + 2] = 0.0f;                                  // z
        } else {
            // Average nearby samples for smoother visualization
            float sum = 0.0f;
            size_t count = 0;
            size_t window_size = std::min(size_t(64), samples_per_point);

            for (size_t j = 0; j < window_size && sample_idx + j < num_samples; ++j) {
                sum += std::abs(samples[sample_idx + j]);
                count++;
            }

            float amplitude = count > 0 ? sum / count : 0.0f;

            vertices_[i * 3 + 0] = static_cast<float>(i) / resolution;  // x
            vertices_[i * 3 + 1] = amplitude;                            // y
            vertices_[i * 3 + 2] = 0.0f;                                  // z
        }
    }

    return vertices_.data();
}

} // namespace audio
