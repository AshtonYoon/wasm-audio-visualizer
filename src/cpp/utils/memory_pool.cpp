#include "memory_pool.h"
#include <stdexcept>

namespace audio {

MemoryPool::MemoryPool(size_t block_size, size_t initial_blocks)
    : block_size_(block_size) {
    blocks_.reserve(initial_blocks);

    for (size_t i = 0; i < initial_blocks; ++i) {
        blocks_.push_back({std::vector<uint8_t>(block_size), false});
        free_list_.push_back(i);
    }
}

MemoryPool::~MemoryPool() = default;

void* MemoryPool::allocate() {
    std::lock_guard<std::mutex> lock(mutex_);

    if (free_list_.empty()) {
        // Grow pool
        size_t new_idx = blocks_.size();
        blocks_.push_back({std::vector<uint8_t>(block_size_), true});
        return blocks_[new_idx].data.data();
    }

    size_t idx = free_list_.back();
    free_list_.pop_back();
    blocks_[idx].in_use = true;
    return blocks_[idx].data.data();
}

void MemoryPool::deallocate(void* ptr) {
    if (!ptr) return;

    std::lock_guard<std::mutex> lock(mutex_);

    // Find which block this pointer belongs to
    for (size_t i = 0; i < blocks_.size(); ++i) {
        if (blocks_[i].data.data() == ptr) {
            if (!blocks_[i].in_use) {
                // Double free
                return;
            }
            blocks_[i].in_use = false;
            free_list_.push_back(i);
            return;
        }
    }
}

} // namespace audio
