#include <emscripten.h>
#include <cstdint>
#include <cstdio>
#include <memory>
#include "audio_decoder.h"
#include "audio_analyzer.h"
#include "waveform_generator.h"

// Global state
static std::unique_ptr<audio::AudioDecoder> g_decoder;
static std::unique_ptr<audio::AudioAnalyzer> g_analyzer;
static std::unique_ptr<audio::WaveformGenerator> g_waveform_gen;

extern "C" {

/**
 * Load audio file from memory buffer
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
 * Get waveform data for visualization
 * @param resolution Number of points to generate
 * @return Pointer to vertex data (x, y, z triplets)
 */
EMSCRIPTEN_KEEPALIVE
const float* getWaveformData(int resolution) {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return nullptr;
    }

    if (!g_waveform_gen) {
        g_waveform_gen = std::make_unique<audio::WaveformGenerator>();
    }

    const auto& samples = g_decoder->samples();
    return g_waveform_gen->generate(
        samples.data(),
        samples.size(),
        resolution,
        0.0f  // time_window_ms (unused for now)
    );
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
 * Cleanup resources
 */
EMSCRIPTEN_KEEPALIVE
void cleanup() {
    g_decoder.reset();
    g_analyzer.reset();
    g_waveform_gen.reset();
    printf("Cleaned up WASM resources\n");
}

} // extern "C"
