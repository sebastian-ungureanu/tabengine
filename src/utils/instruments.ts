import * as alphaTab from '@coderline/alphatab';

export type InstrumentCategory =
  | 'Acoustic guitar'
  | 'Electric guitar'
  | 'Bass'
  | 'Piano'
  | 'Strings'
  | 'Percussion'
  | 'Woodwind'
  | 'Vocals'
  | 'Others';

export type TrackInstrumentGroup =
  | 'Guitar'
  | 'Bass'
  | 'Drums & Percussion'
  | 'Keyboards'
  | 'Strings'
  | 'Winds & Brass'
  | 'Vocals & Synth';

export interface TrackInstrumentPreset {
  id: string;
  label: string;
  defaultName: string;
  shortName: string;
  group: TrackInstrumentGroup;
  category: InstrumentCategory;
  program: number;
  isPercussion: boolean;
  clef: alphaTab.model.Clef;
  stringCount: number | null;
  displayTranspositionPitch: number;
  iconFileName: string;
  summary: string;
}

export const INSTRUMENT_COLORS: Record<InstrumentCategory, string> = {
  'Acoustic guitar': '#F4A942',
  'Electric guitar': '#E8734A',
  Bass: '#4FD9A0',
  Piano: '#E8E8E0',
  Strings: '#FCD34D',
  Percussion: '#F87171',
  Woodwind: '#6EE7B7',
  Vocals: '#C084FC',
  Others: '#94A3B8'
};

