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
  loadScore: (data: any) => void;
  playPause: () => void;
  stop: () => void;
  renderTracks: (tracks: alphaTab.model.Track[]) => void;
  setNotationVisibility: (showStandardNotation: boolean, showTablature: boolean, tracks?: alphaTab.model.Track[]) => void;
  setZoom: (zoom: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  seekToTick: (tick: number) => void;
  api: alphaTab.AlphaTabApi | null;
}

const AlphaTabEditor = forwardRef<AlphaTabEditorRef, AlphaTabEditorProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const api = new alphaTab.AlphaTabApi(containerRef.current, {
      core: {
        fontDirectory: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/',
      },
      player: {
        playerMode: alphaTab.PlayerMode.EnabledAutomatic,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableElementHighlighting: true,
        soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2',
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Page,
      }
    });

    apiRef.current = api;

    api.scoreLoaded.on((score) => {
      if (props.onScoreLoaded) props.onScoreLoaded(score);
    });

    api.playerReady.on(() => {
      console.log('Player ready');
    });

    api.playerStateChanged.on((args) => {
      const playing = args.state === alphaTab.synth.PlayerState.Playing;
      if (props.onPlaybackStatusChanged) props.onPlaybackStatusChanged(playing);
    });

    api.beatMouseDown.on((beat) => {
      if (props.onBeatClick) props.onBeatClick(beat);
    });

    api.playerPositionChanged.on((args) => {
        if (props.onPositionChanged) props.onPositionChanged(args);
    });

    return () => {
      api.destroy();
    };
  }, []); // Only run once on mount

  useImperativeHandle(ref, () => ({
    loadScore: (data: any) => {
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
      }
    },
    api: apiRef.current
  }));

  return (
    <div className="at-container">
      <div ref={containerRef}></div>
    </div>
  );
});

export default AlphaTabEditor;
