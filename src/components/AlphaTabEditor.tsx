import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as alphaTab from '@coderline/alphatab';

export interface AlphaTabEditorProps {
  onScoreLoaded?: (score: alphaTab.model.Score) => void;
  onPlaybackStatusChanged?: (isPlaying: boolean) => void;
  onTrackChanged?: (track: alphaTab.model.Track) => void;
  onBeatClick?: (beat: alphaTab.model.Beat) => void;
  onPositionChanged?: (args: alphaTab.synth.PositionChangedEventArgs) => void;
}

export interface AlphaTabEditorRef {
  loadScore: (data: unknown) => void;
  playPause: () => void;
  stop: () => void;
  renderTracks: (tracks: alphaTab.model.Track[]) => void;
  setNotationVisibility: (showStandardNotation: boolean, showTablature: boolean, tracks?: alphaTab.model.Track[]) => void;
  setTabRhythmMode: (rhythmMode: alphaTab.TabRhythmMode, tracks?: alphaTab.model.Track[]) => void;
  setZoom: (zoom: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  seekToTick: (tick: number) => void;
  api: alphaTab.AlphaTabApi | null;
}

const AlphaTabEditor = forwardRef<AlphaTabEditorRef, AlphaTabEditorProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!containerRef.current) return;
    const scrollElement = containerRef.current.closest('.editor-container') as HTMLElement | null;

    const api = new alphaTab.AlphaTabApi(containerRef.current, {
      core: {
        fontDirectory: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/',
      },
      player: {
        playerMode: alphaTab.PlayerMode.EnabledAutomatic,
        enableCursor: true,
        enableAnimatedBeatCursor: false,
        enableElementHighlighting: true,
        scrollElement: scrollElement ?? undefined,
        scrollMode: alphaTab.ScrollMode.OffScreen,
        scrollOffsetY: -56,
        scrollSpeed: 180,
        nativeBrowserSmoothScroll: true,
        soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2',
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Page,
      },
      importer: {
        beatTextAsLyrics: true,
      }
    });

    api.customCursorHandler = {
      onAttach: () => undefined,
      onDetach: () => undefined,
      placeBarCursor: (barCursor, beatBounds) => {
        const barBounds = beatBounds.barBounds.masterBarBounds.visualBounds;
        barCursor.stopAnimation();
        barCursor.setBounds(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
      },
      placeBeatCursor: (beatCursor, beatBounds, startBeatX) => {
        const barBounds = beatBounds.barBounds.masterBarBounds.visualBounds;
        beatCursor.stopAnimation();
        beatCursor.transitionToX(0, startBeatX);
        beatCursor.setBounds(startBeatX, barBounds.y, 4, barBounds.h);
      },
      transitionBeatCursor: (beatCursor, beatBounds, startBeatX) => {
        const barBounds = beatBounds.barBounds.masterBarBounds.visualBounds;
        beatCursor.stopAnimation();
        beatCursor.transitionToX(0, startBeatX);
        beatCursor.setBounds(startBeatX, barBounds.y, 4, barBounds.h);
      }
    };

    const scrollBeatIntoView = (beatBounds: alphaTab.rendering.BeatBounds, force = false) => {
      const scrollContainer = containerRef.current?.closest('.editor-container') as HTMLElement | null;
      const surfaceContainer = containerRef.current?.parentElement;
      if (!scrollContainer || !surfaceContainer) return;

      const barBounds = beatBounds.barBounds.masterBarBounds.realBounds;
      const verticalPadding = 56;
      const horizontalPadding = 32;
      const barTop = surfaceContainer.offsetTop + barBounds.y;
      const barBottom = barTop + barBounds.h;
      const visibleTop = scrollContainer.scrollTop;
      const visibleBottom = visibleTop + scrollContainer.clientHeight;
      const barLeft = surfaceContainer.offsetLeft + barBounds.x;
      const barRight = barLeft + barBounds.w;
      const visibleLeft = scrollContainer.scrollLeft;
      const visibleRight = visibleLeft + scrollContainer.clientWidth;

      const nextTop = force || barTop < visibleTop + verticalPadding || barBottom > visibleBottom - verticalPadding
        ? Math.max(0, barTop - verticalPadding)
        : scrollContainer.scrollTop;
      const nextLeft = force || barLeft < visibleLeft + horizontalPadding || barRight > visibleRight - horizontalPadding
        ? Math.max(0, barLeft - horizontalPadding)
        : scrollContainer.scrollLeft;

      if (nextTop !== scrollContainer.scrollTop || nextLeft !== scrollContainer.scrollLeft) {
        scrollContainer.scrollTo({
          top: nextTop,
          left: nextLeft,
          behavior: 'smooth'
        });
      }
    };

    api.customScrollHandler = {
      forceScrollTo: (currentBeatBounds) => {
        scrollBeatIntoView(currentBeatBounds, true);
      },
      onBeatCursorUpdating: (startBeat) => {
        scrollBeatIntoView(startBeat);
      }
    };

    apiRef.current = api;

    api.scoreLoaded.on((score) => {
      if (propsRef.current.onScoreLoaded) propsRef.current.onScoreLoaded(score);
    });

    api.playerReady.on(() => {
      console.log('Player ready');
    });

    api.playerStateChanged.on((args) => {
      const playing = args.state === alphaTab.synth.PlayerState.Playing;
      if (propsRef.current.onPlaybackStatusChanged) propsRef.current.onPlaybackStatusChanged(playing);
    });

    api.beatMouseDown.on((beat) => {
      if (propsRef.current.onBeatClick) propsRef.current.onBeatClick(beat);
    });

    api.playerPositionChanged.on((args) => {
        if (propsRef.current.onPositionChanged) propsRef.current.onPositionChanged(args);
    });

    return () => {
      api.destroy();
    };
  }, []); // Only run once on mount

  useImperativeHandle(ref, () => ({
    loadScore: (data: unknown) => {
      apiRef.current?.load(data);
    },
    playPause: () => {
      apiRef.current?.playPause();
    },
    stop: () => {
      apiRef.current?.stop();
    },
    renderTracks: (tracks: alphaTab.model.Track[]) => {
      apiRef.current?.renderTracks(tracks);
    },
    setNotationVisibility: (showStandardNotation: boolean, showTablature: boolean, tracks?: alphaTab.model.Track[]) => {
      const api = apiRef.current;
      if (!api?.score) return;

      api.score.tracks.forEach(track => {
        track.staves.forEach(staff => {
          staff.showStandardNotation = showStandardNotation;
          staff.showTablature = showTablature;
        });
      });

      if (tracks?.length) {
        api.renderTracks(tracks);
      } else {
        api.render();
      }
    },
    setTabRhythmMode: (rhythmMode: alphaTab.TabRhythmMode, tracks?: alphaTab.model.Track[]) => {
      const api = apiRef.current;
      if (!api?.score) return;

      api.settings.notation.rhythmMode = rhythmMode;
      api.updateSettings();

      if (tracks?.length) {
        api.renderTracks(tracks);
      } else {
        api.render();
      }
    },
    setZoom: (zoom: number) => {
      if (apiRef.current) {
        apiRef.current.settings.display.scale = zoom;
        apiRef.current.updateSettings();
        apiRef.current.render();
      }
    },
    setPlaybackSpeed: (speed: number) => {
        if(apiRef.current) {
            apiRef.current.playbackSpeed = speed;
        }
    },
    seekToTick: (tick: number) => {
      if (apiRef.current) {
        apiRef.current.tickPosition = tick;
        window.setTimeout(() => apiRef.current?.scrollToCursor(), 0);
      }
    },
    get api() {
      return apiRef.current;
    }
  }));

  return (
    <div className="at-container">
      <div ref={containerRef}></div>
    </div>
  );
});

export default AlphaTabEditor;
