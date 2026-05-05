import { computeRollingActivity } from '../persistence.js';

describe('computeRollingActivity', () => {
  function dateNDaysAgo(n: number): string {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  }

  it('returns rolling sums covering the last `windowDays` days', () => {
    const daily = new Map<string, number>();
    daily.set(dateNDaysAgo(0), 1);
    daily.set(dateNDaysAgo(1), 2);
    daily.set(dateNDaysAgo(2), 3);

    const result = computeRollingActivity(daily, 3);

    // We expect points for the last 3 days (today, today-1, today-2).
    expect(result.size).toBe(3);
    // today = sum of last 3 days = 1+2+3 = 6
    expect(result.get(dateNDaysAgo(0))).toBe(6);
    // today-1 = sum of (today-1, today-2, today-3) = 2+3+0 = 5
    expect(result.get(dateNDaysAgo(1))).toBe(5);
    // today-2 = sum of (today-2, today-3, today-4) = 3+0+0 = 3
    expect(result.get(dateNDaysAgo(2))).toBe(3);
  });

  it('treats missing days as zero', () => {
    const daily = new Map<string, number>();
    daily.set(dateNDaysAgo(0), 5);
    // No other days populated.

    const result = computeRollingActivity(daily, 3);
    expect(result.get(dateNDaysAgo(0))).toBe(5);
    expect(result.get(dateNDaysAgo(1))).toBe(0);
    expect(result.get(dateNDaysAgo(2))).toBe(0);
  });

  it('returns empty map when no data', () => {
    const result = computeRollingActivity(new Map(), 3);
    // Even with no data, we still produce rolling points (all zeroes)
    // for the last `windowDays` days.
    expect(result.size).toBe(3);
    for (const v of result.values()) expect(v).toBe(0);
  });

  it('produces 180 points for default window=180', () => {
    const result = computeRollingActivity(new Map(), 180);
    expect(result.size).toBe(180);
  });

  it('correctly sums a 6-month window with mixed activity', () => {
    const daily = new Map<string, number>();
    // 100 commits/week for 26 weeks (~182 days) ending today
    for (let i = 0; i < 182; i++) {
      daily.set(dateNDaysAgo(i), 100 / 7);
    }

    const result = computeRollingActivity(daily, 180);
    const today = result.get(dateNDaysAgo(0))!;
    // ~180 days × (100/7) ≈ 2571
    expect(today).toBeGreaterThan(2500);
    expect(today).toBeLessThan(2700);
  });
});
