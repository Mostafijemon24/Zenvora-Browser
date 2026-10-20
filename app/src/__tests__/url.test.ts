import { describe, expect, it } from 'vitest';
import { displayUrl, faviconFor, hostOf, normalize, titleFor, typeOf } from '../lib/url';

describe('normalize', () => {
  it('keeps full URLs', () => {
    expect(normalize('https://example.com/a')).toBe('https://example.com/a');
    expect(normalize('zenvora://settings')).toBe('zenvora://settings');
  });
  it('adds https to bare domains and localhost', () => {
    expect(normalize('github.com/zenvora')).toBe('https://github.com/zenvora');
    expect(normalize('localhost:3000')).toBe('https://localhost:3000');
  });
  it('searches everything else with the chosen engine', () => {
    expect(normalize('fetch api')).toBe('https://duckduckgo.com/?q=fetch%20api');
    expect(normalize('fetch api', 'Google')).toBe('https://www.google.com/search?q=fetch%20api');
  });
  it('ignores blank input', () => {
    expect(normalize('   ')).toBeNull();
  });
});

describe('page types and titles', () => {
  it('classifies demo error hosts', () => {
    expect(typeOf('https://zenvora-docs.invalid/')).toBe('dns');
    expect(typeOf('https://expired.badssl.com/')).toBe('cert');
    expect(typeOf('zenvora://newtab')).toBe('newtab');
    expect(typeOf('https://stripe.com/pricing')).toBe('web');
  });
  it('titles searches and known hosts', () => {
    expect(titleFor('https://www.bing.com/search?q=hello')).toBe('hello — Search');
    expect(titleFor('https://stripe.com/pricing')).toBe('Pricing · Stripe');
    expect(titleFor('https://unknown.example/')).toBe('unknown.example');
  });
  it('strips www and https for display', () => {
    expect(hostOf('https://www.example.com/x')).toBe('example.com');
    expect(displayUrl('https://example.com/x')).toBe('example.com/x');
    expect(displayUrl('zenvora://newtab')).toBe('');
  });
  it('gives internal pages the Z favicon', () => {
    expect(faviconFor('zenvora://settings')).toEqual({ color: 'var(--accent)', letter: 'Z' });
    expect(faviconFor('https://figma.com').letter).toBe('F');
  });
});
