import { useState, useRef, useEffect, useMemo } from 'react';
import * as alphaTab from '@coderline/alphatab';
import AlphaTabEditor, { type AlphaTabEditorRef } from './components/AlphaTabEditor';
import InstrumentIcon from './components/InstrumentIcon';
import TimelineView, { type TrackSettings } from './components/TimelineView';
import { getInstrumentCategory } from './utils/instruments';
import './App.css';

type IconName = 'skip-back' | 'rewind' | 'play' | 'pause' | 'fast-forward' | 'stop' | 'minus' | 'plus' | 'arrow-up' | 'arrow-down' | 'metronome' | 'reset' | 'song-prev' | 'song-next' | 'trash' | 'fullscreen' | 'fullscreen-exit';

interface TrackLyrics {
  trackIndex: number;
  trackName: string;
  lines: string[];
}

interface SongChord {
  id: string;
  name: string;
  barNumber: number;
  trackName: string;
  tick: number;
}

interface PlaylistSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  source: unknown;
  trackCount: number;
  loadedAt: number;
}

interface SelectedNoteSnapshot {
  fret: number;
  string: number;
  stringCount: number;
  vibrato: boolean;
  bend: boolean;
  slide: boolean;
  harmonic: boolean;
  tap: boolean;
  grace: boolean;
  mute: boolean;
  tie: boolean;
  letRing: boolean;
  hammerPull: boolean;
}

type TechniqueId = 'vibrato' | 'bend' | 'slide' | 'harmonic' | 'tap' | 'grace' | 'mute' | 'letRing' | 'tie' | 'hammerPull';
type DefaultTrackType = 'guitar' | 'bass' | 'drums';
type TimelineMode = 'bars' | 'timeline';
type SelectionMode = 'single' | 'multi';

const TECHNIQUES: Array<{ id: TechniqueId; label: string }> = [
  { id: 'vibrato', label: 'Vib' },
  { id: 'bend', label: 'Bend' },
  { id: 'slide', label: 'Slide' },
  { id: 'harmonic', label: 'Harm' },
  { id: 'tap', label: 'Tap' },
  { id: 'grace', label: 'Grace' },
  { id: 'mute', label: 'Mute' },
  { id: 'letRing', label: 'Let ring' },
  { id: 'tie', label: 'Tie' },
  { id: 'hammerPull', label: 'H/P' }
];

const HAMMER_PULL_LOOKUP_BAR_OFFSET = 3;
const MIN_FRET = 0;
const MAX_FRET = 24;

const cloneScoreSource = (source: unknown) => {
  return source instanceof ArrayBuffer ? source.slice(0) : source;
};

const isDefaultTrackTypeMatch = (track: alphaTab.model.Track, defaultTrackType: DefaultTrackType) => {
  const category = getInstrumentCategory(track);

  switch (defaultTrackType) {
    case 'guitar':
      return category === 'Acoustic guitar' || category === 'Electric guitar';
    case 'bass':
      return category === 'Bass';
    case 'drums':
      return category === 'Percussion';
  }
};

const getTracksInOrder = (loadedScore: alphaTab.model.Score | null, order: number[]) => {
  if (!loadedScore) return [];
  const trackByIndex = new Map(loadedScore.tracks.map(track => [track.index, track]));
  const ordered = order
    .map(trackIndex => trackByIndex.get(trackIndex))
    .filter((track): track is alphaTab.model.Track => Boolean(track));
  const orderedIds = new Set(ordered.map(track => track.index));
  return [
    ...ordered,
    ...loadedScore.tracks.filter(track => !orderedIds.has(track.index))
  ];
};

const Icon = ({ name }: { name: IconName }) => {
  switch (name) {
    case 'skip-back':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 5v14" />
          <path d="M18 6 9 12l9 6V6Z" />
        </svg>
      );
    case 'rewind':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m11 7-7 5 7 5V7Z" />
          <path d="m20 7-7 5 7 5V7Z" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7L8 5Z" />
        </svg>
      );
    case 'pause':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14" />
          <path d="M16 5v14" />
        </svg>
      );
    case 'fast-forward':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m13 7 7 5-7 5V7Z" />
          <path d="m4 7 7 5-7 5V7Z" />
        </svg>
      );
    case 'stop':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7h10v10H7z" />
        </svg>
      );
    case 'minus':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      );
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'arrow-up':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      );
    case 'arrow-down':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      );
    case 'metronome':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 21h8" />
          <path d="M7 21 10 3h4l3 18" />
          <path d="M12 6v8" />
          <path d="m12 14 4-3" />
          <path d="M9 17h6" />
        </svg>
      );
    case 'reset':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7v5h5" />
          <path d="M5.6 12A7 7 0 1 0 8 6.3L4 10" />
        </svg>
      );
    case 'song-prev':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18 9 12l6-6" />
        </svg>
      );
    case 'song-next':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'trash':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="m6 6 1 15h10l1-15" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
    case 'fullscreen':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5" />
          <path d="M3 3l7 7" />
          <path d="M16 3h5v5" />
          <path d="m21 3-7 7" />
          <path d="M8 21H3v-5" />
          <path d="m3 21 7-7" />
          <path d="M16 21h5v-5" />
          <path d="m21 21-7-7" />
        </svg>
      );
    case 'fullscreen-exit':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3v6H3" />
          <path d="m3 9 6-6" />
          <path d="M15 3v6h6" />
          <path d="m21 9-6-6" />
          <path d="M9 21v-6H3" />
          <path d="m3 15 6 6" />
          <path d="M15 21v-6h6" />
          <path d="m21 15-6 6" />
        </svg>
      );
  }
};

const cleanLyricLine = (line: string) => line
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .trim();

const getBeatPlaybackTick = (beat: alphaTab.model.Beat) => {
  const bar = beat.voice.bar;
  const masterBars = bar.staff.track.score.masterBars;
  let barStart = 0;

  for (let i = 0; i < bar.index; i++) {
    barStart += masterBars[i]?.calculateDuration() ?? 0;
  }

  return barStart + beat.playbackStart;
};

const extractLyricsFromScore = (loadedScore: alphaTab.model.Score): TrackLyrics[] => {
  return loadedScore.tracks
    .map(track => {
      const lines: string[][] = [];

      track.staves.forEach(staff => {
        staff.bars.forEach(bar => {
          bar.voices.forEach(voice => {
            voice.beats.forEach(beat => {
              beat.lyrics?.forEach((chunk, index) => {
                const text = chunk.trim();
                if (!text) return;
                if (!lines[index]) lines[index] = [];
                lines[index].push(text);
              });
            });
          });
        });
      });

      return {
        trackIndex: track.index,
        trackName: track.name,
        lines: lines
          .map(line => cleanLyricLine(line.join(' ')))
          .filter(Boolean)
      };
    })
    .filter(track => track.lines.length > 0);
};

const extractChordsFromScore = (loadedScore: alphaTab.model.Score | null): SongChord[] => {
  if (!loadedScore) return [];

  const chords: SongChord[] = [];
  const seen = new Set<string>();

  loadedScore.tracks.forEach(track => {
    track.staves.forEach(staff => {
      staff.bars.forEach(bar => {
        bar.voices.forEach(voice => {
          voice.beats.forEach((beat: alphaTab.model.Beat) => {
            const chord = beat.chord || (beat.chordId ? staff.getChord(beat.chordId) : null);
            const chordName = chord?.name?.trim() || beat.chordId?.trim();
            if (!chordName) return;

            const tick = Math.max(0, getBeatPlaybackTick(beat));
            const key = `${track.index}-${bar.index}-${tick}-${chordName}`;
            if (seen.has(key)) return;
            seen.add(key);

            chords.push({
              id: key,
              name: chordName,
              barNumber: bar.index + 1,
              trackName: track.name,
              tick
            });
          });
        });
      });
    });
  });

  return chords.sort((a, b) => a.tick - b.tick || a.trackName.localeCompare(b.trackName) || a.name.localeCompare(b.name));
};

