import React, { useRef } from 'react';
import * as alphaTab from '@coderline/alphatab';

interface BarState {
    hasNotes: boolean;
    index: number;
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
    selectionMode: 'single' | 'multi';
    onSelectionModeChange: (mode: 'single' | 'multi') => void;
    trackSettings: Record<number, TrackSettings>;
    onTrackSettingsChange: (trackIndex: number, settings: Partial<TrackSettings>) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ 
    score, activeTracks, onToggleTrack, currentTick, onSeek, selectionMode, onSelectionModeChange,
    trackSettings, onTrackSettingsChange
}) => {
    const visualRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = React.useState(200);
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

    if (!score) return (
        <div className="timeline-container" style={{ height: `${height}px` }}>
            <div className="timeline-header">Timeline</div>
            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>Load a file to see the timeline</div>
        </div>
    );

    // Calculate bar states for each track
    const totalBars = score.masterBars.length;
    const timelineTracks = score.tracks.map(track => {
        const barStates: BarState[] = [];
        
        // Flatten bars across staves or just take the first staff's bars
        const bars = track.staves[0].bars; 
        
        for (let i = 0; i < totalBars; i++) {
            const bar = bars[i];
            let hasNotes = false;
            if (bar) {
                bar.voices.forEach((voice: alphaTab.model.Voice) => {
                    if (voice.beats.some((beat: alphaTab.model.Beat) => beat.notes.length > 0)) {
                        hasNotes = true;
                    }
                });
            }
            barStates.push({ hasNotes, index: i });
        }
        return { track, barStates };
    });

    const totalTicks = score.masterBars.reduce((acc, mb) => acc + mb.calculateDuration(), 0);
    
    const playheadPosition = (currentTick / totalTicks) * 100;

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (!visualRef.current) return;
        const rect = visualRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        onSeek(Math.floor(percentage * totalTicks));
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span>Multi-Track Timeline</span>
                    <div className="selection-mode-toggle" style={{ display: 'flex', gap: '2px' }}>
                        <button 
                            style={{ 
                                padding: '2px 8px', 
                                fontSize: '10px', 
                                borderRadius: '4px 0 0 4px',
                                backgroundColor: selectionMode === 'single' ? 'var(--accent-color)' : '#444'
                            }} 
                            onClick={() => onSelectionModeChange('single')}
                        >
                            Single Select
                        </button>
                        <button 
                            style={{ 
                                padding: '2px 8px', 
                                fontSize: '10px', 
                                borderRadius: '0 4px 4px 0',
                                backgroundColor: selectionMode === 'multi' ? 'var(--accent-color)' : '#444'
                            }} 
                            onClick={() => onSelectionModeChange('multi')}
                        >
                            Multi Select
                        </button>
                    </div>
                </div>
                <span>{totalBars} Bars</span>
            </div>
            <div className="timeline-tracks">
                {timelineTracks.map(({ track, barStates }) => {
                    const settings = trackSettings[track.index] || { volume: 8, pan: 0, mute: false, solo: false };
                    return (
                        <div key={track.index} className="timeline-track-row">
                            <div className={`timeline-track-info ${activeTracks.includes(track.index) ? 'active' : ''}`}>
                                <div className="track-name" onClick={() => onToggleTrack(track.index)}>
                                    {track.name}
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
                            <div className="timeline-visual" ref={track.index === 0 ? visualRef : null} onClick={handleTimelineClick}>
                                {track.index === 0 && (
                                    <div 
                                        className="timeline-playhead" 
                                        style={{ left: `${playheadPosition}%` }}
                                    />
                                )}
                                {barStates.map((bar, i) => (
                                    <div 
                                        key={i}
                                        className={`timeline-block ${bar.hasNotes ? '' : 'empty'}`}
                                        style={{
                                            left: `${(i / totalBars) * 100}%`,
                                            width: `${(1 / totalBars) * 100}%`
                                        }}
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