export const TRACK_INSTRUMENTS: readonly TrackInstrumentPreset[] = [
  {
    id: 'electric-guitar-clean',
    label: 'Electric Guitar (Clean)',
    defaultName: 'Electric Guitar',
    shortName: 'E.Gtr',
    group: 'Guitar',
    category: 'Electric guitar',
    program: 27,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: 6,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-100.png',
    summary: '6-string · Guitar standard tuning'
  },
  {
    id: 'electric-guitar-overdrive',
    label: 'Electric Guitar (Overdrive)',
    defaultName: 'Overdrive Guitar',
    shortName: 'OD Gtr',
    group: 'Guitar',
    category: 'Electric guitar',
    program: 29,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: 6,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-100.png',
    summary: '6-string · Guitar standard tuning'
  },
  {
    id: 'electric-guitar-distortion',
    label: 'Electric Guitar (Distortion)',
    defaultName: 'Distortion Guitar',
    shortName: 'Dist Gtr',
    group: 'Guitar',
    category: 'Electric guitar',
    program: 30,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: 6,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-100.png',
    summary: '6-string · Guitar standard tuning'
  },
  {
    id: 'electric-guitar-jazz',
    label: 'Electric Guitar (Jazz)',
    defaultName: 'Jazz Guitar',
    shortName: 'Jz Gtr',
    group: 'Guitar',
    category: 'Electric guitar',
    program: 26,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: 6,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-100.png',
    summary: '6-string · Guitar standard tuning'
  },
  {
    id: 'acoustic-guitar-steel',
    label: 'Acoustic Guitar (Steel)',
    defaultName: 'Acoustic Guitar',
    shortName: 'A.Gtr',
    group: 'Guitar',
    category: 'Acoustic guitar',
    program: 25,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: 6,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-folk-100.png',
    summary: '6-string · Guitar standard tuning'
  },
  {
    id: 'acoustic-guitar-nylon',
    label: 'Acoustic Guitar (Nylon)',
    defaultName: 'Nylon Guitar',
    shortName: 'Nylon',
    group: 'Guitar',
    category: 'Acoustic guitar',
    program: 24,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: 6,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-folk-100.png',
    summary: '6-string · Guitar standard tuning'
  },
  {
    id: 'bass-finger',
    label: 'Electric Bass (Finger)',
    defaultName: 'Electric Bass',
    shortName: 'Bass',
    group: 'Bass',
    category: 'Bass',
    program: 33,
    isPercussion: false,
    clef: alphaTab.model.Clef.F4,
    stringCount: 4,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-strings-100.png',
    summary: '4-string · Bass standard tuning'
  },
  {
    id: 'bass-pick',
    label: 'Electric Bass (Pick)',
    defaultName: 'Picked Bass',
    shortName: 'P.Bass',
    group: 'Bass',
    category: 'Bass',
    program: 34,
    isPercussion: false,
    clef: alphaTab.model.Clef.F4,
    stringCount: 4,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-strings-100.png',
    summary: '4-string · Bass standard tuning'
  },
  {
    id: 'bass-acoustic',
    label: 'Acoustic Bass',
    defaultName: 'Acoustic Bass',
    shortName: 'A.Bass',
    group: 'Bass',
    category: 'Bass',
    program: 32,
    isPercussion: false,
    clef: alphaTab.model.Clef.F4,
    stringCount: 4,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-strings-100.png',
    summary: '4-string · Bass standard tuning'
  },
  {
    id: 'bass-slap',
    label: 'Slap Bass',
    defaultName: 'Slap Bass',
    shortName: 'S.Bass',
    group: 'Bass',
    category: 'Bass',
    program: 36,
    isPercussion: false,
    clef: alphaTab.model.Clef.F4,
    stringCount: 4,
    displayTranspositionPitch: -12,
    iconFileName: 'icons8-guitar-strings-100.png',
    summary: '4-string · Bass standard tuning'
  },
  {
    id: 'drums',
    label: 'Drum Kit',
    defaultName: 'Drumkit',
    shortName: 'Drums',
    group: 'Drums & Percussion',
    category: 'Percussion',
    program: 0,
    isPercussion: true,
    clef: alphaTab.model.Clef.Neutral,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-drums-100.png',
    summary: 'Percussion staff · MIDI channel 10'
  },
  {
    id: 'piano-grand',
    label: 'Acoustic Grand Piano',
    defaultName: 'Piano',
    shortName: 'Piano',
    group: 'Keyboards',
    category: 'Piano',
    program: 0,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-grand-piano-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'piano-electric',
    label: 'Electric Piano',
    defaultName: 'Electric Piano',
    shortName: 'E.Pno',
    group: 'Keyboards',
    category: 'Piano',
    program: 4,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-piano-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'organ-rock',
    label: 'Rock Organ',
    defaultName: 'Organ',
    shortName: 'Organ',
    group: 'Keyboards',
    category: 'Piano',
    program: 18,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-piano-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'violin',
    label: 'Violin',
    defaultName: 'Violin',
    shortName: 'Vln',
    group: 'Strings',
    category: 'Strings',
    program: 40,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-violin-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'cello',
    label: 'Cello',
    defaultName: 'Cello',
    shortName: 'Cello',
    group: 'Strings',
    category: 'Strings',
    program: 42,
    isPercussion: false,
    clef: alphaTab.model.Clef.F4,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-cello-100.png',
    summary: 'Standard notation · Bass clef'
  },
  {
    id: 'strings-ensemble',
    label: 'String Ensemble',
    defaultName: 'Strings',
    shortName: 'Str',
    group: 'Strings',
    category: 'Strings',
    program: 48,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-violin-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'saxophone',
    label: 'Alto Saxophone',
    defaultName: 'Saxophone',
    shortName: 'Sax',
    group: 'Winds & Brass',
    category: 'Woodwind',
    program: 65,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-sax-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'flute',
    label: 'Flute',
    defaultName: 'Flute',
    shortName: 'Flute',
    group: 'Winds & Brass',
    category: 'Woodwind',
    program: 73,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-flute-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'clarinet',
    label: 'Clarinet',
    defaultName: 'Clarinet',
    shortName: 'Clar',
    group: 'Winds & Brass',
    category: 'Woodwind',
    program: 71,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-clarinet-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'trumpet',
    label: 'Trumpet',
    defaultName: 'Trumpet',
    shortName: 'Tpt',
    group: 'Winds & Brass',
    category: 'Others',
    program: 56,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-trumpet-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'vocals',
    label: 'Vocals / Choir',
    defaultName: 'Vocals',
    shortName: 'Vox',
    group: 'Vocals & Synth',
    category: 'Vocals',
    program: 52,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-microphone-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'synth-lead',
    label: 'Synth Lead',
    defaultName: 'Synth Lead',
    shortName: 'Lead',
    group: 'Vocals & Synth',
    category: 'Others',
    program: 80,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-audio-wave2-100.png',
    summary: 'Standard notation · Treble clef'
  },
  {
    id: 'synth-pad',
    label: 'Synth Pad',
    defaultName: 'Synth Pad',
    shortName: 'Pad',
    group: 'Vocals & Synth',
    category: 'Others',
    program: 88,
    isPercussion: false,
    clef: alphaTab.model.Clef.G2,
    stringCount: null,
    displayTranspositionPitch: 0,
    iconFileName: 'icons8-audio-wave2-100.png',
    summary: 'Standard notation · Treble clef'
  }
];

