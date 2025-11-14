cmake_minimum_required(VERSION 3.15)
project(wasm-audio-visualizer)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/include)
include_directories(${CMAKE_SOURCE_DIR}/src/third_party/dj_fft)

# Source files
set(SOURCES
    src/cpp/core/audio_decoder.cpp
    src/cpp/core/audio_analyzer.cpp
    src/cpp/core/audio_buffer.cpp
    src/cpp/core/waveform_generator.cpp
    src/cpp/utils/memory_pool.cpp
    src/cpp/bindings/wasm_api.cpp
)

# Emscripten-specific settings
if(EMSCRIPTEN)
    # FFmpeg libraries (prebuilt or from ports)
    # Note: For now we'll use simplified approach, later add FFmpeg

    # Compile flags
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3")

    # SIMD support
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128")

    # Emscripten link flags
    set(EMSCRIPTEN_LINK_FLAGS
        "-s WASM=1"
        "-s MODULARIZE=1"
        "-s EXPORT_ES6=1"
        "-s ENVIRONMENT=web"
        "-s ALLOW_MEMORY_GROWTH=1"
        "-s INITIAL_MEMORY=134217728"
        "-s MAXIMUM_MEMORY=536870912"
        "-pthread"
        "-s PTHREAD_POOL_SIZE=2"
        "-s EXPORTED_FUNCTIONS=['_malloc','_free','_loadAudio','_loadPCMData','_getWaveformData','_getFFTData','_getSampleCount','_getSampleRate','_getChannels','_cleanup']"
        "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','HEAP8','HEAPU8','HEAPF32','writeArrayToMemory']"
        "-gsource-map"
        "--source-map-base=http://localhost:8000/"
    )

    string(REPLACE ";" " " EMSCRIPTEN_LINK_FLAGS_STR "${EMSCRIPTEN_LINK_FLAGS}")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${EMSCRIPTEN_LINK_FLAGS_STR}")
endif()

# Create executable
add_executable(audio-visualizer ${SOURCES})

# Set output name
set_target_properties(audio-visualizer PROPERTIES OUTPUT_NAME "audio-visualizer")

# Install to public directory
install(TARGETS audio-visualizer DESTINATION ${CMAKE_SOURCE_DIR}/public)
install(FILES ${CMAKE_BINARY_DIR}/audio-visualizer.wasm DESTINATION ${CMAKE_SOURCE_DIR}/public OPTIONAL)
install(FILES ${CMAKE_BINARY_DIR}/audio-visualizer.js DESTINATION ${CMAKE_SOURCE_DIR}/public OPTIONAL)
