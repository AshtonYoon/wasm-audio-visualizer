#include "audio_decoder.h"
#include <algorithm>
#include <cstdio>
#include <cstring>

namespace audio {

// WAV 파일 헤더 구조체 (메모리 패킹으로 정확한 바이트 정렬 보장)
#pragma pack(push, 1)
struct RIFFHeader {
  char riff[4];       // "RIFF" 식별자
  uint32_t file_size; // 파일 크기
  char wave[4];       // "WAVE" 식별자
};

struct ChunkHeader {
  char id[4];    // 청크 ID
  uint32_t size; // 청크 크기
};

struct WAVFmt {
  uint16_t audio_format;    // 오디오 포맷 (1 = PCM)
  uint16_t num_channels;    // 채널 수 (1 = 모노, 2 = 스테레오)
  uint32_t sample_rate;     // 샘플 레이트 (Hz)
  uint32_t byte_rate;       // 바이트 레이트 (초당 바이트)
  uint16_t block_align;     // 블록 정렬
  uint16_t bits_per_sample; // 비트 깊이 (8, 16, 24, 32)
};
#pragma pack(pop)

AudioDecoder::AudioDecoder() : loaded_(false) {}

AudioDecoder::~AudioDecoder() = default;

// 오디오 파일 로드 (현재는 WAV만 지원, 추후 FFmpeg 통합 예정)
// data: 파일 데이터 포인터
// size: 파일 크기 (바이트)
// 반환값: 성공 시 true, 실패 시 false
bool AudioDecoder::load(const uint8_t *data, size_t size) {
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
void AudioDecoder::loadFromPCM(const float *samples, size_t num_samples,
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
bool AudioDecoder::decode_wav(const uint8_t *data, size_t size) {
  printf("WAV 디코딩 시작: 파일 크기 = %zu bytes\n", size);

  // RIFF 헤더 체크
  if (size < sizeof(RIFFHeader)) {
    printf("에러: 파일이 너무 작음\n");
    return false;
  }

  const RIFFHeader *riff = reinterpret_cast<const RIFFHeader *>(data);

  // RIFF/WAVE 헤더 검증
  if (std::memcmp(riff->riff, "RIFF", 4) != 0 ||
      std::memcmp(riff->wave, "WAVE", 4) != 0) {
    printf("에러: WAV 파일이 아님 (RIFF/WAVE 헤더 없음)\n");
    return false;
  }

  printf("RIFF/WAVE 헤더 확인됨\n");

  // 청크들을 순회하며 fmt와 data 청크 찾기
  size_t offset = sizeof(RIFFHeader);
  const WAVFmt *fmt_data = nullptr;
  const uint8_t *sample_data = nullptr;
  uint32_t data_size = 0;
  uint16_t bits_per_sample = 0;

  while (offset + sizeof(ChunkHeader) <= size) {
    const ChunkHeader *chunk =
        reinterpret_cast<const ChunkHeader *>(data + offset);
    const uint32_t chunk_size = chunk->size;

    printf("청크 발견: %.4s, 크기 = %u bytes\n", chunk->id, chunk_size);

    if (std::memcmp(chunk->id, "fmt ", 4) == 0) {
      // fmt 청크 처리
      if (chunk_size < sizeof(WAVFmt)) {
        printf("에러: fmt 청크가 너무 작음\n");
        return false;
      }
      fmt_data =
          reinterpret_cast<const WAVFmt *>(data + offset + sizeof(ChunkHeader));
      printf("fmt 청크: %d Hz, %d 채널, %d bits\n", fmt_data->sample_rate,
             fmt_data->num_channels, fmt_data->bits_per_sample);

      bits_per_sample = fmt_data->bits_per_sample;
    } else if (std::memcmp(chunk->id, "data", 4) == 0) {
      // data 청크 처리
      sample_data = data + offset + sizeof(ChunkHeader);
      data_size = chunk_size;
      printf("data 청크 찾음: 크기 = %u bytes\n", data_size);
    }

    // 다음 청크로 이동 (청크 헤더 + 청크 데이터)
    offset += sizeof(ChunkHeader) + chunk_size;

    // 홀수 크기 청크는 패딩 바이트가 있음
    if (chunk_size % 2 != 0) {
      offset++;
    }
  }

  if (!fmt_data) {
    printf("에러: fmt 청크를 찾지 못함\n");
    return false;
  }

  if (!sample_data) {
    printf("에러: data 청크를 찾지 못함\n");
    return false;
  }

  // 오디오 정보 설정
  info_.sample_rate = fmt_data->sample_rate;
  info_.channels = fmt_data->num_channels;
  info_.format = "WAV";

  size_t num_samples = data_size / (bits_per_sample / 8);
  info_.duration_ms =
      (num_samples * 1000) / (fmt_data->sample_rate * fmt_data->num_channels);

  printf("샘플 개수: %zu, 재생 시간: %lld ms\n", num_samples,
         info_.duration_ms);
  printf("메모리 할당 시도: %zu bytes (샘플 %zu개 × 4 bytes)\n",
         num_samples * sizeof(float), num_samples);

  try {
    samples_.reserve(num_samples);
    printf("메모리 할당 성공\n");
  } catch (const std::exception &e) {
    printf("에러: 메모리 할당 실패 - %s\n", e.what());
    return false;
  }

  if (bits_per_sample == 16) {
    // 16-bit PCM → float 변환
    const int16_t *samples_i16 = reinterpret_cast<const int16_t *>(sample_data);
    for (size_t i = 0; i < num_samples; ++i) {
      samples_.push_back(samples_i16[i] /
                         32768.0f); // [-32768, 32767] → [-1.0, 1.0]
    }
  } else if (bits_per_sample == 8) {
    // 8-bit PCM → float 변환
    for (size_t i = 0; i < num_samples; ++i) {
      samples_.push_back((sample_data[i] - 128) /
                         128.0f); // [0, 255] → [-1.0, 1.0]
    }
  } else {
    printf("에러: 지원하지 않는 비트 깊이 (%d-bit)\n", bits_per_sample);
    return false;
  }

  printf("✓ WAV 디코딩 완료: %zu 샘플\n", samples_.size());
  loaded_ = true;
  return true;
}

} // namespace audio
