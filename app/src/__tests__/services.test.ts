import { describe, expect, it, vi } from 'vitest';
import { createMockDownloads, mockAssistant, wait } from '../services/mock';
import { toCsv } from '../lib/saveFile';

describe('mock services', () => {
  it('wait() rejects with AbortError when aborted', async () => {
    const c = new AbortController();
    const p = wait(10_000, c.signal);
    c.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('assistant asks for pages when none are shared', async () => {
    vi.useFakeTimers();
    const p = mockAssistant.ask('summarize', []);
    vi.advanceTimersByTime(1100);
    await expect(p).resolves.toMatch(/No pages are shared/);
    vi.useRealTimers();
  });

  it('downloads progress, pause and finish', () => {
    vi.useFakeTimers();
    const d = createMockDownloads();
    const off = d.subscribe(() => {});
    const zip = () => d.list().find((x) => x.id === 'zip')!;
    vi.advanceTimersByTime(700);
    expect(zip().receivedMb).toBeCloseTo(19.1);
    d.pause('zip');
    vi.advanceTimersByTime(7000);
    expect(zip().receivedMb).toBeCloseTo(19.1);
    d.resume('zip');
    vi.advanceTimersByTime(60_000);
    expect(zip().state).toBe('done');
    d.addFile({ name: 'x.csv', ext: 'CSV', sizeMb: 0.004, note: 'new' });
    expect(d.list()[0].name).toBe('x.csv');
    off();
    vi.useRealTimers();
  });
});

describe('toCsv', () => {
  it('quotes cells with commas and quotes', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"']])).toBe('a,"b,c","say ""hi"""\n');
  });
});
