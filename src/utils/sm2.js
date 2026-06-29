import { DEFAULT_EASE_FACTOR, MIN_EASE_FACTOR } from '../models/Review.js';

/**
 * SM-2 spaced-repetition algorithm (Anki-style).
 * All functions here are pure: same input always yields the same output.
 * The caller passes the current progress and `now`; nothing reads the clock.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** User-facing answer ratings mapped to the SM-2 0..5 quality scale. */
export const REVIEW_RATINGS = {
  forgot: 0,
  hard: 1,
  normal: 2,
  easy: 3,
};

const QUALITY_BY_RATING = {
  0: 0, // forgot
  1: 3, // hard
  2: 4, // normal
  3: 5, // easy
};

const PASS_QUALITY_THRESHOLD = 3;

export const isValidRating = (rating) =>
  Object.prototype.hasOwnProperty.call(QUALITY_BY_RATING, rating);

/** Fresh progress for a card the user has never reviewed. */
export const buildInitialProgress = (now) => ({
  easeFactor: DEFAULT_EASE_FACTOR,
  interval: 0,
  repetitions: 0,
  dueDate: now,
  lastReviewedAt: null,
});

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const clampEaseFactor = (value) => Math.max(MIN_EASE_FACTOR, value);

const recomputeEaseFactor = (easeFactor, quality) => {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return clampEaseFactor(easeFactor + delta);
};

const intervalAfterSuccess = (repetitions, interval, easeFactor) => {
  if (repetitions === 0) return 1;
  if (repetitions === 1) return 6;
  return Math.round(interval * easeFactor);
};

/**
 * Recalculate progress from a single answer.
 * @param {{ easeFactor: number, interval: number, repetitions: number }} progress
 * @param {number} rating one of REVIEW_RATINGS (0..3)
 * @param {Date} now
 * @returns {{ easeFactor: number, interval: number, repetitions: number, dueDate: Date, lastReviewedAt: Date }}
 */
export const computeNextProgress = (progress, rating, now) => {
  const quality = QUALITY_BY_RATING[rating];
  const recalled = quality >= PASS_QUALITY_THRESHOLD;

  const repetitions = recalled ? progress.repetitions + 1 : 0;
  const interval = recalled
    ? intervalAfterSuccess(progress.repetitions, progress.interval, progress.easeFactor)
    : 1;
  const easeFactor = recomputeEaseFactor(progress.easeFactor, quality);

  return {
    easeFactor,
    interval,
    repetitions,
    dueDate: addDays(now, interval),
    lastReviewedAt: now,
  };
};
