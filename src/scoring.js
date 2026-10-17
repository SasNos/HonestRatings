// Pure rating logic: turns a star histogram (or just an average) into the
// "negative stars" Honest Ratings shows instead of the usual positive ones.

export const BAD_MAX_STARS = 2;

// Upper bound of the share of bad reviews for 1, 2, 3 and 4 negative stars.
// Anything above the last limit is 5 negative stars.
const SHARE_LIMITS = [0.1, 0.15, 0.22, 0.3];

// Typical share of 1-2 star reviews for a given average (piecewise linear).
const AVERAGE_CURVE = [
  [1, 1],
  [2, 0.55],
  [2.5, 0.4],
  [3, 0.28],
  [3.5, 0.17],
  [4, 0.08],
  [4.5, 0.03],
  [5, 0],
];

export function negativeStars(share) {
  const index = SHARE_LIMITS.findIndex((limit) => share <= limit);
  return index === -1 ? 5 : index + 1;
}

export function totalCount(histogram) {
  return [1, 2, 3, 4, 5].reduce((sum, star) => sum + (histogram[star] || 0), 0);
}

export function badCount(histogram) {
  return (histogram[1] || 0) + (histogram[2] || 0);
}

export function estimateBadShare(average) {
  const value = Math.min(5, Math.max(1, average));
  const upper = AVERAGE_CURVE.findIndex(([stars]) => stars >= value);
  const [highStars, highShare] = AVERAGE_CURVE[upper];
  if (upper === 0) return highShare;
  const [lowStars, lowShare] = AVERAGE_CURVE[upper - 1];
  const t = (value - lowStars) / (highStars - lowStars);
  return lowShare + t * (highShare - lowShare);
}

// Returns { stars, share, bad, total, exact, average } or null when nothing can be said.
// With a histogram the numbers are exact; with only an average they are an
// estimate (exact: false) and `bad` is null when the review total is unknown.
export function summarize({ histogram, average, total }) {
  if (histogram) {
    const sum = totalCount(histogram);
    if (sum > 0) {
      const bad = badCount(histogram);
      return { stars: negativeStars(bad / sum), share: bad / sum, bad, total: sum, exact: true, average: average ?? null };
    }
  }
  if (average == null) return null;
  const share = estimateBadShare(average);
  return {
    stars: negativeStars(share),
    share,
    average,
    bad: total == null ? null : Math.round(share * total),
    total: total ?? null,
    exact: false,
  };
}
