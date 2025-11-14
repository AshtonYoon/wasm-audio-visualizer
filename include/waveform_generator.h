#pragma once

#include <vector>
#include <cstdint>

namespace audio {

/**
 * Generates 3D waveform surface data from audio samples
 */
class WaveformGenerator {
public:
    WaveformGenerator();
    ~WaveformGenerator();

    /**
     * Generate waveform vertices for 3D surface
     * @param samples Audio samples (interleaved stereo)
     * @param num_samples Number of samples
     * @param resolution Number of points along time axis
     * @param time_window_ms Time window in milliseconds
     * @return Pointer to vertex data (x, y, z triplets)
     */
    const float* generate(
        const float* samples,
        size_t num_samples,
        int resolution,
        float time_window_ms
    );

    // Get number of vertices generated
    size_t num_vertices() const { return vertices_.size() / 3; }

    // Get vertex data size in bytes
    size_t data_size() const { return vertices_.size() * sizeof(float); }

private:
    std::vector<float> vertices_;
    int last_resolution_;
};

} // namespace audio
