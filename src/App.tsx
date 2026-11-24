import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import * as alphaTab from '@coderline/alphatab';
import AlphaTabEditor, { type AlphaTabEditorRef, type TabCellClickEvent, type TabCellSelection } from './components/AlphaTabEditor';
import InstrumentIcon from './components/InstrumentIcon';
import TimelineView, { type TimelineViewRef, type TrackSettings } from './components/TimelineView';
import { ToolbarButton, ToolbarTooltipPortalProvider } from './components/ToolbarButton';
import { assetPath } from './utils/assetPaths';
import { repairGpBufferIfNeeded } from './utils/gpFileRepair';
import {
  applyInstrumentPresetToTrack,
  DEFAULT_TRACK_INSTRUMENT_ID,
  getDefaultInstrumentIdForTrackType,
  getInstrumentCategory,
  getTrackInstrumentPreset,
  getTrackInstrumentPresetById,
  TRACK_INSTRUMENT_GROUPS
} from './utils/instruments';
import { computeBarTiming, findBarIndexAtTick, getBeatPlaybackTick, getTracksInOrder } from './utils/scoreUtils';
import './App.css';

type IconName = 'skip-back' | 'rewind' | 'play' | 'pause' | 'fast-forward' | 'stop' | 'minus' | 'plus' | 'arrow-up' | 'arrow-down' | 'metronome' | 'count-in' | 'reset' | 'song-prev' | 'song-next' | 'trash' | 'moon' | 'sun' | 'fullscreen' | 'fullscreen-exit';
type ThemeMode = 'dark' | 'light';

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
  isDead: boolean;
  string: number;
  stringCount: number;
  isStringed: boolean;
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

interface SelectedBeatSnapshot {
  duration: alphaTab.model.Duration;
  dots: number;
  isTriplet: boolean;
  isRest: boolean;
  noteCount: number;
  beatCountInVoice: number;
  barNumber: number;
  isStringed: boolean;
}

type TechniqueId = 'vibrato' | 'bend' | 'slide' | 'harmonic' | 'tap' | 'grace' | 'mute' | 'letRing' | 'tie' | 'hammerPull';
type DefaultTrackType = 'guitar' | 'bass' | 'drums';
type TimelineMode = 'bars' | 'timeline';
type SelectionMode = 'single' | 'multi';
type SidebarSectionId = 'display' | 'instrument' | 'tuning' | 'edit-note' | 'technique';

interface ScoreMetadata {
  title: string;
  artist: string;
  album: string;
  tab: string;
  music: string;
  words: string;
}

type MetadataFieldKey = keyof ScoreMetadata;

const EMPTY_SCORE_METADATA: ScoreMetadata = {
  title: '',
  artist: '',
  album: '',
  tab: '',
  music: '',
  words: ''
};

const METADATA_FIELDS: Array<{ key: MetadataFieldKey; label: string; id: string }> = [
  { key: 'title', label: 'Title', id: 'score-meta-title' },
  { key: 'artist', label: 'Artist', id: 'score-meta-artist' },
  { key: 'album', label: 'Album', id: 'score-meta-album' },
  { key: 'tab', label: 'Transcribed by', id: 'score-meta-tab' },
  { key: 'music', label: 'Music', id: 'score-meta-music' },
  { key: 'words', label: 'Words', id: 'score-meta-words' }
];

const extractScoreMetadata = (loadedScore: alphaTab.model.Score | null): ScoreMetadata => {
  if (!loadedScore) return EMPTY_SCORE_METADATA;
  return {
    title: loadedScore.title || '',
    artist: loadedScore.artist || '',
    album: loadedScore.album || '',
    tab: loadedScore.tab || '',
    music: loadedScore.music || '',
    words: loadedScore.words || ''
  };
};

const TECHNIQUES: Array<{ id: TechniqueId; label: string; title: string }> = [
  { id: 'vibrato', label: 'Vib', title: 'Vibrato' },
  { id: 'bend', label: 'Bend', title: 'Bend' },
  { id: 'slide', label: 'Slide', title: 'Slide' },
  { id: 'harmonic', label: 'Harm', title: 'Natural harmonic' },
  { id: 'tap', label: 'Tap', title: 'Left-hand tap' },
  { id: 'grace', label: 'Grace', title: 'Grace note' },
  { id: 'mute', label: 'Mute', title: 'Palm mute' },
  { id: 'letRing', label: 'Let ring', title: 'Let ring' },
  { id: 'tie', label: 'Tie', title: 'Tie' },
  { id: 'hammerPull', label: 'H/P', title: 'Hammer-on / Pull-off' }
];

const GETTING_STARTED_STEPS = [
  {
    title: 'Load a song',
    description: 'Open a Guitar Pro file from your device, or start with the demo song to explore the workspace.',
    imageSrc: assetPath('screenshots/step1.png'),
    imageAlt: 'Playlist with loaded songs'
  },
  {
    title: 'Configure your view',
    description: 'Select your preferred view, instrument, and playback behavior. Reorder, mute, solo, or balance parts as needed.',
    imageSrc: assetPath('screenshots/step2.png'),
    imageAlt: 'Rendered sheet music and tablature'
  },
  {
    title: 'Play and enjoy',
    description: 'Use playback, tempo, zoom, timeline navigation, and note tools to practice or edit the arrangement.',
    imageSrc: assetPath('screenshots/step3.png'),
    imageAlt: 'Timeline view with arranged instrument tracks'
  }
];

const HAMMER_PULL_LOOKUP_BAR_OFFSET = 3;
const MIN_FRET = 0;
const MAX_FRET = 24;
const FRET_MULTI_DIGIT_WINDOW_MS = 900;
const SELECTED_NOTE_COLOR = new alphaTab.model.Color(124, 58, 237, 255);
const SELECTED_NOTE_SUB_ELEMENTS: alphaTab.model.NoteSubElement[] = [
  alphaTab.model.NoteSubElement.GuitarTabFretNumber,
  alphaTab.model.NoteSubElement.GuitarTabEffects,
  alphaTab.model.NoteSubElement.StandardNotationNoteHead,
  alphaTab.model.NoteSubElement.StandardNotationAccidentals,
  alphaTab.model.NoteSubElement.StandardNotationEffects,
  alphaTab.model.NoteSubElement.SlashNoteHead,
  alphaTab.model.NoteSubElement.NumberedNumber
];

const SELECTED_BEAT_REST_SUB_ELEMENTS: alphaTab.model.BeatSubElement[] = [
  alphaTab.model.BeatSubElement.StandardNotationRests,
  alphaTab.model.BeatSubElement.GuitarTabRests,
  alphaTab.model.BeatSubElement.SlashRests,
  alphaTab.model.BeatSubElement.NumberedRests
];

const DURATION_OPTIONS: Array<{
  duration: alphaTab.model.Duration;
  label: string;
  title: string;
}> = [
  { duration: alphaTab.model.Duration.Whole, label: '1', title: 'Whole (1/1)' },
  { duration: alphaTab.model.Duration.Half, label: '1/2', title: 'Half (1/2)' },
  { duration: alphaTab.model.Duration.Quarter, label: '1/4', title: 'Quarter (1/4)' },
  { duration: alphaTab.model.Duration.Eighth, label: '1/8', title: 'Eighth (1/8)' },
  { duration: alphaTab.model.Duration.Sixteenth, label: '1/16', title: 'Sixteenth (1/16)' },
  { duration: alphaTab.model.Duration.ThirtySecond, label: '1/32', title: 'Thirty-second (1/32)' },
  { duration: alphaTab.model.Duration.SixtyFourth, label: '1/64', title: 'Sixty-fourth (1/64)' }
];

const createSelectedNoteStyle = (baseStyle: alphaTab.model.NoteStyle | undefined): alphaTab.model.NoteStyle => {
  const style = new alphaTab.model.NoteStyle();
  if (baseStyle) {
    style.noteHead = baseStyle.noteHead;
    style.noteHeadCenterOnStem = baseStyle.noteHeadCenterOnStem;
    baseStyle.colors.forEach((color, key) => {
      style.colors.set(key, color);
    });
  }
  for (const element of SELECTED_NOTE_SUB_ELEMENTS) {
    style.colors.set(element, SELECTED_NOTE_COLOR);
  }
  return style;
};

const createSelectedBeatRestStyle = (baseStyle: alphaTab.model.BeatStyle | undefined): alphaTab.model.BeatStyle => {
  const style = new alphaTab.model.BeatStyle();
  if (baseStyle) {
    baseStyle.colors.forEach((color, key) => {
      style.colors.set(key, color);
    });
  }
  for (const element of SELECTED_BEAT_REST_SUB_ELEMENTS) {
    style.colors.set(element, SELECTED_NOTE_COLOR);
  }
  return style;
};
const MAX_TRACK_VOLUME = 16;
const PAN_CENTER_BALANCE = 8;
const MIN_PAN = -8;
const MAX_PAN = 8;
const MIN_TUNING_MIDI = 16; // E0
const MAX_TUNING_MIDI = 88; // E6
const MIN_CAPO = 0;
const MAX_CAPO = 12;
const TUNING_STRING_COUNTS = [4, 5, 6, 7] as const;
const DEFAULT_TRACK_SETTINGS: TrackSettings = { volume: 8, pan: 0, mute: false, solo: false };

const TUNING_MIDI_OPTIONS: ReadonlyArray<{ midi: number; label: string }> = Array.from(
  { length: MAX_TUNING_MIDI - MIN_TUNING_MIDI + 1 },
  (_, offset) => {
    const midi = MIN_TUNING_MIDI + offset;
    return {
      midi,
      label: alphaTab.model.Tuning.getTextForTuning(midi, true)
    };
  }
);

interface TuningPresetOption {
  key: string;
  name: string;
  tunings: number[];
  isStandard: boolean;
  notesLabel: string;
}

const formatTuningNotesLowToHigh = (tunings: number[], includeOctave = false) => {
  return [...tunings]
    .reverse()
    .map(midi => alphaTab.model.Tuning.getTextForTuning(midi, includeOctave))
    .join(' ');
};

const getTuningPresetsForStringCount = (stringCount: number): TuningPresetOption[] => {
  if (alphaTab.model.Tuning.getPresetsFor(6).length === 0) {
    alphaTab.model.Tuning.initialize();
  }

  const rawPresets = alphaTab.model.Tuning.getPresetsFor(stringCount);
  const seenKeys = new Set<string>();
  const presets: TuningPresetOption[] = [];

  for (const preset of rawPresets) {
    const key = preset.tunings.join(',');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    presets.push({
      key,
      name: preset.name,
      tunings: [...preset.tunings],
      isStandard: preset.isStandard,
      notesLabel: formatTuningNotesLowToHigh(preset.tunings, false)
    });
  }

  return presets;
};

const buildTuningModel = (tunings: number[], preferredName?: string): alphaTab.model.Tuning => {
  if (alphaTab.model.Tuning.getPresetsFor(6).length === 0) {
    alphaTab.model.Tuning.initialize();
  }
  const matched = alphaTab.model.Tuning.findTuning(tunings);
  if (matched) {
    return new alphaTab.model.Tuning(matched.name, [...tunings], matched.isStandard);
  }
  return new alphaTab.model.Tuning(preferredName?.trim() || 'Custom Tuning', [...tunings], false);
};

const clampStaffNotesToStringCount = (staff: alphaTab.model.Staff, stringCount: number) => {
  for (const bar of staff.bars) {
    for (const voice of bar.voices) {
      for (const beat of voice.beats) {
        let changed = false;
        for (const note of beat.notes) {
          if (note.string > stringCount) {
            let targetString = stringCount;
            while (
              targetString > 1 &&
              beat.notes.some(other => other !== note && other.string === targetString)
            ) {
              targetString -= 1;
            }
            note.string = targetString;
            changed = true;
          }
        }
        if (changed) {
          beat.noteStringLookup.clear();
          for (const note of beat.notes) {
            if (note.string >= 0) {
              beat.noteStringLookup.set(note.string, note);
            }
          }
        }
      }
    }
  }
};

const cloneScoreSource = (source: unknown) => {
  return source instanceof ArrayBuffer ? source.slice(0) : source;
};

const balanceToPan = (balance: number) => Math.max(MIN_PAN, Math.min(MAX_PAN, Math.round(balance) - PAN_CENTER_BALANCE));
const panToBalance = (pan: number) => Math.max(0, Math.min(16, Math.round(pan) + PAN_CENTER_BALANCE));

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
    case 'count-in':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.5 3h13" />
          <path d="M5.5 21h13" />
          <path d="M7.5 3v3Q7.5 9.2 12 12Q16.5 9.2 16.5 6V3" />
          <path d="M7.5 21v-3Q7.5 14.8 12 12Q16.5 14.8 16.5 18v3" />
          <path className="count-in-sand" d="M9.8 6.8h4.4L12 9.4Z" />
          <path className="count-in-sand" d="M9.6 20 12 17.2 14.4 20Z" />
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
    case 'moon':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.4 14.6A8 8 0 0 1 9.4 3.6 8.5 8.5 0 1 0 20.4 14.6Z" />
        </svg>
      );
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
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

const TechniqueIcon = ({ id }: { id: TechniqueId }) => {
  switch (id) {
    case 'vibrato':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 12c1.6-3.6 3.1-3.6 4.75 0s3.15 3.6 4.75 0 3.15-3.6 4.75 0 3.15 3.6 4.75 0" />
        </svg>
      );
    case 'bend':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18.5h3c4.6 0 7.5-3 7.5-8.5V5.5" />
          <path d="M12 9l3.5-3.5L19 9" />
        </svg>
      );
    case 'slide':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="17.5" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="18" cy="6.5" r="2.2" fill="currentColor" stroke="none" />
          <path d="M8.4 15.3 15.6 8.7" />
        </svg>
      );
    case 'harmonic':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" />
        </svg>
      );
    case 'tap':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 9h7" />
          <path d="M12 9v6.8" />
        </svg>
      );
    case 'grace':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="6.8" cy="16.2" rx="2.1" ry="1.6" transform="rotate(-20 6.8 16.2)" fill="currentColor" stroke="none" />
          <path d="M8.7 15.6V6.2c2.1.7 3.4 1.9 3.6 3.8" />
          <path d="M6.2 10.6 12.6 6.4" />
          <ellipse cx="17.2" cy="16.2" rx="2.9" ry="2.2" transform="rotate(-20 17.2 16.2)" fill="currentColor" stroke="none" />
          <path d="M8.4 19.2c1.8 1.4 4.8 1.4 6.6 0" />
        </svg>
      );
    case 'mute':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 14V6.5h2.8a2.1 2.1 0 0 1 0 4.2H4" />
          <circle cx="10.4" cy="13.6" r="0.9" fill="currentColor" stroke="none" />
          <path d="M12.8 14V6.5l3.1 4.2 3.1-4.2V14" />
          <path d="M4 18.2h16" strokeDasharray="2.5 2.5" />
        </svg>
      );
    case 'letRing':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="7" cy="12" r="2.4" fill="currentColor" stroke="none" />
          <path d="M11.6 9.1a4.1 4.1 0 0 1 0 5.8" />
          <path d="M14.9 6.8a7.4 7.4 0 0 1 0 10.4" />
          <path d="M18.2 4.6a10.6 10.6 0 0 1 0 14.8" />
        </svg>
      );
    case 'tie':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="6.5" cy="10.2" rx="2.7" ry="2.1" transform="rotate(-18 6.5 10.2)" fill="currentColor" stroke="none" />
          <ellipse cx="17.5" cy="10.2" rx="2.7" ry="2.1" transform="rotate(-18 17.5 10.2)" fill="currentColor" stroke="none" />
          <path d="M6.8 14.3c2.2 3.7 8.2 3.7 10.4 0" />
        </svg>
      );
    case 'hammerPull':
      return (
        <svg className="technique-icon" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="6.5" cy="17.2" rx="2.6" ry="2" transform="rotate(-18 6.5 17.2)" fill="currentColor" stroke="none" />
          <ellipse cx="17.5" cy="14" rx="2.6" ry="2" transform="rotate(-18 17.5 14)" fill="currentColor" stroke="none" />
          <path d="M6.2 13.2C8 7.5 14.2 6 17.6 10" />
        </svg>
      );
  }
};

