# Architecture

OptiShield is organized around a small Manifest V3 extension runtime and modular rendering pipeline.

## Components

- **Content script**: initializes the overlay, watches settings, and maintains DOM integration.
- **Overlay system**: inserts a fixed, pointer-events-free canvas above page content.
- **Canvas 2D renderer**: low-overhead fallback that draws low-alpha temporal bands and chroma offsets.
- **WebGL renderer**: shader-based perturbation for devices with WebGL2 support.
- **Performance manager**: samples frame timing, pauses inactive tabs, and recommends a renderer.
- **Settings store**: uses `chrome.storage.local` only.
- **React UI**: popup and options page for controls and local OCR benchmarking.

## Rendering philosophy

Perturbations are designed to degrade optical capture pipelines by reducing temporal consistency, edge stability, and compression-friendly contours. They are intentionally subtle and configurable to preserve direct readability and accessibility.
