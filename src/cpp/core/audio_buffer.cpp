#include "audio_buffer.h"
#include <algorithm>
#include <cstring>

namespace audio {

AudioBuffer::AudioBuffer(size_t capacity)
    : capacity_(capacity)
    , read_pos_(0)
    , write_pos_(0)
    , available_(0) {
    buffer_.resize(capacity);
}

AudioBuffer::~AudioBuffer() = default;

size_t AudioBuffer::write(const float* data, size_t num_samples) {
    std::lock_guard<std::mutex> lock(mutex_);

    size_t space = capacity_ - available_;
    size_t to_write = std::min(num_samples, space);

    for (size_t i = 0; i < to_write; ++i) {
        buffer_[write_pos_] = data[i];
        write_pos_ = (write_pos_ + 1) % capacity_;
    }

    available_ += to_write;
    return to_write;
}

size_t AudioBuffer::read(float* data, size_t num_samples) {
    std::lock_guard<std::mutex> lock(mutex_);

    size_t to_read = std::min(num_samples, available_);

    for (size_t i = 0; i < to_read; ++i) {
        data[i] = buffer_[read_pos_];
        read_pos_ = (read_pos_ + 1) % capacity_;
    }

    available_ -= to_read;
    return to_read;
}

size_t AudioBuffer::available() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return available_;
}

void AudioBuffer::clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    read_pos_ = 0;
    write_pos_ = 0;
    available_ = 0;
}

} // namespace audio
