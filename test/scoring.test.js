import { describe, expect, it } from 'vitest';
import { badCount, estimateBadShare, negativeStars, summarize, totalCount } from '../src/scoring.js';

describe('negativeStars', () => {
  it.each([
    [0, 1], [0.1, 1], [0.11, 2], [0.15, 2], [0.2, 3], [0.22, 3], [0.3, 4], [0.31, 5], [1, 5],
  ])('share %s gives %s stars', (share, stars) => {
    expect(negativeStars(share)).toBe(stars);
  });
});

describe('histogram counts', () => {
  it('sums bad and all reviews, treating missing stars as zero', () => {
    expect(badCount({ 1: 3, 2: 4, 5: 100 })).toBe(7);
    expect(badCount({})).toBe(0);
    expect(totalCount({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 })).toBe(15);
    expect(totalCount({})).toBe(0);
  });
});

describe('estimateBadShare', () => {
  it('interpolates along the curve', () => {
    expect(estimateBadShare(4)).toBeCloseTo(0.08);
    expect(estimateBadShare(3.75)).toBeCloseTo(0.125);
    expect(estimateBadShare(5)).toBe(0);
  });
  it('clamps values outside 1-5', () => {
    expect(estimateBadShare(0)).toBe(1);
    expect(estimateBadShare(1)).toBe(1);
    expect(estimateBadShare(9)).toBe(0);
  });
});

describe('summarize', () => {
  it('is exact with a histogram', () => {
    expect(summarize({ histogram: { 1: 10, 2: 10, 3: 0, 4: 0, 5: 80 } })).toEqual({ stars: 3, bad: 20, total: 100, exact: true });
  });
  it('estimates from the average when the histogram is empty or missing', () => {
    expect(summarize({ histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, average: 4, total: 1000 })).toEqual({ stars: 1, bad: 80, total: 1000, exact: false });
    expect(summarize({ average: 4 })).toEqual({ stars: 1, bad: null, total: null, exact: false });
  });
  it('returns null without any data', () => {
    expect(summarize({})).toBeNull();
  });
});
