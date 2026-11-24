import { useEffect, useLayoutEffect, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { assetPath } from '../utils/assetPaths';
import { computeBarTiming, getBeatPlaybackTick } from '../utils/scoreUtils';

export interface TabCellSelection {
  beat: alphaTab.model.Beat;
  string: number;
}

export interface TabCellClickEvent {
  beat: alphaTab.model.Beat;
  string: number | null;
  note: alphaTab.model.Note | null;
}

export interface AlphaTabEditorProps {
  selectedTabCell?: TabCellSelection | null;
  isMultiDigitPending?: boolean;
  onScoreLoaded?: (score: alphaTab.model.Score) => void;
  onPlaybackStatusChanged?: (isPlaying: boolean) => void;
  onBeatClick?: (beat: alphaTab.model.Beat) => void;
  onTabCellSelect?: (event: TabCellClickEvent) => void;
  onPositionChanged?: (args: alphaTab.synth.PositionChangedEventArgs) => void;
}

export interface DisplaySettingsOptions {
  showStandardNotation?: boolean;
  showTablature?: boolean;
  rhythmMode?: alphaTab.TabRhythmMode;
  tracks?: alphaTab.model.Track[];
  render?: boolean;
}

export interface AlphaTabEditorRef {
  loadScore: (data: unknown) => void;
  clearScore: () => void;
  playPause: () => void;
  stop: () => void;
  renderTracks: (tracks: alphaTab.model.Track[]) => void;
  applyDisplaySettings: (options: DisplaySettingsOptions) => void;
  setNotationVisibility: (showStandardNotation: boolean, showTablature: boolean, tracks?: alphaTab.model.Track[]) => void;
  setTabRhythmMode: (rhythmMode: alphaTab.TabRhythmMode, tracks?: alphaTab.model.Track[]) => void;
  setZoom: (zoom: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setMetronomeVolume: (volume: number) => void;
  setCountInVolume: (volume: number) => void;
  seekToTick: (tick: number, options?: { scrollToCursor?: boolean; waitForRender?: boolean }) => void;
  reloadMidi: (preserveTick?: boolean) => void;
  api: alphaTab.AlphaTabApi | null;
}

const isEditableStringedStaff = (staff: alphaTab.model.Staff | null | undefined) => {
  return Boolean(staff && staff.isStringed && !staff.isPercussion && staff.tuning.length > 0);
};

const getTabBarBoundsList = (masterBar: alphaTab.rendering.MasterBarBounds) => {
  const byBar = new Map<alphaTab.model.Bar, alphaTab.rendering.BarBounds[]>();
  for (const barBounds of masterBar.bars) {
    if (!barBounds.bar) continue;
    const list = byBar.get(barBounds.bar);
    if (list) {
      list.push(barBounds);
    } else {
      byBar.set(barBounds.bar, [barBounds]);
    }
  }

  const tabBars: alphaTab.rendering.BarBounds[] = [];
  for (const [bar, list] of byBar) {
    const staff = bar.staff;
    if (!isEditableStringedStaff(staff) || !staff.showTablature) continue;
    // MasterBarBounds sorts bars top-down by realBounds.y; when both standard notation
    // and tablature are rendered, tablature is the lower bar (largest realBounds.y).
    let tabBarBounds = list[0];
    for (let i = 1; i < list.length; i++) {
      if (list[i].realBounds.y > tabBarBounds.realBounds.y) {
        tabBarBounds = list[i];
      }
    }
    tabBars.push(tabBarBounds);
  }

  return tabBars;
};

const getTabBeatBounds = (
  boundsLookup: alphaTab.rendering.BoundsLookup | null | undefined,
  beat: alphaTab.model.Beat
): alphaTab.rendering.BeatBounds | null => {
  if (!boundsLookup) return null;
  const staff = beat.voice.bar.staff;
  if (!isEditableStringedStaff(staff) || !staff.showTablature) return null;

  const allBeatBounds = boundsLookup.findBeats(beat);
  if (!allBeatBounds || allBeatBounds.length === 0) return null;

  let best = allBeatBounds[0];
  for (let i = 1; i < allBeatBounds.length; i++) {
    if (allBeatBounds[i].barBounds.realBounds.y > best.barBounds.realBounds.y) {
      best = allBeatBounds[i];
    }
  }

  return best;
};

const resolvePointerToTabCell = (
  boundsLookup: alphaTab.rendering.BoundsLookup | null | undefined,
  relX: number,
  relY: number
): TabCellClickEvent | null => {
  if (!boundsLookup || boundsLookup.staffSystems.length === 0) return null;

  let system: alphaTab.rendering.StaffSystemBounds | null = null;
  for (const candidate of boundsLookup.staffSystems) {
    if (relY >= candidate.realBounds.y && relY <= candidate.realBounds.y + candidate.realBounds.h) {
      system = candidate;
      break;
    }
  }
  if (!system) return null;

  const masterBar = system.findBarAtPos(relX);
  if (!masterBar || masterBar.bars.length === 0) return null;
  if (relX < masterBar.realBounds.x || relX > masterBar.realBounds.x + masterBar.realBounds.w) {
    return null;
  }

  // 1. Prefer direct hit on a tablature staff so we resolve the exact string line.
  const tabBars = getTabBarBoundsList(masterBar);
  let bestTabHit: { barBounds: alphaTab.rendering.BarBounds; distance: number; step: number } | null = null;

  for (const barBounds of tabBars) {
    const stringCount = barBounds.bar.staff.tuning.length;
    const step = stringCount > 1 ? barBounds.realBounds.h / (stringCount - 1) : 14;
    const hitMargin = Math.max(8, step * 0.65);
    const top = barBounds.realBounds.y - hitMargin;
    const bottom = barBounds.realBounds.y + barBounds.realBounds.h + hitMargin;
    if (relY < top || relY > bottom) continue;

    const clampedY = Math.max(barBounds.realBounds.y, Math.min(barBounds.realBounds.y + barBounds.realBounds.h, relY));
    const distance = Math.abs(relY - clampedY);
    if (!bestTabHit || distance < bestTabHit.distance) {
      bestTabHit = { barBounds, distance, step };
    }
  }

  if (bestTabHit) {
    const { barBounds, step } = bestTabHit;
    const beatBounds = barBounds.findBeatAtPos(relX);
    if (beatBounds) {
      const staff = beatBounds.beat.voice.bar.staff;
      const stringCount = staff.tuning.length;
      const directNote = beatBounds.findNoteAtPos(relX, relY);
      if (directNote && directNote.string >= 1 && directNote.string <= stringCount) {
        return {
          beat: beatBounds.beat,
          string: directNote.string,
          note: directNote
        };
      }

      const lineIndex = stringCount > 1
        ? Math.max(0, Math.min(stringCount - 1, Math.round((relY - barBounds.realBounds.y) / step)))
        : 0;
      const clickedString = stringCount - lineIndex;
      const existingNote = beatBounds.beat.notes.find(n => n.string === clickedString) ?? null;
      return {
        beat: beatBounds.beat,
        string: clickedString,
        note: existingNote
      };
    }
  }

  // 2. Fallback: clicked standard notation or non-stringed/percussion bar.
  let closestBar: alphaTab.rendering.BarBounds | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const barBounds of masterBar.bars) {
    const top = barBounds.realBounds.y;
    const bottom = top + barBounds.realBounds.h;
    const distance = relY < top ? top - relY : relY > bottom ? relY - bottom : 0;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestBar = barBounds;
    }
  }

  const beatBounds = closestBar?.findBeatAtPos(relX) ?? null;
  if (!beatBounds) return null;

  const beat = beatBounds.beat;
  const staff = beat.voice.bar.staff;
  const editableStringed = isEditableStringedStaff(staff);
  const directNote = boundsLookup.getNoteAtPos(beat, relX, relY) ?? beatBounds.findNoteAtPos(relX, relY);

  if (directNote) {
    return {
      beat,
      string: editableStringed ? directNote.string : null,
      note: directNote
    };
  }

  const firstNote = beat.notes[0] ?? null;
  return {
    beat,
    string: editableStringed ? (firstNote ? firstNote.string : staff.tuning.length) : null,
    note: firstNote
  };
};