const findHammerPullOriginForNote = (note: alphaTab.model.Note) => {
  let previousBeat = note.beat.previousBeat;

  while (
    previousBeat &&
    previousBeat.voice.bar.index >= note.beat.voice.bar.index - HAMMER_PULL_LOOKUP_BAR_OFFSET
  ) {
    for (const candidate of previousBeat.notes) {
      if (!candidate.isHammerPullOrigin) continue;

      const destination = candidate.hammerPullDestination || alphaTab.model.Note.findHammerPullDestination(candidate);
      if (destination === note) {
        return candidate;
      }
    }

    previousBeat = previousBeat.previousBeat;
  }

  return null;
};

const hasHammerPull = (note: alphaTab.model.Note) => {
  return (
    note.isHammerPullOrigin ||
    note.isHammerPullDestination ||
    !!note.hammerPullOrigin ||
    !!note.hammerPullDestination ||
    !!findHammerPullOriginForNote(note)
  );
};

const createSelectedNoteSnapshot = (note: alphaTab.model.Note | null): SelectedNoteSnapshot | null => {
  if (!note) return null;

  return {
    fret: note.fret,
    string: note.string,
    stringCount: note.beat.voice.bar.staff.tuning.length,
    vibrato: note.vibrato !== alphaTab.model.VibratoType.None,
    bend: note.bendType !== alphaTab.model.BendType.None || note.hasBend,
    slide: note.slideOutType !== alphaTab.model.SlideOutType.None || !!note.slideTarget,
    harmonic: note.harmonicType !== alphaTab.model.HarmonicType.None,
    tap: note.isLeftHandTapped,
    grace: note.beat.graceType !== alphaTab.model.GraceType.None,
    mute: note.isPalmMute,
    tie: note.isTieOrigin || note.isTieDestination || !!note.tieOrigin || !!note.tieDestination,
    letRing: note.isLetRing,
    hammerPull: hasHammerPull(note)
  };
};

