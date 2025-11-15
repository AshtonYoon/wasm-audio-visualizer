#include <emscripten.h>
#include <cstdint>
#include <cstdio>
#include <memory>
#include "audio_decoder.h"
#include "audio_analyzer.h"

// Global state
static std::unique_ptr<audio::AudioDecoder> g_decoder;
static std::unique_ptr<audio::AudioAnalyzer> g_analyzer;
static std::vector<float> g_batch_fft_results; // For batch FFT results

extern "C" {

/**
 * Load audio file from memory buffer (WAV format)
 * Returns 1 on success, 0 on failure
 */
EMSCRIPTEN_KEEPALIVE
int loadAudio(const uint8_t* data, size_t size) {
    if (!g_decoder) {
        g_decoder = std::make_unique<audio::AudioDecoder>();
    }

    bool success = g_decoder->load(data, size);

    if (success) {
        const auto& info = g_decoder->info();
        printf("Loaded audio: %s, %d Hz, %d channels, %lld ms\n",
               info.format.c_str(),
               info.sample_rate,
               info.channels,
               info.duration_ms);
    } else {
        printf("Failed to load audio\n");
    }

    return success ? 1 : 0;
}

/**
 * Load audio from already decoded PCM samples
 * This allows any format to be decoded by Web Audio API first
 * Returns 1 on success, 0 on failure
 */
EMSCRIPTEN_KEEPALIVE
int loadPCMData(const float* samples, int num_samples, int sample_rate, int channels) {
    if (!g_decoder) {
        g_decoder = std::make_unique<audio::AudioDecoder>();
    }

    g_decoder->loadFromPCM(samples, num_samples, sample_rate, channels);

    const auto& info = g_decoder->info();
    printf("Loaded PCM audio: %d Hz, %d channels, %lld ms\n",
           info.sample_rate,
           info.channels,
           info.duration_ms);

    return 1;
}

/**
 * Get FFT spectrum data
 * @param fft_size FFT size (must be power of 2)
 * @return Pointer to magnitude spectrum
 */
EMSCRIPTEN_KEEPALIVE
const float* getFFTData(int fft_size) {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return nullptr;
    }

    if (!g_analyzer) {
        g_analyzer = std::make_unique<audio::AudioAnalyzer>(fft_size);
    } else {
        g_analyzer->set_fft_size(fft_size);
    }

    const auto& samples = g_decoder->samples();
    if (samples.size() < static_cast<size_t>(fft_size)) {
        return nullptr;
    }

    return g_analyzer->analyze(samples.data(), samples.size());
}

/**
 * Get FFT spectrum data at specific sample offset (for realtime playback)
 * @param sample_offset Sample offset to start FFT from
 * @param fft_size FFT size (must be power of 2)
 * @return Pointer to magnitude spectrum
 */
EMSCRIPTEN_KEEPALIVE
const float* getFFTDataAtOffset(int sample_offset, int fft_size) {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return nullptr;
    }

    if (!g_analyzer) {
        g_analyzer = std::make_unique<audio::AudioAnalyzer>(fft_size);
    } else {
        g_analyzer->set_fft_size(fft_size);
    }

    const auto& samples = g_decoder->samples();

    // Check bounds
    if (sample_offset < 0 || sample_offset >= static_cast<int>(samples.size())) {
        return nullptr;
    }

    size_t samples_available = samples.size() - sample_offset;
    if (samples_available < static_cast<size_t>(fft_size)) {
        return nullptr;
    }

    return g_analyzer->analyze(samples.data() + sample_offset, samples_available);
}

/**
 * Get number of audio samples
 */
EMSCRIPTEN_KEEPALIVE
int getSampleCount() {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return 0;
    }
    return static_cast<int>(g_decoder->samples().size());
}

/**
 * Get sample rate
 */
EMSCRIPTEN_KEEPALIVE
int getSampleRate() {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return 0;
    }
    return g_decoder->info().sample_rate;
}

/**
 * Get number of channels
 */
EMSCRIPTEN_KEEPALIVE
int getChannels() {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return 0;
    }
    return g_decoder->info().channels;
}

/**
 * Get batch FFT spectrum data (multiple frames at once for reduced overhead)
 * @param start_offset Starting sample offset
 * @param num_frames Number of FFT frames to compute
 * @param hop_size Samples to skip between frames
 * @param fft_size FFT size (must be power of 2)
 * @return Pointer to batch results (num_frames * fft_size/2 floats)
 */
EMSCRIPTEN_KEEPALIVE
const float* getBatchFFTData(int start_offset, int num_frames, int hop_size, int fft_size) {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return nullptr;
    }

    if (num_frames <= 0 || hop_size <= 0 || fft_size <= 0) {
        return nullptr;
    }

    if (!g_analyzer) {
        g_analyzer = std::make_unique<audio::AudioAnalyzer>(fft_size);
    } else {
        g_analyzer->set_fft_size(fft_size);
    }

    const auto& samples = g_decoder->samples();
    const int num_bins = fft_size / 2;

    // Resize result buffer
    g_batch_fft_results.resize(num_frames * num_bins);

    // Compute FFT for each frame
    for (int frame = 0; frame < num_frames; ++frame) {
        int sample_offset = start_offset + (frame * hop_size);

        // Check bounds
        if (sample_offset < 0 || sample_offset >= static_cast<int>(samples.size())) {
            // Fill with zeros for out-of-bounds frames
            for (int i = 0; i < num_bins; ++i) {
                g_batch_fft_results[frame * num_bins + i] = 0.0f;
            }
            continue;
        }

        size_t samples_available = samples.size() - sample_offset;
        if (samples_available < static_cast<size_t>(fft_size)) {
            // Not enough samples, fill with zeros
            for (int i = 0; i < num_bins; ++i) {
                g_batch_fft_results[frame * num_bins + i] = 0.0f;
            }
            continue;
        }

        // Compute FFT
        const float* fft_result = g_analyzer->analyze(samples.data() + sample_offset, samples_available);

        // Copy results
        for (int i = 0; i < num_bins; ++i) {
            g_batch_fft_results[frame * num_bins + i] = fft_result[i];
        }
    }

    return g_batch_fft_results.data();
}

/**
 * Get the size of batch FFT results (for memory allocation check)
 * @param num_frames Number of frames
 * @param fft_size FFT size
 * @return Number of floats in result
 */
EMSCRIPTEN_KEEPALIVE
int getBatchFFTResultSize(int num_frames, int fft_size) {
    return num_frames * (fft_size / 2);
}

/**
 * Cleanup resources
 */
EMSCRIPTEN_KEEPALIVE
void cleanup() {
    g_decoder.reset();
    g_analyzer.reset();
    g_batch_fft_results.clear();
    printf("Cleaned up WASM resources\n");
}

} // extern "C"
