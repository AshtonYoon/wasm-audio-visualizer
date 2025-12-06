/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
// Source: https://github.com/gzuidhof/coi-serviceworker
// This Service Worker enables Cross-Origin Isolation by injecting COOP/COEP headers
// Required for SharedArrayBuffer to work on GitHub Pages

let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (event) => {
        if (event.data && event.data.type === "coepCredentialless") {
            coepCredentialless = event.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const request = event.request;

        // Skip cross-origin requests
        if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy",
                        coepCredentialless ? "credentialless" : "require-corp");
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        // Reload page when Service Worker updates
        const reloadOnUpdate = (registration) => {
            registration.addEventListener("updatefound", () => {
                const newWorker = registration.installing;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "activated") {
                        window.location.reload();
                    }
                });
            });
        };

        // Register Service Worker
        const registerServiceWorker = async () => {
            if ("serviceWorker" in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register(
                        window.location.pathname + "coi-serviceworker.js"
                    );

                    if (registration.waiting) {
                        // Activate waiting worker immediately
                        registration.waiting.postMessage({ type: "SKIP_WAITING" });
                    }

                    reloadOnUpdate(registration);

                    // Check for updates
                    registration.update();

                    console.log("✅ Service Worker registered - COOP/COEP headers enabled");
                } catch (error) {
                    console.error("❌ Service Worker registration failed:", error);
                }
            } else {
                console.warn("⚠️ Service Workers not supported in this browser");
            }
        };

        // Check if we need to reload for Service Worker activation
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            // Service Worker is already controlling the page
            console.log("✅ Service Worker active");
        } else if (navigator.serviceWorker) {
            // First time - register and reload
            registerServiceWorker();
        }
    })();
}
