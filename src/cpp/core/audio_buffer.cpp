#include "audio_buffer.h"
#include <algorithm>
#include <cstring>

namespace audio {

// 순환 버퍼 생성자
// capacity: 버퍼 크기 (샘플 개수)
AudioBuffer::AudioBuffer(size_t capacity)
    : capacity_(capacity)
    , read_pos_(0)      // 읽기 위치 초기화
    , write_pos_(0)     // 쓰기 위치 초기화
    , available_(0) {   // 사용 가능한 샘플 수 초기화
    buffer_.resize(capacity);  // 버퍼 메모리 할당
}

AudioBuffer::~AudioBuffer() = default;

// 버퍼에 데이터 쓰기 (오디오 샘플 저장)
// data: 쓸 데이터 포인터
// num_samples: 쓸 샘플 개수
// 반환값: 실제로 쓴 샘플 개수
size_t AudioBuffer::write(const float* data, size_t num_samples) {
    std::lock_guard<std::mutex> lock(mutex_);  // Thread-safe 보장

    // 남은 공간 계산
    size_t space = capacity_ - available_;
    size_t to_write = std::min(num_samples, space);  // 쓸 수 있는 만큼만

    // 순환 버퍼에 데이터 쓰기
    for (size_t i = 0; i < to_write; ++i) {
        buffer_[write_pos_] = data[i];
        write_pos_ = (write_pos_ + 1) % capacity_;  // 원형으로 순환
    }

    available_ += to_write;  // 사용 가능한 샘플 수 증가
    return to_write;
}

// 버퍼에서 데이터 읽기 (오디오 샘플 가져오기)
// data: 읽은 데이터를 저장할 포인터
// num_samples: 읽을 샘플 개수
// 반환값: 실제로 읽은 샘플 개수
size_t AudioBuffer::read(float* data, size_t num_samples) {
    std::lock_guard<std::mutex> lock(mutex_);  // Thread-safe 보장

    // 읽을 수 있는 샘플 수 계산
    size_t to_read = std::min(num_samples, available_);

    // 순환 버퍼에서 데이터 읽기
    for (size_t i = 0; i < to_read; ++i) {
        data[i] = buffer_[read_pos_];
        read_pos_ = (read_pos_ + 1) % capacity_;  // 원형으로 순환
    }

    available_ -= to_read;  // 사용 가능한 샘플 수 감소
    return to_read;
}

// 읽을 수 있는 샘플 개수 반환
size_t AudioBuffer::available() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return available_;
}

// 버퍼 비우기 (초기화)
void AudioBuffer::clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    read_pos_ = 0;
    write_pos_ = 0;
    available_ = 0;
}

} // namespace audio
