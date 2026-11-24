import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import InstrumentIcon from './InstrumentIcon';
import { getInstrumentCategory, INSTRUMENT_COLORS } from '../utils/instruments';
import { computeBarTiming, findBarIndexAtTick, getBeatPlaybackTick, getTracksInOrder } from '../utils/scoreUtils';

interface BarState {
    hasNotes: boolean;
    index: number;
}

interface MidiNoteEvent {
    start: number;
    duration: number;
    lane: number;
}

interface TimelineTrackData {
    track: alphaTab.model.Track;
    barStates: BarState[];
    noteEvents: MidiNoteEvent[];
}

interface BarPosition {
    leftPct: number;
    widthPct: number;
}

interface TimelineData {
    totalBars: number;
    totalTicks: number;
    barStartTicks: number[];
    barSnapTicks: number[];
    barPositions: BarPosition[];
    timelineTracks: TimelineTrackData[];
}

export interface TrackSettings {
    volume: number;
    pan: number;
    mute: boolean;
    solo: boolean;
}

export interface TimelineViewRef {
    updateTick: (tick: number) => void;
}

interface TimelineViewProps {
    score: alphaTab.model.Score | null;
    scoreEditRevision: number;
    trackNameRevision: number;
    orderedTrackIndices: number[];
    activeTracks: number[];
    onToggleTrack: (trackIndex: number) => void;
    draggedTrackIndex: number | null;
    trackDropIndex: number | null;
    onTrackDragStart: (event: React.DragEvent<HTMLElement>, trackIndex: number) => void;
    onTrackDragOver: (event: React.DragEvent<HTMLElement>, trackIndex: number) => void;
    onTrackDrop: (event: React.DragEvent<HTMLElement>, trackIndex: number) => void;
    onTrackDragEnd: () => void;
    initialTick?: number;
    onSeek: (tick: number, trackIndex?: number) => void;
    timelineMode: 'bars' | 'timeline';
    onTimelineModeChange: (mode: 'bars' | 'timeline') => void;
    snapToBarStart: boolean;
    onSnapToBarStartChange: (enabled: boolean) => void;
    selectionMode: 'single' | 'multi';
    onSelectionModeChange: (mode: 'single' | 'multi') => void;
    trackSettings: Record<number, TrackSettings>;
    onTrackSettingsChange: (trackIndex: number, settings: Partial<TrackSettings>) => void;
    onRenameTrack: (trackIndex: number, nextName: string) => void;
    onRequestDeleteTrack: (trackIndex: number) => void;
}

const MIN_TIMELINE_TRACK_HEIGHT = 34;
const COMPACT_TRACK_COUNT_LIMIT = 6;
const TIMELINE_HEADER_HEIGHT = 46;
const TIMELINE_RULER_HEIGHT = 26;
const EMPTY_TIMELINE_HEIGHT = 150;
const DEFAULT_TIMELINE_HEIGHT = 300;
const MIN_TIMELINE_LABEL_WIDTH = 258;
const DEFAULT_TRACK_SETTINGS: TrackSettings = { volume: 8, pan: 0, mute: false, solo: false };

const getInitialTimelineHeight = (score: alphaTab.model.Score | null) => {
    const trackCount = score?.tracks.length || 0;
    if (trackCount > 0 && trackCount < COMPACT_TRACK_COUNT_LIMIT) {
        return TIMELINE_HEADER_HEIGHT + TIMELINE_RULER_HEIGHT + (trackCount * MIN_TIMELINE_TRACK_HEIGHT);
    }
    return score ? DEFAULT_TIMELINE_HEIGHT : EMPTY_TIMELINE_HEIGHT;
};

const RenameIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 20 4.7-1.1L19.6 8a2.1 2.1 0 0 0 0-3l-.6-.6a2.1 2.1 0 0 0-3 0L5.1 15.3 4 20Z" />
        <path d="m14.5 5.5 4 4" />
    </svg>
);

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m6 6 1 15h10l1-15" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
    </svg>
);

const lightenHexColor = (hex: string, amount = 0.22): string => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return hex;
    const r = Math.min(255, Math.round(parseInt(match[1], 16) + (255 - parseInt(match[1], 16)) * amount));
    const g = Math.min(255, Math.round(parseInt(match[2], 16) + (255 - parseInt(match[2], 16)) * amount));
    const b = Math.min(255, Math.round(parseInt(match[3], 16) + (255 - parseInt(match[3], 16)) * amount));
    return `rgb(${r}, ${g}, ${b})`;
};

