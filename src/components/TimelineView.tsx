import React, { useRef } from 'react';
import * as alphaTab from '@coderline/alphatab';
import InstrumentIcon from './InstrumentIcon';
import { getInstrumentCategory, INSTRUMENT_COLORS } from '../utils/instruments';

interface BarState {
    hasNotes: boolean;
    index: number;
}

interface MidiNoteEvent {
    id: string;
    start: number;
    duration: number;
    lane: number;
}

interface TimelineTrackData {
    track: alphaTab.model.Track;
    barStates: BarState[];
    noteEvents: MidiNoteEvent[];
}

interface TimelineData {
    totalBars: number;
    totalTicks: number;
    barStartTicks: number[];
    barSnapTicks: number[];
    timelineTracks: TimelineTrackData[];
}

export interface TrackSettings {
    volume: number;
    pan: number;
    mute: boolean;
    solo: boolean;
}

interface TimelineViewProps {
    score: alphaTab.model.Score | null;
    activeTracks: number[];
    onToggleTrack: (trackIndex: number) => void;
    currentTick: number;
    onSeek: (tick: number) => void;
    timelineMode: 'bars' | 'timeline';
    onTimelineModeChange: (mode: 'bars' | 'timeline') => void;
    snapToBarStart: boolean;
    onSnapToBarStartChange: (enabled: boolean) => void;
    selectionMode: 'single' | 'multi';
    onSelectionModeChange: (mode: 'single' | 'multi') => void;
    trackSettings: Record<number, TrackSettings>;
    onTrackSettingsChange: (trackIndex: number, settings: Partial<TrackSettings>) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ 
    score, activeTracks, onToggleTrack, currentTick, onSeek, timelineMode, onTimelineModeChange,
    snapToBarStart, onSnapToBarStartChange, selectionMode, onSelectionModeChange,
    trackSettings, onTrackSettingsChange
}) => {
    const visualRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = React.useState(300);
    const isResizing = useRef(false);

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 100 && newHeight < window.innerHeight * 0.7) {
                setHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const timelineData = React.useMemo(() => {
        if (!score) {
            return {
                totalBars: 0,
                totalTicks: 0,
                barStartTicks: [],
                barSnapTicks: [],
                timelineTracks: [] as TimelineTrackData[]
            } satisfies TimelineData;
        }

        const totalBars = score.masterBars.length;
        const barStartTicks: number[] = [];
        let totalTicks = 0;
        score.masterBars.forEach(masterBar => {
            barStartTicks.push(totalTicks);
            totalTicks += masterBar.calculateDuration();
        });
        const firstNoteTicks = Array.from({ length: totalBars }, () => Number.POSITIVE_INFINITY);
        const timelineTracks = score.tracks.map(track => {
            const barStates: BarState[] = [];
            const rawNoteEvents: Array<MidiNoteEvent & { pitch: number }> = [];

            for (let i = 0; i < totalBars; i++) {
                let hasNotes = false;
                track.staves.forEach(staff => {
                    const bar = staff.bars[i];
                    if (!bar) return;
                    bar.voices.forEach((voice: alphaTab.model.Voice) => {
                        voice.beats.forEach((beat: alphaTab.model.Beat) => {
                            if (beat.notes.length === 0) return;
                            hasNotes = true;

                            const start = Math.max(0, beat.absolutePlaybackStart || beat.playbackStart || 0);
                            const duration = Math.max(30, beat.playbackDuration || 60);
                            firstNoteTicks[i] = Math.min(firstNoteTicks[i], start);
                            beat.notes.forEach((note: alphaTab.model.Note) => {
                                const pitch = note.isPercussion
                                    ? note.percussionArticulation || note.element || note.string || 36
                                    : note.realValue || (note.octave * 12) + note.tone;

                                rawNoteEvents.push({
                                    id: `${track.index}-${staff.index}-${i}-${voice.index}-${beat.index}-${note.index}`,
                                    start,
                                    duration,
                                    pitch,
                                    lane: 50
                                });
                            });
                        });
                    });
                });
                barStates.push({ hasNotes, index: i });
            }

            const pitches = rawNoteEvents.map(note => note.pitch);
            const minPitch = Math.min(...pitches);
            const maxPitch = Math.max(...pitches);
            const pitchRange = Math.max(1, maxPitch - minPitch);
            const noteEvents = rawNoteEvents.map(note => ({
                ...note,
                lane: 82 - ((note.pitch - minPitch) / pitchRange) * 64
            }));

            return { track, barStates, noteEvents };
        });
        const barSnapTicks = firstNoteTicks.map((tick, index) => (
            Number.isFinite(tick) ? tick : barStartTicks[index] || 0
        ));

        return { totalBars, totalTicks, barStartTicks, barSnapTicks, timelineTracks };
    }, [score]);

    if (!score) return (
        <div className="timeline-container" style={{ height: `${height}px` }}>
            <div className="timeline-header">
                <div className="timeline-tabs">
                    <button className="active" type="button">Bars</button>
                    <button type="button">Timeline</button>
                </div>
            </div>
            <div className="timeline-empty-state">Load a file to see the timeline</div>
        </div>
    );

    const { totalBars, totalTicks, barStartTicks, barSnapTicks, timelineTracks } = timelineData;

    let elapsedTicks = 0;
    let currentBarIndex = 0;
    for (let i = 0; i < score.masterBars.length; i++) {
        const duration = score.masterBars[i].calculateDuration();
        if (currentTick < elapsedTicks + duration || i === score.masterBars.length - 1) {
            currentBarIndex = i;
            break;
        }
        elapsedTicks += duration;
    }
    const currentMasterBar = score.masterBars[currentBarIndex];
    const currentBarNumber = currentBarIndex + 1;
    const timeSignature = `${currentMasterBar.timeSignatureNumerator}/${currentMasterBar.timeSignatureDenominator}`;
    const rulerStep = totalBars > 48 ? 8 : totalBars > 24 ? 4 : 2;
    const rulerMarks = Array.from(
        { length: Math.ceil(totalBars / rulerStep) + 1 },
        (_, index) => Math.min(index * rulerStep, totalBars)
    ).filter((value, index, values) => value > 0 && values.indexOf(value) === index);
    
    const playheadPosition = totalTicks > 0 ? Math.max(0, Math.min(100, (currentTick / totalTicks) * 100)) : 0;

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (!visualRef.current) return;
        const rect = visualRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const clickedTick = Math.floor(percentage * totalTicks);

        if (!snapToBarStart) {
            onSeek(clickedTick);
            return;
        }

        let clickedBarIndex = 0;
        for (let i = barStartTicks.length - 1; i >= 0; i--) {
            if (clickedTick >= barStartTicks[i]) {
                clickedBarIndex = i;
                break;
            }
        }
        onSeek(Math.floor(barSnapTicks[clickedBarIndex] ?? clickedTick));
    };

    return (
        <div className="timeline-container" style={{ height: `${height}px` }}>
            <div 
                className="timeline-resizer" 
                onMouseDown={() => {
                    isResizing.current = true;
                    document.body.style.cursor = 'ns-resize';
                }}
            />
            <div className="timeline-header">
                <div className="timeline-tabs">
                    <button
                        className={timelineMode === 'bars' ? 'active' : ''}
                        type="button"
                        onClick={() => onTimelineModeChange('bars')}
                    >
                        Bars
                    </button>
                    <button
                        className={timelineMode === 'timeline' ? 'active' : ''}
                        type="button"
                        onClick={() => onTimelineModeChange('timeline')}
                    >
                        Timeline
                    </button>
                </div>
                <div className="timeline-toolstrip">
                    <button
                        className={snapToBarStart ? 'active' : ''}
                        type="button"
                        onClick={() => onSnapToBarStartChange(!snapToBarStart)}
                    >
                        Snap to bar start
                    </button>
                    <button
                        className={selectionMode === 'single' ? 'active' : ''}
                        type="button"
                        onClick={() => onSelectionModeChange('single')}
                    >
                        Single
                    </button>
                    <button
                        className={selectionMode === 'multi' ? 'active' : ''}
                        type="button"
                        onClick={() => onSelectionModeChange('multi')}
                    >
                        Multi
                    </button>
                </div>
                <div className="timeline-meta">
                    <span>Bar {currentBarNumber}</span>
                    <span>{totalBars} bars</span>
                    <span>{timeSignature}</span>
                </div>
            </div>
            <div className="timeline-ruler">
                <div className="timeline-ruler-spacer" />
                <div className="timeline-ruler-grid">
                    {rulerMarks.map(mark => (
                        <span key={mark} style={{ left: `${((mark - 1) / totalBars) * 100}%` }}>
                            {mark}
                        </span>
                    ))}
                </div>
            </div>
            <div
                className="timeline-tracks"
                style={{ '--timeline-track-count': timelineTracks.length } as React.CSSProperties}
            >
                <div className="timeline-playhead-layer">
                    <div
                        className="timeline-playhead"
                        style={{ left: `${playheadPosition}%` }}
                    />
                </div>
                {timelineTracks.map(({ track, barStates, noteEvents }) => {
                    const settings = trackSettings[track.index] || { volume: 8, pan: 0, mute: false, solo: false };
                    const instrumentCategory = getInstrumentCategory(track);
                    const instrumentColor = INSTRUMENT_COLORS[instrumentCategory];
                    return (
                        <div key={track.index} className="timeline-track-row">
                            <div className={`timeline-track-info ${activeTracks.includes(track.index) ? 'active' : ''}`}>
                                <InstrumentIcon track={track} className="timeline-track-icon" />
                                <div className="track-name" onClick={() => onToggleTrack(track.index)}>
                                    <strong>{track.index + 1}. {track.name}</strong>
                                </div>
                                <div className="track-controls">
                                    <button 
                                        className={`control-btn solo ${settings.solo ? 'active' : ''}`}
                                        onClick={() => onTrackSettingsChange(track.index, { solo: !settings.solo })}
                                    >
                                        S
                                    </button>
                                    <button 
                                        className={`control-btn mute ${settings.mute ? 'active' : ''}`}
                                        onClick={() => onTrackSettingsChange(track.index, { mute: !settings.mute })}
                                    >
                                        M
                                    </button>
                                    <div className="slider-group">
                                        <label>Vol {settings.volume}</label>
                                        <input 
                                            type="range" min="0" max="15" step="1" 
                                            className="track-slider"
                                            value={settings.volume}
                                            onChange={(e) => onTrackSettingsChange(track.index, { volume: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="slider-group">
                                        <label>Pan {settings.pan}</label>
                                        <input 
                                            type="range" min="-10" max="10" step="1" 
                                            className="track-slider"
                                            value={settings.pan}
                                            onChange={(e) => onTrackSettingsChange(track.index, { pan: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div
                                className={`timeline-visual ${timelineMode === 'timeline' ? 'timeline-visual-notes' : ''}`}
                                ref={track.index === 0 ? visualRef : null}
                                onClick={handleTimelineClick}
                            >
                                {timelineMode === 'bars'
                                    ? barStates.map((bar, i) => (
                                        <div
                                            key={bar.index}
                                            className={`timeline-block ${bar.hasNotes ? '' : 'empty'}`}
                                            style={{
                                                left: `${(i / totalBars) * 100}%`,
                                                width: `${(1 / totalBars) * 100}%`,
                                                '--timeline-track-color': instrumentColor
                                            } as React.CSSProperties}
                                        />
                                    ))
                                    : noteEvents.map(note => (
                                        <div
                                            key={note.id}
                                            className="timeline-note"
                                            style={{
                                                left: `${totalTicks > 0 ? (note.start / totalTicks) * 100 : 0}%`,
                                                width: `${totalTicks > 0 ? Math.max(0.18, (note.duration / totalTicks) * 100) : 0.18}%`,
                                                top: `${note.lane}%`,
                                                '--timeline-track-color': instrumentColor
                                            } as React.CSSProperties}
                                        />
                                    ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TimelineView;