export const TRACK_INSTRUMENT_GROUPS: ReadonlyArray<{
  group: TrackInstrumentGroup;
  instruments: readonly TrackInstrumentPreset[];
}> = (
  [
    'Guitar',
    'Bass',
    'Drums & Percussion',
    'Keyboards',
    'Strings',
    'Winds & Brass',
    'Vocals & Synth'
  ] as const
).map(group => ({
  group,
  instruments: TRACK_INSTRUMENTS.filter(instrument => instrument.group === group)
}));

export const DEFAULT_TRACK_INSTRUMENT_ID = 'electric-guitar-clean';

const TRACK_INSTRUMENT_BY_ID = new Map<string, TrackInstrumentPreset>(
  TRACK_INSTRUMENTS.map(preset => [preset.id, preset])
);

const explicitTrackPresets = new WeakMap<alphaTab.model.Track, TrackInstrumentPreset>();

const MIDI_PERCUSSION_CHANNEL = 9;
const DEFAULT_PERCUSSION_ARTICULATION = 38; // Acoustic Snare

export const getTrackInstrumentPresetById = (id: string): TrackInstrumentPreset | undefined => {
  return TRACK_INSTRUMENT_BY_ID.get(id);
};

export const getDefaultInstrumentIdForTrackType = (defaultTrackType: 'guitar' | 'bass' | 'drums'): string => {
  switch (defaultTrackType) {
    case 'bass':
      return 'bass-finger';
    case 'drums':
      return 'drums';
    case 'guitar':
    default:
      return DEFAULT_TRACK_INSTRUMENT_ID;
  }
};

export const getExplicitTrackInstrumentPreset = (
  track: alphaTab.model.Track | null | undefined
): TrackInstrumentPreset | null => {
  if (!track) return null;
  const cached = explicitTrackPresets.get(track);
  if (
    cached &&
    cached.isPercussion === track.isPercussion &&
    (cached.isPercussion || cached.program === track.playbackInfo.program)
  ) {
    return cached;
  }
  return null;
};

export const getTrackInstrumentPreset = (
  track: alphaTab.model.Track | null | undefined
): TrackInstrumentPreset | null => {
  if (!track) return null;

  const explicit = getExplicitTrackInstrumentPreset(track);
  if (explicit) return explicit;

  if (track.isPercussion) {
    return TRACK_INSTRUMENT_BY_ID.get('drums') ?? null;
  }

  const program = track.playbackInfo.program;
  const isStringed = Boolean(track.staves[0]?.isStringed);
  if (program === 0 && isStringed) {
    return null;
  }

  return TRACK_INSTRUMENTS.find(preset => !preset.isPercussion && preset.program === program) ?? null;
};

const isProgramInRange = (program: number, start: number, end: number) => program >= start && program <= end;

const getCategoryFromProgram = (program: number): InstrumentCategory | null => {
  if (isProgramInRange(program, 1, 7) || isProgramInRange(program, 16, 23)) return 'Piano';
  if (isProgramInRange(program, 24, 25)) return 'Acoustic guitar';
  if (isProgramInRange(program, 26, 31)) return 'Electric guitar';
  if (isProgramInRange(program, 32, 39)) return 'Bass';
  if (isProgramInRange(program, 40, 51)) return 'Strings';
  if (isProgramInRange(program, 52, 54)) return 'Vocals';
  if (isProgramInRange(program, 56, 63)) return 'Others';
  if (isProgramInRange(program, 64, 79)) return 'Woodwind';
  if (isProgramInRange(program, 80, 103)) return 'Others';
  if (isProgramInRange(program, 112, 119)) return 'Percussion';
  return null;
};

