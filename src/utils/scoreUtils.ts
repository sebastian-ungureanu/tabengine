import type * as alphaTab from '@coderline/alphatab';

export interface ScoreBarTiming {
  barStartTicks: number[];
  totalTicks: number;
}

export const computeBarTiming = (score: alphaTab.model.Score | null): ScoreBarTiming => {
  if (!score) {
    return { barStartTicks: [], totalTicks: 0 };
  }

  const barCount = score.masterBars.length;
  const barStartTicks = new Array<number>(barCount);
  let totalTicks = 0;

  for (let i = 0; i < barCount; i++) {
    barStartTicks[i] = totalTicks;
    totalTicks += score.masterBars[i].calculateDuration();
  }

  return { barStartTicks, totalTicks };
};

export const findBarIndexAtTick = (barStartTicks: number[], tick: number): number => {
  const count = barStartTicks.length;
  if (count === 0 || tick <= 0) return 0;

  let low = 0;
  let high = count - 1;
  let result = 0;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (barStartTicks[mid] <= tick) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
};

export const getBeatPlaybackTick = (beat: alphaTab.model.Beat, barStartTicks?: number[]): number => {
  const bar = beat.voice.bar;
  if (barStartTicks && bar.index < barStartTicks.length) {
    return barStartTicks[bar.index] + beat.playbackStart;
  }

  const masterBars = bar.staff.track.score.masterBars;
  let barStart = 0;
  for (let i = 0; i < bar.index; i++) {
    barStart += masterBars[i]?.calculateDuration() ?? 0;
  }

  return barStart + beat.playbackStart;
};

export const getTracksInOrder = (
  loadedScore: alphaTab.model.Score | null,
  order: number[]
): alphaTab.model.Track[] => {
  if (!loadedScore) return [];

  const trackByIndex = new Map(loadedScore.tracks.map(track => [track.index, track]));
  const ordered: alphaTab.model.Track[] = [];
  const orderedIds = new Set<number>();

  for (const trackIndex of order) {
    const track = trackByIndex.get(trackIndex);
    if (track && !orderedIds.has(track.index)) {
      ordered.push(track);
      orderedIds.add(track.index);
    }
  }

  for (const track of loadedScore.tracks) {
    if (!orderedIds.has(track.index)) {
      ordered.push(track);
    }
  }

  return ordered;
};
