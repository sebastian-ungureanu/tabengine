# Tab Engine

Tab Engine is a browser-based guitar tablature player and editor for Guitar Pro files. It is built with React, TypeScript, Vite, and alphaTab.

## Features

- Load Guitar Pro files: `.gp`, `.gp3`, `.gp4`, `.gp5`, and `.gpx`
- Render notation and tablature with alphaTab
- Play, pause, stop, seek, rewind by bar, and jump to song start
- Timeline with Bars and MIDI-note map views
- Playlist support for switching between loaded songs
- Per-track selection, solo, mute, volume, and pan controls
- Preferences for default track type, timeline view, snap behavior, and selection mode
- Display toggles for musical notation, tabs, and tab-only note durations
- Technique editing for the selected note
- Instrument-aware colors and icons
- Lyrics panel with embedded lyrics support

## Getting Started

Install dependencies:

```sh
npm install
```

Start the Vite dev server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

Run lint checks:

```sh
npm run lint
```

## Project Structure

```text
src/
  App.tsx                         Main application shell and state
  App.css                         Application styling
  components/
    AlphaTabEditor.tsx            alphaTab integration and editor API wrapper
    InstrumentIcon.tsx            Instrument icon selection
    TimelineView.tsx              Timeline and track map view
  utils/
    instruments.ts                Instrument category and color mapping
public/
  music-icons/                    Instrument icon assets
  tab-engine-icon.svg             App icon and favicon
```

## Notes

Tab Engine uses alphaTab for parsing, rendering, playback, cursor handling, and Guitar Pro score support. Some external alphaTab assets, such as fonts and the soundfont, are loaded from the alphaTab CDN at runtime.