const getCategoryFromName = (name: string): InstrumentCategory | null => {
  if (/\b(drum|drums|drumkit|percussion|kick|snare|cymbal|tom)\b/.test(name)) return 'Percussion';
  if (/\b(vocal|vocals|voice|choir|chorus|singer)\b/.test(name)) return 'Vocals';
  if (/\bbass\b/.test(name)) return 'Bass';
  if (/\b(piano|keyboard|keys|grand|upright|organ)\b/.test(name)) return 'Piano';
  if (/\b(strings?|violin|viola|cello|contrabass)\b/.test(name)) return 'Strings';
  if (/\b(flute|clarinet|sax|saxophone|oboe|bassoon|piccolo|recorder|woodwind)\b/.test(name)) return 'Woodwind';
  if (/\bacoustic\b.*\bguitar\b|\bguitar\b.*\bacoustic\b/.test(name)) return 'Acoustic guitar';
  if (/\belectric\b.*\bguitar\b|\bguitar\b.*\belectric\b|\bdistortion\b|\boverdrive\b|\bjazz guitar\b|\bclean guitar\b/.test(name)) return 'Electric guitar';
  if (/\bguitar\b/.test(name)) return 'Electric guitar';
  return null;
};

export const getInstrumentCategory = (track: alphaTab.model.Track | null | undefined): InstrumentCategory => {
  if (!track) return 'Others';

  const explicit = getExplicitTrackInstrumentPreset(track);
  if (explicit) return explicit.category;

  if (track.isPercussion) return 'Percussion';

  const program = track.playbackInfo.program;
  const programCategory = getCategoryFromProgram(program);
  if (programCategory) return programCategory;

  const nameCategory = getCategoryFromName(track.name.toLowerCase());
  if (nameCategory) return nameCategory;

  if (program === 0) return 'Piano';

  return 'Others';
};

const createDefaultTuning = (stringCount: number): alphaTab.model.Tuning => {
  const defaultTuning = alphaTab.model.Tuning.getDefaultTuningFor(stringCount);
  if (defaultTuning) {
    return new alphaTab.model.Tuning(defaultTuning.name, [...defaultTuning.tunings], defaultTuning.isStandard);
  }
  if (stringCount === 4) {
    return new alphaTab.model.Tuning('Bass Standard Tuning', [43, 38, 33, 28], true);
  }
  return new alphaTab.model.Tuning('Guitar Standard Tuning', [64, 59, 55, 50, 45, 40], true);
};

const mapPitchToStringFret = (midiPitch: number, tuning: number[]) => {
  let bestString = 1;
  let bestFret = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < tuning.length; i++) {
    const rawFret = midiPitch - tuning[i];
    const clampedFret = Math.max(0, Math.min(24, rawFret));
    const pitchError = Math.abs(rawFret - clampedFret);
    const score = pitchError * 100 + clampedFret;
    if (score < bestScore) {
      bestScore = score;
      bestString = tuning.length - i;
      bestFret = clampedFret;
    }
  }

  return { string: bestString, fret: bestFret };
};

export const allocateMelodicChannels = (
  score: alphaTab.model.Score,
  excludeTrack?: alphaTab.model.Track
): { primaryChannel: number; secondaryChannel: number } => {
  const usedChannels = new Set<number>([MIDI_PERCUSSION_CHANNEL]);
  for (const existing of score.tracks) {
    if (existing === excludeTrack) continue;
    usedChannels.add(existing.playbackInfo.primaryChannel);
    usedChannels.add(existing.playbackInfo.secondaryChannel);
  }

  const alloc = () => {
    let ch = 0;
    while (usedChannels.has(ch)) ch += 1;
    usedChannels.add(ch);
    return ch;
  };

  return {
    primaryChannel: alloc(),
    secondaryChannel: alloc()
  };
};

export interface ApplyInstrumentOptions {
  showStandardNotation: boolean;
  showTablature: boolean;
  isNewTrack?: boolean;
}

