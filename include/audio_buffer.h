#pragma once

#include <vector>
#include <cstdint>
#include <mutex>

namespace audio {

/**
 * Thread-safe circular audio buffer
 */
class AudioBuffer {
public:
    explicit AudioBuffer(size_t capacity = 1024 * 1024);
    ~AudioBuffer();

    // Write samples to buffer
    size_t write(const float* data, size_t num_samples);

    // Read samples from buffer
    size_t read(float* data, size_t num_samples);

    // Get current fill level
    size_t available() const;

    // Clear buffer
    void clear();

    // Get capacity
    size_t capacity() const { return capacity_; }

private:
    std::vector<float> buffer_;
    size_t capacity_;
    size_t read_pos_;
    size_t write_pos_;
    size_t available_;
    mutable std::mutex mutex_;
};

} // namespace audio
