# WASM Audio Visualizer

C++ WebAssembly based 3D audio visualizer using Emscripten, dj_fft, and Three.js.

## Features

- 🎵 WAV audio file support (more formats coming with FFmpeg integration)
- 🌊 Real-time 3D waveform surface visualization
- 📊 FFT-based frequency analysis using dj_fft
- ⚡ SIMD and multithreading optimizations
- 🎮 Interactive camera controls (orbit, zoom, pan)
- 🎨 Customizable visual settings (color schemes, sensitivity)
- 🎧 Web Audio API playback with real-time analysis

## Tech Stack

- **C++20** - Core audio processing
- **Emscripten 4.0** - WebAssembly compilation
- **dj_fft** - Fast Fourier Transform (header-only library)
- **Three.js** - 3D rendering with WebGL
- **Web Audio API** - Audio playback and analysis
- **Vite** - Fast development server and bundler

## Prerequisites

The build system will automatically install Emscripten if not found. You need:

- **Homebrew** (macOS) - for CMake
- **Node.js 18+** - for npm dependencies
- **Git** - for cloning and submodules

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/wasm-audio-visualizer.git
cd wasm-audio-visualizer

# Install Node.js dependencies
npm install

# Build WASM module
./build.sh

# Start development server
npm run dev
```

Then open http://localhost:8000 in your browser.

## Development

### Build Commands

```bash
# Build WASM module only
npm run build:wasm

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clean build artifacts
npm run clean
```

### Project Structure

```
wasm-audio-visualizer/
├── src/
│   ├── cpp/                    # C++ source code
│   │   ├── core/               # Audio processing core
│   │   │   ├── audio_decoder.cpp      # WAV decoder
│   │   │   ├── audio_analyzer.cpp     # FFT analysis
│   │   │   ├── audio_buffer.cpp       # Circular buffer
│   │   │   └── waveform_generator.cpp # 3D data generation
│   │   ├── utils/
│   │   │   └── memory_pool.cpp        # Memory management
│   │   └── bindings/
│   │       └── wasm_api.cpp           # WASM API
│   ├── web/                    # Web frontend
│   │   └── js/
│   │       ├── main.js                # Main application
│   │       ├── audio-player.js        # Audio playback
│   │       ├── visualizer-3d.js       # 3D visualization
│   │       └── ui-controls.js         # UI controls
│   └── third_party/            # External libraries
│       └── dj_fft/                    # FFT library
├── include/                    # C++ headers
├── build/                      # Build output
├── public/                     # Static assets
├── CMakeLists.txt              # CMake configuration
├── vite.config.js              # Vite configuration
└── index.html                  # Main HTML page
```

## Usage

1. **Load Audio**: Click "Choose Audio File" and select a WAV file
2. **Visualize**: The 3D waveform will appear automatically
3. **Play**: Use the play/pause/stop controls
4. **Interact**: Drag to rotate, scroll to zoom, right-click to pan
5. **Customize**: Adjust FFT size, color scheme, and sensitivity

## Current Limitations

- **Audio Formats**: Currently only WAV files are supported. FFmpeg integration is planned for MP3, OGG, FLAC, AAC support.
- **Browser Compatibility**: Requires a modern browser with WebAssembly, SharedArrayBuffer, and Web Audio API support.
- **File Size**: Large files may cause memory issues due to in-memory processing.

## Planned Features

- [ ] FFmpeg integration for multi-format support
- [ ] Real-time microphone input visualization
- [ ] More 3D visualization modes (spectrum bars, particles, etc.)
- [ ] Export visualization as video
- [ ] Performance optimizations for large files
- [ ] Waveform zooming and time-based navigation

## Performance

- **SIMD**: Enabled via `-msimd128` for faster FFT computations
- **Multithreading**: pthread support for background audio processing
- **Memory Pool**: Custom allocator for reduced allocation overhead
- **WebGL**: Hardware-accelerated 3D rendering

## Browser Requirements

- Chrome/Edge 91+ (recommended)
- Firefox 89+
- Safari 15.2+

**Note**: SharedArrayBuffer requires secure context (HTTPS or localhost) and proper COOP/COEP headers.

## Architecture

### WASM Module

The C++ code is compiled to WebAssembly and exposes these functions:

- `loadAudio(data, size)` - Load audio from memory
- `getWaveformData(resolution)` - Get 3D waveform vertices
- `getFFTData(fftSize)` - Get frequency spectrum
- `getSampleCount()`, `getSampleRate()`, `getChannels()` - Audio info
- `cleanup()` - Free resources

### JavaScript Integration

The JavaScript side handles:

1. **Loading**: Reading files and passing data to WASM
2. **Playback**: Web Audio API for audio output
3. **Visualization**: Three.js for 3D rendering
4. **UI**: Controls and settings management

## Troubleshooting

### Build fails with "emcc not found"

The build script will automatically install Emscripten to `~/emsdk`. If you have it elsewhere, modify `build.sh` to source your emsdk_env.sh.

### "Failed to decode audio"

Currently only WAV format is supported. Ensure your file is a valid WAV file.

### Blank screen on load

Check browser console for errors. Ensure WASM files are being served correctly (check Network tab).

### SharedArrayBuffer errors

Make sure you're accessing via `http://localhost` or HTTPS, and the server is setting COOP/COEP headers (Vite does this automatically).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Credits

- [dj_fft](https://github.com/jdupuy/dj_fft) by Jonathan Dupuy - FFT library
- [Emscripten](https://emscripten.org/) - WebAssembly toolchain
- [Three.js](https://threejs.org/) - 3D library

## Author

Created as a demonstration of C++ WebAssembly audio processing with modern web technologies.
