#include <emscripten.h>
#include <cstdint>
#include <cstdio>
#include <memory>
#include "audio_decoder.h"
#include "audio_analyzer.h"

// 전역 상태 (디코더와 분석기 인스턴스)
static std::unique_ptr<audio::AudioDecoder> g_decoder;
static std::unique_ptr<audio::AudioAnalyzer> g_analyzer;

extern "C" {

/**
 * WAV 오디오 파일을 메모리 버퍼에서 로드
 * data: WAV 파일 데이터 포인터
 * size: 파일 크기 (바이트)
 * 반환값: 성공 시 1, 실패 시 0
 */
EMSCRIPTEN_KEEPALIVE
int loadAudio(const uint8_t* data, size_t size) {
    if (!g_decoder) {
        g_decoder = std::make_unique<audio::AudioDecoder>();
    }

    bool success = g_decoder->load(data, size);

    if (success) {
        const auto& info = g_decoder->info();
        printf("오디오 로드 완료: %s, %d Hz, %d channels, %lld ms\n",
               info.format.c_str(),
               info.sample_rate,
               info.channels,
               info.duration_ms);
    } else {
        printf("오디오 로드 실패\n");
    }

    return success ? 1 : 0;
}


/**
 * 특정 샘플 오프셋에서 FFT 스펙트럼 데이터 가져오기 (실시간 재생용)
 * sample_offset: FFT를 시작할 샘플 위치
 * fft_size: FFT 크기 (2의 거듭제곱이어야 함)
 * 반환값: 주파수 크기 스펙트럼 배열 포인터 (길이는 fft_size/2)
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

    // 범위 검사
    if (sample_offset < 0 || sample_offset >= static_cast<int>(samples.size())) {
        return nullptr;
    }

    size_t samples_available = samples.size() - sample_offset;
    if (samples_available < static_cast<size_t>(fft_size)) {
        return nullptr;  // FFT에 필요한 샘플이 부족
    }

    return g_analyzer->analyze(samples.data() + sample_offset, samples_available);
}

/**
 * 총 오디오 샘플 개수 반환
 * 반환값: 샘플 개수
 */
EMSCRIPTEN_KEEPALIVE
int getSampleCount() {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return 0;
    }
    return static_cast<int>(g_decoder->samples().size());
}

/**
 * 샘플 레이트 반환
 * 반환값: 샘플 레이트 (Hz)
 */
EMSCRIPTEN_KEEPALIVE
int getSampleRate() {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return 0;
    }
    return g_decoder->info().sample_rate;
}

/**
 * 채널 수 반환
 * 반환값: 채널 수 (1 = 모노, 2 = 스테레오)
 */
EMSCRIPTEN_KEEPALIVE
int getChannels() {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return 0;
    }
    return g_decoder->info().channels;
}

/**
 * 디코딩된 PCM 샘플 데이터 포인터 반환
 * Web Audio API AudioBuffer 생성을 위해 사용
 * 반환값: float 샘플 배열 포인터 (크기는 getSampleCount()로 확인)
 */
EMSCRIPTEN_KEEPALIVE
const float* getSamples() {
    if (!g_decoder || !g_decoder->is_loaded()) {
        return nullptr;
    }
    const auto& samples = g_decoder->samples();
    if (samples.empty()) {
        return nullptr;
    }
    return samples.data();
}

} // extern "C"
