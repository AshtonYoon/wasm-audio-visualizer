#pragma once

#include <vector>
#include <cstdint>
#include <mutex>

namespace audio {

/**
 * Simple memory pool for fixed-size allocations
 * Reduces allocation overhead for frequently allocated/deallocated buffers
 */
class MemoryPool {
public:
    explicit MemoryPool(size_t block_size, size_t initial_blocks = 16);
    ~MemoryPool();

    // Allocate a block
    void* allocate();

    // Deallocate a block
    void deallocate(void* ptr);

    // Get block size
    size_t block_size() const { return block_size_; }

    // Get statistics
    size_t total_blocks() const { return blocks_.size(); }
    size_t available_blocks() const { return free_list_.size(); }

private:
    struct Block {
        std::vector<uint8_t> data;
        bool in_use;
    };

    size_t block_size_;
    std::vector<Block> blocks_;
    std::vector<size_t> free_list_;
    std::mutex mutex_;
};

} // namespace audio
