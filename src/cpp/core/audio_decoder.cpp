#include "audio_decoder.h"
#include <cstring>
#include <algorithm>
#include <cstdio>

namespace audio {

// Simple WAV header structure
#pragma pack(push, 1)
struct WAVHeader {
    char riff[4];           // "RIFF"
    uint32_t file_size;
    char wave[4];           // "WAVE"
    char fmt[4];            // "fmt "
    uint32_t fmt_size;
    uint16_t audio_format;
    uint16_t num_channels;
    uint32_t sample_rate;
    uint32_t byte_rate;
    uint16_t block_align;
    uint16_t bits_per_sample;
};

struct WAVDataHeader {
    char data[4];           // "data"
    uint32_t data_size;
};
#pragma pack(pop)

AudioDecoder::AudioDecoder()
    : loaded_(false) {
}

AudioDecoder::~AudioDecoder() = default;

bool AudioDecoder::load(const uint8_t* data, size_t size) {
    loaded_ = false;
    samples_.clear();

    // For now, only support WAV
    // FFmpeg integration will be added later
    return decode_wav(data, size);
}

void AudioDecoder::loadFromPCM(const float* samples, size_t num_samples,
                                int sample_rate, int channels) {
    // Clear existing data
    samples_.clear();

    // Set audio info
    info_.sample_rate = sample_rate;
    info_.channels = channels;
    info_.duration_ms = (num_samples * 1000) / (sample_rate * channels);
    info_.format = "PCM";

    // Copy samples
    samples_.assign(samples, samples + num_samples);

    loaded_ = true;
}

bool AudioDecoder::decode_wav(const uint8_t* data, size_t size) {
    if (size < sizeof(WAVHeader)) {
        return false;
    }

    const WAVHeader* header = reinterpret_cast<const WAVHeader*>(data);

    // Verify RIFF/WAVE
    if (std::memcmp(header->riff, "RIFF", 4) != 0 ||
        std::memcmp(header->wave, "WAVE", 4) != 0) {
        return false;
    }

    // Find data chunk
    size_t offset = sizeof(WAVHeader);
    const WAVDataHeader* data_header = nullptr;

    while (offset + sizeof(WAVDataHeader) <= size) {
        const WAVDataHeader* chunk = reinterpret_cast<const WAVDataHeader*>(data + offset);

        if (std::memcmp(chunk->data, "data", 4) == 0) {
            data_header = chunk;
            offset += sizeof(WAVDataHeader);
            break;
        }

        // Skip to next chunk (chunk ID + size + data)
        offset += 8;
        if (offset < size) {
            uint32_t chunk_size = *reinterpret_cast<const uint32_t*>(data + offset - 4);
            offset += chunk_size;
        }
    }

    if (!data_header) {
        return false;
    }

    // Fill audio info
    info_.sample_rate = header->sample_rate;
    info_.channels = header->num_channels;
    info_.format = "WAV";

    size_t num_samples = data_header->data_size / (header->bits_per_sample / 8);
    info_.duration_ms = (num_samples * 1000) / (header->sample_rate * header->num_channels);

    // Convert samples to float [-1.0, 1.0]
    const uint8_t* sample_data = data + offset;
    samples_.reserve(num_samples);

    if (header->bits_per_sample == 16) {
        const int16_t* samples_i16 = reinterpret_cast<const int16_t*>(sample_data);
        for (size_t i = 0; i < num_samples; ++i) {
            samples_.push_back(samples_i16[i] / 32768.0f);
        }
    } else if (header->bits_per_sample == 8) {
        for (size_t i = 0; i < num_samples; ++i) {
            samples_.push_back((sample_data[i] - 128) / 128.0f);
        }
    } else {
        return false;  // Unsupported bit depth
    }

    loaded_ = true;
    return true;
}

} // namespace audio