interface TimelineNotesCanvasProps {
    noteEvents: MidiNoteEvent[];
    totalTicks: number;
    color: string;
}

const TimelineNotesCanvas = memo(({ noteEvents, totalTicks, color }: TimelineNotesCanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const draw = () => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (width <= 0 || height <= 0) return;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const pixelWidth = Math.round(width * dpr);
            const pixelHeight = Math.round(height * dpr);

            if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
                canvas.width = pixelWidth;
                canvas.height = pixelHeight;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            if (noteEvents.length === 0 || totalTicks <= 0) return;

            const fillColor = lightenHexColor(color, 0.22);
            const invTotalTicks = 1 / totalTicks;
            const minNoteWidth = Math.max(2, width * 0.0018);

            ctx.fillStyle = fillColor;
            ctx.globalAlpha = 0.9;

            for (let i = 0; i < noteEvents.length; i++) {
                const note = noteEvents[i];
                const x = note.start * invTotalTicks * width;
                const w = Math.max(minNoteWidth, note.duration * invTotalTicks * width);
                const y = (note.lane / 100) * height - 1;
                ctx.fillRect(x, y, w, 2);
            }
        };

        draw();

        const observer = new ResizeObserver(draw);
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [noteEvents, totalTicks, color]);

    return <canvas ref={canvasRef} className="timeline-notes-canvas" aria-hidden="true" />;
});

TimelineNotesCanvas.displayName = 'TimelineNotesCanvas';

interface TimelineBarBlocksProps {
    barStates: BarState[];
    barPositions: BarPosition[];
    instrumentColor: string;
}

const TimelineBarBlocks = memo(({ barStates, barPositions, instrumentColor }: TimelineBarBlocksProps) => {
    if (barPositions.length === 0) return null;

    return (
        <>
            {barStates.map((bar, i) => {
                const position = barPositions[i];
                if (!position) return null;
                return (
                    <div
                        key={bar.index}
                        className={`timeline-block ${bar.hasNotes ? '' : 'empty'}`}
                        style={{
                            left: `${position.leftPct}%`,
                            width: `${position.widthPct}%`,
                            '--timeline-track-color': instrumentColor
                        } as React.CSSProperties}
                    />
                );
            })}
        </>
    );
});

TimelineBarBlocks.displayName = 'TimelineBarBlocks';

interface TimelineBarGridProps {
    minorPath: string;
    majorPath: string;
    variant?: 'ruler' | 'track';
}

const TimelineBarGrid = memo(({ minorPath, majorPath, variant = 'track' }: TimelineBarGridProps) => {
    if (!minorPath && !majorPath) return null;

    return (
        <svg
            className={`timeline-grid-svg timeline-grid-svg-${variant}`}
            viewBox="0 0 10000 100"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            {minorPath && (
                <path
                    className="timeline-grid-minor"
                    d={minorPath}
                    vectorEffect="non-scaling-stroke"
                />
            )}
            {majorPath && (
                <path
                    className="timeline-grid-major"
                    d={majorPath}
                    vectorEffect="non-scaling-stroke"
                />
            )}
        </svg>
    );
});

TimelineBarGrid.displayName = 'TimelineBarGrid';