const AlphaTabEditor = memo(forwardRef<AlphaTabEditorRef, AlphaTabEditorProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabCursorRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const barStartTicksRef = useRef<number[]>([]);
  const pendingSeekScrollTickRef = useRef<number | null>(null);
  const pendingPostRenderScrollRef = useRef(false);
  const pendingRestoreTickRef = useRef<number | null>(null);
  const pendingResumePlaybackRef = useRef(false);
  const seekScrollTimerRef = useRef<number | null>(null);
  const suppressCursorScrollUntilRef = useRef(0);
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const updateTabCursorOverlay = useRef(() => {
    const cursorEl = tabCursorRef.current;
    const api = apiRef.current;
    const container = containerRef.current;
    const selection = propsRef.current.selectedTabCell;

    if (!cursorEl || !api || !container || !selection) {
      if (cursorEl) cursorEl.style.display = 'none';
      return;
    }

    const staff = selection.beat.voice.bar.staff;
    const isTrackRendered = api.tracks.some(track => track === staff.track);
    if (!isTrackRendered || !isEditableStringedStaff(staff) || !staff.showTablature) {
      cursorEl.style.display = 'none';
      return;
    }

    const tabBeatBounds = getTabBeatBounds(api.renderer.boundsLookup, selection.beat);
    if (!tabBeatBounds) {
      cursorEl.style.display = 'none';
      return;
    }

    const barBounds = tabBeatBounds.barBounds;
    const stringCount = staff.tuning.length;
    const scale = api.settings.display.scale || 1;
    const step = stringCount > 1 ? barBounds.realBounds.h / (stringCount - 1) : 14 * scale;
    const lineIndex = Math.max(0, Math.min(stringCount - 1, stringCount - selection.string));
    const centerY = barBounds.realBounds.y + lineIndex * step;

    const noteBounds = tabBeatBounds.notes?.find(nb => nb.note.string === selection.string) ?? null;
    const minW = Math.max(20, 22 * scale);
    const boxH = Math.max(15, Math.min(step * 0.96, 18 * scale));

    let centerX = tabBeatBounds.onNotesX;
    let boxW = minW;

    if (noteBounds && noteBounds.noteHeadBounds.w > 0) {
      centerX = noteBounds.noteHeadBounds.x + noteBounds.noteHeadBounds.w / 2;
      boxW = Math.max(minW, noteBounds.noteHeadBounds.w + 10 * scale);
    } else if (selection.beat.isEmpty && tabBeatBounds.onNotesX <= tabBeatBounds.realBounds.x + 2) {
      centerX = tabBeatBounds.realBounds.x + Math.min(26 * scale, tabBeatBounds.realBounds.w / 2);
    }

    const surface = container.querySelector('.at-surface') as HTMLElement | null;
    const outerRect = container.parentElement?.getBoundingClientRect();
    const surfaceRect = surface?.getBoundingClientRect();
    const offsetX = surfaceRect && outerRect ? surfaceRect.left - outerRect.left : 0;
    const offsetY = surfaceRect && outerRect ? surfaceRect.top - outerRect.top : 0;

    cursorEl.style.display = 'block';
    cursorEl.style.left = `${offsetX + centerX - boxW / 2}px`;
    cursorEl.style.top = `${offsetY + centerY - boxH / 2}px`;
    cursorEl.style.width = `${boxW}px`;
    cursorEl.style.height = `${boxH}px`;
  });

  useLayoutEffect(() => {
    updateTabCursorOverlay.current();
  }, [props.selectedTabCell, props.isMultiDigitPending]);

  useEffect(() => {
    const container = containerRef.current;
    const tabCursorEl = tabCursorRef.current;
    if (!container) return;

    let isDisposed = false;
    const scrollElement = container.closest('.editor-container') as HTMLElement | null;

    const api = new alphaTab.AlphaTabApi(container, {
      core: {
        fontDirectory: assetPath('alphatab/font/'),
        includeNoteBounds: true,
      },
      player: {
        playerMode: alphaTab.PlayerMode.EnabledAutomatic,
        enableCursor: true,
        enableAnimatedBeatCursor: false,
        enableElementHighlighting: true,
        scrollElement: scrollElement ?? undefined,
        scrollMode: alphaTab.ScrollMode.OffScreen,
        scrollOffsetY: -56,
        scrollSpeed: 180,
        nativeBrowserSmoothScroll: true,
        soundFont: assetPath('alphatab/soundfont/sonivox.sf2'),
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Page,
      },
      importer: {
        beatTextAsLyrics: true,
      }
    });

    api.customCursorHandler = {
      onAttach: () => undefined,
      onDetach: () => undefined,
      placeBarCursor: (barCursor, beatBounds) => {
        const barBounds = beatBounds.barBounds.masterBarBounds.visualBounds;
        barCursor.stopAnimation();
        barCursor.setBounds(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
      },
      placeBeatCursor: (beatCursor, beatBounds, startBeatX) => {
        const barBounds = beatBounds.barBounds.masterBarBounds.visualBounds;
        beatCursor.stopAnimation();
        beatCursor.transitionToX(0, startBeatX);
        beatCursor.setBounds(startBeatX, barBounds.y, 4, barBounds.h);
      },
      transitionBeatCursor: (beatCursor, beatBounds, startBeatX) => {
        const barBounds = beatBounds.barBounds.masterBarBounds.visualBounds;
        beatCursor.stopAnimation();
        beatCursor.transitionToX(0, startBeatX);
        beatCursor.setBounds(startBeatX, barBounds.y, 4, barBounds.h);
      }
    };

    const shouldIgnoreCursorScroll = (beatBounds: alphaTab.rendering.BeatBounds) => {
      if (pendingPostRenderScrollRef.current) return true;
      if (performance.now() < suppressCursorScrollUntilRef.current) return true;

      const pendingTick = pendingSeekScrollTickRef.current;
      if (pendingTick === null) return false;

      const beatTick = getBeatPlaybackTick(beatBounds.beat, barStartTicksRef.current);
      const beatEndTick = beatTick + Math.max(1, beatBounds.beat.playbackDuration || 1);
      return pendingTick < beatTick || pendingTick >= beatEndTick;
    };

    const scrollBeatIntoView = (beatBounds: alphaTab.rendering.BeatBounds, force = false) => {
      if (shouldIgnoreCursorScroll(beatBounds)) return;

      const scrollContainer = containerRef.current?.closest('.editor-container') as HTMLElement | null;
      const surfaceContainer = containerRef.current?.parentElement;
      if (!scrollContainer || !surfaceContainer) return;

      const barBounds = beatBounds.barBounds.masterBarBounds.realBounds;
      const verticalPadding = 56;
      const horizontalPadding = 32;
      const barTop = surfaceContainer.offsetTop + barBounds.y;
      const barBottom = barTop + barBounds.h;
      const visibleTop = scrollContainer.scrollTop;
      const visibleBottom = visibleTop + scrollContainer.clientHeight;
      const barLeft = surfaceContainer.offsetLeft + barBounds.x;
      const barRight = barLeft + barBounds.w;
      const visibleLeft = scrollContainer.scrollLeft;
      const visibleRight = visibleLeft + scrollContainer.clientWidth;

      const nextTop = force || barTop < visibleTop + verticalPadding || barBottom > visibleBottom - verticalPadding
        ? Math.max(0, barTop - verticalPadding)
        : scrollContainer.scrollTop;
      const nextLeft = force || barLeft < visibleLeft + horizontalPadding || barRight > visibleRight - horizontalPadding
        ? Math.max(0, barLeft - horizontalPadding)
        : scrollContainer.scrollLeft;

      if (nextTop !== scrollContainer.scrollTop || nextLeft !== scrollContainer.scrollLeft) {
        scrollContainer.scrollTo({
          top: nextTop,
          left: nextLeft,
          behavior: force ? 'auto' : 'smooth'
        });
      }

      pendingSeekScrollTickRef.current = null;
    };

    api.customScrollHandler = {
      forceScrollTo: (currentBeatBounds) => {
        scrollBeatIntoView(currentBeatBounds, true);
      },
      onBeatCursorUpdating: (startBeat) => {
        scrollBeatIntoView(startBeat);
      }
    };

    apiRef.current = api;

    api.scoreLoaded.on((score) => {
      if (isDisposed) return;
      barStartTicksRef.current = computeBarTiming(score).barStartTicks;
      propsRef.current.onScoreLoaded?.(score);
    });

    api.midiLoaded.on(() => {
      if (isDisposed) return;
      const restoreTick = pendingRestoreTickRef.current;
      const shouldResume = pendingResumePlaybackRef.current;
      if (restoreTick !== null) {
        pendingRestoreTickRef.current = null;
        suppressCursorScrollUntilRef.current = performance.now() + 250;
        api.tickPosition = restoreTick;
      }
      if (shouldResume) {
        pendingResumePlaybackRef.current = false;
        api.play();
      }
    });

    api.playerStateChanged.on((args) => {
      if (isDisposed) return;
      const playing = args.state === alphaTab.synth.PlayerState.Playing;
      propsRef.current.onPlaybackStatusChanged?.(playing);
    });

    const handleSurfaceMouseDown = (event: MouseEvent) => {
      if (isDisposed || event.button !== 0) return;
      const surface = container.querySelector('.at-surface') as HTMLElement | null;
      if (!surface) return;
      if (event.target instanceof Node && !surface.contains(event.target)) return;

      const surfaceRect = surface.getBoundingClientRect();
      const relX = event.clientX - surfaceRect.left;
      const relY = event.clientY - surfaceRect.top;
      const hit = resolvePointerToTabCell(api.renderer.boundsLookup, relX, relY);
      if (!hit) return;

      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }

      if (propsRef.current.onTabCellSelect) {
        propsRef.current.onTabCellSelect(hit);
      } else {
        propsRef.current.onBeatClick?.(hit.beat);
      }
    };

    container.addEventListener('mousedown', handleSurfaceMouseDown);

    api.beatMouseDown.on((beat) => {
      if (isDisposed || propsRef.current.onTabCellSelect) return;
      propsRef.current.onBeatClick?.(beat);
    });

    api.postRenderFinished.on(() => {
      if (isDisposed) return;

      updateTabCursorOverlay.current();

      if (!pendingPostRenderScrollRef.current) return;

      pendingPostRenderScrollRef.current = false;
      const pendingTick = pendingSeekScrollTickRef.current;
      api.scrollToCursor();

      if (pendingTick !== null && pendingSeekScrollTickRef.current === pendingTick) {
        if (seekScrollTimerRef.current !== null) {
          window.clearTimeout(seekScrollTimerRef.current);
        }
        seekScrollTimerRef.current = window.setTimeout(() => {
          seekScrollTimerRef.current = null;
          if (pendingSeekScrollTickRef.current === pendingTick) {
            pendingSeekScrollTickRef.current = null;
            apiRef.current?.scrollToCursor();
          }
        }, 120);
      }
    });

    api.playerPositionChanged.on((args) => {
      if (isDisposed) return;
      propsRef.current.onPositionChanged?.(args);
    });

    return () => {
      isDisposed = true;
      container.removeEventListener('mousedown', handleSurfaceMouseDown);
      if (seekScrollTimerRef.current !== null) {
        window.clearTimeout(seekScrollTimerRef.current);
        seekScrollTimerRef.current = null;
      }
      pendingSeekScrollTickRef.current = null;
      pendingPostRenderScrollRef.current = false;
      pendingRestoreTickRef.current = null;
      pendingResumePlaybackRef.current = false;
      barStartTicksRef.current = [];
      if (tabCursorEl) {
        tabCursorEl.style.display = 'none';
      }
      api.destroy();
      apiRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    loadScore: (data: unknown) => {
      pendingPostRenderScrollRef.current = false;
      pendingRestoreTickRef.current = null;
      pendingResumePlaybackRef.current = false;
      apiRef.current?.load(data);
    },
    clearScore: () => {
      const api = apiRef.current;
      if (!api) return;
      if (seekScrollTimerRef.current !== null) {
        window.clearTimeout(seekScrollTimerRef.current);
        seekScrollTimerRef.current = null;
      }
      pendingSeekScrollTickRef.current = null;
      pendingPostRenderScrollRef.current = false;
      pendingRestoreTickRef.current = null;
      pendingResumePlaybackRef.current = false;
      barStartTicksRef.current = [];
      if (tabCursorRef.current) {
        tabCursorRef.current.style.display = 'none';
      }
      api.stop();
      api.tickPosition = 0;
    },
    playPause: () => {
      apiRef.current?.playPause();
    },
    stop: () => {
      apiRef.current?.stop();
    },
    renderTracks: (tracks: alphaTab.model.Track[]) => {
      apiRef.current?.renderTracks(tracks);
    },
    applyDisplaySettings: ({ showStandardNotation, showTablature, rhythmMode, tracks, render = true }) => {
      const api = apiRef.current;
      if (!api?.score) return;

      if (showStandardNotation !== undefined || showTablature !== undefined) {
        api.score.tracks.forEach(track => {
          track.staves.forEach(staff => {
            const supportsTab = staff.isStringed && !staff.isPercussion;
            if (showStandardNotation !== undefined) {
              staff.showStandardNotation = supportsTab ? showStandardNotation : true;
            }
            if (showTablature !== undefined) {
              staff.showTablature = supportsTab ? showTablature : false;
            }
          });
        });
      }

      if (rhythmMode !== undefined && api.settings.notation.rhythmMode !== rhythmMode) {
        api.settings.notation.rhythmMode = rhythmMode;
        api.updateSettings();
      }

      if (!render) return;

      if (tracks?.length) {
        api.renderTracks(tracks);
      } else {
        api.render();
      }
    },
    setNotationVisibility: (showStandardNotation: boolean, showTablature: boolean, tracks?: alphaTab.model.Track[]) => {
      const api = apiRef.current;
      if (!api?.score) return;

      api.score.tracks.forEach(track => {
        track.staves.forEach(staff => {
          const supportsTab = staff.isStringed && !staff.isPercussion;
          staff.showStandardNotation = supportsTab ? showStandardNotation : true;
          staff.showTablature = supportsTab ? showTablature : false;
        });
      });

      if (tracks?.length) {
        api.renderTracks(tracks);
      } else {
        api.render();
      }
    },
    setTabRhythmMode: (rhythmMode: alphaTab.TabRhythmMode, tracks?: alphaTab.model.Track[]) => {
      const api = apiRef.current;
      if (!api?.score) return;

      if (api.settings.notation.rhythmMode !== rhythmMode) {
        api.settings.notation.rhythmMode = rhythmMode;
        api.updateSettings();
      }

      if (tracks?.length) {
        api.renderTracks(tracks);
      } else {
        api.render();
      }
    },
    setZoom: (zoom: number) => {
      const api = apiRef.current;
      if (api && api.settings.display.scale !== zoom) {
        api.settings.display.scale = zoom;
        api.updateSettings();
        api.render();
      }
    },
    setPlaybackSpeed: (speed: number) => {
      if (apiRef.current) {
        apiRef.current.playbackSpeed = speed;
      }
    },
    setMetronomeVolume: (volume: number) => {
      if (apiRef.current) {
        apiRef.current.metronomeVolume = volume;
      }
    },
    setCountInVolume: (volume: number) => {
      if (apiRef.current) {
        apiRef.current.countInVolume = volume;
      }
    },
    seekToTick: (tick: number, options?: { scrollToCursor?: boolean; waitForRender?: boolean }) => {
      const api = apiRef.current;
      if (!api) return;

      if (seekScrollTimerRef.current !== null) {
        window.clearTimeout(seekScrollTimerRef.current);
        seekScrollTimerRef.current = null;
      }

      const shouldScroll = options?.scrollToCursor !== false;
      const waitForRender = shouldScroll && Boolean(options?.waitForRender);
      pendingSeekScrollTickRef.current = shouldScroll ? tick : null;
      pendingPostRenderScrollRef.current = waitForRender;
      suppressCursorScrollUntilRef.current = shouldScroll ? 0 : performance.now() + 250;
      api.tickPosition = tick;

      if (shouldScroll && !waitForRender) {
        seekScrollTimerRef.current = window.setTimeout(() => {
          seekScrollTimerRef.current = null;
          if (pendingSeekScrollTickRef.current === tick) {
            pendingSeekScrollTickRef.current = null;
            apiRef.current?.scrollToCursor();
          }
        }, 120);
      }
    },
    reloadMidi: (preserveTick = true) => {
      const api = apiRef.current;
      if (!api?.score) return;

      const wasPlaying = api.playerState === alphaTab.synth.PlayerState.Playing;
      if (preserveTick) {
        pendingRestoreTickRef.current = api.tickPosition;
      }
      pendingResumePlaybackRef.current = wasPlaying;
      api.loadMidiForScore();
    },
    get api() {
      return apiRef.current;
    }
  }), []);

  return (
    <div className="at-container">
      <div ref={containerRef}></div>
      <div
        ref={tabCursorRef}
        className={`tab-edit-cursor ${props.isMultiDigitPending ? 'multi-digit-pending' : ''}`}
        aria-hidden="true"
      />
    </div>
  );
}));

AlphaTabEditor.displayName = 'AlphaTabEditor';

export default AlphaTabEditor;
