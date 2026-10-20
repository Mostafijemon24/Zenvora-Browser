import { describe, expect, it } from 'vitest';
import { MAX_CLOSED, currentTab, initialTabs, tabsReducer, wsTabs } from '../state/tabs';
import type { TabsAction, TabsState } from '../state/tabs';

const run = (s: TabsState, ...actions: TabsAction[]) => actions.reduce(tabsReducer, s);

describe('tabs reducer', () => {
  it('navigates and walks history', () => {
    let s = run(initialTabs(), { type: 'navigate', url: 'https://a.com/' }, { type: 'navigate', url: 'https://b.com/' });
    expect(currentTab(s).url).toBe('https://b.com/');
    s = run(s, { type: 'go', delta: -1 });
    expect(currentTab(s).url).toBe('https://a.com/');
    // Navigating from the middle drops forward history.
    s = run(s, { type: 'navigate', url: 'https://c.com/' });
    expect(currentTab(s).hist).toEqual(['zenvora://newtab', 'https://a.com/', 'https://c.com/']);
    expect(run(s, { type: 'go', delta: 1 })).toBe(s);
  });

  it('activates a neighbour when closing the active tab, and can reopen it', () => {
    let s = initialTabs(); // Research: tabs 1-4, tab 4 active
    s = run(s, { type: 'close', id: 4 });
    expect(currentTab(s).id).toBe(3);
    expect(s.closed.map((t) => t.id)).toEqual([4]);
    s = run(s, { type: 'reopen' });
    expect(currentTab(s).id).toBe(4);
    expect(s.closed).toHaveLength(0);
  });

  it('never leaves a workspace empty', () => {
    let s = run(initialTabs(), { type: 'setWorkspace', ws: 'Client work' }, { type: 'close', id: 5 }, { type: 'close', id: 6 });
    const tabs = wsTabs(s);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].url).toBe('zenvora://newtab');
    expect(currentTab(s).id).toBe(tabs[0].id);
  });

  it('caps the closed-tab list', () => {
    let s = initialTabs();
    for (let i = 0; i < MAX_CLOSED + 3; i++) s = run(s, { type: 'newTab' }, { type: 'close', id: s.nextId });
    expect(s.closed.length).toBe(MAX_CLOSED);
  });

  it('switches workspace when activating a tab from another one', () => {
    const s = run(initialTabs(), { type: 'activate', id: 7 });
    expect(s.ws).toBe('Personal');
    expect(currentTab(s).id).toBe(7);
  });

  it('clamps zoom and toggles bookmarks', () => {
    let s = run(initialTabs(), { type: 'setZoom', id: 4, zoom: 400 }, { type: 'toggleStar', id: 4 });
    expect(s.zoom[4]).toBe(200);
    expect(s.starred[4]).toBe(true);
    s = run(s, { type: 'setZoom', id: 4, zoom: 10 });
    expect(s.zoom[4]).toBe(50);
  });
});
