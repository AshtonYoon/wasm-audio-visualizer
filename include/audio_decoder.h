#pragma once

#include <vector>
#include <cstdint>
#include <memory>
#include <string>

namespace audio {

struct AudioInfo {
    int sample_rate = 0;
    int channels = 0;
    int64_t duration_ms = 0;
    std::string format;
};

/**
 * Audio decoder supporting multiple formats via FFmpeg
 * For initial version, we'll implement a simple WAV decoder
 * FFmpeg integration will be added later
 */
class AudioDecoder {
public:
    AudioDecoder();
    ~AudioDecoder();

    // Load audio from memory buffer
    bool load(const uint8_t* data, size_t size);

    // Get audio info
    const AudioInfo& info() const { return info_; }

    // Decode all samples (for now, we'll keep it simple)
    // Returns interleaved float samples [-1.0, 1.0]
    const std::vector<float>& samples() const { return samples_; }

    // Check if audio is loaded
    bool is_loaded() const { return loaded_; }

private:
    bool decode_wav(const uint8_t* data, size_t size);

    AudioInfo info_;
    std::vector<float> samples_;
    bool loaded_;
};

} // namespace audio
