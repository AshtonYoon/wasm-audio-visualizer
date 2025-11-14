#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building WASM Audio Visualizer...${NC}"

# Source Emscripten environment
if [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
    source "$HOME/emsdk/emsdk_env.sh"
fi

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found. Please install and activate emsdk."
    exit 1
fi

# Create build directory
mkdir -p build
cd build

# Configure with Emscripten
echo -e "${GREEN}Configuring CMake...${NC}"
emcmake cmake ..

# Build
echo -e "${GREEN}Building...${NC}"
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Copy outputs to public directory
echo -e "${GREEN}Copying outputs to public/...${NC}"
cp audio-visualizer.js ../public/
cp audio-visualizer.wasm ../public/
if [ -f audio-visualizer.wasm.map ]; then
    cp audio-visualizer.wasm.map ../public/
fi

cd ..

echo -e "${GREEN}Build complete! Output files in public/${NC}"
