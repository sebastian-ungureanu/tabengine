import { useState, useRef, useEffect } from 'react';
import * as alphaTab from '@coderline/alphatab';
import AlphaTabEditor, { type AlphaTabEditorRef } from './components/AlphaTabEditor';
import TimelineView, { type TrackSettings } from './components/TimelineView';
import './App.css';

function App() {
  const editorRef = useRef<AlphaTabEditorRef>(null);
  const [score, setScore] = useState<alphaTab.model.Score | null>(null);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            const target = e.target as HTMLElement;
            // Ignore if typing in an input or textarea
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                editorRef.current?.playPause();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [activeTracks, setActiveTracks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedNote, setSelectedNote] = useState<alphaTab.model.Note | null>(null);
  const [currentTick, setCurrentTick] = useState(0);
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('multi');
  const [trackSettings, setTrackSettings] = useState<Record<number, TrackSettings>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        if (data && editorRef.current) {
          editorRef.current.loadScore(data);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const onScoreLoaded = (loadedScore: alphaTab.model.Score) => {
    setScore(loadedScore);
    // By default, select the first track
    if (loadedScore.tracks.length > 0) {
      setActiveTracks([loadedScore.tracks[0].index]);
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

  const onBeatClick = (beat: alphaTab.model.Beat) => {
    if (beat.notes.length > 0) {
      setSelectedNote(beat.notes[0]);
    } else {
      setSelectedNote(null);
    }
    // Seek to the beat when clicked in the notation view
    if (editorRef.current) {
        editorRef.current.seekToTick(beat.playbackStart);
    }
  };

  const onPositionChanged = (args: alphaTab.synth.PositionChangedEventArgs) => {
      setCurrentTick(args.currentTick);
  };

  const onSeek = (tick: number) => {
      if (editorRef.current) {
          editorRef.current.seekToTick(tick);
      }
      setCurrentTick(tick);
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
        newTracks = [score.tracks[0].index];
    }

    setActiveTracks(newTracks);
    if (editorRef.current && score) {
        const tracksToRender = score.tracks.filter(t => newTracks.includes(t.index));
        editorRef.current.renderTracks(tracksToRender);
    }
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    editorRef.current?.setZoom(newZoom);
  };

  const updateFret = (fret: number) => {
      if(selectedNote && editorRef.current?.api) {
          selectedNote.fret = fret;
          editorRef.current.api.render();
      }
  }

  const loadDemo = () => {
    if (editorRef.current) {
      editorRef.current.loadScore('https://www.alphatab.net/files/canon.gp');
    }
  };

  return (
    <div className="app-container">
      <main className="main-content">
        <header className="toolbar">
          <div className="playback-controls">
            <button onClick={() => editorRef.current?.playPause()} disabled={!score}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => editorRef.current?.stop()} disabled={!score}>Stop</button>
          </div>

          <div style={{display: 'flex', gap: '5px'}}>
            <button onClick={loadDemo} style={{padding: '4px 8px', fontSize: '10px'}}>Demo</button>
            <label className="file-input-label">
              Load .gp
              <input type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" onChange={handleFileChange} />
            </label>
          </div>

          <div className="zoom-controls">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <input 
              type="range" 
              min="0.5" 
              max="3" 
              step="0.1" 
              value={zoom} 
              onChange={handleZoomChange} 
            />
          </div>
        </header>

        <div className="editor-layout">
            <div className="editor-container">
                <AlphaTabEditor 
                    ref={editorRef} 
                    onScoreLoaded={onScoreLoaded}
                    onPlaybackStatusChanged={setIsPlaying}
                    onBeatClick={onBeatClick}
                    onPositionChanged={onPositionChanged}
                />
            </div>

            {selectedNote && (
                <aside className="sidebar">
                    <div className="sidebar-header" style={{padding: '15px', borderBottom: '1px solid var(--border-color)'}}>
                        <span>Edit Note</span>
                        <button onClick={() => setSelectedNote(null)} style={{padding: '2px 8px', fontSize: '10px'}}>X</button>
                    </div>
                    <div className="edit-panel" style={{border: 'none'}}>
                        <div className="edit-group">
                            <label>Fret</label>
                            <input 
                                type="number" 
                                value={selectedNote.fret} 
                                onChange={(e) => updateFret(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="edit-group">
                            <button onClick={() => updateFret(selectedNote.fret + 1)}>+ Fret</button>
                            <button onClick={() => updateFret(Math.max(0, selectedNote.fret - 1))} style={{marginLeft: '5px'}}>- Fret</button>
                        </div>
                    </div>
                </aside>
            )}
        </div>

        <TimelineView 
            score={score}
            activeTracks={activeTracks}
            onToggleTrack={toggleTrack}
            currentTick={currentTick}
            onSeek={onSeek}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            trackSettings={trackSettings}
            onTrackSettingsChange={handleTrackSettingsChange}
        />
      </main>
    </div>
  );
}

export default App;
