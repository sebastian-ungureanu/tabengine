import * as alphaTab from '@coderline/alphatab';
import { getInstrumentCategory, INSTRUMENT_COLORS, type InstrumentCategory } from '../utils/instruments';

interface InstrumentIconProps {
  track?: alphaTab.model.Track | null;
  className?: string;
}

const InstrumentSvg = ({ category }: { category: InstrumentCategory }) => {
  switch (category) {
    case 'Acoustic guitar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.2 14.8a3.4 3.4 0 1 0 4.8 4.8 3.4 3.4 0 0 0-4.8-4.8Z" />
          <path d="M5.3 10.9a3.3 3.3 0 1 0 4.7 4.7 3.3 3.3 0 0 0-4.7-4.7Z" />
          <path d="m11.7 12.3 7.1-7.1" />
          <path d="m17.5 3.9 2.6 2.6" />
          <path d="M9.3 16.3h.1" />
        </svg>
      );
    case 'Electric guitar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 17 3-6 3 3 6-8" />
          <path d="m15.8 4.7 3.5 3.5" />
          <path d="M7.4 14.4 4 15l1 2.4L3.7 20l3.4-.4 2.1 1.7.5-3.2" />
          <path d="M10 15.5h.1" />
        </svg>
      );
    case 'Bass':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.4 14.2a3.8 3.8 0 1 0 5.4 5.4 3.8 3.8 0 0 0-5.4-5.4Z" />
          <path d="m12.6 14 6.9-9.5" />
          <path d="m18.2 3.3 2.5 1.8" />
          <path d="M11.8 17.2h.1" />
          <path d="M13.4 13.1 16 15" />
        </svg>
      );
    case 'Piano':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v12H4z" />
          <path d="M7 6v12" />
          <path d="M11 6v12" />
          <path d="M15 6v12" />
          <path d="M8.8 6v7" />
          <path d="M12.8 6v7" />
          <path d="M16.8 6v7" />
        </svg>
      );
    case 'Strings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 4c2 2 2 4 0 6 3 1 4 4 2 7-1.4 2.1-4.6 2.1-6 0-2-3-1-6 2-7-2-2-2-4 0-6" />
          <path d="M15 5c2.8 3.5 3.7 7.8 2.5 13" />
          <path d="m5 20 14-16" />
          <path d="M10 12h2" />
        </svg>
      );
    case 'Percussion':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="12" cy="9" rx="6.5" ry="3" />
          <path d="M5.5 9v5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V9" />
          <path d="m5 5 5 4" />
          <path d="m19 5-5 4" />
        </svg>
      );
    case 'Woodwind':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 17 19 7" />
          <path d="m17 5 2 3" />
          <path d="M8.5 14.5h.1" />
          <path d="M11.5 12.5h.1" />
          <path d="M14.5 10.5h.1" />
          <path d="m4 18 2 2" />
        </svg>
      );
    case 'Vocals':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 13a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z" />
          <path d="M6 10a6 6 0 0 0 12 0" />
          <path d="M12 16v4" />
          <path d="M9 20h6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 16V8" />
          <path d="M9 19V5" />
          <path d="M13 15V9" />
          <path d="M17 18V6" />
          <path d="M21 14v-4" />
        </svg>
      );
  }
};

const InstrumentIcon = ({ track, className = '' }: InstrumentIconProps) => {
  const category = getInstrumentCategory(track);
  const color = INSTRUMENT_COLORS[category];

  return (
    <span
      className={`instrument-type-icon ${className}`}
      style={{ borderColor: color, color }}
      title={category}
      aria-label={category}
    >
      <InstrumentSvg category={category} />
    </span>
  );
};

export default InstrumentIcon;