export const applyInstrumentPresetToTrack = (
  score: alphaTab.model.Score,
  track: alphaTab.model.Track,
  preset: TrackInstrumentPreset,
  options: ApplyInstrumentOptions
) => {
  const { showStandardNotation, showTablature, isNewTrack = false } = options;

  track.playbackInfo.bank = 0;

  if (preset.isPercussion) {
    track.playbackInfo.program = 0;
    track.playbackInfo.primaryChannel = MIDI_PERCUSSION_CHANNEL;
    track.playbackInfo.secondaryChannel = MIDI_PERCUSSION_CHANNEL;
  } else {
    track.playbackInfo.program = preset.program;
    const needsChannels =
      isNewTrack ||
      track.playbackInfo.primaryChannel === MIDI_PERCUSSION_CHANNEL ||
      track.playbackInfo.secondaryChannel === MIDI_PERCUSSION_CHANNEL ||
      track.playbackInfo.primaryChannel === track.playbackInfo.secondaryChannel;
    if (needsChannels) {
      const channels = allocateMelodicChannels(score, track);
      track.playbackInfo.primaryChannel = channels.primaryChannel;
      track.playbackInfo.secondaryChannel = channels.secondaryChannel;
    }
  }

  track.staves.forEach(staff => {
    staff.bars.forEach(bar => {
      bar.voices.forEach(voice => {
        voice.beats.forEach(beat => {
          if (beat.automations.length > 0) {
            beat.automations = beat.automations.filter(
              automation =>
                automation.type !== alphaTab.model.AutomationType.Instrument &&
                automation.type !== alphaTab.model.AutomationType.Bank
            );
          }
        });
      });
    });
  });

  track.staves.forEach(staff => {
    const wasPercussion = staff.isPercussion;
    const wasStringed = staff.isStringed && !wasPercussion;
    const prevStringCount = wasStringed ? staff.tuning.length : 0;

    const targetIsStringed = preset.stringCount !== null && !preset.isPercussion;
    const targetStringCount = targetIsStringed ? (preset.stringCount as number) : 0;
    const staffStructureChanged =
      isNewTrack ||
      wasPercussion !== preset.isPercussion ||
      wasStringed !== targetIsStringed ||
      prevStringCount !== targetStringCount;

    let nextTuning: alphaTab.model.Tuning;
    if (targetIsStringed) {
      nextTuning = !isNewTrack && wasStringed && prevStringCount === targetStringCount
        ? staff.stringTuning
        : createDefaultTuning(targetStringCount);
    } else {
      nextTuning = new alphaTab.model.Tuning('', [], false);
    }

    if (!isNewTrack && staffStructureChanged) {
      const notePitches = new Map<alphaTab.model.Note, number>();
      staff.bars.forEach(bar => {
        bar.voices.forEach(voice => {
          voice.beats.forEach(beat => {
            beat.notes.forEach(note => {
              const midi = note.calculateRealValue(false, false);
              notePitches.set(note, Number.isFinite(midi) && midi > 0 ? midi : 60);
            });
          });
        });
      });

      staff.bars.forEach(bar => {
        bar.clef = preset.clef;
        bar.voices.forEach(voice => {
          voice.beats.forEach(beat => {
            beat.notes.forEach(note => {
              const midi = notePitches.get(note) ?? 60;
              if (preset.isPercussion) {
                note.percussionArticulation = note.isPercussion
                  ? note.percussionArticulation
                  : DEFAULT_PERCUSSION_ARTICULATION;
                note.string = NaN;
                note.fret = NaN;
                note.octave = NaN;
                note.tone = NaN;
              } else if (targetIsStringed) {
                const { string, fret } = mapPitchToStringFret(midi, nextTuning.tunings);
                note.percussionArticulation = NaN;
                note.octave = NaN;
                note.tone = NaN;
                note.string = string;
                note.fret = fret;
              } else {
                note.percussionArticulation = NaN;
                note.string = NaN;
                note.fret = NaN;
                note.octave = Math.floor(midi / 12);
                note.tone = ((midi % 12) + 12) % 12;
              }
            });
          });
        });
      });
    } else if (isNewTrack || staff.bars[0]?.clef !== preset.clef) {
      staff.bars.forEach(bar => {
        bar.clef = preset.clef;
      });
    }

    staff.isPercussion = preset.isPercussion;
    staff.stringTuning = nextTuning;
    staff.displayTranspositionPitch = preset.displayTranspositionPitch;

    if (targetIsStringed) {
      staff.showStandardNotation = showStandardNotation;
      staff.showTablature = showTablature;
    } else {
      staff.showStandardNotation = true;
      staff.showTablature = false;
    }
  });

  explicitTrackPresets.set(track, preset);
};