const DurationIcon = ({ duration }: { duration: alphaTab.model.Duration }) => {
  if (duration === alphaTab.model.Duration.Whole) {
    return (
      <svg className="duration-icon" viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="13.5" rx="5.2" ry="3.6" transform="rotate(-14 12 13.5)" />
      </svg>
    );
  }

  if (duration === alphaTab.model.Duration.Half) {
    return (
      <svg className="duration-icon" viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="9.6" cy="17.4" rx="4" ry="2.8" transform="rotate(-18 9.6 17.4)" />
        <path d="M13.2 16.5V4.5" />
      </svg>
    );
  }

  const flagCount = duration === alphaTab.model.Duration.Eighth
    ? 1
    : duration === alphaTab.model.Duration.Sixteenth
      ? 2
      : duration === alphaTab.model.Duration.ThirtySecond
        ? 3
        : duration === alphaTab.model.Duration.SixtyFourth
          ? 4
          : 0;

  return (
    <svg className="duration-icon" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="9.2" cy="17.5" rx="4" ry="2.8" transform="rotate(-18 9.2 17.5)" fill="currentColor" stroke="none" />
      <path d="M12.8 16.7V4.2" />
      {flagCount >= 1 && <path d="M12.8 4.4c2.7 1 4.4 2.6 4.4 4.4" />}
      {flagCount >= 2 && <path d="M12.8 7.6c2.7 1 4.4 2.5 4.4 4.2" />}
      {flagCount >= 3 && <path d="M12.8 10.6c2.6.9 4.2 2.3 4.2 3.9" />}
      {flagCount >= 4 && <path d="M12.8 13.4c2.4.8 3.9 2 3.9 3.4" />}
    </svg>
  );
};

const cleanLyricLine = (line: string) => line
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .trim();

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

