# Fishing Joy

[🇬🇧 English](./README.md) | [🇨🇳 中文](./README.zh.md) | [🇯🇵 日本語](./README.ja.md) | [🇪🇸 Español](./README.es.md)

Fishing Joy is a standalone browser fishing game built with **PixiJS v8** and **Tone.js**. The project has no build step and runs entirely as a local static site.

## Features

- WebGL water distortion and layered scene composition
- Procedural fish spawning and school formations
- Local coin economy with upgradeable cannon power
- Synth-based sound effects plus looping background audio
- Plain script loading through `index.html`

## Quick Start

### Windows one-click launch

Double-click [run.bat](./run.bat).

The script:

- looks for `py` or `python`
- starts a local server on `http://localhost:8080/`
- opens the game in your default browser

### Manual launch

```powershell
cd E:\Privy\Fish
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Requirements

- Python 3 available as `py` or `python`
- A modern browser with WebGL enabled
- Internet access for the PixiJS and Tone.js CDN scripts used by [index.html](./index.html)

## Project Structure

- [index.html](./index.html): page entry and script loading order
- [src](./src): game logic, rendering, audio, and entities
- [images](./images): sprite sheets and UI textures
- [loop-01.mp3](./loop-01.mp3): looping background audio

## Notes

- Use a local static server instead of opening `index.html` with `file://`.
- Coins are now stored locally in memory during play.
