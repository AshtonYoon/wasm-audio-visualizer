#include "audio_decoder.h"
#include <cstring>
#include <algorithm>
#include <cstdio>

namespace audio {

// WAV 파일 헤더 구조체 (메모리 패킹으로 정확한 바이트 정렬 보장)
#pragma pack(push, 1)
struct WAVHeader {
    char riff[4];           // "RIFF" 식별자
    uint32_t file_size;     // 파일 크기
    char wave[4];           // "WAVE" 식별자
    char fmt[4];            // "fmt " 청크 식별자
    uint32_t fmt_size;      // fmt 청크 크기
    uint16_t audio_format;  // 오디오 포맷 (1 = PCM)
    uint16_t num_channels;  // 채널 수 (1 = 모노, 2 = 스테레오)
    uint32_t sample_rate;   // 샘플 레이트 (Hz)
    uint32_t byte_rate;     // 바이트 레이트 (초당 바이트)
    uint16_t block_align;   // 블록 정렬
    uint16_t bits_per_sample; // 비트 깊이 (8, 16, 24, 32)
};

struct WAVDataHeader {
    char data[4];           // "data" 청크 식별자
    uint32_t data_size;     // 데이터 크기 (바이트)
};
#pragma pack(pop)

AudioDecoder::AudioDecoder()
    : loaded_(false) {
}

AudioDecoder::~AudioDecoder() = default;

// 오디오 파일 로드 (현재는 WAV만 지원, 추후 FFmpeg 통합 예정)
// data: 파일 데이터 포인터
// size: 파일 크기 (바이트)
// 반환값: 성공 시 true, 실패 시 false
bool AudioDecoder::load(const uint8_t* data, size_t size) {
    loaded_ = false;
    samples_.clear();

    // 현재는 WAV만 지원 (추후 FFmpeg 통합으로 MP3, OGG 등 지원 예정)
    return decode_wav(data, size);
}

// PCM 데이터에서 직접 로드 (Web Audio API에서 디코딩된 데이터 사용)
// samples: PCM 샘플 배열 포인터
// num_samples: 샘플 개수
// sample_rate: 샘플 레이트 (Hz)
// channels: 채널 수
void AudioDecoder::loadFromPCM(const float* samples, size_t num_samples,
                                int sample_rate, int channels) {
    // 기존 데이터 초기화
    samples_.clear();

    // 오디오 정보 설정
    info_.sample_rate = sample_rate;
    info_.channels = channels;
    info_.duration_ms = (num_samples * 1000) / (sample_rate * channels);
    info_.format = "PCM";

    // 샘플 복사
    samples_.assign(samples, samples + num_samples);

    loaded_ = true;
}

// WAV 파일 디코딩 (내부 함수)
// data: WAV 파일 데이터 포인터
// size: 파일 크기 (바이트)
// 반환값: 성공 시 true, 실패 시 false
bool AudioDecoder::decode_wav(const uint8_t* data, size_t size) {
    // 최소 헤더 크기 체크
    if (size < sizeof(WAVHeader)) {
        return false;
    }

    const WAVHeader* header = reinterpret_cast<const WAVHeader*>(data);

    // RIFF/WAVE 헤더 검증
    if (std::memcmp(header->riff, "RIFF", 4) != 0 ||
        std::memcmp(header->wave, "WAVE", 4) != 0) {
        return false;  // WAV 파일이 아님
    }

    // "data" 청크 찾기
    size_t offset = sizeof(WAVHeader);
    const WAVDataHeader* data_header = nullptr;

    while (offset + sizeof(WAVDataHeader) <= size) {
        const WAVDataHeader* chunk = reinterpret_cast<const WAVDataHeader*>(data + offset);

        if (std::memcmp(chunk->data, "data", 4) == 0) {
            data_header = chunk;
            offset += sizeof(WAVDataHeader);
            break;
        }

        // 다음 청크로 건너뛰기 (청크 ID + 크기 + 데이터)
        offset += 8;
        if (offset < size) {
            uint32_t chunk_size = *reinterpret_cast<const uint32_t*>(data + offset - 4);
            offset += chunk_size;
        }
    }

    if (!data_header) {
        return false;  // data 청크를 찾지 못함
    }

    // 오디오 정보 설정
    info_.sample_rate = header->sample_rate;
    info_.channels = header->num_channels;
    info_.format = "WAV";

    size_t num_samples = data_header->data_size / (header->bits_per_sample / 8);
    info_.duration_ms = (num_samples * 1000) / (header->sample_rate * header->num_channels);

    // 샘플을 float [-1.0, 1.0] 범위로 변환
    const uint8_t* sample_data = data + offset;
    samples_.reserve(num_samples);

    if (header->bits_per_sample == 16) {
        // 16-bit PCM → float 변환
        const int16_t* samples_i16 = reinterpret_cast<const int16_t*>(sample_data);
        for (size_t i = 0; i < num_samples; ++i) {
            samples_.push_back(samples_i16[i] / 32768.0f);  // [-32768, 32767] → [-1.0, 1.0]
        }
    } else if (header->bits_per_sample == 8) {
        // 8-bit PCM → float 변환
        for (size_t i = 0; i < num_samples; ++i) {
            samples_.push_back((sample_data[i] - 128) / 128.0f);  // [0, 255] → [-1.0, 1.0]
        }
    } else {
        return false;  // 지원하지 않는 비트 깊이 (24-bit, 32-bit 등)
    }

    loaded_ = true;
    return true;
}

} // namespace audio