const extractChordsFromScore = (
  loadedScore: alphaTab.model.Score | null,
  barStartTicks: number[]
): SongChord[] => {
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

            const tick = Math.max(0, getBeatPlaybackTick(beat, barStartTicks));
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

  const staff = note.beat.voice.bar.staff;
  return {
    fret: note.fret,
    isDead: note.isDead,
    string: note.string,
    stringCount: staff.tuning.length,
    isStringed: staff.isStringed,
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

const createSelectedBeatSnapshot = (beat: alphaTab.model.Beat | null): SelectedBeatSnapshot | null => {
  if (!beat) return null;

  const staff = beat.voice.bar.staff;
  return {
    duration: beat.duration,
    dots: beat.dots,
    isTriplet: beat.tupletNumerator === 3 && beat.tupletDenominator === 2,
    isRest: beat.isRest,
    noteCount: beat.notes.length,
    beatCountInVoice: beat.voice.beats.length,
    barNumber: beat.voice.bar.index + 1,
    isStringed: staff.isStringed && !staff.isPercussion
  };
};

const clearNoteSlide = (note: alphaTab.model.Note) => {
  if (note.slideTarget) {
    note.slideTarget.slideOrigin = null;
  }
  note.slideTarget = null;
  note.slideOutType = alphaTab.model.SlideOutType.None;
};

const clearNoteTie = (note: alphaTab.model.Note) => {
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

const clearNoteLetRing = (note: alphaTab.model.Note) => {
  if (note.letRingDestination) {
    note.letRingDestination.isLetRing = false;
  }
  note.isLetRing = false;
  note.letRingDestination = null;
};

const clearNoteHammerPull = (note: alphaTab.model.Note) => {
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

const clearNoteLinks = (note: alphaTab.model.Note) => {
  clearNoteSlide(note);
  clearNoteTie(note);
  clearNoteLetRing(note);
  clearNoteHammerPull(note);
  if (note.slideOrigin) {
    note.slideOrigin.slideTarget = null;
    note.slideOrigin = null;
  }
};

const syncVoiceBeatMetadata = (voice: alphaTab.model.Voice) => {
  voice.beats.forEach((voiceBeat, index) => {
    voiceBeat.index = index;
    voiceBeat.tupletGroup = null;
  });
};

const findAdjacentBeatInStaff = (beat: alphaTab.model.Beat, direction: -1 | 1): alphaTab.model.Beat | null => {
  const direct = direction > 0 ? beat.nextBeat : beat.previousBeat;
  if (direct) return direct;

  const currentBar = beat.voice.bar;
  const staff = currentBar.staff;
  const voiceIndex = beat.voice.index;
  let barIndex = currentBar.index + direction;

  while (barIndex >= 0 && barIndex < staff.bars.length) {
    const candidateBar = staff.bars[barIndex];
    const candidateVoice = candidateBar.voices[voiceIndex] ?? candidateBar.voices[0];
    if (candidateVoice && candidateVoice.beats.length > 0) {
      return direction > 0
        ? candidateVoice.beats[0]
        : candidateVoice.beats[candidateVoice.beats.length - 1];
    }
    barIndex += direction;
  }

  return null;
};

const getRhythmModeForSettings = (
  showStandardNotation: boolean,
  showTablature: boolean,
  showTabNoteDurations: boolean
) => {
  if (showTablature && !showStandardNotation) {
    return showTabNoteDurations ? alphaTab.TabRhythmMode.ShowWithBeams : alphaTab.TabRhythmMode.Hidden;
  }
  return alphaTab.TabRhythmMode.Automatic;
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

const formatSongPreview = (song: PlaylistSong | null) => {
  if (!song) return 'No song';
  return song.artist && song.artist !== 'Unknown Artist'
    ? `${song.title} - ${song.artist}`
    : song.title;
};

function App() {
  const appContainerRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);
  const toolbarFileInputRef = useRef<HTMLInputElement>(null);
  const deleteTrackDialogRef = useRef<HTMLDialogElement>(null);
  const addTrackDialogRef = useRef<HTMLDialogElement>(null);
  const [tooltipPortal, setTooltipPortal] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<AlphaTabEditorRef>(null);
  const timelineRef = useRef<TimelineViewRef>(null);
  const playlistIdRef = useRef(0);
  const currentTickRef = useRef(0);
  const panReloadTimerRef = useRef<number | null>(null);
  const metadataNoticeTimerRef = useRef<number | null>(null);
  const lastRenderedRef = useRef<{ score: alphaTab.model.Score; trackKey: string } | null>(null);
  const pendingPlaylistLoadRef = useRef<{
    id: string;
    source: unknown;
    fallbackTitle?: string;
  } | null>(null);

  const [score, setScore] = useState<alphaTab.model.Score | null>(null);
  const [appView, setAppView] = useState<'main' | 'preferences'>('main');
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [leftPanelTab, setLeftPanelTab] = useState<'tabs' | 'chords' | 'lyrics'>('tabs');
  const [rightPanelTab, setRightPanelTab] = useState<'song' | 'playlist'>('song');
  const [trackLyrics, setTrackLyrics] = useState<TrackLyrics[]>([]);

  const [activeTracks, setActiveTracks] = useState<number[]>([]);
  const [focusedTrackIndex, setFocusedTrackIndex] = useState<number | null>(null);
  const [tuningTrackOverride, setTuningTrackOverride] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const selectedNoteRef = useRef<alphaTab.model.Note | null>(null);
  const selectedBeatRef = useRef<alphaTab.model.Beat | null>(null);
  const styledSelectedNoteRef = useRef<{
    note: alphaTab.model.Note;
    previousStyle: alphaTab.model.NoteStyle | undefined;
  } | null>(null);
  const styledSelectedBeatRef = useRef<{
    beat: alphaTab.model.Beat;
    previousStyle: alphaTab.model.BeatStyle | undefined;
  } | null>(null);
  const [selectedNote, setSelectedNoteSnapshot] = useState<SelectedNoteSnapshot | null>(null);
  const [selectedBeat, setSelectedBeatSnapshot] = useState<SelectedBeatSnapshot | null>(null);
  const selectedTabCellRef = useRef<TabCellSelection | null>(null);
  const [selectedTabCell, setSelectedTabCellState] = useState<TabCellSelection | null>(null);
  const pendingFretInputRef = useRef<{
    digit: number;
    beat: alphaTab.model.Beat;
    string: number;
    timerId: number;
  } | null>(null);
  const [isMultiDigitPending, setIsMultiDigitPending] = useState(false);
  const [playbackTime, setPlaybackTime] = useState({ currentTime: 0, endTime: 0, tempo: 0 });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isCountInEnabled, setIsCountInEnabled] = useState(false);
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
  const [scoreEditRevision, setScoreEditRevision] = useState(0);
  const [trackPendingDelete, setTrackPendingDelete] = useState<{ index: number; name: string } | null>(null);
  const [isAddTrackDialogOpen, setIsAddTrackDialogOpen] = useState(false);
  const [newTrackInstrumentId, setNewTrackInstrumentId] = useState<string>(DEFAULT_TRACK_INSTRUMENT_ID);
  const [newTrackName, setNewTrackName] = useState('');
  const [isNewTrackNameCustomized, setIsNewTrackNameCustomized] = useState(false);
  const [collapsedSidebarSections, setCollapsedSidebarSections] = useState<Partial<Record<SidebarSectionId, boolean>>>({});

  // Draft values for numeric inputs so typing multi-digit numbers doesn't clamp on the first digit
  const [tempoDraft, setTempoDraft] = useState<string | null>(null);
  const [zoomDraft, setZoomDraft] = useState<string | null>(null);
  const [fretDraft, setFretDraft] = useState<string | null>(null);
  const [savedMetadata, setSavedMetadata] = useState<ScoreMetadata>(EMPTY_SCORE_METADATA);
  const [metadataDraft, setMetadataDraft] = useState<ScoreMetadata>(EMPTY_SCORE_METADATA);
  const [metadataSaveNotice, setMetadataSaveNotice] = useState('');

  const barTiming = useMemo(() => computeBarTiming(score), [score]);

  const orderedTracks = useMemo(() => {
    void trackNameRevision;
    return getTracksInOrder(score, trackOrder);
  }, [score, trackOrder, trackNameRevision]);

  const selectedTrack = (
    focusedTrackIndex !== null && activeTracks.includes(focusedTrackIndex)
      ? orderedTracks.find(track => track.index === focusedTrackIndex)
      : null
  ) ?? orderedTracks.find(track => activeTracks.includes(track.index)) ?? orderedTracks[0] ?? null;

  const tuningTargetTrack = (
    tuningTrackOverride !== null
      ? orderedTracks.find(track => track.index === tuningTrackOverride)
      : null
  ) ?? selectedTrack;

  const songChords = useMemo(() => {
    void trackNameRevision;
    return extractChordsFromScore(score, barTiming.barStartTicks);
  }, [score, barTiming.barStartTicks, trackNameRevision]);

  const chordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    songChords.forEach(chord => counts.set(chord.name, (counts.get(chord.name) || 0) + 1));
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [songChords]);

  const stateRef = useRef({
    score,
    appView,
    barTiming,
    playbackSpeed,
    isPlaying,
    showStandardNotation,
    showTablature,
    showTabNoteDurations,
    defaultTrackType,
    playlistLength: playlist.length,
    selectionMode,
    activeTracks,
    orderedTracks,
    trackOrder,
    draggedTrackIndex,
    trackDropIndex
  });

  useLayoutEffect(() => {
    stateRef.current = {
      score,
      appView,
      barTiming,
      playbackSpeed,
      isPlaying,
      showStandardNotation,
      showTablature,
      showTabNoteDurations,
      defaultTrackType,
      playlistLength: playlist.length,
      selectionMode,
      activeTracks,
      orderedTracks,
      trackOrder,
      draggedTrackIndex,
      trackDropIndex
    };
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === appContainerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (panReloadTimerRef.current !== null) {
        window.clearTimeout(panReloadTimerRef.current);
      }
      if (metadataNoticeTimerRef.current !== null) {
        window.clearTimeout(metadataNoticeTimerRef.current);
      }
      if (pendingFretInputRef.current !== null) {
        window.clearTimeout(pendingFretInputRef.current.timerId);
        pendingFretInputRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isAppMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (appMenuRef.current && !appMenuRef.current.contains(event.target as Node)) {
        setIsAppMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAppMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAppMenuOpen]);

  useEffect(() => {
    const dialog = deleteTrackDialogRef.current;
    if (!dialog) return;

    if (trackPendingDelete) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [trackPendingDelete]);

  useEffect(() => {
    const dialog = addTrackDialogRef.current;
    if (!dialog) return;

    if (isAddTrackDialogOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isAddTrackDialogOpen]);

  const clearPendingFretInput = useCallback(() => {
    if (pendingFretInputRef.current !== null) {
      window.clearTimeout(pendingFretInputRef.current.timerId);
      pendingFretInputRef.current = null;
    }
    setIsMultiDigitPending(false);
  }, []);

  const syncSelectedElementStyles = useCallback((
    nextNote: alphaTab.model.Note | null,
    nextBeat: alphaTab.model.Beat | null,
    options?: { render?: boolean }
  ): number | undefined => {
    const prevNote = styledSelectedNoteRef.current;
    const prevBeat = styledSelectedBeatRef.current;
    const targetRestBeat = !nextNote && nextBeat && nextBeat.isRest ? nextBeat : null;

    if (prevNote?.note === nextNote && prevBeat?.beat === targetRestBeat) {
      return undefined;
    }

    const api = editorRef.current?.api;
    const currentScore = api?.score ?? null;
    let firstChangedBar: number | undefined;

    const recordChangedBarForBeat = (beat: alphaTab.model.Beat) => {
      if (currentScore && beat.voice.bar.staff.track.score === currentScore) {
        const barIndex = beat.voice.bar.index;
        firstChangedBar = firstChangedBar === undefined ? barIndex : Math.min(firstChangedBar, barIndex);
      }
    };

    if (prevNote && prevNote.note !== nextNote) {
      prevNote.note.style = prevNote.previousStyle;
      recordChangedBarForBeat(prevNote.note.beat);
      styledSelectedNoteRef.current = null;
    }

    if (prevBeat && prevBeat.beat !== targetRestBeat) {
      prevBeat.beat.style = prevBeat.previousStyle;
      recordChangedBarForBeat(prevBeat.beat);
      styledSelectedBeatRef.current = null;
    }

    if (nextNote && styledSelectedNoteRef.current?.note !== nextNote) {
      styledSelectedNoteRef.current = {
        note: nextNote,
        previousStyle: nextNote.style
      };
      nextNote.style = createSelectedNoteStyle(nextNote.style);
      recordChangedBarForBeat(nextNote.beat);
    }

    if (targetRestBeat && styledSelectedBeatRef.current?.beat !== targetRestBeat) {
      styledSelectedBeatRef.current = {
        beat: targetRestBeat,
        previousStyle: targetRestBeat.style
      };
      targetRestBeat.style = createSelectedBeatRestStyle(targetRestBeat.style);
      recordChangedBarForBeat(targetRestBeat);
    }

    if (options?.render !== false && firstChangedBar !== undefined && api) {
      api.render({ reuseViewport: true, firstChangedMasterBar: firstChangedBar });
    }

    return firstChangedBar;
  }, []);

  const setSelectedNote = useCallback((
    note: alphaTab.model.Note | null,
    options?: { render?: boolean; beat?: alphaTab.model.Beat | null }
  ) => {
    const nextBeat = options && 'beat' in options ? (options.beat ?? null) : (note?.beat ?? null);
    selectedNoteRef.current = note;
    selectedBeatRef.current = nextBeat;
    setFretDraft(null);
    setSelectedNoteSnapshot(createSelectedNoteSnapshot(note));
    setSelectedBeatSnapshot(createSelectedBeatSnapshot(nextBeat));
    syncSelectedElementStyles(note, nextBeat, options);
  }, [syncSelectedElementStyles]);

  const setSelectedTabCell = useCallback((cell: TabCellSelection | null) => {
    selectedTabCellRef.current = cell;
    setSelectedTabCellState(cell);
  }, []);

  const selectTabCell = useCallback((
    beat: alphaTab.model.Beat | null,
    string: number | null,
    explicitNote?: alphaTab.model.Note | null,
    options?: { render?: boolean }
  ) => {
    clearPendingFretInput();

    if (!beat) {
      setSelectedTabCell(null);
      setSelectedNote(null, { ...options, beat: null });
      return;
    }

    const staff = beat.voice.bar.staff;
    const isEditableStringed = staff.isStringed && !staff.isPercussion && staff.tuning.length > 0;

    if (isEditableStringed && string !== null) {
      const clampedString = Math.max(1, Math.min(staff.tuning.length, string));
      setSelectedTabCell({ beat, string: clampedString });
      const matchingNote = explicitNote && explicitNote.beat === beat && explicitNote.string === clampedString
        ? explicitNote
        : beat.notes.find(n => n.string === clampedString) ?? null;
      setSelectedNote(matchingNote, { ...options, beat });
      return;
    }

    setSelectedTabCell(null);
    setSelectedNote(explicitNote ?? beat.notes[0] ?? null, { ...options, beat });
  }, [clearPendingFretInput, setSelectedNote, setSelectedTabCell]);

  const tuningTargetStaff = tuningTargetTrack?.staves[0] ?? null;
  const hasStringTuning = Boolean(tuningTargetStaff?.isStringed && !tuningTargetStaff?.isPercussion);
  const currentTuningValues = useMemo(() => {
    void scoreEditRevision;
    void trackNameRevision;
    return hasStringTuning && tuningTargetStaff ? [...tuningTargetStaff.tuning] : [];
  }, [hasStringTuning, tuningTargetStaff, scoreEditRevision, trackNameRevision]);
  const currentCapo = hasStringTuning && tuningTargetStaff ? tuningTargetStaff.capo : 0;
  const tuningPresets = useMemo(
    () => (currentTuningValues.length > 0 ? getTuningPresetsForStringCount(currentTuningValues.length) : []),
    [currentTuningValues.length]
  );
  const currentTuningKey = currentTuningValues.join(',');
  const matchedTuningPreset = tuningPresets.find(preset => preset.key === currentTuningKey) ?? null;
  const selectedTuningPresetValue = matchedTuningPreset?.key ?? '__custom__';
  const tuningName = hasStringTuning && tuningTargetStaff
    ? (matchedTuningPreset?.name || tuningTargetStaff.tuningName || 'Custom Tuning')
    : tuningTargetTrack ? 'Not applicable' : '-';
  const tuningNotes = hasStringTuning && currentTuningValues.length > 0
    ? `${formatTuningNotesLowToHigh(currentTuningValues, false)}${currentCapo > 0 ? ` · Capo ${currentCapo}` : ''}`
    : tuningTargetTrack ? 'This track does not use string tuning.' : '-';
  const canShiftTuningDown = currentTuningValues.length > 0 && currentTuningValues.every(midi => midi > MIN_TUNING_MIDI);
  const canShiftTuningUp = currentTuningValues.length > 0 && currentTuningValues.every(midi => midi < MAX_TUNING_MIDI);
  const selectedTrackInstrumentPreset = getTrackInstrumentPreset(selectedTrack);
  const selectedTrackInstrumentValue = selectedTrackInstrumentPreset?.id ?? (selectedTrack ? '__current__' : '');
  const newTrackPreset = getTrackInstrumentPresetById(newTrackInstrumentId)
    ?? getTrackInstrumentPresetById(DEFAULT_TRACK_INSTRUMENT_ID)!;
  const songTitle = (score ? savedMetadata.title : '') || 'Untitled Song';
  const songArtist = (score ? savedMetadata.artist : '') || 'Unknown Artist';
  const hasMetadataChanges = Boolean(score) && METADATA_FIELDS.some(
    field => metadataDraft[field.key] !== savedMetadata[field.key]
  );
  const tempo = playbackTime.tempo || score?.tempo || 100;
  const lyricSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${songTitle} ${songArtist} lyrics`)}`;
  const showTabDurationToggle = showTablature && !showStandardNotation;
  const activePlaylistIndex = playlist.findIndex(song => song.id === activePlaylistId);
  const previousPlaylistSong = activePlaylistIndex > 0 ? playlist[activePlaylistIndex - 1] : null;
  const nextPlaylistSong = activePlaylistIndex >= 0 && activePlaylistIndex < playlist.length - 1
    ? playlist[activePlaylistIndex + 1]
    : null;

  const isSidebarSectionCollapsed = (sectionId: SidebarSectionId) => Boolean(collapsedSidebarSections[sectionId]);
  const getSidebarSectionContentId = (sectionId: SidebarSectionId) => `${sectionId}-section-content`;
  const toggleSidebarSection = (sectionId: SidebarSectionId) => {
    setCollapsedSidebarSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  const renderSidebarSectionHeader = (sectionId: SidebarSectionId, title: string) => {
    const isCollapsed = isSidebarSectionCollapsed(sectionId);

    return (
      <button
        className="section-collapse-button"
        type="button"
        aria-expanded={!isCollapsed}
        aria-controls={getSidebarSectionContentId(sectionId)}
        onClick={() => toggleSidebarSection(sectionId)}
      >
        <h2>{title}</h2>
      </button>
    );
  };

  // Single authoritative render effect for active tracks — avoids double/triple alphaTab renders
  useEffect(() => {
    if (!score || !editorRef.current || activeTracks.length === 0) return;
    const tracksToRender = orderedTracks.filter(track => activeTracks.includes(track.index));
    if (!tracksToRender.length) return;

    const trackKey = tracksToRender.map(track => track.index).join(',');
    const prev = lastRenderedRef.current;
    if (prev && prev.score === score && prev.trackKey === trackKey) return;

    lastRenderedRef.current = { score, trackKey };
    editorRef.current.renderTracks(tracksToRender);
  }, [score, orderedTracks, activeTracks]);

  const loadScoreSource = useCallback((source: unknown, options?: { id?: string; fallbackTitle?: string }) => {
    if (!editorRef.current) return;

    if (panReloadTimerRef.current !== null) {
      window.clearTimeout(panReloadTimerRef.current);
      panReloadTimerRef.current = null;
    }

    const id = options?.id || `song-${playlistIdRef.current += 1}`;
    pendingPlaylistLoadRef.current = {
      id,
      source: cloneScoreSource(source),
      fallbackTitle: options?.fallbackTitle
    };
    editorRef.current.loadScore(cloneScoreSource(source));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = event.target?.result;
        if (data instanceof ArrayBuffer) {
          const prepared = await repairGpBufferIfNeeded(data);
          loadScoreSource(prepared, { fallbackTitle: file.name });
        } else if (data) {
          loadScoreSource(data, { fallbackTitle: file.name });
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    }
  };

  const onScoreLoaded = useCallback((loadedScore: alphaTab.model.Score) => {
    const {
      showStandardNotation: curShowNotation,
      showTablature: curShowTab,
      showTabNoteDurations: curShowDurations,
      defaultTrackType: curDefaultTrackType,
      playlistLength
    } = stateRef.current;

    const playlistLoad = pendingPlaylistLoadRef.current;
    const playlistId = playlistLoad?.id || `song-${playlistIdRef.current += 1}`;
    const playlistSource = playlistLoad?.source || loadedScore;
    const playlistTitle = loadedScore.title || playlistLoad?.fallbackTitle || `Song ${playlistLength + 1}`;

    // Apply display settings without triggering an extra render; the track effect below renders once
    editorRef.current?.applyDisplaySettings({
      showStandardNotation: curShowNotation,
      showTablature: curShowTab,
      rhythmMode: getRhythmModeForSettings(curShowNotation, curShowTab, curShowDurations),
      render: false
    });

    lastRenderedRef.current = null;
    currentTickRef.current = 0;
    timelineRef.current?.updateTick(0);
    selectTabCell(null, null, null, { render: false });

    if (metadataNoticeTimerRef.current !== null) {
      window.clearTimeout(metadataNoticeTimerRef.current);
      metadataNoticeTimerRef.current = null;
    }
    const initialMetadata = extractScoreMetadata(loadedScore);
    setSavedMetadata(initialMetadata);
    setMetadataDraft(initialMetadata);
    setMetadataSaveNotice('');

    setScore(loadedScore);
    setTrackLyrics(extractLyricsFromScore(loadedScore));
    setPlaybackSpeed(1);
    setTempoDraft(null);
    editorRef.current?.setPlaybackSpeed(1);
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

    const defaultTrack = loadedScore.tracks.find(track => isDefaultTrackTypeMatch(track, curDefaultTrackType)) || loadedScore.tracks[0];
    setActiveTracks(defaultTrack ? [defaultTrack.index] : []);
    setFocusedTrackIndex(defaultTrack ? defaultTrack.index : null);
    setTuningTrackOverride(null);

    const initialSettings: Record<number, TrackSettings> = {};
    loadedScore.tracks.forEach(track => {
      initialSettings[track.index] = {
        volume: Math.max(0, Math.min(MAX_TRACK_VOLUME, track.playbackInfo.volume)),
        pan: balanceToPan(track.playbackInfo.balance),
        mute: track.playbackInfo.isMute,
        solo: track.playbackInfo.isSolo
      };
    });
    setTrackSettings(initialSettings);
  }, [selectTabCell]);

  const switchPlaylistSong = (song: PlaylistSong) => {
    if (song.id === activePlaylistId) return;
    selectTabCell(null, null, null, { render: false });
    loadScoreSource(song.source, { id: song.id, fallbackTitle: song.title });
  };

  const deletePlaylistSong = (song: PlaylistSong) => {
    const songIndex = playlist.findIndex(item => item.id === song.id);
    const nextPlaylist = playlist.filter(item => item.id !== song.id);
    setPlaylist(nextPlaylist);

    if (song.id !== activePlaylistId) return;

    const replacementSong = nextPlaylist[Math.min(songIndex, nextPlaylist.length - 1)] || null;
    if (replacementSong) {
      selectTabCell(null, null, null, { render: false });
      loadScoreSource(replacementSong.source, { id: replacementSong.id, fallbackTitle: replacementSong.title });
    } else {
      if (panReloadTimerRef.current !== null) {
        window.clearTimeout(panReloadTimerRef.current);
        panReloadTimerRef.current = null;
      }
      if (metadataNoticeTimerRef.current !== null) {
        window.clearTimeout(metadataNoticeTimerRef.current);
        metadataNoticeTimerRef.current = null;
      }
      editorRef.current?.clearScore();
      pendingPlaylistLoadRef.current = null;
      lastRenderedRef.current = null;
      currentTickRef.current = 0;
      selectTabCell(null, null, null, { render: false });
      setScore(null);
      setSavedMetadata(EMPTY_SCORE_METADATA);
      setMetadataDraft(EMPTY_SCORE_METADATA);
      setMetadataSaveNotice('');
      setActivePlaylistId(null);
      setActiveTracks([]);
      setFocusedTrackIndex(null);
      setTuningTrackOverride(null);
      setTrackOrder([]);
      setTrackLyrics([]);
      setTrackSettings({});
      setIsPlaying(false);
      setPlaybackSpeed(1);
      setTempoDraft(null);
      setPlaybackTime({ currentTime: 0, endTime: 0, tempo: 0 });
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

  const getFileTempoAtTick = useCallback((tick: number) => {
    const currentScore = stateRef.current.score;
    const tickCache = editorRef.current?.api?.tickCache;
    if (!tickCache?.masterBars.length) return currentScore?.tempo || 100;

    const masterBar = tickCache.masterBars.find((lookup, index) => {
      const isLast = index === tickCache.masterBars.length - 1;
      return tick >= lookup.start && (tick < lookup.end || isLast);
    });
    if (!masterBar) return currentScore?.tempo || 100;

    let latestTempo = masterBar.tempo;
    let latestTick = -1;
    for (const change of masterBar.tempoChanges) {
      if (change.tick <= tick && change.tick >= latestTick) {
        latestTick = change.tick;
        latestTempo = change.tempo;
      }
    }

    return latestTempo || currentScore?.tempo || 100;
  }, []);

  const onSeek = useCallback((tick: number, options?: { scrollToCursor?: boolean; waitForRender?: boolean }) => {
    editorRef.current?.seekToTick(tick, options);
    currentTickRef.current = tick;
    timelineRef.current?.updateTick(tick);

    const nextTempo = Math.round(getFileTempoAtTick(tick) * stateRef.current.playbackSpeed);
    setPlaybackTime(prev => (
      prev.tempo === nextTempo ? prev : { ...prev, tempo: nextTempo }
    ));
  }, [getFileTempoAtTick]);

  const handleTimelineSeek = useCallback((tick: number, trackIndex?: number) => {
    let willSwitchTrack = false;

    if (trackIndex !== undefined) {
      const { selectionMode: curMode, activeTracks: curActive } = stateRef.current;
      const nextActiveTracks = curMode === 'single'
        ? (curActive.length === 1 && curActive[0] === trackIndex ? curActive : [trackIndex])
        : (curActive.includes(trackIndex) ? curActive : [...curActive, trackIndex]);

      if (nextActiveTracks !== curActive) {
        willSwitchTrack = true;
        setActiveTracks(nextActiveTracks);
      }
    }

    onSeek(tick, willSwitchTrack ? { scrollToCursor: true, waitForRender: true } : undefined);
  }, [onSeek]);

  const rerenderEditedNote = useCallback((changedBarIndex?: number) => {
    const api = editorRef.current?.api;
    if (!api) return;
    const styleChangedBar = syncSelectedElementStyles(
      selectedNoteRef.current,
      selectedBeatRef.current,
      { render: false }
    );
    api.score?.finish(api.settings);
    const firstChangedMasterBar = changedBarIndex !== undefined && styleChangedBar !== undefined
      ? Math.min(changedBarIndex, styleChangedBar)
      : (changedBarIndex ?? styleChangedBar);
    api.render(
      firstChangedMasterBar !== undefined
        ? { reuseViewport: true, firstChangedMasterBar }
        : { reuseViewport: true }
    );
    editorRef.current?.reloadMidi(true);
    setScoreEditRevision(revision => revision + 1);
    setSelectedNoteSnapshot(createSelectedNoteSnapshot(selectedNoteRef.current));
    setSelectedBeatSnapshot(createSelectedBeatSnapshot(selectedBeatRef.current));
  }, [syncSelectedElementStyles]);

  const applyFretToSelectedCell = useCallback((fret: number, isDead: boolean) => {
    const api = editorRef.current?.api;
    if (!api) return;

    const cell = selectedTabCellRef.current;
    if (cell) {
      const { beat, string } = cell;
      const staff = beat.voice.bar.staff;
      if (!staff.isStringed || staff.isPercussion || string < 1 || string > staff.tuning.length) {
        return;
      }

      const clampedFret = Math.max(MIN_FRET, Math.min(MAX_FRET, Math.round(fret)));
      let note = beat.notes.find(n => n.string === string) ?? null;

      if (note) {
        if (isDead) {
          if (note.isTieDestination) {
            clearNoteTie(note);
          }
          if (note.isDead) {
            setSelectedNote(note, { beat });
            return;
          }
          note.isDead = true;
        } else {
          if (!note.isDead && note.fret === clampedFret) {
            setSelectedNote(note, { beat });
            return;
          }
          note.isDead = false;
          note.fret = clampedFret;
        }
      } else {
        note = new alphaTab.model.Note();
        note.string = string;
        note.fret = isDead ? 0 : clampedFret;
        note.isDead = isDead;
        beat.isEmpty = false;
        beat.addNote(note);
      }

      selectedNoteRef.current = note;
      selectedBeatRef.current = beat;
      setFretDraft(null);
      rerenderEditedNote(beat.voice.bar.index);
      return;
    }

    const note = selectedNoteRef.current;
    if (!note) return;
    if (isDead) {
      if (note.isTieDestination) {
        clearNoteTie(note);
      }
      if (note.isDead) return;
      note.isDead = true;
    } else {
      const clampedFret = Math.max(MIN_FRET, Math.min(MAX_FRET, Math.round(fret)));
      if (!note.isDead && note.fret === clampedFret) return;
      note.isDead = false;
      note.fret = clampedFret;
    }
    setFretDraft(null);
    rerenderEditedNote(note.beat.voice.bar.index);
  }, [rerenderEditedNote, setSelectedNote]);

  const deleteNoteAtSelectedCell = useCallback(() => {
    const api = editorRef.current?.api;
    if (!api) return;

    const cell = selectedTabCellRef.current;
    const note = cell
      ? cell.beat.notes.find(n => n.string === cell.string) ?? null
      : selectedNoteRef.current;
    if (!note) return;

    const beat = note.beat;
    syncSelectedElementStyles(null, beat, { render: false });
    clearNoteLinks(note);
    beat.removeNote(note);
    beat.notes.forEach((remaining, index) => {
      remaining.index = index;
    });

    selectedNoteRef.current = null;
    selectedBeatRef.current = beat;
    setFretDraft(null);
    rerenderEditedNote(beat.voice.bar.index);
  }, [rerenderEditedNote, syncSelectedElementStyles]);

  const updateBeatDuration = useCallback((duration: alphaTab.model.Duration) => {
    const beat = selectedBeatRef.current;
    if (!beat || !editorRef.current?.api) return;
    clearPendingFretInput();
    if (beat.duration === duration && !beat.isEmpty) return;

    beat.duration = duration;
    beat.isEmpty = false;
    rerenderEditedNote(beat.voice.bar.index);
  }, [clearPendingFretInput, rerenderEditedNote]);

  const stepBeatDuration = useCallback((stepDirection: -1 | 1) => {
    const beat = selectedBeatRef.current;
    if (!beat) return;

    const currentIndex = DURATION_OPTIONS.findIndex(option => option.duration === beat.duration);
    const baseIndex = currentIndex >= 0 ? currentIndex : 2; // Quarter fallback
    // Index 0 = Whole (longest), last index = 64th (shortest)
    const nextIndex = Math.max(0, Math.min(DURATION_OPTIONS.length - 1, baseIndex - stepDirection));
    if (nextIndex === currentIndex && !beat.isEmpty) return;

    updateBeatDuration(DURATION_OPTIONS[nextIndex].duration);
  }, [updateBeatDuration]);

  const toggleBeatDots = useCallback((dotCount: 1 | 2) => {
    const beat = selectedBeatRef.current;
    if (!beat || !editorRef.current?.api) return;
    clearPendingFretInput();

    beat.dots = beat.dots === dotCount ? 0 : dotCount;
    beat.isEmpty = false;
    rerenderEditedNote(beat.voice.bar.index);
  }, [clearPendingFretInput, rerenderEditedNote]);

  const toggleBeatTriplet = useCallback(() => {
    const beat = selectedBeatRef.current;
    if (!beat || !editorRef.current?.api) return;
    clearPendingFretInput();

    const isCurrentlyTriplet = beat.tupletNumerator === 3 && beat.tupletDenominator === 2;
    if (isCurrentlyTriplet) {
      beat.tupletNumerator = -1;
      beat.tupletDenominator = -1;
    } else {
      beat.tupletNumerator = 3;
      beat.tupletDenominator = 2;
    }
    syncVoiceBeatMetadata(beat.voice);
    beat.isEmpty = false;
    rerenderEditedNote(beat.voice.bar.index);
  }, [clearPendingFretInput, rerenderEditedNote]);

  const convertBeatToRest = useCallback(() => {
    const beat = selectedBeatRef.current;
    if (!beat || !editorRef.current?.api) return;
    clearPendingFretInput();

    if (beat.notes.length === 0 && !beat.isEmpty && !beat.deadSlapped) {
      return;
    }

    syncSelectedElementStyles(null, null, { render: false });
    for (const existingNote of [...beat.notes]) {
      clearNoteLinks(existingNote);
      beat.removeNote(existingNote);
    }
    beat.deadSlapped = false;
    beat.isEmpty = false;
    selectedNoteRef.current = null;
    selectedBeatRef.current = beat;
    setFretDraft(null);
    rerenderEditedNote(beat.voice.bar.index);
  }, [clearPendingFretInput, rerenderEditedNote, syncSelectedElementStyles]);

  const insertRestBeat = useCallback(() => {
    const beat = selectedBeatRef.current;
    if (!beat || !editorRef.current?.api) return;
    clearPendingFretInput();

    const voice = beat.voice;
    const newBeat = new alphaTab.model.Beat();
    newBeat.duration = beat.duration === alphaTab.model.Duration.Whole
      ? alphaTab.model.Duration.Quarter
      : beat.duration;
    newBeat.isEmpty = false;
    newBeat.dynamics = beat.dynamics;

    voice.insertBeat(beat, newBeat);
    syncVoiceBeatMetadata(voice);

    const staff = voice.bar.staff;
    const isEditableStringed = staff.isStringed && !staff.isPercussion && staff.tuning.length > 0;
    const targetString = isEditableStringed
      ? Math.max(1, Math.min(staff.tuning.length, selectedTabCellRef.current?.string ?? staff.tuning.length))
      : null;

    if (targetString !== null) {
      setSelectedTabCell({ beat: newBeat, string: targetString });
    } else {
      setSelectedTabCell(null);
    }
    selectedNoteRef.current = null;
    selectedBeatRef.current = newBeat;
    setFretDraft(null);

    rerenderEditedNote(voice.bar.index);
    onSeek(getBeatPlaybackTick(newBeat, stateRef.current.barTiming.barStartTicks), { scrollToCursor: false });
  }, [clearPendingFretInput, onSeek, rerenderEditedNote, setSelectedTabCell]);

  const removeSelectedBeat = useCallback(() => {
    const beat = selectedBeatRef.current;
    if (!beat || !editorRef.current?.api) return;
    clearPendingFretInput();

    const voice = beat.voice;
    if (voice.beats.length <= 1) {
      syncSelectedElementStyles(null, null, { render: false });
      for (const existingNote of [...beat.notes]) {
        clearNoteLinks(existingNote);
        beat.removeNote(existingNote);
      }
      beat.deadSlapped = false;
      beat.isEmpty = false;
      beat.duration = alphaTab.model.Duration.Whole;
      beat.dots = 0;
      beat.tupletNumerator = -1;
      beat.tupletDenominator = -1;
      beat.tupletGroup = null;
      selectedNoteRef.current = null;
      selectedBeatRef.current = beat;
      setFretDraft(null);
      rerenderEditedNote(voice.bar.index);
      return;
    }

    const beatIndex = voice.beats.indexOf(beat);
    if (beatIndex < 0) return;

    syncSelectedElementStyles(null, null, { render: false });
    for (const existingNote of [...beat.notes]) {
      clearNoteLinks(existingNote);
      beat.removeNote(existingNote);
    }

    voice.beats.splice(beatIndex, 1);
    syncVoiceBeatMetadata(voice);

    const nextBeat = voice.beats[Math.min(beatIndex, voice.beats.length - 1)];
    const staff = voice.bar.staff;
    const isEditableStringed = staff.isStringed && !staff.isPercussion && staff.tuning.length > 0;
    const targetString = isEditableStringed
      ? Math.max(1, Math.min(staff.tuning.length, selectedTabCellRef.current?.string ?? staff.tuning.length))
      : null;

    if (targetString !== null) {
      setSelectedTabCell({ beat: nextBeat, string: targetString });
      selectedNoteRef.current = nextBeat.notes.find(n => n.string === targetString) ?? null;
    } else {
      setSelectedTabCell(null);
      selectedNoteRef.current = nextBeat.notes[0] ?? null;
    }
    selectedBeatRef.current = nextBeat;
    setFretDraft(null);

    rerenderEditedNote(voice.bar.index);
    onSeek(getBeatPlaybackTick(nextBeat, stateRef.current.barTiming.barStartTicks), { scrollToCursor: false });
  }, [clearPendingFretInput, onSeek, rerenderEditedNote, setSelectedTabCell, syncSelectedElementStyles]);

  const onTabCellSelect = useCallback((event: TabCellClickEvent) => {
    const clickedTrackIndex = event.beat.voice.bar.staff.track.index;
    setFocusedTrackIndex(clickedTrackIndex);
    setTuningTrackOverride(null);
    selectTabCell(event.beat, event.string, event.note);
    onSeek(getBeatPlaybackTick(event.beat, stateRef.current.barTiming.barStartTicks), { scrollToCursor: false });
  }, [onSeek, selectTabCell]);

  const moveTabCursorHorizontal = useCallback((direction: -1 | 1) => {
    const cell = selectedTabCellRef.current;
    if (!cell) return;

    const nextBeat = findAdjacentBeatInStaff(cell.beat, direction);
    if (!nextBeat) return;

    const stringCount = nextBeat.voice.bar.staff.tuning.length;
    const targetString = Math.max(1, Math.min(stringCount, cell.string));
    selectTabCell(nextBeat, targetString);
    onSeek(getBeatPlaybackTick(nextBeat, stateRef.current.barTiming.barStartTicks));
  }, [onSeek, selectTabCell]);

  const moveTabCursorVertical = useCallback((direction: -1 | 1) => {
    const cell = selectedTabCellRef.current;
    if (!cell) return;

    const stringCount = cell.beat.voice.bar.staff.tuning.length;
    if (stringCount <= 1) return;

    const nextString = Math.max(1, Math.min(stringCount, cell.string + direction));
    if (nextString === cell.string) return;

    selectTabCell(cell.beat, nextString);
  }, [selectTabCell]);

  const moveSelectedNoteBy = useCallback((offset: number) => {
    const note = selectedNoteRef.current;
    if (!note) return;

    const barStartTicks = stateRef.current.barTiming.barStartTicks;
    const track = note.beat.voice.bar.staff.track;
    const notesWithTicks: Array<{ note: alphaTab.model.Note; tick: number }> = [];

    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            if (beat.notes.length === 0) continue;
            const tick = getBeatPlaybackTick(beat, barStartTicks);
            for (const candidate of beat.notes) {
              notesWithTicks.push({ note: candidate, tick });
            }
          }
        }
      }
    }

    notesWithTicks.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.note.index - b.note.index;
    });

    const currentIndex = notesWithTicks.findIndex(item => item.note === note);
    const nextItem = notesWithTicks[currentIndex + offset];
    if (!nextItem) return;

    setSelectedNote(nextItem.note);
    onSeek(nextItem.tick);
  }, [onSeek, setSelectedNote]);

  // Bind global keyboard shortcuts once on mount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (deleteTrackDialogRef.current?.open || addTrackDialogRef.current?.open) return;
      if (isTypingTarget(e.target)) return;

      if (e.code === 'Space') {
        if (!stateRef.current.score) return;
        e.preventDefault();
        editorRef.current?.playPause();
        return;
      }

      if (stateRef.current.appView !== 'main') return;

      const cell = selectedTabCellRef.current;
      if (cell && stateRef.current.activeTracks.includes(cell.beat.voice.bar.staff.track.index)) {
        if (e.code === 'ArrowUp') {
          e.preventDefault();
          moveTabCursorVertical(1);
          return;
        }

        if (e.code === 'ArrowDown') {
          e.preventDefault();
          moveTabCursorVertical(-1);
          return;
        }

        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          moveTabCursorHorizontal(-1);
          return;
        }

        if (e.code === 'ArrowRight') {
          e.preventDefault();
          moveTabCursorHorizontal(1);
          return;
        }

        if (e.key === 'Escape') {
          if (pendingFretInputRef.current) {
            clearPendingFretInput();
          } else {
            selectTabCell(null, null);
          }
          return;
        }

        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          clearPendingFretInput();
          deleteNoteAtSelectedCell();
          return;
        }

        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const digit = parseInt(e.key, 10);
            const pending = pendingFretInputRef.current;

            if (pending && pending.beat === cell.beat && pending.string === cell.string) {
              const combined = pending.digit * 10 + digit;
              clearPendingFretInput();
              if (combined >= MIN_FRET && combined <= MAX_FRET) {
                applyFretToSelectedCell(combined, false);
                return;
              }
            } else {
              clearPendingFretInput();
            }

            applyFretToSelectedCell(digit, false);

            if (digit === 1 || digit === 2) {
              const timerId = window.setTimeout(() => {
                pendingFretInputRef.current = null;
                setIsMultiDigitPending(false);
              }, FRET_MULTI_DIGIT_WINDOW_MS);
              pendingFretInputRef.current = {
                digit,
                beat: cell.beat,
                string: cell.string,
                timerId
              };
              setIsMultiDigitPending(true);
            }
            return;
          }

          if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            clearPendingFretInput();
            applyFretToSelectedCell(0, true);
            return;
          }
        }
      }

      const activeBeat = selectedBeatRef.current;
      if (
        activeBeat &&
        stateRef.current.activeTracks.includes(activeBeat.voice.bar.staff.track.index) &&
        !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          convertBeatToRest();
          return;
        }

        if (e.key === '.') {
          e.preventDefault();
          toggleBeatDots(1);
          return;
        }

        if (e.key === '-' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          stepBeatDuration(-1);
          return;
        }

        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault();
          stepBeatDuration(1);
          return;
        }

        if (e.key === 'Escape' && !cell) {
          selectTabCell(null, null);
          return;
        }
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
  }, [
    applyFretToSelectedCell,
    clearPendingFretInput,
    convertBeatToRest,
    deleteNoteAtSelectedCell,
    moveSelectedNoteBy,
    moveTabCursorHorizontal,
    moveTabCursorVertical,
    selectTabCell,
    stepBeatDuration,
    toggleBeatDots
  ]);

  const onPositionChanged = useCallback((args: alphaTab.synth.PositionChangedEventArgs) => {
    currentTickRef.current = args.currentTick;
    timelineRef.current?.updateTick(args.currentTick);

    const nextCurrentSec = Math.max(0, Math.floor(args.currentTime / 1000));
    const nextEndSec = Math.max(0, Math.floor(args.endTime / 1000));
    const nextTempo = Math.round(args.modifiedTempo || args.originalTempo || stateRef.current.score?.tempo || 100);

    setPlaybackTime(prev => {
      const prevCurrentSec = Math.max(0, Math.floor(prev.currentTime / 1000));
      const prevEndSec = Math.max(0, Math.floor(prev.endTime / 1000));
      if (prevCurrentSec === nextCurrentSec && prevEndSec === nextEndSec && prev.tempo === nextTempo) {
        return prev;
      }
      return {
        currentTime: args.currentTime,
        endTime: args.endTime,
        tempo: nextTempo
      };
    });
  }, []);

  const seekToSongStart = () => {
    onSeek(0);
  };

  const seekByBars = (barOffset: number) => {
    const { barStartTicks } = barTiming;
    if (barStartTicks.length === 0) return;

    const currentBarIndex = findBarIndexAtTick(barStartTicks, currentTickRef.current);
    const nextBarIndex = Math.max(0, Math.min(barStartTicks.length - 1, currentBarIndex + barOffset));
    onSeek(barStartTicks[nextBarIndex]);
  };

  const handleTrackSettingsChange = useCallback((trackIndex: number, settings: Partial<TrackSettings>) => {
    setTrackSettings(prev => {
      const current = prev[trackIndex] || DEFAULT_TRACK_SETTINGS;
      return { ...prev, [trackIndex]: { ...current, ...settings } };
    });

    const currentScore = stateRef.current.score;
    const api = editorRef.current?.api;
    if (!currentScore || !api) return;

    const track = currentScore.tracks.find(t => t.index === trackIndex);
    if (!track) return;

    if (settings.volume !== undefined) {
      const clampedVol = Math.max(0, Math.min(MAX_TRACK_VOLUME, settings.volume));
      track.playbackInfo.volume = clampedVol;
      api.changeTrackVolume([track], clampedVol / MAX_TRACK_VOLUME);
    }
    if (settings.mute !== undefined) {
      track.playbackInfo.isMute = settings.mute;
      api.changeTrackMute([track], settings.mute);
    }
    if (settings.solo !== undefined) {
      track.playbackInfo.isSolo = settings.solo;
      api.changeTrackSolo([track], settings.solo);
    }
    if (settings.pan !== undefined) {
      track.playbackInfo.balance = panToBalance(settings.pan);
      if (!stateRef.current.isPlaying) {
        if (panReloadTimerRef.current !== null) {
          window.clearTimeout(panReloadTimerRef.current);
        }
        panReloadTimerRef.current = window.setTimeout(() => {
          panReloadTimerRef.current = null;
          if (!stateRef.current.isPlaying) {
            editorRef.current?.reloadMidi(true);
          }
        }, 250);
      }
    }
  }, []);

  const toggleTrack = useCallback((trackIndex: number) => {
    const { selectionMode: curMode, activeTracks: curActive, orderedTracks: curOrdered, score: curScore } = stateRef.current;
    let newTracks: number[];
    if (curMode === 'single') {
      newTracks = [trackIndex];
    } else if (curActive.includes(trackIndex)) {
      newTracks = curActive.filter(i => i !== trackIndex);
    } else {
      newTracks = [...curActive, trackIndex];
    }

    if (newTracks.length === 0 && curScore) {
      newTracks = [curOrdered[0]?.index ?? curScore.tracks[0].index];
    }

    if (
      (selectedTabCellRef.current &&
        !newTracks.includes(selectedTabCellRef.current.beat.voice.bar.staff.track.index)) ||
      (selectedBeatRef.current &&
        !newTracks.includes(selectedBeatRef.current.voice.bar.staff.track.index))
    ) {
      selectTabCell(null, null, null, { render: false });
    }

    setActiveTracks(newTracks);
    setFocusedTrackIndex(newTracks.includes(trackIndex) ? trackIndex : newTracks[0] ?? null);
    setTuningTrackOverride(null);
  }, [selectTabCell]);

  const reorderTracks = useCallback((sourceTrackIndex: number, targetTrackIndex: number) => {
    const { score: curScore, trackOrder: curOrder } = stateRef.current;
    if (!curScore || sourceTrackIndex === targetTrackIndex) return;

    const baseOrder = getTracksInOrder(curScore, curOrder).map(track => track.index);
    const sourceIndex = baseOrder.indexOf(sourceTrackIndex);
    const targetIndex = baseOrder.indexOf(targetTrackIndex);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextOrder = [...baseOrder];
    const [movedTrack] = nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, movedTrack);
    setTrackOrder(nextOrder);
  }, []);

  const clearTrackDragState = useCallback(() => {
    setDraggedTrackIndex(null);
    setTrackDropIndex(null);
  }, []);

  const handleTrackDragStart = useCallback((event: React.DragEvent<HTMLElement>, trackIndex: number) => {
    setDraggedTrackIndex(trackIndex);
    setTrackDropIndex(trackIndex);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(trackIndex));
  }, []);

  const handleTrackDragOver = useCallback((event: React.DragEvent<HTMLElement>, trackIndex: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (stateRef.current.trackDropIndex !== trackIndex) {
      setTrackDropIndex(trackIndex);
    }
  }, []);

  const handleTrackDrop = useCallback((event: React.DragEvent<HTMLElement>, trackIndex: number) => {
    event.preventDefault();
    const sourceTrackIndex = stateRef.current.draggedTrackIndex ?? Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(sourceTrackIndex)) {
      clearTrackDragState();
      return;
    }

    reorderTracks(sourceTrackIndex, trackIndex);
    clearTrackDragState();
  }, [clearTrackDragState, reorderTracks]);

  const renameTrack = useCallback((trackIndex: number, nextName: string) => {
    const curScore = stateRef.current.score;
    if (!curScore) return;
    const track = curScore.tracks.find(item => item.index === trackIndex);
    const trimmedName = nextName.trim();
    if (!track || !trimmedName || track.name === trimmedName) return;

    track.name = trimmedName;
    setTrackNameRevision(revision => revision + 1);
  }, []);

  const handleMetadataFieldChange = (field: MetadataFieldKey, value: string) => {
    if (metadataNoticeTimerRef.current !== null) {
      window.clearTimeout(metadataNoticeTimerRef.current);
      metadataNoticeTimerRef.current = null;
    }
    setMetadataSaveNotice('');
    setMetadataDraft(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetMetadataDraft = () => {
    setMetadataDraft(savedMetadata);
    setMetadataSaveNotice('');
  };

  const saveMetadata = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const curScore = stateRef.current.score;
    if (!curScore || !hasMetadataChanges) return;

    const nextMetadata: ScoreMetadata = {
      title: metadataDraft.title.trim(),
      artist: metadataDraft.artist.trim(),
      album: metadataDraft.album.trim(),
      tab: metadataDraft.tab.trim(),
      music: metadataDraft.music.trim(),
      words: metadataDraft.words.trim()
    };

    curScore.title = nextMetadata.title;
    curScore.artist = nextMetadata.artist;
    curScore.album = nextMetadata.album;
    curScore.tab = nextMetadata.tab;
    curScore.music = nextMetadata.music;
    curScore.words = nextMetadata.words;

    const api = editorRef.current?.api;
    if (api) {
      api.score?.finish(api.settings);
      api.render();
    }

    setSavedMetadata(nextMetadata);
    setMetadataDraft(nextMetadata);
    setPlaylist(prev => prev.map(item => (
      item.id === activePlaylistId
        ? {
            ...item,
            title: nextMetadata.title || 'Untitled Song',
            artist: nextMetadata.artist || 'Unknown Artist',
            album: nextMetadata.album,
            source: curScore
          }
        : item
    )));

    setMetadataSaveNotice('Saved');
    if (metadataNoticeTimerRef.current !== null) {
      window.clearTimeout(metadataNoticeTimerRef.current);
    }
    metadataNoticeTimerRef.current = window.setTimeout(() => {
      metadataNoticeTimerRef.current = null;
      setMetadataSaveNotice('');
    }, 2200);
  };

  const openAddTrackDialog = useCallback(() => {
    const curScore = stateRef.current.score;
    if (!curScore) return;

    const initialInstrumentId = getDefaultInstrumentIdForTrackType(stateRef.current.defaultTrackType);
    const preset = getTrackInstrumentPresetById(initialInstrumentId)
      ?? getTrackInstrumentPresetById(DEFAULT_TRACK_INSTRUMENT_ID)!;
    const nextNumber = curScore.tracks.length + 1;

    setNewTrackInstrumentId(preset.id);
    setNewTrackName(`${preset.defaultName} ${nextNumber}`);
    setIsNewTrackNameCustomized(false);
    setIsAddTrackDialogOpen(true);
  }, []);

  const handleNewTrackInstrumentChange = (instrumentId: string) => {
    setNewTrackInstrumentId(instrumentId);
    if (!isNewTrackNameCustomized) {
      const curScore = stateRef.current.score;
      const preset = getTrackInstrumentPresetById(instrumentId);
      if (curScore && preset) {
        setNewTrackName(`${preset.defaultName} ${curScore.tracks.length + 1}`);
      }
    }
  };

  const addTrackWithInstrument = useCallback((instrumentId: string, customName?: string) => {
    const curScore = stateRef.current.score;
    const api = editorRef.current?.api;
    if (!curScore || !api) return;

    const preset = getTrackInstrumentPresetById(instrumentId)
      ?? getTrackInstrumentPresetById(DEFAULT_TRACK_INSTRUMENT_ID)!;

    const {
      showStandardNotation: curShowNotation,
      showTablature: curShowTab,
      selectionMode: curSelectionMode
    } = stateRef.current;

    const nextNumber = curScore.tracks.length + 1;
    const trimmedName = customName?.trim() || `${preset.defaultName} ${nextNumber}`;

    const track = new alphaTab.model.Track();
    track.name = trimmedName;
    track.shortName = `${preset.shortName} ${nextNumber}`;
    track.playbackInfo.volume = 12;
    track.playbackInfo.balance = PAN_CENTER_BALANCE;
    track.playbackInfo.isMute = false;
    track.playbackInfo.isSolo = false;

    const staff = new alphaTab.model.Staff();
    const referenceStaff = curScore.tracks[0]?.staves[0] ?? null;
    const barCount = curScore.masterBars.length;
    for (let i = 0; i < barCount; i++) {
      const bar = new alphaTab.model.Bar();
      const refBar = referenceStaff?.bars[i];
      if (refBar) {
        bar.keySignature = refBar.keySignature;
        bar.keySignatureType = refBar.keySignatureType;
      }
      const voice = new alphaTab.model.Voice();
      const emptyBeat = new alphaTab.model.Beat();
      emptyBeat.isEmpty = true;
      voice.addBeat(emptyBeat);
      bar.addVoice(voice);
      staff.addBar(bar);
    }

    track.addStaff(staff);
    applyInstrumentPresetToTrack(curScore, track, preset, {
      showStandardNotation: curShowNotation,
      showTablature: curShowTab,
      isNewTrack: true
    });

    curScore.addTrack(track);
    curScore.finish(api.settings);

    const newTrackIndex = track.index;
    setTrackOrder(prev => [...prev, newTrackIndex]);
    setTrackSettings(prev => ({
      ...prev,
      [newTrackIndex]: {
        volume: track.playbackInfo.volume,
        pan: balanceToPan(track.playbackInfo.balance),
        mute: false,
        solo: false
      }
    }));
    setPlaylist(prev => prev.map(item => (
      item.id === activePlaylistId
        ? { ...item, trackCount: curScore.tracks.length }
        : item
    )));
    setTrackNameRevision(revision => revision + 1);
    setScoreEditRevision(revision => revision + 1);
    setActiveTracks(prev => (
      curSelectionMode === 'single' ? [newTrackIndex] : [...prev, newTrackIndex]
    ));
    setFocusedTrackIndex(newTrackIndex);
    setTuningTrackOverride(null);

    if (!stateRef.current.isPlaying) {
      editorRef.current?.reloadMidi(true);
    }
  }, [activePlaylistId]);

  const changeTrackInstrument = useCallback((trackIndex: number, instrumentId: string) => {
    const curScore = stateRef.current.score;
    const api = editorRef.current?.api;
    const preset = getTrackInstrumentPresetById(instrumentId);
    if (!curScore || !api || !preset) return;

    const track = curScore.tracks.find(item => item.index === trackIndex);
    if (!track) return;

    applyInstrumentPresetToTrack(curScore, track, preset, {
      showStandardNotation: stateRef.current.showStandardNotation,
      showTablature: stateRef.current.showTablature,
      isNewTrack: false
    });

    curScore.finish(api.settings);

    if (
      selectedNoteRef.current?.beat.voice.bar.staff.track === track ||
      selectedTabCellRef.current?.beat.voice.bar.staff.track === track ||
      selectedBeatRef.current?.voice.bar.staff.track === track
    ) {
      const staff = track.staves[0];
      if (track.isPercussion || !staff?.isStringed) {
        selectTabCell(null, null, null, { render: false });
      } else if (selectedTabCellRef.current) {
        selectTabCell(selectedTabCellRef.current.beat, selectedTabCellRef.current.string, null, { render: false });
      } else {
        setSelectedNoteSnapshot(createSelectedNoteSnapshot(selectedNoteRef.current));
      }
    }

    lastRenderedRef.current = null;
    setTrackNameRevision(revision => revision + 1);
    setScoreEditRevision(revision => revision + 1);
    editorRef.current?.reloadMidi(true);
  }, [selectTabCell]);

  const applyTrackTuning = useCallback((
    trackIndex: number,
    nextTunings: number[],
    options?: { name?: string }
  ) => {
    const curScore = stateRef.current.score;
    const api = editorRef.current?.api;
    if (!curScore || !api || nextTunings.length === 0) return;

    const track = curScore.tracks.find(item => item.index === trackIndex);
    if (!track || track.isPercussion) return;

    const clampedTunings = nextTunings.map(midi =>
      Math.max(MIN_TUNING_MIDI, Math.min(MAX_TUNING_MIDI, Math.round(midi)))
    );
    const nextTuning = buildTuningModel(clampedTunings, options?.name);

    let updatedAnyStaff = false;
    track.staves.forEach(staff => {
      if (!staff.isStringed || staff.isPercussion) return;
      if (clampedTunings.length < staff.tuning.length) {
        clampStaffNotesToStringCount(staff, clampedTunings.length);
      }
      staff.stringTuning = new alphaTab.model.Tuning(
        nextTuning.name,
        [...nextTuning.tunings],
        nextTuning.isStandard
      );
      updatedAnyStaff = true;
    });

    if (!updatedAnyStaff) return;

    curScore.finish(api.settings);

    if (selectedTabCellRef.current?.beat.voice.bar.staff.track === track) {
      const clampedString = Math.max(1, Math.min(clampedTunings.length, selectedTabCellRef.current.string));
      selectTabCell(selectedTabCellRef.current.beat, clampedString, null, { render: false });
    } else if (selectedNoteRef.current?.beat.voice.bar.staff.track === track) {
      setSelectedNoteSnapshot(createSelectedNoteSnapshot(selectedNoteRef.current));
      setSelectedBeatSnapshot(createSelectedBeatSnapshot(selectedBeatRef.current));
    }

    if (stateRef.current.activeTracks.includes(track.index)) {
      api.render({ reuseViewport: true });
    }
    editorRef.current?.reloadMidi(true);
    setTrackNameRevision(revision => revision + 1);
    setScoreEditRevision(revision => revision + 1);
  }, [selectTabCell]);

  const applyTrackTuningPreset = useCallback((trackIndex: number, presetKey: string) => {
    if (presetKey === '__custom__') return;
    const parsed = presetKey
      .split(',')
      .map(value => parseInt(value, 10))
      .filter(Number.isFinite);
    if (parsed.length === 0) return;

    const presets = getTuningPresetsForStringCount(parsed.length);
    const preset = presets.find(item => item.key === presetKey);
    applyTrackTuning(trackIndex, parsed, { name: preset?.name });
  }, [applyTrackTuning]);

  const updateTrackStringPitch = useCallback((trackIndex: number, tuningArrayIndex: number, nextMidi: number) => {
    const curScore = stateRef.current.score;
    if (!curScore) return;
    const track = curScore.tracks.find(item => item.index === trackIndex);
    const staff = track?.staves[0];
    if (!staff || !staff.isStringed || staff.isPercussion) return;
    if (tuningArrayIndex < 0 || tuningArrayIndex >= staff.tuning.length) return;

    const clampedMidi = Math.max(MIN_TUNING_MIDI, Math.min(MAX_TUNING_MIDI, Math.round(nextMidi)));
    if (staff.tuning[tuningArrayIndex] === clampedMidi) return;

    const nextTunings = [...staff.tuning];
    nextTunings[tuningArrayIndex] = clampedMidi;
    applyTrackTuning(trackIndex, nextTunings);
  }, [applyTrackTuning]);

  const shiftTrackTuningSemitones = useCallback((trackIndex: number, semitoneDelta: number) => {
    const curScore = stateRef.current.score;
    if (!curScore || semitoneDelta === 0) return;
    const track = curScore.tracks.find(item => item.index === trackIndex);
    const staff = track?.staves[0];
    if (!staff || !staff.isStringed || staff.isPercussion || staff.tuning.length === 0) return;

    const canShift = staff.tuning.every(midi => {
      const next = midi + semitoneDelta;
      return next >= MIN_TUNING_MIDI && next <= MAX_TUNING_MIDI;
    });
    if (!canShift) return;

    const nextTunings = staff.tuning.map(midi => midi + semitoneDelta);
    applyTrackTuning(trackIndex, nextTunings);
  }, [applyTrackTuning]);

  const changeTrackStringCount = useCallback((trackIndex: number, nextStringCount: number) => {
    const curScore = stateRef.current.score;
    if (!curScore) return;
    const track = curScore.tracks.find(item => item.index === trackIndex);
    const staff = track?.staves[0];
    if (!staff || !staff.isStringed || staff.isPercussion) return;
    if (staff.tuning.length === nextStringCount) return;

    if (alphaTab.model.Tuning.getPresetsFor(6).length === 0) {
      alphaTab.model.Tuning.initialize();
    }
    const defaultTuning = alphaTab.model.Tuning.getDefaultTuningFor(nextStringCount);
    const nextTunings = defaultTuning?.tunings?.length === nextStringCount
      ? [...defaultTuning.tunings]
      : nextStringCount === 4
        ? [43, 38, 33, 28]
        : nextStringCount === 5
          ? [43, 38, 33, 28, 23]
          : nextStringCount === 7
            ? [64, 59, 55, 50, 45, 40, 35]
            : [64, 59, 55, 50, 45, 40];

    applyTrackTuning(trackIndex, nextTunings, { name: defaultTuning?.name });
  }, [applyTrackTuning]);

  const updateTrackCapo = useCallback((trackIndex: number, nextCapo: number) => {
    const curScore = stateRef.current.score;
    const api = editorRef.current?.api;
    if (!curScore || !api) return;
    const track = curScore.tracks.find(item => item.index === trackIndex);
    if (!track || track.isPercussion) return;

    const clampedCapo = Math.max(MIN_CAPO, Math.min(MAX_CAPO, Math.round(nextCapo)));
    let changed = false;
    track.staves.forEach(staff => {
      if (!staff.isStringed || staff.isPercussion) return;
      if (staff.capo !== clampedCapo) {
        staff.capo = clampedCapo;
        changed = true;
      }
    });
    if (!changed) return;

    curScore.finish(api.settings);
    if (stateRef.current.activeTracks.includes(track.index)) {
      api.render({ reuseViewport: true });
    }
    editorRef.current?.reloadMidi(true);
    setTrackNameRevision(revision => revision + 1);
    setScoreEditRevision(revision => revision + 1);
  }, []);

  const handleAddTrackDialogSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addTrackWithInstrument(newTrackInstrumentId, newTrackName);
    setIsAddTrackDialogOpen(false);
  };

  const handleAddTrackDialogClose = () => {
    setIsAddTrackDialogOpen(false);
  };

  const requestDeleteTrack = useCallback((trackIndex: number) => {
    const curScore = stateRef.current.score;
    if (!curScore || curScore.tracks.length <= 1) return;
    const track = curScore.tracks.find(item => item.index === trackIndex);
    if (!track) return;
    setTrackPendingDelete({ index: track.index, name: track.name });
  }, []);

  const deleteTrack = useCallback((trackIndex: number) => {
    const curScore = stateRef.current.score;
    const api = editorRef.current?.api;
    if (!curScore || !api || curScore.tracks.length <= 1) return;

    const removePos = curScore.tracks.findIndex(item => item.index === trackIndex);
    if (removePos < 0) return;

    const [removedTrack] = curScore.tracks.splice(removePos, 1);
    if (
      selectedNoteRef.current?.beat.voice.bar.staff.track === removedTrack ||
      selectedTabCellRef.current?.beat.voice.bar.staff.track === removedTrack ||
      selectedBeatRef.current?.voice.bar.staff.track === removedTrack
    ) {
      selectTabCell(null, null, null, { render: false });
    }

    const indexRemap = new Map<number, number>();
    curScore.tracks.forEach((track, newIndex) => {
      indexRemap.set(track.index, newIndex);
      track.index = newIndex;
    });

    curScore.finish(api.settings);
    lastRenderedRef.current = null;

    const nextOrder = stateRef.current.trackOrder
      .filter(idx => idx !== trackIndex)
      .map(idx => indexRemap.get(idx))
      .filter((idx): idx is number => idx !== undefined);
    setTrackOrder(nextOrder);

    const remappedActive = stateRef.current.activeTracks
      .filter(idx => idx !== trackIndex)
      .map(idx => indexRemap.get(idx))
      .filter((idx): idx is number => idx !== undefined);
    const nextActive = remappedActive.length > 0 ? remappedActive : [nextOrder[0] ?? curScore.tracks[0].index];
    setActiveTracks(nextActive);
    setFocusedTrackIndex(prev => (prev !== null ? (indexRemap.get(prev) ?? nextActive[0] ?? null) : nextActive[0] ?? null));
    setTuningTrackOverride(prev => (prev !== null ? (indexRemap.get(prev) ?? null) : null));

    setTrackSettings(prev => {
      const next: Record<number, TrackSettings> = {};
      for (const [oldIdx, newIdx] of indexRemap) {
        if (prev[oldIdx]) {
          next[newIdx] = prev[oldIdx];
        }
      }
      return next;
    });

    setTrackLyrics(extractLyricsFromScore(curScore));
    setPlaylist(prev => prev.map(item => (
      item.id === activePlaylistId
        ? { ...item, trackCount: curScore.tracks.length }
        : item
    )));
    setTrackNameRevision(revision => revision + 1);
    setScoreEditRevision(revision => revision + 1);
    editorRef.current?.reloadMidi(true);
  }, [activePlaylistId, selectTabCell]);

  const handleDeleteTrackDialogClose = () => {
    const dialog = deleteTrackDialogRef.current;
    const returnValue = dialog?.returnValue ?? '';
    if (dialog) {
      dialog.returnValue = '';
    }
    const target = trackPendingDelete;
    setTrackPendingDelete(null);

    if (returnValue === 'delete' && target) {
      deleteTrack(target.index);
    }
  };

  const updateZoomPercent = (percent: number) => {
    const nextZoom = Math.max(0.5, Math.min(3, Math.round(percent) / 100));
    setZoom(nextZoom);
    setZoomDraft(null);
    editorRef.current?.setZoom(nextZoom);
  };

  const commitZoomDraft = () => {
    if (zoomDraft === null) return;
    const parsed = parseInt(zoomDraft, 10);
    if (Number.isFinite(parsed)) {
      updateZoomPercent(parsed);
    } else {
      setZoomDraft(null);
    }
  };

  const updateTempo = (bpm: number) => {
    const nextTempo = Math.max(30, Math.min(240, Math.round(bpm)));
    const fileTempoAtCurrentTick = getFileTempoAtTick(currentTickRef.current);
    const nextPlaybackSpeed = nextTempo / fileTempoAtCurrentTick;
    setPlaybackSpeed(nextPlaybackSpeed);
    setTempoDraft(null);
    setPlaybackTime(prev => ({ ...prev, tempo: nextTempo }));
    editorRef.current?.setPlaybackSpeed(nextPlaybackSpeed);
  };

  const commitTempoDraft = () => {
    if (tempoDraft === null) return;
    const parsed = parseInt(tempoDraft, 10);
    if (Number.isFinite(parsed)) {
      updateTempo(parsed);
    } else {
      setTempoDraft(null);
    }
  };

  const resetTempo = () => {
    if (!score) return;
    setPlaybackSpeed(1);
    setTempoDraft(null);
    editorRef.current?.setPlaybackSpeed(1);
    setPlaybackTime(prev => ({
      ...prev,
      tempo: Math.round(getFileTempoAtTick(currentTickRef.current))
    }));
  };

  const toggleMetronome = () => {
    const nextEnabled = !isMetronomeEnabled;
    setIsMetronomeEnabled(nextEnabled);
    editorRef.current?.setMetronomeVolume(nextEnabled ? 1 : 0);
  };

  const toggleCountIn = () => {
    const nextEnabled = !isCountInEnabled;
    setIsCountInEnabled(nextEnabled);
    editorRef.current?.setCountInVolume(nextEnabled ? 1 : 0);
  };

  const applyNotationVisibility = (nextShowStandardNotation: boolean, nextShowTablature: boolean) => {
    if (!nextShowStandardNotation && !nextShowTablature) return;

    setShowStandardNotation(nextShowStandardNotation);
    setShowTablature(nextShowTablature);

    if (score) {
      const tracksToRender = orderedTracks.filter(t => activeTracks.includes(t.index));
      const targetTracks = tracksToRender.length ? tracksToRender : orderedTracks;
      editorRef.current?.applyDisplaySettings({
        showStandardNotation: nextShowStandardNotation,
        showTablature: nextShowTablature,
        rhythmMode: getRhythmModeForSettings(nextShowStandardNotation, nextShowTablature, showTabNoteDurations),
        tracks: targetTracks
      });
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
    if (!note || !editorRef.current?.api) return;
    clearPendingFretInput();
    const clampedFret = Math.max(MIN_FRET, Math.min(MAX_FRET, Math.round(fret)));
    setFretDraft(null);
    if (!note.isDead && note.fret === clampedFret) return;
    note.isDead = false;
    note.fret = clampedFret;
    rerenderEditedNote(note.beat.voice.bar.index);
  };

  const toggleDeadNote = () => {
    const note = selectedNoteRef.current;
    if (!note || !editorRef.current?.api) return;
    clearPendingFretInput();
    setFretDraft(null);
    if (note.isDead) {
      note.isDead = false;
      note.fret = Math.max(MIN_FRET, Math.min(MAX_FRET, Math.round(note.fret)));
    } else {
      if (note.isTieDestination) {
        clearNoteTie(note);
      }
      note.isDead = true;
    }
    rerenderEditedNote(note.beat.voice.bar.index);
  };

  const commitFretDraft = () => {
    if (fretDraft === null) return;
    const trimmed = fretDraft.trim();
    if (trimmed.toLowerCase() === 'x') {
      const note = selectedNoteRef.current;
      setFretDraft(null);
      if (note && editorRef.current?.api) {
        clearPendingFretInput();
        if (note.isTieDestination) {
          clearNoteTie(note);
        }
        if (!note.isDead) {
          note.isDead = true;
          rerenderEditedNote(note.beat.voice.bar.index);
        }
      }
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      updateFret(parsed);
    } else {
      setFretDraft(null);
    }
  };

  const moveSelectedNoteToString = (stringOffset: number) => {
    const note = selectedNoteRef.current;
    if (!note || !editorRef.current?.api) return;

    const staff = note.beat.voice.bar.staff;
    const stringCount = staff.tuning.length;
    if (!staff.isStringed || stringCount <= 1) return;

    let targetString = note.string + stringOffset;
    while (targetString >= 1 && targetString <= stringCount) {
      const occupied = note.beat.notes.some(other => other !== note && other.string === targetString);
      if (!occupied) break;
      targetString += Math.sign(stringOffset);
    }

    if (targetString < 1 || targetString > stringCount || targetString === note.string) return;

    clearPendingFretInput();
    const oldString = note.string;
    note.string = targetString;
    note.beat.noteStringLookup.delete(oldString);
    note.beat.noteStringLookup.set(targetString, note);
    if (selectedTabCellRef.current?.beat === note.beat) {
      setSelectedTabCell({ beat: note.beat, string: targetString });
    }
    rerenderEditedNote(note.beat.voice.bar.index);
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
    if (note) clearNoteSlide(note);
  };

  const clearSelectedNoteTie = () => {
    const note = selectedNoteRef.current;
    if (note) clearNoteTie(note);
  };

  const clearSelectedNoteLetRing = () => {
    const note = selectedNoteRef.current;
    if (note) clearNoteLetRing(note);
  };

  const clearSelectedNoteHammerPull = () => {
    const note = selectedNoteRef.current;
    if (note) clearNoteHammerPull(note);
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
    return selectedNote[technique];
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

  const toggleThemeMode = () => {
    setThemeMode(current => current === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={`app-container ${themeMode}-theme`} ref={appContainerRef}>
      <ToolbarTooltipPortalProvider value={tooltipPortal}>
      <main className="main-content">
        <header className="toolbar">
          <div className="app-menu" ref={appMenuRef}>
            <ToolbarButton
              className={`icon-button menu-button ${isAppMenuOpen ? 'active' : ''}`}
              aria-label="Application menu"
              tooltip="Application menu"
              aria-expanded={isAppMenuOpen}
              onClick={() => setIsAppMenuOpen(open => !open)}
            >
              <img src={assetPath('tabengine_logo.png')} alt="" />
            </ToolbarButton>
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

          <div className="app-brand">
            <span>Tab Engine</span>
          </div>

          <div className="transport-cluster" role="group" aria-label="Playback controls">
            <ToolbarButton className="icon-button transport-button" onClick={seekToSongStart} isDisabled={!score} aria-label="Skip to start" tooltip="Skip to start">
              <Icon name="skip-back" />
            </ToolbarButton>
            <ToolbarButton className="icon-button transport-button" onClick={() => seekByBars(-1)} isDisabled={!score} aria-label="Rewind" tooltip="Rewind 1 bar">
              <Icon name="rewind" />
            </ToolbarButton>
            <ToolbarButton className="play-button" onClick={() => editorRef.current?.playPause()} isDisabled={!score} aria-label={isPlaying ? 'Pause' : 'Play'} tooltip={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
              <Icon name={isPlaying ? 'pause' : 'play'} />
            </ToolbarButton>
            <ToolbarButton className="icon-button transport-button" onClick={() => seekByBars(1)} isDisabled={!score} aria-label="Forward" tooltip="Forward 1 bar">
              <Icon name="fast-forward" />
            </ToolbarButton>
            <ToolbarButton className="icon-button transport-button" onClick={() => editorRef.current?.stop()} isDisabled={!score} aria-label="Stop" tooltip="Stop">
              <Icon name="stop" />
            </ToolbarButton>
            <div className="time-readout">
              <span>{formatTime(playbackTime.currentTime)}</span>
              <span>/</span>
              <span>{formatTime(playbackTime.endTime)}</span>
            </div>
          </div>

          <div className="song-title-nav">
            <ToolbarButton
              className="song-nav-button previous-song"
              isDisabled={!previousPlaylistSong}
              onClick={() => previousPlaylistSong && switchPlaylistSong(previousPlaylistSong)}
              tooltip={previousPlaylistSong ? `Previous song: ${formatSongPreview(previousPlaylistSong)}` : 'No previous song'}
              aria-label={previousPlaylistSong ? `Previous song: ${formatSongPreview(previousPlaylistSong)}` : 'No previous song'}
            >
              <Icon name="song-prev" />
              <span>
                <small>Previous</small>
                <strong>{previousPlaylistSong?.title || '-'}</strong>
              </span>
            </ToolbarButton>

            <div className="song-title-block">
              <strong>{songTitle}</strong>
              <span>{songArtist}</span>
            </div>

            <ToolbarButton
              className="song-nav-button next-song"
              isDisabled={!nextPlaylistSong}
              onClick={() => nextPlaylistSong && switchPlaylistSong(nextPlaylistSong)}
              tooltip={nextPlaylistSong ? `Next song: ${formatSongPreview(nextPlaylistSong)}` : 'No next song'}
              aria-label={nextPlaylistSong ? `Next song: ${formatSongPreview(nextPlaylistSong)}` : 'No next song'}
            >
              <span>
                <small>Next</small>
                <strong>{nextPlaylistSong?.title || '-'}</strong>
              </span>
              <Icon name="song-next" />
            </ToolbarButton>
          </div>

          <div className="song-stats">
            <div className="tempo-control" role="group" aria-label="Tempo control">
              <ToolbarButton
                className={`icon-button count-in-toggle-button ${isCountInEnabled ? 'active' : ''}`}
                onClick={toggleCountIn}
                aria-pressed={isCountInEnabled}
                aria-label="Count-in"
                tooltip={isCountInEnabled ? 'Count-in: On (1 bar before playback)' : 'Count-in: Off (1 bar before playback)'}
              >
                <Icon name="count-in" />
              </ToolbarButton>
              <span className="tempo-label">
                <ToolbarButton
                  className={`icon-button metronome-toggle-button ${isMetronomeEnabled ? 'active' : ''}`}
                  onClick={toggleMetronome}
                  aria-pressed={isMetronomeEnabled}
                  aria-label="Metronome"
                  tooltip={isMetronomeEnabled ? 'Metronome: On' : 'Metronome: Off'}
                >
                  <img src={assetPath('music-icons/icons8-metronome-100.png')} alt="" />
                </ToolbarButton>
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
                onChange={(e) => updateTempo(parseInt(e.target.value, 10) || 30)}
                aria-label="Tempo"
                title={score ? `Tempo: ${Math.round(tempo)} BPM` : 'Tempo (load a song to adjust)'}
              />
              <div className="tempo-number-control">
                <input
                  className="tempo-number"
                  type="number"
                  min="30"
                  max="240"
                  value={tempoDraft ?? String(Math.round(tempo))}
                  disabled={!score}
                  onChange={(e) => setTempoDraft(e.target.value)}
                  onBlur={commitTempoDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitTempoDraft();
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setTempoDraft(null);
                      e.currentTarget.blur();
                    }
                  }}
                  aria-label="Tempo BPM"
                  title={score ? `Tempo: ${Math.round(tempo)} BPM (30–240)` : 'Tempo BPM (load a song to edit)'}
                />
                <div className="tempo-stepper">
                  <ToolbarButton
                    className="tempo-step-button tempo-step-up"
                    isDisabled={!score}
                    onClick={() => updateTempo(tempo + 1)}
                    tabIndex={-1}
                    aria-label="Increase tempo"
                    tooltip="Increase tempo (+1 BPM)"
                  />
                  <ToolbarButton
                    className="tempo-step-button tempo-step-down"
                    isDisabled={!score}
                    onClick={() => updateTempo(tempo - 1)}
                    tabIndex={-1}
                    aria-label="Decrease tempo"
                    tooltip="Decrease tempo (-1 BPM)"
                  />
                </div>
              </div>
              <span className="tempo-unit">BPM</span>
              <ToolbarButton className="icon-button tempo-reset-button" isDisabled={!score} onClick={resetTempo} aria-label="Reset tempo to score default" tooltip="Reset tempo to score default">
                <Icon name="reset" />
              </ToolbarButton>
            </div>
          </div>

          <div className="zoom-controls" role="group" aria-label="Zoom controls">
            <ToolbarButton className="icon-button" onClick={() => updateZoomPercent(zoom * 100 - 10)} aria-label="Zoom out" tooltip="Zoom out (-10%)"><Icon name="minus" /></ToolbarButton>
            <div className="zoom-percent-control">
              <input
                className="zoom-percent-input"
                type="number"
                min="50"
                max="300"
                value={zoomDraft ?? String(Math.round(zoom * 100))}
                onChange={(e) => setZoomDraft(e.target.value)}
                onBlur={commitZoomDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitZoomDraft();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setZoomDraft(null);
                    e.currentTarget.blur();
                  }
                }}
                aria-label="Zoom percentage"
                title="Zoom percentage (50%–300%)"
              />
              <span>%</span>
            </div>
            <ToolbarButton className="icon-button" onClick={() => updateZoomPercent(zoom * 100 + 10)} aria-label="Zoom in" tooltip="Zoom in (+10%)"><Icon name="plus" /></ToolbarButton>
          </div>

          <div className="file-actions" role="group" aria-label="File and view actions">
            <ToolbarButton className="ghost-button" onClick={loadDemo} tooltip="Load demo song (Canon Rock)">Demo</ToolbarButton>
            <ToolbarButton
              className="file-input-label"
              onClick={() => toolbarFileInputRef.current?.click()}
              tooltip="Open a Guitar Pro file (.gp, .gp3, .gp4, .gp5, .gpx)"
            >
              <img src={assetPath('music-icons/icons8-rhythm-100.png')} alt="" />
              Load song
            </ToolbarButton>
            <input
              ref={toolbarFileInputRef}
              type="file"
              accept=".gp,.gp3,.gp4,.gp5,.gpx"
              onChange={handleFileChange}
              tabIndex={-1}
              aria-hidden="true"
            />
            <ToolbarButton
              className="icon-button theme-toggle-button"
              onClick={toggleThemeMode}
              aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              tooltip={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              <Icon name={themeMode === 'dark' ? 'moon' : 'sun'} />
            </ToolbarButton>
            <ToolbarButton
              className="icon-button fullscreen-button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              tooltip={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <Icon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} />
            </ToolbarButton>
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
                  <section className="panel-section collapsible-panel-section display-section">
                    {renderSidebarSectionHeader('display', 'Display')}
                    <div
                      className="collapsible-section-content notation-toggle-list"
                      id={getSidebarSectionContentId('display')}
                      hidden={isSidebarSectionCollapsed('display')}
                    >
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
                      <button
                        className="icon-button"
                        type="button"
                        disabled={!score}
                        onClick={openAddTrackDialog}
                        title={score ? 'Add a new track' : 'Load a song to add tracks'}
                        aria-label="Add track"
                      >
                        <Icon name="plus" />
                      </button>
                    </div>
                    <div className="side-track-list">
                      {score ? orderedTracks.map((track, trackPosition) => {
                        const settings = trackSettings[track.index] || DEFAULT_TRACK_SETTINGS;
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
                                <InstrumentIcon track={track} revision={trackNameRevision} className="track-badge" />
                                <span className="track-main-text">
                                  <strong title={`${trackPosition + 1}. ${track.name}`}>{trackPosition + 1}. {track.name}</strong>
                                  <small title={getInstrumentCategory(track)}>{getInstrumentCategory(track)}</small>
                                </span>
                              </button>
                              <button className={`mini-toggle solo ${settings.solo ? 'active' : ''}`} type="button" onClick={() => handleTrackSettingsChange(track.index, { solo: !settings.solo })}>S</button>
                              <button className={`mini-toggle mute ${settings.mute ? 'active' : ''}`} type="button" onClick={() => handleTrackSettingsChange(track.index, { mute: !settings.mute })}>M</button>
                              <button
                                className="mini-toggle delete-track"
                                type="button"
                                disabled={orderedTracks.length <= 1}
                                onClick={() => requestDeleteTrack(track.index)}
                                aria-label={`Delete ${track.name}`}
                                title={orderedTracks.length <= 1 ? 'Cannot delete the only track' : `Delete ${track.name}`}
                              >
                                <Icon name="trash" />
                              </button>
                            </div>
                            <div className="side-track-controls">
                              <label className="track-mix-control">
                                <span className="control-label">Vol {settings.volume}</span>
                                <input
                                  type="range"
                                  min="0"
                                  max={MAX_TRACK_VOLUME}
                                  step="1"
                                  value={settings.volume}
                                  draggable={false}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onDragStart={(e) => e.preventDefault()}
                                  onChange={(e) => handleTrackSettingsChange(track.index, { volume: parseInt(e.target.value, 10) })}
                                  aria-label={`${track.name} volume`}
                                />
                              </label>
                              <label className="track-mix-control">
                                <span className="control-label">Pan {formatPan(settings.pan)}</span>
                                <input
                                  type="range"
                                  min={MIN_PAN}
                                  max={MAX_PAN}
                                  step="1"
                                  value={settings.pan}
                                  draggable={false}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onDragStart={(e) => e.preventDefault()}
                                  onChange={(e) => handleTrackSettingsChange(track.index, { pan: parseInt(e.target.value, 10) })}
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
                    <button
                      className="add-track-button"
                      type="button"
                      disabled={!score}
                      onClick={openAddTrackDialog}
                      title={score ? 'Add a new track' : 'Load a song to add tracks'}
                    >
                      <Icon name="plus" />
                      Add track
                    </button>
                  </section>

                  <section className="panel-section info-section">
                    <div className="info-section-header">
                      <h2 id="info-section-heading">Information</h2>
                      <span className="info-save-status" role="status" aria-live="polite">
                        {metadataSaveNotice}
                      </span>
                    </div>
                    {score ? (
                      <form
                        className="info-form"
                        aria-labelledby="info-section-heading"
                        onSubmit={saveMetadata}
                      >
                        <div className="info-fields">
                          {METADATA_FIELDS.map((field, index) => {
                            const isFieldChanged = metadataDraft[field.key] !== savedMetadata[field.key];
                            return (
                              <div
                                className={`info-field ${isFieldChanged ? 'changed' : ''}`}
                                key={field.key}
                              >
                                <label htmlFor={field.id}>{field.label}</label>
                                <input
                                  id={field.id}
                                  name={field.key}
                                  type="text"
                                  value={metadataDraft[field.key]}
                                  placeholder="-"
                                  enterKeyHint={index < METADATA_FIELDS.length - 1 ? 'next' : 'done'}
                                  onChange={(e) => handleMetadataFieldChange(field.key, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      resetMetadataDraft();
                                      e.currentTarget.blur();
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        {hasMetadataChanges && (
                          <div className="info-form-actions">
                            <button
                              type="button"
                              className="info-reset-button"
                              onClick={resetMetadataDraft}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="info-save-button"
                            >
                              Save changes
                            </button>
                          </div>
                        )}
                      </form>
                    ) : (
                      <dl>
                        {METADATA_FIELDS.map(field => (
                          <div key={field.key}>
                            <dt>{field.label}</dt>
                            <dd>-</dd>
                          </div>
                        ))}
                      </dl>
                    )}
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
                        <svg className="empty-state-svg" viewBox="0 0 122 122" aria-hidden="true">
                          <g className="chord-markers" fill="none" stroke="var(--graphic-muted)" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M23.5 13.5 28.5 18.5M28.5 13.5 23.5 18.5" />
                            <circle cx="68" cy="16" r="2.7" />
                            <circle cx="82" cy="16" r="2.7" />
                            <circle cx="96" cy="16" r="2.7" />
                          </g>
                          <rect x="25.5" y="24" width="71" height="3.2" rx="1.2" fill="var(--graphic-nut)" />
                          <g stroke="var(--graphic-fret-line)" strokeWidth="1">
                            <line x1="26" y1="40.5" x2="96" y2="40.5" />
                            <line x1="26" y1="54.5" x2="96" y2="54.5" />
                            <line x1="26" y1="68.5" x2="96" y2="68.5" />
                            <line x1="26" y1="82.5" x2="96" y2="82.5" />
                          </g>
                          <g stroke="var(--graphic-grid-line)" strokeWidth="1.2">
                            <line x1="26" y1="26.5" x2="26" y2="82.5" />
                            <line x1="40" y1="26.5" x2="40" y2="82.5" />
                            <line x1="54" y1="26.5" x2="54" y2="82.5" />
                            <line x1="68" y1="26.5" x2="68" y2="82.5" />
                            <line x1="82" y1="26.5" x2="82" y2="82.5" />
                            <line x1="96" y1="26.5" x2="96" y2="82.5" />
                          </g>
                          <g className="chord-dots" fill="var(--graphic-chord-dot)">
                            <circle cx="40" cy="61.5" r="5.5" />
                            <circle cx="54" cy="47.5" r="5.5" />
                          </g>
                        </svg>
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
                        <svg className="empty-state-svg" viewBox="0 0 122 122" aria-hidden="true">
                          <g className="lyrics-note" fill="var(--graphic-lyric-note)">
                            <path d="M49 24.5 86 18v6.2L49 30.7Z" />
                            <rect x="49" y="25" width="3.4" height="34" rx="1.2" />
                            <rect x="82.6" y="19" width="3.4" height="34" rx="1.2" />
                            <ellipse cx="44" cy="60" rx="7.6" ry="5.5" transform="rotate(-18 44 60)" />
                            <ellipse cx="77.6" cy="54" rx="7.6" ry="5.5" transform="rotate(-18 77.6 54)" />
                          </g>
                          <g fill="var(--graphic-lyric-line)">
                            <rect x="24" y="76" width="74" height="2.6" rx="1.3" />
                            <rect x="31" y="84" width="60" height="2.6" rx="1.3" />
                          </g>
                        </svg>
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
              <div className={`editor-container ${!score ? 'has-getting-started' : ''}`}>
                {!score && (
                  <section className="getting-started-screen" aria-labelledby="getting-started-title">
                    <div className="getting-started-panel">
                      <span className="getting-started-kicker">Getting started</span>
                      <h1 id="getting-started-title">How to use Tab Engine</h1>
                      <ol className="getting-started-steps">
                        {GETTING_STARTED_STEPS.map((step, index) => (
                          <li key={step.title}>
                            <div className="getting-started-card-visual">
                              <img src={step.imageSrc} alt={step.imageAlt} />
                            </div>
                            <div className="getting-started-card-copy">
                              <span className="getting-started-step-number">{index + 1}</span>
                              <div>
                                <strong>{step.title}</strong>
                                <p>{step.description}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="getting-started-actions">
                        <button className="ghost-button" type="button" onClick={loadDemo}>Demo</button>
                        <label className="file-input-label">
                          <img src={assetPath('music-icons/icons8-rhythm-100.png')} alt="" />
                          Load song
                          <input type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" onChange={handleFileChange} />
                        </label>
                      </div>
                    </div>
                  </section>
                )}
                <AlphaTabEditor
                  ref={editorRef}
                  selectedTabCell={selectedTabCell}
                  isMultiDigitPending={isMultiDigitPending}
                  onScoreLoaded={onScoreLoaded}
                  onPlaybackStatusChanged={setIsPlaying}
                  onTabCellSelect={onTabCellSelect}
                  onPositionChanged={onPositionChanged}
                />
              </div>
            </section>

            <aside className="right-panel">
              <div className="inspector-tabs">
                <button className={rightPanelTab === 'song' ? 'active' : ''} type="button" onClick={() => setRightPanelTab('song')}>
                  <img src={assetPath('music-icons/icons8-music-heart-100.png')} alt="" />
                  Song
                </button>
                <button className={rightPanelTab === 'playlist' ? 'active' : ''} type="button" onClick={() => setRightPanelTab('playlist')}>
                  <img src={assetPath('music-icons/icons8-albums-100.png')} alt="" />
                  Playlist
                </button>
              </div>

              {rightPanelTab === 'song' && (
                <>
                  <section className="panel-section collapsible-panel-section">
                    {renderSidebarSectionHeader('instrument', 'Instrument')}
                    <div
                      className="collapsible-section-content instrument-panel-content"
                      id={getSidebarSectionContentId('instrument')}
                      hidden={isSidebarSectionCollapsed('instrument')}
                    >
                      <div className="instrument-card">
                        <InstrumentIcon track={selectedTrack} revision={trackNameRevision} className="instrument-icon" />
                        <div className="instrument-card-meta">
                          <strong title={selectedTrack?.name || 'No track selected'}>{selectedTrack?.name || 'No track selected'}</strong>
                          <small>{getInstrumentCategory(selectedTrack)}</small>
                        </div>
                      </div>
                      <label className="instrument-select-field">
                        <span>Track instrument</span>
                        <select
                          value={selectedTrackInstrumentValue}
                          disabled={!selectedTrack}
                          onChange={(e) => {
                            if (selectedTrack && e.target.value !== '__current__') {
                              changeTrackInstrument(selectedTrack.index, e.target.value);
                            }
                          }}
                          aria-label="Track instrument"
                        >
                          {!selectedTrack && <option value="">No track selected</option>}
                          {selectedTrack && !selectedTrackInstrumentPreset && (
                            <option value="__current__">
                              {getInstrumentCategory(selectedTrack)} (GM #{selectedTrack.playbackInfo.program})
                            </option>
                          )}
                          {TRACK_INSTRUMENT_GROUPS.map(({ group, instruments }) => (
                            <optgroup label={group} key={group}>
                              {instruments.map(instrument => (
                                <option value={instrument.id} key={instrument.id}>
                                  {instrument.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className="panel-section collapsible-panel-section">
                    {renderSidebarSectionHeader('tuning', 'Tuning')}
                    <div
                      className="collapsible-section-content tuning-panel-content"
                      id={getSidebarSectionContentId('tuning')}
                      hidden={isSidebarSectionCollapsed('tuning')}
                    >
                      {orderedTracks.length > 1 && tuningTargetTrack && (
                        <label className="instrument-select-field">
                          <span>Track</span>
                          <select
                            value={String(tuningTargetTrack.index)}
                            onChange={(e) => {
                              const nextIndex = parseInt(e.target.value, 10);
                              if (Number.isFinite(nextIndex)) {
                                setTuningTrackOverride(nextIndex);
                              }
                            }}
                            aria-label="Track to tune"
                          >
                            {orderedTracks.map((track, position) => (
                              <option value={String(track.index)} key={track.index}>
                                {position + 1}. {track.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <div className="tuning-card">
                        <img src={assetPath('music-icons/icons8-tuning-fork-100.png')} alt="" />
                        <div>
                          <strong title={tuningName}>{tuningName}</strong>
                          <span>{tuningNotes}</span>
                        </div>
                      </div>

                      {hasStringTuning && tuningTargetTrack && currentTuningValues.length > 0 && (
                        <>
                          <label className="instrument-select-field">
                            <span>Tuning preset</span>
                            <select
                              value={selectedTuningPresetValue}
                              onChange={(e) => applyTrackTuningPreset(tuningTargetTrack.index, e.target.value)}
                              aria-label="Tuning preset"
                            >
                              {!matchedTuningPreset && (
                                <option value="__custom__">
                                  Custom ({formatTuningNotesLowToHigh(currentTuningValues, false)})
                                </option>
                              )}
                              {tuningPresets.map(preset => (
                                <option value={preset.key} key={preset.key}>
                                  {preset.name} ({preset.notesLabel})
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="tuning-quick-row">
                            <select
                              className="tuning-string-count-select"
                              value={String(currentTuningValues.length)}
                              onChange={(e) => {
                                const nextCount = parseInt(e.target.value, 10);
                                if (Number.isFinite(nextCount)) {
                                  changeTrackStringCount(tuningTargetTrack.index, nextCount);
                                }
                              }}
                              aria-label="Number of strings"
                            >
                              {!TUNING_STRING_COUNTS.includes(currentTuningValues.length as 4 | 5 | 6 | 7) && (
                                <option value={String(currentTuningValues.length)}>
                                  {currentTuningValues.length} strings
                                </option>
                              )}
                              {TUNING_STRING_COUNTS.map(count => (
                                <option value={String(count)} key={count}>
                                  {count} strings
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!canShiftTuningDown}
                              onClick={() => shiftTrackTuningSemitones(tuningTargetTrack.index, -1)}
                              title="Tune all strings down ½ step"
                              aria-label="Tune all strings down half step"
                            >
                              -½
                            </button>
                            <button
                              type="button"
                              disabled={!canShiftTuningUp}
                              onClick={() => shiftTrackTuningSemitones(tuningTargetTrack.index, 1)}
                              title="Tune all strings up ½ step"
                              aria-label="Tune all strings up half step"
                            >
                              +½
                            </button>
                          </div>

                          <div className="tuning-strings-list" role="group" aria-label="Per-string tuning">
                            {currentTuningValues.map((midi, arrayIndex) => {
                              const stringNumber = arrayIndex + 1;
                              return (
                                <div className="tuning-string-row" key={stringNumber}>
                                  <span className="tuning-string-badge" title={`String ${stringNumber}`}>
                                    {stringNumber}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={midi <= MIN_TUNING_MIDI}
                                    onClick={() => updateTrackStringPitch(tuningTargetTrack.index, arrayIndex, midi - 1)}
                                    aria-label={`Lower string ${stringNumber} by one semitone`}
                                    title="Lower ½ step"
                                  >
                                    <Icon name="minus" />
                                  </button>
                                  <select
                                    value={String(midi)}
                                    onChange={(e) => {
                                      const nextMidi = parseInt(e.target.value, 10);
                                      if (Number.isFinite(nextMidi)) {
                                        updateTrackStringPitch(tuningTargetTrack.index, arrayIndex, nextMidi);
                                      }
                                    }}
                                    aria-label={`String ${stringNumber} pitch`}
                                  >
                                    {TUNING_MIDI_OPTIONS.map(option => (
                                      <option value={String(option.midi)} key={option.midi}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={midi >= MAX_TUNING_MIDI}
                                    onClick={() => updateTrackStringPitch(tuningTargetTrack.index, arrayIndex, midi + 1)}
                                    aria-label={`Raise string ${stringNumber} by one semitone`}
                                    title="Raise ½ step"
                                  >
                                    <Icon name="plus" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <div className="tuning-capo-row">
                            <span>Capo</span>
                            <div className="tuning-capo-controls">
                              <button
                                type="button"
                                disabled={currentCapo <= MIN_CAPO}
                                onClick={() => updateTrackCapo(tuningTargetTrack.index, currentCapo - 1)}
                                aria-label="Decrease capo fret"
                              >
                                <Icon name="minus" />
                              </button>
                              <span className="tuning-capo-value">
                                {currentCapo === 0 ? 'Off' : `Fret ${currentCapo}`}
                              </span>
                              <button
                                type="button"
                                disabled={currentCapo >= MAX_CAPO}
                                onClick={() => updateTrackCapo(tuningTargetTrack.index, currentCapo + 1)}
                                aria-label="Increase capo fret"
                              >
                                <Icon name="plus" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                  {(selectedNote || selectedBeat) && (
                    <section className="panel-section collapsible-panel-section">
                      {renderSidebarSectionHeader('edit-note', selectedBeat?.isRest ? 'Edit Break' : 'Edit Note')}
                      <div
                        className="collapsible-section-content compact-section"
                        id={getSidebarSectionContentId('edit-note')}
                        hidden={isSidebarSectionCollapsed('edit-note')}
                      >
                        {selectedNote && (
                          <>
                            <label className="field-row">
                              <span>Fret</span>
                              <div className="fret-number-control">
                                <input
                                  className="tempo-number fret-number"
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={fretDraft ?? (selectedNote.isDead ? 'X' : String(selectedNote.fret))}
                                  onChange={(e) => setFretDraft(e.target.value)}
                                  onBlur={commitFretDraft}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      commitFretDraft();
                                      e.currentTarget.blur();
                                    } else if (e.key === 'Escape') {
                                      setFretDraft(null);
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  aria-label="Fret number or X for dead note"
                                />
                                <div className="tempo-stepper">
                                  <button
                                    className="tempo-step-button tempo-step-up"
                                    type="button"
                                    disabled={!selectedNote.isDead && selectedNote.fret >= MAX_FRET}
                                    onClick={() => updateFret(selectedNote.isDead ? selectedNote.fret : selectedNote.fret + 1)}
                                    tabIndex={-1}
                                    aria-label="Increase fret"
                                  />
                                  <button
                                    className="tempo-step-button tempo-step-down"
                                    type="button"
                                    disabled={!selectedNote.isDead && selectedNote.fret <= MIN_FRET}
                                    onClick={() => updateFret(selectedNote.isDead ? 0 : Math.max(0, selectedNote.fret - 1))}
                                    tabIndex={-1}
                                    aria-label="Decrease fret"
                                  />
                                </div>
                              </div>
                            </label>
                            <div className="note-edit-button-row">
                              <button
                                type="button"
                                disabled={!selectedNote.isStringed || selectedNote.stringCount <= 1 || selectedNote.string >= selectedNote.stringCount}
                                onClick={() => moveSelectedNoteToString(1)}
                                aria-label="Move note to next string"
                                title="Move note to next string"
                              >
                                <Icon name="arrow-up" />
                              </button>
                              <button
                                type="button"
                                disabled={!selectedNote.isStringed || selectedNote.stringCount <= 1 || selectedNote.string <= 1}
                                onClick={() => moveSelectedNoteToString(-1)}
                                aria-label="Move note to previous string"
                                title="Move note to previous string"
                              >
                                <Icon name="arrow-down" />
                              </button>
                              <button
                                type="button"
                                disabled={!selectedNote.isDead && selectedNote.fret >= MAX_FRET}
                                onClick={() => updateFret(selectedNote.isDead ? selectedNote.fret : selectedNote.fret + 1)}
                                aria-label="Increase fret"
                                title="Increase fret"
                              >
                                <Icon name="plus" />
                              </button>
                              <button
                                type="button"
                                disabled={!selectedNote.isDead && selectedNote.fret <= MIN_FRET}
                                onClick={() => updateFret(selectedNote.isDead ? 0 : selectedNote.fret - 1)}
                                aria-label="Decrease fret"
                                title="Decrease fret"
                              >
                                <Icon name="minus" />
                              </button>
                              <button
                                className={`dead-note-toggle ${selectedNote.isDead ? 'active' : ''}`}
                                type="button"
                                onClick={toggleDeadNote}
                                aria-pressed={selectedNote.isDead}
                                aria-label="Dead note (X)"
                                title="Dead / muted note (X)"
                              >
                                X
                              </button>
                            </div>
                          </>
                        )}

                        {selectedBeat && (
                          <>
                            <div className="edit-subsection">
                              <span className="edit-subsection-label">Duration</span>
                              <div className="duration-grid" role="group" aria-label="Note or break duration">
                                {DURATION_OPTIONS.map(option => {
                                  const active = selectedBeat.duration === option.duration;
                                  return (
                                    <button
                                      key={option.duration}
                                      className={active ? 'active' : ''}
                                      type="button"
                                      aria-pressed={active}
                                      title={option.title}
                                      onClick={() => updateBeatDuration(option.duration)}
                                    >
                                      <DurationIcon duration={option.duration} />
                                      <span>{option.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="duration-modifier-row" role="group" aria-label="Duration modifiers">
                                <button
                                  className={selectedBeat.dots === 1 ? 'active' : ''}
                                  type="button"
                                  aria-pressed={selectedBeat.dots === 1}
                                  title="Dotted (shortcut: .)"
                                  onClick={() => toggleBeatDots(1)}
                                >
                                  Dot
                                </button>
                                <button
                                  className={selectedBeat.dots === 2 ? 'active' : ''}
                                  type="button"
                                  aria-pressed={selectedBeat.dots === 2}
                                  title="Double-dotted"
                                  onClick={() => toggleBeatDots(2)}
                                >
                                  2× Dot
                                </button>
                                <button
                                  className={selectedBeat.isTriplet ? 'active' : ''}
                                  type="button"
                                  aria-pressed={selectedBeat.isTriplet}
                                  title="Triplet (3:2)"
                                  onClick={toggleBeatTriplet}
                                >
                                  Triplet
                                </button>
                              </div>
                            </div>

                            <div className="edit-subsection">
                              <span className="edit-subsection-label">Breaks</span>
                              <div className="break-action-row">
                                <button
                                  className={selectedBeat.isRest ? 'active' : ''}
                                  type="button"
                                  aria-pressed={selectedBeat.isRest}
                                  title="Turn beat into a rest/break (shortcut: R)"
                                  onClick={convertBeatToRest}
                                >
                                  Rest
                                </button>
                                <button
                                  type="button"
                                  title="Insert a rest/break after this beat"
                                  onClick={insertRestBeat}
                                >
                                  + Rest
                                </button>
                                <button
                                  className="break-delete-button"
                                  type="button"
                                  title={selectedBeat.beatCountInVoice <= 1 ? 'Clear bar to whole rest' : 'Remove this beat/break'}
                                  onClick={removeSelectedBeat}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        <p className="note-edit-hint">
                          Type 0–24 or X on the tab. Use + / - for duration, . for dot, R for rest, Backspace to clear.
                        </p>
                      </div>
                    </section>
                  )}

                  <section className="panel-section collapsible-panel-section">
                    {renderSidebarSectionHeader('technique', 'Technique')}
                    <div
                      className="collapsible-section-content technique-grid"
                      id={getSidebarSectionContentId('technique')}
                      hidden={isSidebarSectionCollapsed('technique')}
                    >
                      {TECHNIQUES.map(technique => {
                        const active = isTechniqueActive(technique.id);
                        return (
                          <button
                            className={active ? 'active' : ''}
                            type="button"
                            key={technique.id}
                            disabled={!selectedNote}
                            aria-pressed={active}
                            title={technique.title}
                            onClick={() => toggleTechnique(technique.id)}
                          >
                            <TechniqueIcon id={technique.id} />
                            <span>{technique.label}</span>
                          </button>
                        );
                      })}
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
            ref={timelineRef}
            key={activePlaylistId || 'timeline-empty'}
            score={score}
            scoreEditRevision={scoreEditRevision}
            trackNameRevision={trackNameRevision}
            orderedTrackIndices={trackOrder}
            activeTracks={activeTracks}
            onToggleTrack={toggleTrack}
            draggedTrackIndex={draggedTrackIndex}
            trackDropIndex={trackDropIndex}
            onTrackDragStart={handleTrackDragStart}
            onTrackDragOver={handleTrackDragOver}
            onTrackDrop={handleTrackDrop}
            onTrackDragEnd={clearTrackDragState}
            onSeek={handleTimelineSeek}
            timelineMode={timelineMode}
            onTimelineModeChange={setTimelineMode}
            snapToBarStart={snapToBarStart}
            onSnapToBarStartChange={setSnapToBarStart}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            trackSettings={trackSettings}
            onTrackSettingsChange={handleTrackSettingsChange}
            onRenameTrack={renameTrack}
            onRequestDeleteTrack={requestDeleteTrack}
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
            <img src={assetPath('GitHub_Invertocat_White.svg')} alt="" />
            sebastian-ungureanu/tabengine
          </a>
        </footer>
      </main>

      <dialog
        ref={deleteTrackDialogRef}
        className="confirm-dialog"
        aria-labelledby="delete-track-dialog-title"
        aria-describedby="delete-track-dialog-desc"
        onClose={handleDeleteTrackDialogClose}
      >
        <h1 id="delete-track-dialog-title">Delete track?</h1>
        <p id="delete-track-dialog-desc">
          Are you sure you want to delete <strong>{trackPendingDelete?.name}</strong>? This will remove the track and its notes from the current score.
        </p>
        <form method="dialog" className="confirm-dialog-actions">
          <button type="submit" value="cancel" className="confirm-dialog-cancel" autoFocus>
            Cancel
          </button>
          <button type="submit" value="delete" className="confirm-dialog-danger">
            Delete track
          </button>
        </form>
      </dialog>

      <dialog
        ref={addTrackDialogRef}
        className="confirm-dialog add-track-dialog"
        aria-labelledby="add-track-dialog-title"
        onClose={handleAddTrackDialogClose}
      >
        <h1 id="add-track-dialog-title">Add track</h1>
        <form className="add-track-form" onSubmit={handleAddTrackDialogSubmit}>
          <div className="add-track-preview">
            <InstrumentIcon preset={newTrackPreset} className="instrument-icon" />
            <div className="add-track-preview-meta">
              <strong>{newTrackPreset.label}</strong>
              <small>{newTrackPreset.summary}</small>
            </div>
          </div>

          <label className="add-track-field" htmlFor="new-track-instrument">
            <span>Instrument</span>
            <select
              id="new-track-instrument"
              value={newTrackInstrumentId}
              onChange={(e) => handleNewTrackInstrumentChange(e.target.value)}
            >
              {TRACK_INSTRUMENT_GROUPS.map(({ group, instruments }) => (
                <optgroup label={group} key={group}>
                  {instruments.map(instrument => (
                    <option value={instrument.id} key={instrument.id}>
                      {instrument.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="add-track-field" htmlFor="new-track-name">
            <span>Track name</span>
            <input
              id="new-track-name"
              type="text"
              value={newTrackName}
              onChange={(e) => {
                setNewTrackName(e.target.value);
                setIsNewTrackNameCustomized(true);
              }}
              placeholder={newTrackPreset.defaultName}
              maxLength={64}
            />
          </label>

          <div className="confirm-dialog-actions">
            <button
              type="button"
              className="confirm-dialog-cancel"
              onClick={() => setIsAddTrackDialogOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="confirm-dialog-primary">
              Add track
            </button>
          </div>
        </form>
      </dialog>
      </ToolbarTooltipPortalProvider>
      <div className="toolbar-tooltip-portal" ref={setTooltipPortal} />
    </div>
  );
}

export default App;
