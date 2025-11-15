export class UIControls {
    constructor(app) {
        this.app = app;
        this.init();
    }

    init() {
        // FFT size selector
        const fftSizeSelect = document.getElementById('fft-size');
        fftSizeSelect.addEventListener('change', (e) => {
            const size = parseInt(e.target.value);
            if (this.app.audioPlayer) {
                this.app.audioPlayer.setFFTSize(size);
            }
        });

        // Color scheme selector
        const colorSchemeSelect = document.getElementById('color-scheme');
        colorSchemeSelect.addEventListener('change', (e) => {
            const scheme = e.target.value;
            if (this.app.visualizer) {
                this.app.visualizer.setColorScheme(scheme);
            }
        });

        // Sensitivity slider
        const sensitivitySlider = document.getElementById('sensitivity');
        const sensitivityValue = document.getElementById('sensitivity-value');
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sensitivityValue.textContent = value.toFixed(1);
            if (this.app.visualizer) {
                this.app.visualizer.setSensitivity(value);
            }
        });
    }
}
