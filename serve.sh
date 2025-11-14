#!/bin/bash

# Development server with COOP/COEP headers for SharedArrayBuffer
# Required for pthread support

PORT=8000

echo "Starting development server on http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

python3 -c "
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Required headers for SharedArrayBuffer (pthread support)
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # Serve from public directory
        if self.path == '/':
            self.path = '/index.html'

        # Handle both public/ and root paths
        if not self.path.startswith('/public'):
            test_path = 'public' + self.path
            if os.path.exists(test_path):
                self.path = '/public' + self.path

        return super().do_GET()

os.chdir('.')
httpd = HTTPServer(('localhost', $PORT), CORSRequestHandler)
httpd.serve_forever()
"
