#include "memory_pool.h"
#include <stdexcept>

namespace audio {

// 메모리 풀 생성자
// block_size: 각 블록의 크기 (바이트)
// initial_blocks: 초기 할당할 블록 개수
MemoryPool::MemoryPool(size_t block_size, size_t initial_blocks)
    : block_size_(block_size) {
    blocks_.reserve(initial_blocks);  // 메모리 재할당 방지를 위해 미리 예약

    // 초기 블록들을 미리 할당하여 풀 구성
    for (size_t i = 0; i < initial_blocks; ++i) {
        blocks_.push_back({std::vector<uint8_t>(block_size), false});
        free_list_.push_back(i);  // 사용 가능한 블록 목록에 추가
    }
}

MemoryPool::~MemoryPool() = default;

// 메모리 블록 할당
// 반환값: 할당된 메모리 블록 포인터
void* MemoryPool::allocate() {
    std::lock_guard<std::mutex> lock(mutex_);  // Thread-safe 보장

    if (free_list_.empty()) {
        // 사용 가능한 블록이 없으면 풀 확장
        size_t new_idx = blocks_.size();
        blocks_.push_back({std::vector<uint8_t>(block_size_), true});
        return blocks_[new_idx].data.data();
    }

    // free_list에서 사용 가능한 블록 꺼내기
    size_t idx = free_list_.back();
    free_list_.pop_back();
    blocks_[idx].in_use = true;  // 사용 중으로 표시
    return blocks_[idx].data.data();
}

// 메모리 블록 해제 (풀로 반환)
// ptr: 해제할 메모리 블록 포인터
void MemoryPool::deallocate(void* ptr) {
    if (!ptr) return;  // nullptr 체크

    std::lock_guard<std::mutex> lock(mutex_);  // Thread-safe 보장

    // 이 포인터가 어느 블록에 속하는지 찾기
    for (size_t i = 0; i < blocks_.size(); ++i) {
        if (blocks_[i].data.data() == ptr) {
            if (!blocks_[i].in_use) {
                // Double free 방지: 이미 해제된 블록은 무시
                return;
            }
            blocks_[i].in_use = false;  // 사용 중 아님으로 표시
            free_list_.push_back(i);     // free_list에 다시 추가 (재사용 가능)
            return;
        }
    }
}

} // namespace audio
