import * as cardRepository from '../repository/card.js';
import * as deckCardRepository from '../repository/deckCard.js';
import * as reviewRepository from '../repository/review.js';
import * as deckService from './deckService.js';
import { toReviewDTO, toStudyCard } from '../dto/reviewDto.js';
import {
  computeNextProgress,
  buildInitialProgress,
  isValidRating,
} from '../utils/sm2.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';
import { assertObjectId, assertAuth } from '../utils/validation.js';

const DEFAULT_STUDY_LIMIT = 20;
const MAX_STUDY_LIMIT = 200;

const asPlain = (doc) =>
  doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;

const isPresent = (value) => value !== null;

const buildCardMap = (cards) =>
  new Map(cards.map((card) => [card._id.toString(), card]));

const parseLimit = (raw) => {
  if (raw === undefined || raw === null) return DEFAULT_STUDY_LIMIT;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_STUDY_LIMIT;
  return Math.min(value, MAX_STUDY_LIMIT);
};

const parseRating = (raw) => {
  const value = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || !isValidRating(value)) {
    throw new DomainError(
      'rating must be 0 (forgot), 1 (hard), 2 (normal) or 3 (easy)',
      httpStatus.BAD_REQUEST
    );
  }
  return value;
};

const loadCardOr404 = async (cardId) => {
  const card = await cardRepository.findById(cardId);
  if (!card) {
    throw new DomainError('Card not found', httpStatus.NOT_FOUND);
  }
  return card;
};

const loadAccessibleDeckCardIds = async (authUser, deckId) => {
  const deck = await deckService.loadDeckOr404(deckId);
  deckService.assertCanAccessDeck(deck, authUser);
  const deckCards = await deckCardRepository.listByDeck({ deckId });
  return deckCards.map((deckCard) => deckCard.card.toString());
};

export async function startCard(authUser, cardId) {
  assertAuth(authUser);
  assertObjectId(cardId, 'cardId');
  await loadCardOr404(cardId);

  const now = new Date();
  const { doc } = await reviewRepository.startIfMissing({
    userId: authUser.id,
    cardId,
    progress: buildInitialProgress(now),
  });
  return toReviewDTO(asPlain(doc));
}

export async function submitAnswer(authUser, cardId, body) {
  assertAuth(authUser);
  assertObjectId(cardId, 'cardId');
  const rating = parseRating(body?.rating);
  await loadCardOr404(cardId);

  const now = new Date();
  const existing = await reviewRepository.findOne({
    userId: authUser.id,
    cardId,
  });
  const current = existing ?? buildInitialProgress(now);
  const next = computeNextProgress(current, rating, now);
  const saved = await reviewRepository.saveProgress({
    userId: authUser.id,
    cardId,
    progress: next,
  });
  return toReviewDTO(saved);
}

export async function resetProgress(authUser, cardId) {
  assertAuth(authUser);
  assertObjectId(cardId, 'cardId');
  const removed = await reviewRepository.deleteOne({
    userId: authUser.id,
    cardId,
  });
  return { cardId, reset: removed };
}

const toStudyFromReview = (cardMap) => (review) => {
  const card = cardMap.get(review.card.toString());
  if (!card) return null;
  return toStudyCard({ card, review });
};

export async function getDueCards(authUser, deckId, query) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  const cardIds = await loadAccessibleDeckCardIds(authUser, deckId);
  if (cardIds.length === 0) return [];

  const limit = parseLimit(query?.limit);
  const now = new Date();
  const dueReviews = await reviewRepository.listDueByUserAndCards({
    userId: authUser.id,
    cardIds,
    now,
    limit,
  });
  const dueCardIds = dueReviews.map((review) => review.card.toString());
  const cards = await cardRepository.findByIds(dueCardIds);
  const cardMap = buildCardMap(cards);
  return dueReviews.map(toStudyFromReview(cardMap)).filter(isPresent);
}

const isUnreviewed = (reviewedSet) => (cardId) => !reviewedSet.has(cardId);

const toNewStudyCard = (cardMap) => (cardId) => {
  const card = cardMap.get(cardId);
  if (!card) return null;
  return toStudyCard({ card, review: null });
};

export async function getNewCards(authUser, deckId, query) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  const cardIds = await loadAccessibleDeckCardIds(authUser, deckId);
  if (cardIds.length === 0) return [];

  const limit = parseLimit(query?.limit);
  const reviewedIds = await reviewRepository.findReviewedCardIds({
    userId: authUser.id,
    cardIds,
  });
  const reviewedSet = new Set(reviewedIds);
  const newCardIds = cardIds.filter(isUnreviewed(reviewedSet)).slice(0, limit);
  const cards = await cardRepository.findByIds(newCardIds);
  const cardMap = buildCardMap(cards);
  return newCardIds.map(toNewStudyCard(cardMap)).filter(isPresent);
}
