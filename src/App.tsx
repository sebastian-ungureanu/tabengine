import { useState, useRef, useEffect } from 'react';
import * as alphaTab from '@coderline/alphatab';
import AlphaTabEditor, { type AlphaTabEditorRef } from './components/AlphaTabEditor';
import InstrumentIcon from './components/InstrumentIcon';
import TimelineView, { type TrackSettings } from './components/TimelineView';
import { getInstrumentCategory } from './utils/instruments';
import './App.css';

type IconName = 'skip-back' | 'rewind' | 'play' | 'pause' | 'fast-forward' | 'stop' | 'minus' | 'plus' | 'metronome' | 'reset';

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
  }
};

function App() {
  const editorRef = useRef<AlphaTabEditorRef>(null);
  const [score, setScore] = useState<alphaTab.model.Score | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<'tabs' | 'chords' | 'lyrics'>('tabs');

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
  const [playbackTime, setPlaybackTime] = useState({ currentTime: 0, endTime: 0, tempo: 0 });
  const [tempoBpm, setTempoBpm] = useState(100);
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single');
  const [trackSettings, setTrackSettings] = useState<Record<number, TrackSettings>>({});
  const [showStandardNotation, setShowStandardNotation] = useState(true);
  const [showTablature, setShowTablature] = useState(true);

  const selectedTrack = score?.tracks.find(track => activeTracks.includes(track.index)) ?? score?.tracks[0] ?? null;
  const selectedTrackSettings = selectedTrack
    ? trackSettings[selectedTrack.index] || { volume: 8, pan: 0, mute: false, solo: false }
    : { volume: 8, pan: 0, mute: false, solo: false };
  const songTitle = score?.title || 'Untitled Song';
  const songArtist = score?.artist || 'Unknown Artist';
  const tempo = tempoBpm || playbackTime.tempo || score?.tempo || 100;

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
    loadedScore.tracks.forEach(track => {
      track.staves.forEach(staff => {
        staff.showStandardNotation = showStandardNotation;
        staff.showTablature = showTablature;
      });
    });
    setScore(loadedScore);
    setCurrentTick(0);
    setTempoBpm(loadedScore.tempo || 100);
    setPlaybackTime({ currentTime: 0, endTime: 0, tempo: loadedScore.tempo });
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
      setPlaybackTime({
        currentTime: args.currentTime,
        endTime: args.endTime,
        tempo: Math.round(args.modifiedTempo || args.originalTempo || tempo)
      });
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

  const updateTempo = (bpm: number) => {
      const nextTempo = Math.max(30, Math.min(240, Math.round(bpm)));
      setTempoBpm(nextTempo);
      if (score) {
          editorRef.current?.setPlaybackSpeed(nextTempo / (score.tempo || 100));
      }
  };

  const resetTempo = () => {
      if (!score) return;
      updateTempo(score.tempo || 100);
  };

  const applyNotationVisibility = (nextShowStandardNotation: boolean, nextShowTablature: boolean) => {
      if (!nextShowStandardNotation && !nextShowTablature) return;

      setShowStandardNotation(nextShowStandardNotation);
      setShowTablature(nextShowTablature);

      if (score) {
          const tracksToRender = score.tracks.filter(t => activeTracks.includes(t.index));
          editorRef.current?.setNotationVisibility(
              nextShowStandardNotation,
              nextShowTablature,
              tracksToRender.length ? tracksToRender : score.tracks
          );
      }
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
          <button className="icon-button menu-button" type="button" aria-label="Open menu">
            <span />
            <span />
            <span />
          </button>

          <div className="transport-cluster">
            <button className="icon-button transport-button" type="button" disabled={!score} aria-label="Previous">
              <Icon name="skip-back" />
            </button>
            <button className="icon-button transport-button" type="button" disabled={!score} aria-label="Rewind">
              <Icon name="rewind" />
            </button>
            <button className="play-button" type="button" onClick={() => editorRef.current?.playPause()} disabled={!score} aria-label={isPlaying ? 'Pause' : 'Play'}>
              <Icon name={isPlaying ? 'pause' : 'play'} />
            </button>
            <button className="icon-button transport-button" type="button" disabled={!score} aria-label="Forward">
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

          <div className="song-title-block">
            <strong>{songTitle}</strong>
            <span>{songArtist}</span>
          </div>

          <div className="song-stats">
            <div className="tempo-control" aria-label="Tempo control">
              <span className="tempo-label">
                <Icon name="metronome" />
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
              Load .gp
              <input type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" onChange={handleFileChange} />
            </label>
          </div>
        </header>

        <div className="workspace-layout">
          <aside className="left-panel">
            <div className="panel-tabs">
              <button className={leftPanelTab === 'tabs' ? 'active' : ''} type="button" onClick={() => setLeftPanelTab('tabs')}>Tabs</button>
              <button className={leftPanelTab === 'chords' ? 'active' : ''} type="button" onClick={() => setLeftPanelTab('chords')}>Chords</button>
              <button className={leftPanelTab === 'lyrics' ? 'active' : ''} type="button" onClick={() => setLeftPanelTab('lyrics')}>Lyrics</button>
            </div>

            {leftPanelTab === 'tabs' && (
              <>
                <section className="panel-section tracks-section">
                  <div className="section-title-row">
                    <h2>Tracks</h2>
                    <button className="icon-button" type="button" aria-label="Add track">+</button>
                  </div>
                  <div className="side-track-list">
                    {score ? score.tracks.map(track => {
                      const settings = trackSettings[track.index] || { volume: 8, pan: 0, mute: false, solo: false };
                      const active = activeTracks.includes(track.index);
                      return (
                        <div key={track.index} className={`side-track ${active ? 'active' : ''}`}>
                          <button className="track-main" type="button" onClick={() => toggleTrack(track.index)}>
                            <InstrumentIcon track={track} className="track-badge" />
                            <span>
                              <strong>{track.index + 1}. {track.name}</strong>
                              <small>{getInstrumentCategory(track)}</small>
                            </span>
                          </button>
                          <button className={`mini-toggle ${settings.solo ? 'active' : ''}`} type="button" onClick={() => handleTrackSettingsChange(track.index, { solo: !settings.solo })}>S</button>
                          <button className={`mini-toggle ${settings.mute ? 'active' : ''}`} type="button" onClick={() => handleTrackSettingsChange(track.index, { mute: !settings.mute })}>M</button>
                          <input
                            type="range"
                            min="0"
                            max="15"
                            step="1"
                            value={settings.volume}
                            onChange={(e) => handleTrackSettingsChange(track.index, { volume: parseInt(e.target.value) })}
                            aria-label={`${track.name} volume`}
                          />
                        </div>
                      );
                    }) : (
                      <div className="empty-panel-state">Load a Guitar Pro file to populate tracks.</div>
                    )}
                  </div>
                  <button className="add-track-button" type="button">+ Add Track</button>
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
              <section className="coming-soon-panel">
                <div className="coming-soon-graphic chord-graphic" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <strong>Cmaj7</strong>
                </div>
                <h2>Chords coming soon</h2>
                <p>Chord diagrams and progression tools will live here.</p>
              </section>
            )}

            {leftPanelTab === 'lyrics' && (
              <section className="coming-soon-panel">
                <div className="coming-soon-graphic lyrics-graphic" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <strong>La</strong>
                </div>
                <h2>Lyrics coming soon</h2>
                <p>Synced lyrics and verse editing will appear in this space.</p>
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
              <button className="active" type="button">Song</button>
              <button type="button">Track</button>
            </div>

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
              <div className="section-title-row">
                <h2>Tuning</h2>
                <button className="icon-button" type="button">x</button>
              </div>
              <div className="tuning-row">E A D G B E</div>
              <select value="standard" onChange={() => undefined}>
                <option value="standard">Standard</option>
              </select>
            </section>

            <section className="panel-section compact-section">
              <h2>Sounds</h2>
              <select value="clean" onChange={() => undefined}>
                <option value="clean">1. Clean</option>
              </select>
              <button className="text-link" type="button">+ Add Sound</button>
            </section>

            <section className="panel-section compact-section">
              <h2>Interpretation</h2>
              <label className="field-row">
                <span>Playing style</span>
                <select value="pick" onChange={() => undefined}>
                  <option value="pick">Pick</option>
                </select>
              </label>
              <label className="field-row">
                <span>Palm mute</span>
                <input type="range" min="0" max="100" value="30" onChange={() => undefined} />
              </label>
              <label className="field-row">
                <span>Auto let ring</span>
                <input type="checkbox" defaultChecked />
              </label>
            </section>

            {selectedNote && (
              <section className="panel-section compact-section">
                <div className="section-title-row">
                  <h2>Edit Note</h2>
                  <button className="icon-button" type="button" onClick={() => setSelectedNote(null)}>x</button>
                </div>
                <label className="field-row">
                  <span>Fret</span>
                  <input
                    type="number"
                    value={selectedNote.fret}
                    onChange={(e) => updateFret(parseInt(e.target.value) || 0)}
                  />
                </label>
                <div className="button-row">
                  <button type="button" onClick={() => updateFret(Math.max(0, selectedNote.fret - 1))}>- Fret</button>
                  <button type="button" onClick={() => updateFret(selectedNote.fret + 1)}>+ Fret</button>
                </div>
              </section>
            )}

            <section className="panel-section compact-section">
              <h2>Technique</h2>
              <div className="technique-grid">
                {['Vib', 'Bend', 'Slide', 'Harm', 'Tap', 'Grace', 'Mute', 'Tie'].map(item => (
                  <button type="button" key={item}>{item}</button>
                ))}
              </div>
            </section>

            <section className="panel-section compact-section notation-section">
              <h2>Notation</h2>
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
              </div>
            </section>
          </aside>
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
