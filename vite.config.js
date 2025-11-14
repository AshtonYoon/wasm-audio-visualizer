import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: './',
    publicDir: 'public',
    server: {
        port: 8000,
        headers: {
            // Required for SharedArrayBuffer (pthread support)
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
