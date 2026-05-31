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

const isProgramInRange = (program: number, start: number, end: number) => program >= start && program <= end;

export const getInstrumentCategory = (track: alphaTab.model.Track | null | undefined): InstrumentCategory => {
  if (!track) return 'Others';

  const name = track.name.toLowerCase();
  const program = track.playbackInfo.program;

  if (track.isPercussion || /\b(drum|drums|drumkit|percussion|kick|snare|cymbal|tom)\b/.test(name)) return 'Percussion';
  if (/\b(vocal|vocals|voice|choir|chorus|singer)\b/.test(name)) return 'Vocals';
  if (/\bbass\b/.test(name)) return 'Bass';
  if (/\b(piano|keyboard|keys|grand|upright)\b/.test(name)) return 'Piano';
  if (/\b(strings?|violin|viola|cello|contrabass)\b/.test(name)) return 'Strings';
  if (/\b(flute|clarinet|sax|saxophone|oboe|bassoon|piccolo|recorder|woodwind)\b/.test(name)) return 'Woodwind';
  if (/\bacoustic\b.*\bguitar\b|\bguitar\b.*\bacoustic\b/.test(name)) return 'Acoustic guitar';
  if (/\belectric\b.*\bguitar\b|\bguitar\b.*\belectric\b|\bdistortion\b|\boverdrive\b|\bjazz guitar\b|\bclean guitar\b/.test(name)) return 'Electric guitar';
  if (/\bguitar\b/.test(name)) return 'Electric guitar';

  if (isProgramInRange(program, 0, 7)) return 'Piano';
  if (isProgramInRange(program, 24, 25)) return 'Acoustic guitar';
  if (isProgramInRange(program, 26, 31)) return 'Electric guitar';
  if (isProgramInRange(program, 32, 39)) return 'Bass';
  if (isProgramInRange(program, 40, 51)) return 'Strings';
  if (isProgramInRange(program, 52, 54)) return 'Vocals';
  if (isProgramInRange(program, 64, 79)) return 'Woodwind';
  if (isProgramInRange(program, 112, 119)) return 'Percussion';

  return 'Others';
};
