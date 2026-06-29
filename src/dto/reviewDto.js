import { toCardDTO } from './cardDto.js';

const toIso = (value) => (value instanceof Date ? value.toISOString() : null);

export function toReviewDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.toString?.() ?? null,
    userId: doc.user?.toString?.() ?? null,
    cardId: doc.card?.toString?.() ?? null,
    easeFactor: doc.easeFactor,
    interval: doc.interval,
    repetitions: doc.repetitions,
    dueDate: toIso(doc.dueDate),
    lastReviewedAt: toIso(doc.lastReviewedAt),
  };
}

/**
 * A card queued for study: the card content plus the viewer's progress.
 * `review` is null for brand-new cards the user has never seen.
 */
export function toStudyCard({ card, review }) {
  const base = toCardDTO(card);
  if (!base) return null;
  return {
    ...base,
    review: toReviewDTO(review),
  };
}
