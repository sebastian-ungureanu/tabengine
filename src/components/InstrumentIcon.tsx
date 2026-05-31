import * as alphaTab from '@coderline/alphatab';
import { getInstrumentCategory, INSTRUMENT_COLORS, type InstrumentCategory } from '../utils/instruments';

interface InstrumentIconProps {
  track?: alphaTab.model.Track | null;
  className?: string;
}

const MUSIC_ICON_BASE = '/music-icons/';

const CATEGORY_ICONS: Record<InstrumentCategory, string> = {
  'Acoustic guitar': 'icons8-folk-100.png',
  'Electric guitar': 'icons8-guitar-100.png',
  Bass: 'icons8-guitar-strings-100.png',
  Piano: 'icons8-grand-piano-100.png',
  Strings: 'icons8-violin-100.png',
  Percussion: 'icons8-drums-100.png',
  Woodwind: 'icons8-clarinet-100.png',
  Vocals: 'icons8-microphone-100.png',
  Others: 'icons8-audio-wave2-100.png'
};

const TRACK_NAME_ICONS: Array<[RegExp, string]> = [
  [/\bbanjo\b/, 'icons8-banjo-100.png'],
  [/\bbassoon\b/, 'icons8-bassoon-100.png'],
  [/\bcello\b/, 'icons8-cello-100.png'],
  [/\bclarinet\b/, 'icons8-clarinet-100.png'],
  [/\bflute\b|\bpiccolo\b/, 'icons8-flute-100.png'],
  [/\bharmonica\b/, 'icons8-harmonica-100.png'],
  [/\bharp\b/, 'icons8-harp-100.png'],
  [/\bsax\b|\bsaxophone\b/, 'icons8-sax-100.png'],
  [/\btrombone\b/, 'icons8-trombone-100.png'],
  [/\btrumpet\b|\bcornet\b|\bflugelhorn\b/, 'icons8-trumpet-100.png'],
  [/\btuba\b/, 'icons8-tuba-100.png'],
  [/\bviolin\b|\bviola\b|\bfiddle\b/, 'icons8-violin-100.png'],
  [/\bpiano\b|\bkeyboard\b|\bkeys\b/, 'icons8-piano-100.png'],
  [/\bgrand\b.*\bpiano\b|\bpiano\b.*\bgrand\b/, 'icons8-grand-piano-100.png'],
  [/\bdrums?\b|\bdrumkit\b|\bpercussion\b|\bkick\b|\bsnare\b|\bcymbal\b|\btom\b/, 'icons8-drums-100.png'],
  [/\bmarching\b.*\bdrum|\btenor drums?\b/, 'icons8-marching-tenor-drums-100.png'],
  [/\bvocal\b|\bvocals\b|\bvoice\b|\bchoir\b|\bchorus\b|\bsinger\b|\bmicrophone\b/, 'icons8-microphone-100.png'],
  [/\bacoustic\b.*\bguitar\b|\bguitar\b.*\bacoustic\b|\bfolk\b/, 'icons8-folk-100.png'],
  [/\belectric\b.*\bguitar\b|\bguitar\b.*\belectric\b|\bguitar\b|\bdistortion\b|\boverdrive\b/, 'icons8-guitar-100.png']
];

const getIconFileName = (track: alphaTab.model.Track | null | undefined, category: InstrumentCategory) => {
  const trackName = track?.name.toLowerCase() ?? '';
  const match = TRACK_NAME_ICONS.find(([pattern]) => pattern.test(trackName));
  return match?.[1] ?? CATEGORY_ICONS[category];
};

const InstrumentIcon = ({ track, className = '' }: InstrumentIconProps) => {
  const category = getInstrumentCategory(track);
  const color = INSTRUMENT_COLORS[category];
  const iconFileName = getIconFileName(track, category);

  return (
    <span
      className={`instrument-type-icon ${className}`}
      style={{ borderColor: color, color }}
      title={category}
      aria-label={category}
    >
      <img src={`${MUSIC_ICON_BASE}${iconFileName}`} alt="" />
    </span>
  );
};

export default InstrumentIcon;