const TimelineView = memo(forwardRef<TimelineViewRef, TimelineViewProps>(({
    score, scoreEditRevision, trackNameRevision, orderedTrackIndices, activeTracks, onToggleTrack,
    draggedTrackIndex, trackDropIndex, onTrackDragStart, onTrackDragOver, onTrackDrop, onTrackDragEnd,
    initialTick = 0, onSeek, timelineMode, onTimelineModeChange,
    snapToBarStart, onSnapToBarStartChange, selectionMode, onSelectionModeChange,
    trackSettings, onTrackSettingsChange, onRenameTrack, onRequestDeleteTrack
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const tracksRef = useRef<HTMLDivElement>(null);
    const visualRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const barNumberRef = useRef<HTMLSpanElement>(null);
    const timeSigRef = useRef<HTMLSpanElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const currentTickRef = useRef(initialTick);
    const lastDisplayedBarIndexRef = useRef(-1);

    const [height, setHeight] = useState(() => getInitialTimelineHeight(score));
    const [trackInfoWidth, setTrackInfoWidth] = useState(MIN_TIMELINE_LABEL_WIDTH);
    const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null);
    const [draftTrackName, setDraftTrackName] = useState('');
    const activeResizeModeRef = useRef<'none' | 'height' | 'column'>('none');
    const didCancelRename = useRef(false);

    const stopResize = useCallback(() => {
        if (activeResizeModeRef.current === 'none') return;
        activeResizeModeRef.current = 'none';
        document.body.style.cursor = '';
    }, []);

    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (activeResizeModeRef.current === 'height') {
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 100 && newHeight < window.innerHeight * 0.7) {
                setHeight(newHeight);
            }
        } else if (activeResizeModeRef.current === 'column' && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const requestedWidth = e.clientX - rect.left;
            const maxWidth = Math.max(MIN_TIMELINE_LABEL_WIDTH, rect.width - 360);
            setTrackInfoWidth(Math.min(maxWidth, Math.max(MIN_TIMELINE_LABEL_WIDTH, requestedWidth)));
        }
    }, []);

    const startResize = useCallback((mode: 'height' | 'column') => {
        activeResizeModeRef.current = mode;
        document.body.style.cursor = mode === 'height' ? 'ns-resize' : 'ew-resize';

        const onMouseUp = () => {
            stopResize();
            window.removeEventListener('mousemove', handleResizeMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', handleResizeMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [handleResizeMouseMove, stopResize]);

    useEffect(() => {
        return () => {
            stopResize();
            window.removeEventListener('mousemove', handleResizeMouseMove);
        };
    }, [handleResizeMouseMove, stopResize]);

    useEffect(() => {
        if (editingTrackIndex === null) return;
        const input = renameInputRef.current;
        if (!input) return;

        const frameId = requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
        return () => cancelAnimationFrame(frameId);
    }, [editingTrackIndex]);

    const orderedTracks = useMemo(() => {
        return getTracksInOrder(score, orderedTrackIndices);
    }, [score, orderedTrackIndices]);

    const timelineData = useMemo(() => {
        void scoreEditRevision;
        if (!score) {
            return {
                totalBars: 0,
                totalTicks: 0,
                barStartTicks: [],
                barSnapTicks: [],
                barPositions: [],
                timelineTracks: [] as TimelineTrackData[]
            } satisfies TimelineData;
        }

        const totalBars = score.masterBars.length;
        const { barStartTicks, totalTicks } = computeBarTiming(score);
        const firstNoteTicks = Array.from({ length: totalBars }, () => Number.POSITIVE_INFINITY);

        const timelineTracks = orderedTracks.map(track => {
            const barStates: BarState[] = new Array(totalBars);
            const rawNoteEvents: Array<{ start: number; duration: number; pitch: number }> = [];
            let minPitch = Number.POSITIVE_INFINITY;
            let maxPitch = Number.NEGATIVE_INFINITY;

            for (let i = 0; i < totalBars; i++) {
                let hasNotes = false;
                for (let s = 0; s < track.staves.length; s++) {
                    const bar = track.staves[s].bars[i];
                    if (!bar) continue;

                    for (let v = 0; v < bar.voices.length; v++) {
                        const voice = bar.voices[v];
                        for (let b = 0; b < voice.beats.length; b++) {
                            const beat = voice.beats[b];
                            if (beat.notes.length === 0) continue;

                            hasNotes = true;
                            const start = Math.max(0, getBeatPlaybackTick(beat, barStartTicks));
                            const duration = Math.max(30, beat.playbackDuration || 60);
                            if (start < firstNoteTicks[i]) {
                                firstNoteTicks[i] = start;
                            }

                            for (let n = 0; n < beat.notes.length; n++) {
                                const note = beat.notes[n];
                                const pitch = note.isPercussion
                                    ? note.percussionArticulation || note.element || note.string || 36
                                    : note.realValue || (note.octave * 12) + note.tone;

                                if (pitch < minPitch) minPitch = pitch;
                                if (pitch > maxPitch) maxPitch = pitch;
                                rawNoteEvents.push({ start, duration, pitch });
                            }
                        }
                    }
                }
                barStates[i] = { hasNotes, index: i };
            }

            const pitchRange = Number.isFinite(minPitch) && Number.isFinite(maxPitch)
                ? Math.max(1, maxPitch - minPitch)
                : 1;
            const safeMinPitch = Number.isFinite(minPitch) ? minPitch : 0;

            const noteEvents: MidiNoteEvent[] = rawNoteEvents.map(note => ({
                start: note.start,
                duration: note.duration,
                lane: 82 - ((note.pitch - safeMinPitch) / pitchRange) * 64
            }));

            return { track, barStates, noteEvents };
        });

        const barSnapTicks = firstNoteTicks.map((tick, index) => (
            Number.isFinite(tick) ? tick : barStartTicks[index] || 0
        ));

        const barPositions: BarPosition[] = Array.from({ length: totalBars }, (_, index) => {
            if (totalTicks > 0) {
                const startTick = barStartTicks[index] ?? 0;
                const endTick = index + 1 < totalBars ? (barStartTicks[index + 1] ?? totalTicks) : totalTicks;
                return {
                    leftPct: (startTick / totalTicks) * 100,
                    widthPct: (Math.max(0, endTick - startTick) / totalTicks) * 100
                };
            }
            return {
                leftPct: totalBars > 0 ? (index / totalBars) * 100 : 0,
                widthPct: totalBars > 0 ? (1 / totalBars) * 100 : 0
            };
        });

        return { totalBars, totalTicks, barStartTicks, barSnapTicks, barPositions, timelineTracks };
    }, [score, orderedTracks, scoreEditRevision]);

    const applyTickToDom = useCallback((tick: number) => {
        currentTickRef.current = tick;
        const { totalTicks, barStartTicks } = timelineData;

        if (playheadRef.current) {
            const pct = totalTicks > 0 ? Math.max(0, Math.min(100, (tick / totalTicks) * 100)) : 0;
            playheadRef.current.style.left = `${pct}%`;
        }

        if (!score || score.masterBars.length === 0) return;

        const barIndex = findBarIndexAtTick(barStartTicks, tick);
        if (barIndex !== lastDisplayedBarIndexRef.current) {
            lastDisplayedBarIndexRef.current = barIndex;
            if (barNumberRef.current) {
                barNumberRef.current.textContent = `Bar ${barIndex + 1}`;
            }
            const masterBar = score.masterBars[barIndex];
            if (timeSigRef.current && masterBar) {
                timeSigRef.current.textContent = `${masterBar.timeSignatureNumerator}/${masterBar.timeSignatureDenominator}`;
            }
        }
    }, [score, timelineData]);

    useImperativeHandle(ref, () => ({
        updateTick: applyTickToDom
    }), [applyTickToDom]);

    useLayoutEffect(() => {
        lastDisplayedBarIndexRef.current = -1;
        applyTickToDom(currentTickRef.current);
    }, [applyTickToDom]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const tracksEl = tracksRef.current;
        if (!container) return;

        const syncScrollbarWidth = () => {
            const nextWidth = tracksEl ? Math.max(0, tracksEl.offsetWidth - tracksEl.clientWidth) : 0;
            container.style.setProperty('--timeline-scrollbar-width', `${nextWidth}px`);
        };

        syncScrollbarWidth();
        if (!tracksEl) return;

        const observer = new ResizeObserver(syncScrollbarWidth);
        observer.observe(tracksEl);
        return () => observer.disconnect();
    }, [score, timelineData.timelineTracks.length, height]);

    const rulerMarks = useMemo(() => {
        const { totalBars } = timelineData;
        if (totalBars <= 0) return [];
        const rulerStep = totalBars > 48 ? 8 : totalBars > 24 ? 4 : 2;
        const marks: number[] = [];
        for (let mark = rulerStep; mark < totalBars; mark += rulerStep) {
            marks.push(mark);
        }
        if (marks[marks.length - 1] !== totalBars) {
            marks.push(totalBars);
        }
        return marks;
    }, [timelineData]);

    const gridPaths = useMemo(() => {
        const { totalBars, barPositions } = timelineData;
        if (totalBars <= 1 || barPositions.length === 0) {
            return { trackMinorPath: '', rulerMinorPath: '', majorPath: '' };
        }

        const majorBarIndices = new Set(rulerMarks.map(mark => mark - 1));
        const minorStep = totalBars > 256 ? 4 : totalBars > 128 ? 2 : 1;
        const trackMinorSegments: string[] = [];
        const rulerMinorSegments: string[] = [];
        const majorSegments: string[] = [];

        for (let i = 1; i < totalBars; i++) {
            const x = Number((barPositions[i].leftPct * 100).toFixed(2));
            if (majorBarIndices.has(i)) {
                majorSegments.push(`M${x} 0V100`);
            } else if (i % minorStep === 0) {
                trackMinorSegments.push(`M${x} 0V100`);
                rulerMinorSegments.push(`M${x} 70V100`);
            }
        }

        return {
            trackMinorPath: trackMinorSegments.join(''),
            rulerMinorPath: rulerMinorSegments.join(''),
            majorPath: majorSegments.join('')
        };
    }, [timelineData, rulerMarks]);

    // Reference trackNameRevision so renamed track labels re-render cleanly
    void trackNameRevision;

    if (!score) return (
        <div className="timeline-container" style={{ height: `${height}px` }}>
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
            </div>
            <div className="timeline-empty-state">Load a file to see the timeline</div>
        </div>
    );

    const { totalBars, totalTicks, barStartTicks, barSnapTicks, barPositions, timelineTracks } = timelineData;
    const firstMasterBar = score.masterBars[0];
    const initialTimeSignature = firstMasterBar
        ? `${firstMasterBar.timeSignatureNumerator}/${firstMasterBar.timeSignatureDenominator}`
        : '-';

    const handleTimelineClick = (e: React.MouseEvent, trackIndex: number) => {
        if (!visualRef.current || totalTicks <= 0) return;
        const rect = visualRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const clickedTick = Math.floor(percentage * totalTicks);

        if (!snapToBarStart) {
            onSeek(clickedTick, trackIndex);
            return;
        }

        const clickedBarIndex = findBarIndexAtTick(barStartTicks, clickedTick);
        onSeek(Math.floor(barSnapTicks[clickedBarIndex] ?? clickedTick), trackIndex);
    };

    const startRenamingTrack = (track: alphaTab.model.Track) => {
        didCancelRename.current = false;
        setEditingTrackIndex(track.index);
        setDraftTrackName(track.name);
    };

    const commitRenamingTrack = (trackIndex: number) => {
        if (didCancelRename.current) {
            didCancelRename.current = false;
            return;
        }

        onRenameTrack(trackIndex, draftTrackName);
        setEditingTrackIndex(null);
    };

    const cancelRenamingTrack = () => {
        didCancelRename.current = true;
        setEditingTrackIndex(null);
        setDraftTrackName('');
    };

    return (
        <div
            className="timeline-container"
            ref={containerRef}
            style={{
                height: `${height}px`,
                '--timeline-label-width': `${trackInfoWidth}px`
            } as React.CSSProperties}
        >
            <div
                className="timeline-resizer"
                onMouseDown={(event) => {
                    event.preventDefault();
                    startResize('height');
                }}
            />
            <div
                className="timeline-column-resizer"
                onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startResize('column');
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
                    <div className="timeline-tool-group">
                        <span className="timeline-tool-label">Playhead behavior:</span>
                        <button
                            className={snapToBarStart ? 'active' : ''}
                            type="button"
                            onClick={() => onSnapToBarStartChange(!snapToBarStart)}
                        >
                            Snap to bar start
                        </button>
                    </div>
                    <div className="timeline-tool-group">
                        <span className="timeline-tool-label">Track selection:</span>
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
                </div>
                <div className="timeline-meta">
                    <span ref={barNumberRef}>Bar 1</span>
                    <span>{totalBars} bars</span>
                    <span ref={timeSigRef}>{initialTimeSignature}</span>
                </div>
            </div>
            <div className="timeline-ruler">
                <div className="timeline-ruler-spacer" />
                <div className="timeline-ruler-grid">
                    <TimelineBarGrid
                        minorPath={gridPaths.rulerMinorPath}
                        majorPath={gridPaths.majorPath}
                        variant="ruler"
                    />
                    {rulerMarks.map(mark => {
                        const leftPct = barPositions[mark - 1]?.leftPct ?? ((mark - 1) / totalBars) * 100;
                        return (
                            <span key={mark} style={{ left: `${leftPct}%` }}>
                                {mark}
                            </span>
                        );
                    })}
                </div>
            </div>
            <div
                ref={tracksRef}
                className="timeline-tracks"
                style={{ '--timeline-track-count': timelineTracks.length } as React.CSSProperties}
            >
                <div className="timeline-playhead-layer">
                    <div
                        ref={playheadRef}
                        className="timeline-playhead"
                        style={{ left: '0%' }}
                    />
                </div>
                {timelineTracks.map(({ track, barStates, noteEvents }, trackPosition) => {
                    const settings = trackSettings[track.index] || DEFAULT_TRACK_SETTINGS;
                    const instrumentCategory = getInstrumentCategory(track);
                    const instrumentColor = INSTRUMENT_COLORS[instrumentCategory];
                    return (
                        <div
                            key={track.index}
                            className={[
                                'timeline-track-row',
                                track.index === draggedTrackIndex ? 'dragging' : '',
                                track.index === trackDropIndex && track.index !== draggedTrackIndex ? 'drop-target' : ''
                            ].filter(Boolean).join(' ')}
                            draggable={editingTrackIndex !== track.index}
                            onDragStart={(event) => onTrackDragStart(event, track.index)}
                            onDragOver={(event) => onTrackDragOver(event, track.index)}
                            onDrop={(event) => onTrackDrop(event, track.index)}
                            onDragEnd={onTrackDragEnd}
                        >
                            <div className={`timeline-track-info ${activeTracks.includes(track.index) ? 'active' : ''}`}>
                                <InstrumentIcon track={track} revision={trackNameRevision} className="timeline-track-icon" />
                                {editingTrackIndex === track.index ? (
                                    <input
                                        ref={renameInputRef}
                                        className="timeline-track-name-input"
                                        value={draftTrackName}
                                        onChange={(event) => setDraftTrackName(event.target.value)}
                                        onBlur={() => commitRenamingTrack(track.index)}
                                        onClick={(event) => event.stopPropagation()}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                commitRenamingTrack(track.index);
                                            }
                                            if (event.key === 'Escape') {
                                                event.preventDefault();
                                                cancelRenamingTrack();
                                            }
                                        }}
                                        aria-label={`Rename ${track.name}`}
                                    />
                                ) : (
                                    <div className="track-name" onClick={() => onToggleTrack(track.index)}>
                                        <strong>{trackPosition + 1}. {track.name}</strong>
                                    </div>
                                )}
                                <button
                                    className="timeline-rename-button"
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        startRenamingTrack(track);
                                    }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    aria-label={`Rename ${track.name}`}
                                    title={`Rename ${track.name}`}
                                >
                                    <RenameIcon />
                                </button>
                                <div className="track-controls">
                                    <button
                                        className={`control-btn solo ${settings.solo ? 'active' : ''}`}
                                        type="button"
                                        onClick={() => onTrackSettingsChange(track.index, { solo: !settings.solo })}
                                    >
                                        S
                                    </button>
                                    <button
                                        className={`control-btn mute ${settings.mute ? 'active' : ''}`}
                                        type="button"
                                        onClick={() => onTrackSettingsChange(track.index, { mute: !settings.mute })}
                                    >
                                        M
                                    </button>
                                    <button
                                        className="control-btn delete-track"
                                        type="button"
                                        disabled={timelineTracks.length <= 1}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onRequestDeleteTrack(track.index);
                                        }}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        aria-label={`Delete ${track.name}`}
                                        title={timelineTracks.length <= 1 ? 'Cannot delete the only track' : `Delete ${track.name}`}
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                            <div
                                className={`timeline-visual ${timelineMode === 'timeline' ? 'timeline-visual-notes' : ''}`}
                                ref={trackPosition === 0 ? visualRef : null}
                                onClick={(event) => handleTimelineClick(event, track.index)}
                            >
                                <TimelineBarGrid
                                    minorPath={gridPaths.trackMinorPath}
                                    majorPath={gridPaths.majorPath}
                                    variant="track"
                                />
                                {timelineMode === 'bars' ? (
                                    <TimelineBarBlocks
                                        barStates={barStates}
                                        barPositions={barPositions}
                                        instrumentColor={instrumentColor}
                                    />
                                ) : (
                                    <TimelineNotesCanvas
                                        noteEvents={noteEvents}
                                        totalTicks={totalTicks}
                                        color={instrumentColor}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}));

TimelineView.displayName = 'TimelineView';

export default TimelineView;