function App() {
  const appContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<AlphaTabEditorRef>(null);
  const playlistIdRef = useRef(0);
  const pendingPlaylistLoadRef = useRef<{
    id: string;
    source: unknown;
    fallbackTitle?: string;
  } | null>(null);
  const [score, setScore] = useState<alphaTab.model.Score | null>(null);
  const [appView, setAppView] = useState<'main' | 'preferences'>('main');
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<'tabs' | 'chords' | 'lyrics'>('tabs');
  const [rightPanelTab, setRightPanelTab] = useState<'song' | 'playlist'>('song');
  const [trackLyrics, setTrackLyrics] = useState<TrackLyrics[]>([]);

  const [activeTracks, setActiveTracks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const selectedNoteRef = useRef<alphaTab.model.Note | null>(null);
  const [selectedNote, setSelectedNoteSnapshot] = useState<SelectedNoteSnapshot | null>(null);
  const [currentTick, setCurrentTick] = useState(0);
  const [playbackTime, setPlaybackTime] = useState({ currentTime: 0, endTime: 0, tempo: 0 });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('bars');
  const [snapToBarStart, setSnapToBarStart] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [trackSettings, setTrackSettings] = useState<Record<number, TrackSettings>>({});
  const [showStandardNotation, setShowStandardNotation] = useState(true);
  const [showTablature, setShowTablature] = useState(true);
  const [showTabNoteDurations, setShowTabNoteDurations] = useState(false);
  const [defaultTrackType, setDefaultTrackType] = useState<DefaultTrackType>('guitar');
  const [playlist, setPlaylist] = useState<PlaylistSong[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [draggedPlaylistId, setDraggedPlaylistId] = useState<string | null>(null);
  const [playlistDropId, setPlaylistDropId] = useState<string | null>(null);
  const [trackOrder, setTrackOrder] = useState<number[]>([]);
  const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(null);
  const [trackDropIndex, setTrackDropIndex] = useState<number | null>(null);
  const [trackNameRevision, setTrackNameRevision] = useState(0);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === appContainerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const setSelectedNote = (note: alphaTab.model.Note | null) => {
    selectedNoteRef.current = note;
    setSelectedNoteSnapshot(createSelectedNoteSnapshot(note));
  };

  const isTypingTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return Boolean(
      element &&
      (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'SELECT' ||
        element.isContentEditable
      )
    );
  };

  const orderedTracks = useMemo(() => {
    void trackNameRevision;
    return getTracksInOrder(score, trackOrder);
  }, [score, trackOrder, trackNameRevision]);
  const selectedTrack = orderedTracks.find(track => activeTracks.includes(track.index)) ?? orderedTracks[0] ?? null;
  const songChords = useMemo(() => {
    void trackNameRevision;
    return extractChordsFromScore(score);
  }, [score, trackNameRevision]);
  const chordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    songChords.forEach(chord => counts.set(chord.name, (counts.get(chord.name) || 0) + 1));
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [songChords]);
  const selectedTrackSettings = selectedTrack
    ? trackSettings[selectedTrack.index] || { volume: 8, pan: 0, mute: false, solo: false }
    : { volume: 8, pan: 0, mute: false, solo: false };
  const selectedStaff = selectedTrack?.staves[0] ?? null;
  const tuningName = selectedStaff?.isStringed ? selectedStaff.tuningName : selectedTrack ? 'Not applicable' : '-';
  const tuningNotes = selectedStaff?.isStringed
    ? selectedStaff.tuning.map(tuning => alphaTab.model.Tuning.getTextForTuning(tuning, false)).join(' ')
    : selectedTrack ? 'This track does not use string tuning.' : '-';
  const songTitle = score?.title || 'Untitled Song';
  const songArtist = score?.artist || 'Unknown Artist';
  const tempo = playbackTime.tempo || score?.tempo || 100;
  const lyricSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${songTitle} ${songArtist} lyrics`)}`;
  const showTabDurationToggle = showTablature && !showStandardNotation;
  const activePlaylistIndex = playlist.findIndex(song => song.id === activePlaylistId);
  const previousPlaylistSong = activePlaylistIndex > 0 ? playlist[activePlaylistIndex - 1] : null;
  const nextPlaylistSong = activePlaylistIndex >= 0 && activePlaylistIndex < playlist.length - 1
    ? playlist[activePlaylistIndex + 1]
    : null;

  useEffect(() => {
    if (!score || !editorRef.current || activeTracks.length === 0) return;
    const tracksToRender = orderedTracks.filter(track => activeTracks.includes(track.index));
    if (tracksToRender.length) {
      editorRef.current.renderTracks(tracksToRender);
    }
  }, [score, orderedTracks, activeTracks]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPan = (pan: number) => {
    if (pan === 0) return 'C';
    return pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`;
  };

  const loadScoreSource = (source: unknown, options?: { id?: string; fallbackTitle?: string }) => {
    if (!editorRef.current) return;

    const id = options?.id || `song-${playlistIdRef.current += 1}`;
    pendingPlaylistLoadRef.current = {
      id,
      source: cloneScoreSource(source),
      fallbackTitle: options?.fallbackTitle
    };
    editorRef.current.loadScore(cloneScoreSource(source));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        if (data) {
          loadScoreSource(data, { fallbackTitle: file.name });
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    }
  };

  const onScoreLoaded = (loadedScore: alphaTab.model.Score) => {
    const playlistLoad = pendingPlaylistLoadRef.current;
    const playlistId = playlistLoad?.id || `song-${playlistIdRef.current += 1}`;
    const playlistSource = playlistLoad?.source || loadedScore;
    const playlistTitle = loadedScore.title || playlistLoad?.fallbackTitle || `Song ${playlist.length + 1}`;

    loadedScore.tracks.forEach(track => {
      track.staves.forEach(staff => {
        staff.showStandardNotation = showStandardNotation;
        staff.showTablature = showTablature;
      });
    });
    setScore(loadedScore);
    setTrackLyrics(extractLyricsFromScore(loadedScore));
    setCurrentTick(0);
    setPlaybackSpeed(1);
    editorRef.current?.setPlaybackSpeed(1);
    editorRef.current?.setTabRhythmMode(
      showTablature && !showStandardNotation
        ? showTabNoteDurations ? alphaTab.TabRhythmMode.ShowWithBeams : alphaTab.TabRhythmMode.Hidden
        : alphaTab.TabRhythmMode.Automatic,
      loadedScore.tracks
    );
    setPlaybackTime({ currentTime: 0, endTime: 0, tempo: loadedScore.tempo || 100 });
    setTrackOrder(loadedScore.tracks.map(track => track.index));
    setActivePlaylistId(playlistId);
    setPlaylist(prev => {
      const nextSong: PlaylistSong = {
        id: playlistId,
        title: playlistTitle,
        artist: loadedScore.artist || 'Unknown Artist',
        album: loadedScore.album || '',
        source: playlistSource,
        trackCount: loadedScore.tracks.length,
        loadedAt: Date.now()
      };

      if (prev.some(song => song.id === playlistId)) {
        return prev.map(song => (
          song.id === playlistId
            ? { ...nextSong, loadedAt: song.loadedAt }
            : song
        ));
      }

      return [...prev, nextSong];
    });
    pendingPlaylistLoadRef.current = null;
    const defaultTrack = loadedScore.tracks.find(track => isDefaultTrackTypeMatch(track, defaultTrackType)) || loadedScore.tracks[0];
    if (defaultTrack) {
      setActiveTracks([defaultTrack.index]);
      editorRef.current?.renderTracks([defaultTrack]);
    } else {
      setActiveTracks([]);
    }

    // Initialize track settings from score
    const initialSettings: Record<number, TrackSettings> = {};
    loadedScore.tracks.forEach(track => {
        initialSettings[track.index] = {
            volume: track.playbackInfo.volume,
            pan: track.playbackInfo.balance,
            mute: track.playbackInfo.isMute,
            solo: track.playbackInfo.isSolo
        };
    });
    setTrackSettings(initialSettings);
  };

  const switchPlaylistSong = (song: PlaylistSong) => {
    if (song.id === activePlaylistId) return;
    setSelectedNote(null);
    loadScoreSource(song.source, { id: song.id, fallbackTitle: song.title });
  };

  const deletePlaylistSong = (song: PlaylistSong) => {
    const songIndex = playlist.findIndex(item => item.id === song.id);
    const nextPlaylist = playlist.filter(item => item.id !== song.id);
    setPlaylist(nextPlaylist);

    if (song.id !== activePlaylistId) return;

    const replacementSong = nextPlaylist[Math.min(songIndex, nextPlaylist.length - 1)] || null;
    if (replacementSong) {
      setSelectedNote(null);
      loadScoreSource(replacementSong.source, { id: replacementSong.id, fallbackTitle: replacementSong.title });
    } else {
      setActivePlaylistId(null);
    }
  };

  const clearPlaylistDragState = () => {
    setDraggedPlaylistId(null);
    setPlaylistDropId(null);
  };

  const handlePlaylistDragStart = (event: React.DragEvent<HTMLDivElement>, song: PlaylistSong) => {
    setDraggedPlaylistId(song.id);
    setPlaylistDropId(song.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', song.id);
  };

  const handlePlaylistDragOver = (event: React.DragEvent<HTMLDivElement>, song: PlaylistSong) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (playlistDropId !== song.id) {
      setPlaylistDropId(song.id);
    }
  };

  const handlePlaylistDrop = (event: React.DragEvent<HTMLDivElement>, targetSong: PlaylistSong) => {
    event.preventDefault();
    const sourceId = draggedPlaylistId || event.dataTransfer.getData('text/plain');

    if (!sourceId || sourceId === targetSong.id) {
      clearPlaylistDragState();
      return;
    }

    setPlaylist(prev => {
      const sourceIndex = prev.findIndex(song => song.id === sourceId);
      const targetIndex = prev.findIndex(song => song.id === targetSong.id);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const next = [...prev];
      const [movedSong] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedSong);
      return next;
    });
    clearPlaylistDragState();
  };

  const formatSongPreview = (song: PlaylistSong | null) => {
    if (!song) return 'No song';
    return song.artist && song.artist !== 'Unknown Artist'
      ? `${song.title} - ${song.artist}`
      : song.title;
  };

  const onBeatClick = (beat: alphaTab.model.Beat) => {
    if (beat.notes.length > 0) {
      setSelectedNote(beat.notes[0]);
    } else {
      setSelectedNote(null);
    }
    // Seek to the beat when clicked in the notation view
    onSeek(getBeatPlaybackTick(beat), { scrollToCursor: false });
  };

  const getTrackNotesInPlaybackOrder = (track: alphaTab.model.Track) => {
      return track.staves
          .flatMap(staff => staff.bars.flatMap(bar => (
              bar.voices.flatMap(voice => (
                  voice.beats.flatMap(beat => beat.notes)
              ))
          )))
          .sort((a, b) => {
              const startDelta = getBeatPlaybackTick(a.beat) - getBeatPlaybackTick(b.beat);
              if (startDelta !== 0) return startDelta;
              return a.index - b.index;
          });
  };

  const moveSelectedNoteBy = (offset: number) => {
      const note = selectedNoteRef.current;
      if (!note) return;

      const notes = getTrackNotesInPlaybackOrder(note.beat.voice.bar.staff.track);
      const currentIndex = notes.findIndex(candidate => candidate === note);
      const nextNote = notes[currentIndex + offset];
      if (!nextNote) return;

      setSelectedNote(nextNote);
      onSeek(getBeatPlaybackTick(nextNote.beat));
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isTypingTarget(e.target)) return;

        if (e.code === 'Space') {
            e.preventDefault();
            editorRef.current?.playPause();
            return;
        }

        if (e.code === 'ArrowLeft' && selectedNoteRef.current) {
            e.preventDefault();
            moveSelectedNoteBy(-1);
            return;
        }

        if (e.code === 'ArrowRight' && selectedNoteRef.current) {
            e.preventDefault();
            moveSelectedNoteBy(1);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const onPositionChanged = (args: alphaTab.synth.PositionChangedEventArgs) => {
      setCurrentTick(args.currentTick);
      setPlaybackTime({
        currentTime: args.currentTime,
        endTime: args.endTime,
        tempo: Math.round(args.modifiedTempo || args.originalTempo || score?.tempo || 100)
      });
  };

  const getFileTempoAtTick = (tick: number) => {
      const tickCache = editorRef.current?.api?.tickCache;
      if (!tickCache?.masterBars.length) return score?.tempo || 100;

      const masterBar = tickCache.masterBars.find((lookup, index) => {
          const isLast = index === tickCache.masterBars.length - 1;
          return tick >= lookup.start && (tick < lookup.end || isLast);
      });
      if (!masterBar) return score?.tempo || 100;

      const tempoChange = [...masterBar.tempoChanges]
          .filter(change => change.tick <= tick)
          .sort((a, b) => b.tick - a.tick)[0];

      return tempoChange?.tempo || masterBar.tempo || score?.tempo || 100;
  };

  function onSeek(tick: number, options?: { scrollToCursor?: boolean }) {
      if (editorRef.current) {
          editorRef.current.seekToTick(tick, options);
      }
      setCurrentTick(tick);
      setPlaybackTime(prev => ({
          ...prev,
          tempo: Math.round(getFileTempoAtTick(tick) * playbackSpeed)
      }));
  }

  const getBarStartTicks = () => {
      if (!score) return [];
      let tick = 0;
      return score.masterBars.map(masterBar => {
          const startTick = tick;
          tick += masterBar.calculateDuration();
          return startTick;
      });
  };

  const getCurrentBarIndex = () => {
      const barStartTicks = getBarStartTicks();
      if (barStartTicks.length === 0) return 0;

      for (let i = barStartTicks.length - 1; i >= 0; i--) {
          if (currentTick >= barStartTicks[i]) {
              return i;
          }
      }
      return 0;
  };

  const seekToSongStart = () => {
      onSeek(0);
  };

  const seekByBars = (barOffset: number) => {
      const barStartTicks = getBarStartTicks();
      if (barStartTicks.length === 0) return;

      const nextBarIndex = Math.max(0, Math.min(barStartTicks.length - 1, getCurrentBarIndex() + barOffset));
      onSeek(barStartTicks[nextBarIndex]);
  };

  const handleTrackSettingsChange = (trackIndex: number, settings: Partial<TrackSettings>) => {
    setTrackSettings(prev => {
        const current = prev[trackIndex] || { volume: 8, pan: 0, mute: false, solo: false };
        const updated = { ...current, ...settings };
        
        // Apply to alphaTab synthesizer
        if (score && editorRef.current?.api?.player) {
            const track = score.tracks.find(t => t.index === trackIndex);
            if (track) {
                const player = editorRef.current.api.player;
                const channel = track.playbackInfo.primaryChannel;
                if (settings.volume !== undefined) player.setChannelVolume(channel, settings.volume / 15);
                if (settings.mute !== undefined) player.setChannelMute(channel, settings.mute);
                if (settings.solo !== undefined) player.setChannelSolo(channel, settings.solo);
                // Pan is tricky because IAlphaSynth doesn't have a direct setChannelPan, 
                // but we can update the model and hope the player picks it up or use raw midi if available.
                // For now we update the model.
                if (settings.pan !== undefined) track.playbackInfo.balance = settings.pan;
            }
        }

        return { ...prev, [trackIndex]: updated };
    });
  };

  const toggleTrack = (trackIndex: number) => {
    let newTracks: number[];
    if (selectionMode === 'single') {
        newTracks = [trackIndex];
    } else {
        if (activeTracks.includes(trackIndex)) {
          newTracks = activeTracks.filter(i => i !== trackIndex);
        } else {
          newTracks = [...activeTracks, trackIndex];
        }
    }
    
    if (newTracks.length === 0 && score) {
        newTracks = [orderedTracks[0]?.index ?? score.tracks[0].index];
    }

    setActiveTracks(newTracks);
  };

  const reorderTracks = (sourceTrackIndex: number, targetTrackIndex: number) => {
      if (!score || sourceTrackIndex === targetTrackIndex) return;

      const baseOrder = getTracksInOrder(score, trackOrder).map(track => track.index);
      const sourceIndex = baseOrder.indexOf(sourceTrackIndex);
      const targetIndex = baseOrder.indexOf(targetTrackIndex);
      if (sourceIndex < 0 || targetIndex < 0) return;

      const nextOrder = [...baseOrder];
      const [movedTrack] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, movedTrack);
      setTrackOrder(nextOrder);
  };

  const clearTrackDragState = () => {
      setDraggedTrackIndex(null);
      setTrackDropIndex(null);
  };

  const handleTrackDragStart = (event: React.DragEvent<HTMLElement>, trackIndex: number) => {
      setDraggedTrackIndex(trackIndex);
      setTrackDropIndex(trackIndex);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(trackIndex));
  };

  const handleTrackDragOver = (event: React.DragEvent<HTMLElement>, trackIndex: number) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (trackDropIndex !== trackIndex) {
          setTrackDropIndex(trackIndex);
      }
  };

  const handleTrackDrop = (event: React.DragEvent<HTMLElement>, trackIndex: number) => {
      event.preventDefault();
      const sourceTrackIndex = draggedTrackIndex ?? Number(event.dataTransfer.getData('text/plain'));
      if (!Number.isFinite(sourceTrackIndex)) {
          clearTrackDragState();
          return;
      }

      reorderTracks(sourceTrackIndex, trackIndex);
      clearTrackDragState();
  };

  const renameTrack = (trackIndex: number, nextName: string) => {
      if (!score) return;
      const track = score.tracks.find(item => item.index === trackIndex);
      const trimmedName = nextName.trim();
      if (!track || !trimmedName || track.name === trimmedName) return;

      track.name = trimmedName;
      setTrackNameRevision(revision => revision + 1);
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    editorRef.current?.setZoom(newZoom);
  };

  const updateTempo = (bpm: number) => {
      const nextTempo = Math.max(30, Math.min(240, Math.round(bpm)));
      const fileTempoAtCurrentTick = getFileTempoAtTick(currentTick);
      const nextPlaybackSpeed = nextTempo / fileTempoAtCurrentTick;
      setPlaybackSpeed(nextPlaybackSpeed);
      setPlaybackTime(prev => ({ ...prev, tempo: nextTempo }));
      editorRef.current?.setPlaybackSpeed(nextPlaybackSpeed);
  };

  const resetTempo = () => {
      if (!score) return;
      setPlaybackSpeed(1);
      editorRef.current?.setPlaybackSpeed(1);
      setPlaybackTime(prev => ({
          ...prev,
          tempo: Math.round(getFileTempoAtTick(currentTick))
      }));
  };

  const applyNotationVisibility = (nextShowStandardNotation: boolean, nextShowTablature: boolean) => {
      if (!nextShowStandardNotation && !nextShowTablature) return;

      setShowStandardNotation(nextShowStandardNotation);
      setShowTablature(nextShowTablature);

      if (score) {
          const tracksToRender = orderedTracks.filter(t => activeTracks.includes(t.index));
          editorRef.current?.setNotationVisibility(
              nextShowStandardNotation,
              nextShowTablature,
              tracksToRender.length ? tracksToRender : orderedTracks
          );
          editorRef.current?.setTabRhythmMode(
              nextShowTablature && !nextShowStandardNotation
                  ? showTabNoteDurations ? alphaTab.TabRhythmMode.ShowWithBeams : alphaTab.TabRhythmMode.Hidden
                  : alphaTab.TabRhythmMode.Automatic,
              tracksToRender.length ? tracksToRender : orderedTracks
          );
      }
  };

  const applyTabNoteDurations = (nextShowTabNoteDurations: boolean) => {
      setShowTabNoteDurations(nextShowTabNoteDurations);

      if (!score || !showTablature || showStandardNotation) return;

      const tracksToRender = orderedTracks.filter(t => activeTracks.includes(t.index));
      editorRef.current?.setTabRhythmMode(
          nextShowTabNoteDurations ? alphaTab.TabRhythmMode.ShowWithBeams : alphaTab.TabRhythmMode.Hidden,
          tracksToRender.length ? tracksToRender : orderedTracks
      );
  };

  const updateFret = (fret: number) => {
      const note = selectedNoteRef.current;
      if(note && editorRef.current?.api) {
          note.fret = Math.max(MIN_FRET, Math.min(MAX_FRET, fret));
          editorRef.current.api.score?.finish(editorRef.current.api.settings);
          editorRef.current.api.render();
          setSelectedNoteSnapshot(createSelectedNoteSnapshot(note));
      }
  }

  const moveSelectedNoteToString = (stringOffset: number) => {
      const note = selectedNoteRef.current;
      if (!note || !editorRef.current?.api) return;

      const stringCount = note.beat.voice.bar.staff.tuning.length;
      note.string = Math.max(1, Math.min(stringCount, note.string + stringOffset));
      editorRef.current.api.score?.finish(editorRef.current.api.settings);
      editorRef.current.api.render();
      setSelectedNoteSnapshot(createSelectedNoteSnapshot(note));
  };

  const rerenderEditedNote = () => {
      const api = editorRef.current?.api;
      if (!api) return;
      api.score?.finish(api.settings);
      api.render();
      setSelectedNoteSnapshot(createSelectedNoteSnapshot(selectedNoteRef.current));
  };

  const clearSelectedNoteBend = () => {
      const note = selectedNoteRef.current;
      if (!note) return;
      note.bendType = alphaTab.model.BendType.None;
      note.bendPoints = null;
      note.maxBendPoint = null;
  };

  const clearSelectedNoteSlide = () => {
      const note = selectedNoteRef.current;
      if (!note) return;
      if (note.slideTarget) {
          note.slideTarget.slideOrigin = null;
      }
      note.slideTarget = null;
      note.slideOutType = alphaTab.model.SlideOutType.None;
  };

  const clearSelectedNoteTie = () => {
      const note = selectedNoteRef.current;
      if (!note) return;
      if (note.tieDestination) {
          note.tieDestination.tieOrigin = null;
          note.tieDestination.isTieDestination = false;
      }
      if (note.tieOrigin) {
          note.tieOrigin.tieDestination = null;
      }
      note.tieOrigin = null;
      note.tieDestination = null;
      note.isTieDestination = false;
  };

  const clearSelectedNoteLetRing = () => {
      const note = selectedNoteRef.current;
      if (!note) return;
      if (note.letRingDestination) {
          note.letRingDestination.isLetRing = false;
      }
      note.isLetRing = false;
      note.letRingDestination = null;
  };

  const clearSelectedNoteHammerPull = () => {
      const note = selectedNoteRef.current;
      if (!note) return;
      const inferredOrigin = findHammerPullOriginForNote(note);
      if (inferredOrigin && inferredOrigin !== note) {
          inferredOrigin.isHammerPullOrigin = false;
          inferredOrigin.hammerPullDestination = null;
      }
      if (note.hammerPullDestination) {
          note.hammerPullDestination.hammerPullOrigin = null;
      }
      if (note.hammerPullOrigin) {
          note.hammerPullOrigin.isHammerPullOrigin = false;
          note.hammerPullOrigin.hammerPullDestination = null;
      }
      note.isHammerPullOrigin = false;
      note.hammerPullOrigin = null;
      note.hammerPullDestination = null;
  };

  const toggleTechnique = (technique: TechniqueId) => {
      const note = selectedNoteRef.current;
      if (!note) return;

      switch (technique) {
          case 'vibrato':
              note.vibrato = note.vibrato === alphaTab.model.VibratoType.None
                  ? alphaTab.model.VibratoType.Slight
                  : alphaTab.model.VibratoType.None;
              break;
          case 'bend':
              if (note.bendType !== alphaTab.model.BendType.None || note.hasBend) {
                  clearSelectedNoteBend();
              } else {
                  note.bendType = alphaTab.model.BendType.Bend;
                  note.bendStyle = alphaTab.model.BendStyle.Default;
                  note.bendPoints = [];
                  note.addBendPoint(new alphaTab.model.BendPoint(0, 0));
                  note.addBendPoint(new alphaTab.model.BendPoint(60, 4));
              }
              break;
          case 'slide': {
              if (note.slideOutType !== alphaTab.model.SlideOutType.None || note.slideTarget) {
                  clearSelectedNoteSlide();
              } else {
                  const nextNote = alphaTab.model.Note.nextNoteOnSameLine(note);
                  note.slideOutType = nextNote ? alphaTab.model.SlideOutType.Shift : alphaTab.model.SlideOutType.OutUp;
                  note.slideTarget = nextNote;
                  if (nextNote) {
                      nextNote.slideOrigin = note;
                  }
              }
              break;
          }
          case 'harmonic':
              if (note.harmonicType === alphaTab.model.HarmonicType.None) {
                  note.harmonicType = alphaTab.model.HarmonicType.Natural;
                  note.harmonicValue = 12;
              } else {
                  note.harmonicType = alphaTab.model.HarmonicType.None;
                  note.harmonicValue = 0;
              }
              break;
          case 'tap':
              note.isLeftHandTapped = !note.isLeftHandTapped;
              break;
          case 'grace':
              note.beat.graceType = note.beat.graceType === alphaTab.model.GraceType.None
                  ? alphaTab.model.GraceType.BeforeBeat
                  : alphaTab.model.GraceType.None;
              break;
          case 'mute':
              note.isPalmMute = !note.isPalmMute;
              break;
          case 'letRing':
              if (note.isLetRing || note.letRingDestination) {
                  clearSelectedNoteLetRing();
              } else {
                  note.isLetRing = true;
                  note.letRingDestination = alphaTab.model.Note.nextNoteOnSameLine(note);
              }
              break;
          case 'tie':
              if (note.isTieOrigin || note.isTieDestination || note.tieOrigin || note.tieDestination) {
                  clearSelectedNoteTie();
              } else {
                  const nextNote = alphaTab.model.Note.nextNoteOnSameLine(note);
                  if (!nextNote) return;
                  note.tieDestination = nextNote;
                  nextNote.tieOrigin = note;
                  nextNote.isTieDestination = true;
              }
              break;
          case 'hammerPull': {
              if (hasHammerPull(note)) {
                  clearSelectedNoteHammerPull();
              } else {
                  const nextNote = alphaTab.model.Note.findHammerPullDestination(note) || alphaTab.model.Note.nextNoteOnSameLine(note);
                  if (!nextNote) return;
                  note.isHammerPullOrigin = true;
                  note.hammerPullDestination = nextNote;
                  nextNote.hammerPullOrigin = note;
              }
              break;
          }
      }

      rerenderEditedNote();
  };

  const isTechniqueActive = (technique: TechniqueId) => {
      if (!selectedNote) return false;

      switch (technique) {
          case 'vibrato':
              return selectedNote.vibrato;
          case 'bend':
              return selectedNote.bend;
          case 'slide':
              return selectedNote.slide;
          case 'harmonic':
              return selectedNote.harmonic;
          case 'tap':
              return selectedNote.tap;
          case 'grace':
              return selectedNote.grace;
          case 'mute':
              return selectedNote.mute;
          case 'letRing':
              return selectedNote.letRing;
          case 'tie':
              return selectedNote.tie;
          case 'hammerPull':
              return selectedNote.hammerPull;
      }
  };

  const loadDemo = () => {
    loadScoreSource('https://www.alphatab.net/files/canon.gp', { fallbackTitle: 'Canon Rock' });
  };

  const switchAppView = (nextView: 'main' | 'preferences') => {
    setAppView(nextView);
    setIsAppMenuOpen(false);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }

    appContainerRef.current?.requestFullscreen();
  };

  return (
    <div className="app-container" ref={appContainerRef}>
      <main className="main-content">
        <header className="toolbar">
          <div className="app-menu">
            <button
              className={`icon-button menu-button ${isAppMenuOpen ? 'active' : ''}`}
              type="button"
              aria-label="Open menu"
              aria-expanded={isAppMenuOpen}
              onClick={() => setIsAppMenuOpen(open => !open)}
            >
              <img src="/tab-engine-icon.svg" alt="" />
            </button>
            {isAppMenuOpen && (
              <div className="app-menu-popover" role="menu">
                <button
                  className={appView === 'main' ? 'active' : ''}
                  type="button"
                  role="menuitem"
                  onClick={() => switchAppView('main')}
                >
                  <strong>Tab Engine</strong>
                  <span>Main app</span>
                </button>
                <button
                  className={appView === 'preferences' ? 'active' : ''}
                  type="button"
                  role="menuitem"
                  onClick={() => switchAppView('preferences')}
                >
                  <strong>Preferences</strong>
                  <span>User settings</span>
                </button>
              </div>
            )}
          </div>

          <div className="app-brand" aria-label="Tab Engine">
            <span>Tab Engine</span>
          </div>

          <div className="transport-cluster">
            <button className="icon-button transport-button" type="button" onClick={seekToSongStart} disabled={!score} aria-label="Previous">
              <Icon name="skip-back" />
            </button>
            <button className="icon-button transport-button" type="button" onClick={() => seekByBars(-1)} disabled={!score} aria-label="Rewind">
              <Icon name="rewind" />
            </button>
            <button className="play-button" type="button" onClick={() => editorRef.current?.playPause()} disabled={!score} aria-label={isPlaying ? 'Pause' : 'Play'}>
              <Icon name={isPlaying ? 'pause' : 'play'} />
            </button>
            <button className="icon-button transport-button" type="button" onClick={() => seekByBars(1)} disabled={!score} aria-label="Forward">
              <Icon name="fast-forward" />
            </button>
            <button className="icon-button transport-button" type="button" onClick={() => editorRef.current?.stop()} disabled={!score} aria-label="Stop">
              <Icon name="stop" />
            </button>
            <div className="time-readout">
              <span>{formatTime(playbackTime.currentTime)}</span>
              <span>/</span>
              <span>{formatTime(playbackTime.endTime)}</span>
            </div>
          </div>

          <div className="song-title-nav">
            <button
              className="song-nav-button previous-song"
              type="button"
              disabled={!previousPlaylistSong}
              onClick={() => previousPlaylistSong && switchPlaylistSong(previousPlaylistSong)}
              title={previousPlaylistSong ? `Previous song: ${formatSongPreview(previousPlaylistSong)}` : 'No previous song'}
              aria-label={previousPlaylistSong ? `Previous song, ${formatSongPreview(previousPlaylistSong)}` : 'No previous song'}
            >
              <Icon name="song-prev" />
              <span>
                <small>Previous</small>
                <strong>{previousPlaylistSong?.title || '-'}</strong>
              </span>
            </button>

            <div className="song-title-block">
              <strong>{songTitle}</strong>
              <span>{songArtist}</span>
            </div>

            <button
              className="song-nav-button next-song"
              type="button"
              disabled={!nextPlaylistSong}
              onClick={() => nextPlaylistSong && switchPlaylistSong(nextPlaylistSong)}
              title={nextPlaylistSong ? `Next song: ${formatSongPreview(nextPlaylistSong)}` : 'No next song'}
              aria-label={nextPlaylistSong ? `Next song, ${formatSongPreview(nextPlaylistSong)}` : 'No next song'}
            >
              <span>
                <small>Next</small>
                <strong>{nextPlaylistSong?.title || '-'}</strong>
              </span>
              <Icon name="song-next" />
            </button>
          </div>

          <div className="song-stats">
            <div className="tempo-control" aria-label="Tempo control">
              <span className="tempo-label">
                <img src="/music-icons/icons8-metronome-100.png" alt="" />
                Tempo
              </span>
              <input
                className="tempo-slider"
                type="range"
                min="30"
                max="240"
                step="1"
                value={Math.round(tempo)}
                disabled={!score}
                onChange={(e) => updateTempo(parseInt(e.target.value) || 30)}
                aria-label="Tempo slider"
              />
              <div className="tempo-number-control">
                <input
                  className="tempo-number"
                  type="number"
                  min="30"
                  max="240"
                  value={Math.round(tempo)}
                  disabled={!score}
                  onChange={(e) => updateTempo(parseInt(e.target.value) || 30)}
                  aria-label="Tempo BPM"
                />
                <div className="tempo-stepper">
                  <button
                    className="tempo-step-button tempo-step-up"
                    type="button"
                    disabled={!score}
                    onClick={() => updateTempo(tempo + 1)}
                    tabIndex={-1}
                    aria-label="Increase tempo"
                  />
                  <button
                    className="tempo-step-button tempo-step-down"
                    type="button"
                    disabled={!score}
                    onClick={() => updateTempo(tempo - 1)}
                    tabIndex={-1}
                    aria-label="Decrease tempo"
                  />
                </div>
              </div>
              <span className="tempo-unit">BPM</span>
              <button className="icon-button tempo-reset-button" type="button" disabled={!score} onClick={resetTempo} aria-label="Reset tempo to score default">
                <Icon name="reset" />
              </button>
            </div>
          </div>

          <div className="zoom-controls">
            <button className="icon-button" type="button" onClick={() => {
              const newZoom = Math.max(0.5, zoom - 0.1);
              setZoom(newZoom);
              editorRef.current?.setZoom(newZoom);
            }} aria-label="Zoom out"><Icon name="minus" /></button>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={handleZoomChange}
              aria-label="Zoom"
            />
            <span>{Math.round(zoom * 100)}%</span>
            <button className="icon-button" type="button" onClick={() => {
              const newZoom = Math.min(3, zoom + 0.1);
              setZoom(newZoom);
              editorRef.current?.setZoom(newZoom);
            }} aria-label="Zoom in"><Icon name="plus" /></button>
          </div>

          <div className="file-actions">
            <button className="ghost-button" type="button" onClick={loadDemo}>Demo</button>
            <label className="file-input-label">
              <img src="/music-icons/icons8-rhythm-100.png" alt="" />
              Load song
              <input type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" onChange={handleFileChange} />
            </label>
            <button
              className="icon-button fullscreen-button"
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <Icon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} />
            </button>
          </div>
        </header>

        <div className={`app-view-shell ${appView !== 'main' ? 'hidden-view' : ''}`}>
        <div className="workspace-layout">
          <aside className="left-panel">
            <div className="panel-tabs">
              <button className={leftPanelTab === 'tabs' ? 'active' : ''} type="button" onClick={() => setLeftPanelTab('tabs')}>Tabs</button>
              <button className={leftPanelTab === 'chords' ? 'active' : ''} type="button" onClick={() => setLeftPanelTab('chords')}>Chords</button>
              <button className={leftPanelTab === 'lyrics' ? 'active' : ''} type="button" onClick={() => setLeftPanelTab('lyrics')}>Lyrics</button>
            </div>

            {leftPanelTab === 'tabs' && (
              <>
                <section className="panel-section compact-section display-section">
                  <h2>Display</h2>
                  <div className="notation-toggle-list">
                    <label className="notation-toggle">
                      <span>Musical notation</span>
                      <input
                        type="checkbox"
                        checked={showStandardNotation}
                        disabled={!score || (!showTablature && showStandardNotation)}
                        onChange={(e) => applyNotationVisibility(e.target.checked, showTablature)}
                      />
                    </label>
                    <label className="notation-toggle">
                      <span>Tabs</span>
                      <input
                        type="checkbox"
                        checked={showTablature}
                        disabled={!score || (!showStandardNotation && showTablature)}
                        onChange={(e) => applyNotationVisibility(showStandardNotation, e.target.checked)}
                      />
                    </label>
                    {showTabDurationToggle && (
                      <label className="notation-toggle contextual-toggle">
                        <span>Note durations</span>
                        <input
                          type="checkbox"
                          checked={showTabNoteDurations}
                          disabled={!score}
                          onChange={(e) => applyTabNoteDurations(e.target.checked)}
                        />
                      </label>
                    )}
                  </div>
                </section>

                <section className="panel-section tracks-section">
                  <div className="section-title-row">
                    <h2>Tracks</h2>
                    <button className="icon-button" type="button" aria-label="Add track">
                      <Icon name="plus" />
                    </button>
                  </div>
                  <div className="side-track-list">
                    {score ? orderedTracks.map((track, trackPosition) => {
                      const settings = trackSettings[track.index] || { volume: 8, pan: 0, mute: false, solo: false };
                      const active = activeTracks.includes(track.index);
                      const previousTrack = orderedTracks[trackPosition - 1];
                      const nextTrack = orderedTracks[trackPosition + 1];
                      return (
                        <div
                          key={track.index}
                          className={[
                            'side-track',
                            active ? 'active' : ''
                          ].filter(Boolean).join(' ')}
                        >
                          <div className="side-track-header">
                            <div className="track-order-controls" aria-label={`Reorder ${track.name}`}>
                              <button
                                type="button"
                                disabled={!previousTrack}
                                onClick={() => previousTrack && reorderTracks(track.index, previousTrack.index)}
                                aria-label={`Move ${track.name} up`}
                                title="Move track up"
                              >
                                <Icon name="arrow-up" />
                              </button>
                              <button
                                type="button"
                                disabled={!nextTrack}
                                onClick={() => nextTrack && reorderTracks(track.index, nextTrack.index)}
                                aria-label={`Move ${track.name} down`}
                                title="Move track down"
                              >
                                <Icon name="arrow-down" />
                              </button>
                            </div>
                            <button className="track-main" type="button" onClick={() => toggleTrack(track.index)}>
                              <InstrumentIcon track={track} className="track-badge" />
                              <span>
                                <strong>{trackPosition + 1}. {track.name}</strong>
                                <small>{getInstrumentCategory(track)}</small>
                              </span>
                            </button>
                            <button className={`mini-toggle solo ${settings.solo ? 'active' : ''}`} type="button" onClick={() => handleTrackSettingsChange(track.index, { solo: !settings.solo })}>S</button>
                            <button className={`mini-toggle mute ${settings.mute ? 'active' : ''}`} type="button" onClick={() => handleTrackSettingsChange(track.index, { mute: !settings.mute })}>M</button>
                          </div>
                          <div className="side-track-controls">
                            <label className="track-mix-control">
                              <span className="control-label">Vol {settings.volume}</span>
                              <input
                                type="range"
                                min="0"
                                max="15"
                                step="1"
                                value={settings.volume}
                                draggable={false}
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.preventDefault()}
                                onChange={(e) => handleTrackSettingsChange(track.index, { volume: parseInt(e.target.value) })}
                                aria-label={`${track.name} volume`}
                              />
                            </label>
                            <label className="track-mix-control">
                              <span className="control-label">Pan {formatPan(settings.pan)}</span>
                              <input
                                type="range"
                                min="-10"
                                max="10"
                                step="1"
                                value={settings.pan}
                                draggable={false}
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.preventDefault()}
                                onChange={(e) => handleTrackSettingsChange(track.index, { pan: parseInt(e.target.value) })}
                                aria-label={`${track.name} pan`}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="empty-panel-state">Load a Guitar Pro file to populate tracks.</div>
                    )}
                  </div>
                  <button className="add-track-button" type="button">
                    <Icon name="plus" />
                    Add track
                  </button>
                </section>

                <section className="panel-section info-section">
                  <h2>Information</h2>
                  <dl>
                    <div><dt>Title</dt><dd>{score?.title || '-'}</dd></div>
                    <div><dt>Artist</dt><dd>{score?.artist || '-'}</dd></div>
                    <div><dt>Album</dt><dd>{score?.album || '-'}</dd></div>
                    <div><dt>Transcribed by</dt><dd>{score?.tab || '-'}</dd></div>
                    <div><dt>Music</dt><dd>{score?.music || '-'}</dd></div>
                    <div><dt>Words</dt><dd>{score?.words || '-'}</dd></div>
                  </dl>
                </section>
              </>
            )}

            {leftPanelTab === 'chords' && (
              <section className="chords-panel">
                <h2>Chords</h2>
                {songChords.length > 0 ? (
                  <>
                    <div className="chord-summary-grid">
                      {chordCounts.map(chord => (
                        <button
                          className="chord-chip"
                          type="button"
                          key={chord.name}
                          onClick={() => {
                            const firstOccurrence = songChords.find(item => item.name === chord.name);
                            if (firstOccurrence) onSeek(firstOccurrence.tick);
                          }}
                        >
                          <strong>{chord.name}</strong>
                          <span>{chord.count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="chord-progression-list">
                      {songChords.map(chord => (
                        <button
                          className="chord-progression-item"
                          type="button"
                          key={chord.id}
                          onClick={() => onSeek(chord.tick)}
                        >
                          <span>Bar {chord.barNumber}</span>
                          <strong>{chord.name}</strong>
                          <small>{chord.trackName}</small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="chords-empty-state">
                    <div className="coming-soon-graphic chord-graphic" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <strong>Cmaj7</strong>
                    </div>
                    <h3>No embedded chords</h3>
                    <p>This file does not include chord annotations.</p>
                  </div>
                )}
              </section>
            )}

            {leftPanelTab === 'lyrics' && (
              <section className="lyrics-panel">
                <h2>Lyrics</h2>
                {trackLyrics.length > 0 ? (
                  <div className="lyrics-track-list">
                    {trackLyrics.map(track => (
                      <article className="lyrics-track-card" key={track.trackIndex}>
                        <h3>{track.trackName}</h3>
                        {track.lines.map((line, index) => (
                          <p key={`${track.trackIndex}-${index}`}>{line}</p>
                        ))}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="lyrics-empty-state">
                    <div className="coming-soon-graphic lyrics-graphic" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <strong>La</strong>
                    </div>
                    <h3>No embedded lyrics</h3>
                    <p>Lyrics were not found in this Guitar Pro file. Use an authorized public source for the full text.</p>
                    {score && (
                      <a href={lyricSearchUrl} target="_blank" rel="noreferrer">
                        Search public sources
                      </a>
                    )}
                  </div>
                )}
              </section>
            )}
          </aside>

          <section className="center-stage">
            <div className="editor-container">
              <AlphaTabEditor
                ref={editorRef}
                onScoreLoaded={onScoreLoaded}
                onPlaybackStatusChanged={setIsPlaying}
                onBeatClick={onBeatClick}
                onPositionChanged={onPositionChanged}
              />
            </div>
          </section>

          <aside className="right-panel">
            <div className="inspector-tabs">
              <button className={rightPanelTab === 'song' ? 'active' : ''} type="button" onClick={() => setRightPanelTab('song')}>
                <img src="/music-icons/icons8-music-heart-100.png" alt="" />
                Song
              </button>
              <button className={rightPanelTab === 'playlist' ? 'active' : ''} type="button" onClick={() => setRightPanelTab('playlist')}>
                <img src="/music-icons/icons8-albums-100.png" alt="" />
                Playlist
              </button>
            </div>

            {rightPanelTab === 'song' && (
              <>
                <section className="panel-section">
                  <h2>Instrument</h2>
                  <div className="instrument-card">
                    <InstrumentIcon track={selectedTrack} className="instrument-icon" />
                    <div>
                      <strong>{selectedTrack?.name || 'No track selected'}</strong>
                      <small>{getInstrumentCategory(selectedTrack)} - Vol {selectedTrackSettings.volume}</small>
                    </div>
                  </div>
                </section>

                <section className="panel-section compact-section">
                  <h2>Tuning</h2>
                  <div className="tuning-card">
                    <img src="/music-icons/icons8-tuning-fork-100.png" alt="" />
                    <div>
                      <strong>{tuningName}</strong>
                      <span>{tuningNotes}</span>
                    </div>
                  </div>
                </section>

                {selectedNote && (
                  <section className="panel-section compact-section">
                    <div className="section-title-row">
                      <h2>Edit Note</h2>
                    </div>
                    <label className="field-row">
                      <span>Fret</span>
                      <div className="fret-number-control">
                        <input
                          className="tempo-number fret-number"
                          type="number"
                          min="0"
                          max="24"
                          value={selectedNote.fret}
                          onChange={(e) => updateFret(parseInt(e.target.value) || 0)}
                          aria-label="Fret number"
                        />
                        <div className="tempo-stepper">
                          <button
                            className="tempo-step-button tempo-step-up"
                            type="button"
                            disabled={selectedNote.fret >= MAX_FRET}
                            onClick={() => updateFret(selectedNote.fret + 1)}
                            tabIndex={-1}
                            aria-label="Increase fret"
                          />
                          <button
                            className="tempo-step-button tempo-step-down"
                            type="button"
                            disabled={selectedNote.fret <= MIN_FRET}
                            onClick={() => updateFret(Math.max(0, selectedNote.fret - 1))}
                            tabIndex={-1}
                            aria-label="Decrease fret"
                          />
                        </div>
                      </div>
                    </label>
                    <div className="note-edit-button-row">
                      <button
                        type="button"
                        disabled={selectedNote.string >= selectedNote.stringCount}
                        onClick={() => moveSelectedNoteToString(1)}
                        aria-label="Move note to next string"
                        title="Move note to next string"
                      >
                        <Icon name="arrow-up" />
                      </button>
                      <button
                        type="button"
                        disabled={selectedNote.string <= 1}
                        onClick={() => moveSelectedNoteToString(-1)}
                        aria-label="Move note to previous string"
                        title="Move note to previous string"
                      >
                        <Icon name="arrow-down" />
                      </button>
                      <button
                        type="button"
                        disabled={selectedNote.fret >= MAX_FRET}
                        onClick={() => updateFret(selectedNote.fret + 1)}
                        aria-label="Increase fret"
                        title="Increase fret"
                      >
                        <Icon name="plus" />
                      </button>
                      <button
                        type="button"
                        disabled={selectedNote.fret <= MIN_FRET}
                        onClick={() => updateFret(selectedNote.fret - 1)}
                        aria-label="Decrease fret"
                        title="Decrease fret"
                      >
                        <Icon name="minus" />
                      </button>
                    </div>
                  </section>
                )}

                <section className="panel-section compact-section">
                  <h2>Technique</h2>
                  <div className="technique-grid">
                    {TECHNIQUES.map(technique => (
                      <button
                        className={isTechniqueActive(technique.id) ? 'active' : ''}
                        type="button"
                        key={technique.id}
                        disabled={!selectedNote}
                        onClick={() => toggleTechnique(technique.id)}
                      >
                        {technique.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            {rightPanelTab === 'playlist' && (
              <section className="panel-section playlist-section">
                <h2>Playlist</h2>
                {playlist.length > 0 ? (
                  <div className="playlist-list">
                    {playlist.map((song, index) => (
                      <div
                        className={[
                          'playlist-item',
                          song.id === activePlaylistId ? 'active' : '',
                          song.id === draggedPlaylistId ? 'dragging' : '',
                          song.id === playlistDropId && song.id !== draggedPlaylistId ? 'drop-target' : ''
                        ].filter(Boolean).join(' ')}
                        key={song.id}
                        draggable
                        onDragStart={(event) => handlePlaylistDragStart(event, song)}
                        onDragOver={(event) => handlePlaylistDragOver(event, song)}
                        onDrop={(event) => handlePlaylistDrop(event, song)}
                        onDragEnd={clearPlaylistDragState}
                      >
                        <button className="playlist-select" type="button" onClick={() => switchPlaylistSong(song)}>
                          <span className="playlist-index">{index + 1}</span>
                          <span className="playlist-meta">
                            <strong>{song.title}</strong>
                            <small>
                              {song.artist}
                              {song.album ? ` - ${song.album}` : ''}
                            </small>
                            <em>{song.trackCount} {song.trackCount === 1 ? 'track' : 'tracks'}</em>
                          </span>
                        </button>
                        <button
                          className="playlist-delete-button"
                          type="button"
                          onClick={() => deletePlaylistSong(song)}
                          aria-label={`Remove ${song.title} from playlist`}
                          title={`Remove ${song.title}`}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="playlist-empty">
                    <strong>No songs loaded</strong>
                    <span>Open a Guitar Pro file to add it here.</span>
                  </div>
                )}
                <label className="playlist-load-button">
                  <Icon name="plus" />
                  Add song to playlist
                  <input type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" onChange={handleFileChange} />
                </label>
              </section>
            )}
          </aside>
        </div>

        <TimelineView
            key={activePlaylistId || 'timeline-empty'}
            score={score}
            orderedTrackIndices={trackOrder}
            activeTracks={activeTracks}
            onToggleTrack={toggleTrack}
            draggedTrackIndex={draggedTrackIndex}
            trackDropIndex={trackDropIndex}
            onTrackDragStart={handleTrackDragStart}
            onTrackDragOver={handleTrackDragOver}
            onTrackDrop={handleTrackDrop}
            onTrackDragEnd={clearTrackDragState}
            currentTick={currentTick}
            onSeek={onSeek}
            timelineMode={timelineMode}
            onTimelineModeChange={setTimelineMode}
            snapToBarStart={snapToBarStart}
            onSnapToBarStartChange={setSnapToBarStart}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            trackSettings={trackSettings}
            onTrackSettingsChange={handleTrackSettingsChange}
            onRenameTrack={renameTrack}
        />
        </div>

        {appView === 'preferences' && (
          <section className="preferences-view">
            <div className="preferences-header">
              <span>Tab Engine</span>
              <h1>Preferences</h1>
            </div>

            <div className="preferences-grid">
              <section className="preferences-panel">
                <h2>Display</h2>
                <label className="preference-row">
                  <span>Musical notation</span>
                  <input
                    type="checkbox"
                    checked={showStandardNotation}
                    disabled={!score || (!showTablature && showStandardNotation)}
                    onChange={(e) => applyNotationVisibility(e.target.checked, showTablature)}
                  />
                </label>
                <label className="preference-row">
                  <span>Tabs</span>
                  <input
                    type="checkbox"
                    checked={showTablature}
                    disabled={!score || (!showStandardNotation && showTablature)}
                    onChange={(e) => applyNotationVisibility(showStandardNotation, e.target.checked)}
                  />
                </label>
                {showTabDurationToggle && (
                  <label className="preference-row">
                    <span>Note durations</span>
                    <input
                      type="checkbox"
                      checked={showTabNoteDurations}
                      disabled={!score}
                      onChange={(e) => applyTabNoteDurations(e.target.checked)}
                    />
                  </label>
                )}
              </section>

              <section className="preferences-panel">
                <h2>Default Track</h2>
                <div className="preference-choice-list" role="radiogroup" aria-label="Default track type">
                  {[
                    { value: 'guitar', label: 'Guitar' },
                    { value: 'bass', label: 'Bass' },
                    { value: 'drums', label: 'Drums' }
                  ].map(option => (
                    <label className="preference-choice" key={option.value}>
                      <span>{option.label}</span>
                      <input
                        type="radio"
                        name="default-track-type"
                        value={option.value}
                        checked={defaultTrackType === option.value}
                        onChange={() => setDefaultTrackType(option.value as DefaultTrackType)}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="preferences-panel">
                <h2>Timeline</h2>
                <label className="preference-row">
                  <span>Snap to bar start</span>
                  <input
                    type="checkbox"
                    checked={snapToBarStart}
                    onChange={(e) => setSnapToBarStart(e.target.checked)}
                  />
                </label>
                <div className="preference-choice-list" role="radiogroup" aria-label="Default timeline view">
                  {[
                    { value: 'bars', label: 'Bars' },
                    { value: 'timeline', label: 'Timeline' }
                  ].map(option => (
                    <label className="preference-choice" key={option.value}>
                      <span>{option.label}</span>
                      <input
                        type="radio"
                        name="default-timeline-view"
                        value={option.value}
                        checked={timelineMode === option.value}
                        onChange={() => setTimelineMode(option.value as TimelineMode)}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="preferences-panel">
                <h2>Track Selection</h2>
                <div className="preference-choice-list" role="radiogroup" aria-label="Default track selection mode">
                  {[
                    { value: 'single', label: 'Single' },
                    { value: 'multi', label: 'Multi' }
                  ].map(option => (
                    <label className="preference-choice" key={option.value}>
                      <span>{option.label}</span>
                      <input
                        type="radio"
                        name="default-selection-mode"
                        value={option.value}
                        checked={selectionMode === option.value}
                        onChange={() => setSelectionMode(option.value as SelectionMode)}
                      />
                    </label>
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}

        <footer className="app-footer">
          <span className="footer-credit">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
            <span>
              Made with love of music by{' '}
              <a href="http://sebastianungureanu.com/" target="_blank" rel="noreferrer">
                Sebastian Ungureanu
              </a>
              .
            </span>
          </span>
          <a
            className="footer-repo-link"
            href="https://github.com/sebastian-ungureanu/tabengine"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/GitHub_Invertocat_White.svg" alt="" />
            sebastian-ungureanu/tabengine
          </a>
        </footer>
      </main>
    </div>
  );
}

export default App;
