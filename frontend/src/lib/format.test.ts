import { describe, expect, it } from 'vitest';
import { formatDate, isOverdue, todayIso } from './format';

describe('formatDate', () => {
  it('does not shift plain dates to the previous day', () => {
    // "2026-10-01" must stay October 1st whatever the local time zone is.
    expect(formatDate('2026-10-01')).toMatch(/1/);
    expect(formatDate('2026-10-01')).not.toMatch(/30/);
  });

  it('shows a dash for empty values', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('isOverdue', () => {
  it('is true only when the estimated date passed and the order was not delivered', () => {
    expect(isOverdue('2000-01-01', null)).toBe(true);
    expect(isOverdue('2000-01-01', '2000-01-02')).toBe(false);
    expect(isOverdue(todayIso(), null)).toBe(false);
  });
});
