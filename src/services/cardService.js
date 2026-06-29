import * as cardRepository from '../repository/card.js';
import * as deckCardRepository from '../repository/deckCard.js';
import * as reviewRepository from '../repository/review.js';
import * as deckService from './deckService.js';
import { toCardDTO, toDeckCardEntry } from '../dto/cardDto.js';
import { toDeckCardDTO } from '../dto/deckCardDto.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';
import { assertObjectId, assertAuth, toObjectId } from '../utils/validation.js';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const asPlain = (doc) =>
  doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;

const parseSideText = (raw) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new DomainError('text is required', httpStatus.BAD_REQUEST);
  }
  const trimmed = raw.trim();
  if (trimmed.length > 2000) {
    throw new DomainError('text must be at most 2000 characters', httpStatus.BAD_REQUEST);
  }
  return trimmed;
};

const parseOptionalText = (raw, label, maxLength) => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new DomainError(`${label} must be a string`, httpStatus.BAD_REQUEST);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) {
    throw new DomainError(
      `${label} must be at most ${maxLength} characters`,
      httpStatus.BAD_REQUEST
    );
  }
  return trimmed;
};

const parseCardSide = (raw, label) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DomainError(`${label} is required`, httpStatus.BAD_REQUEST);
  }
  return {
    text: parseSideText(raw.text),
    description: parseOptionalText(raw.description, `${label}.description`, 4000),
    imageUrl: parseOptionalText(raw.imageUrl, `${label}.imageUrl`, 2048),
  };
};

const normalizeTag = (tag) => {
  if (typeof tag !== 'string') {
    throw new DomainError('each tag must be a string', httpStatus.BAD_REQUEST);
  }
  return tag.trim();
};

const isNonEmptyString = (value) => value.length > 0;
const uniqueStrings = (values) => [...new Set(values)];

const parseTags = (raw) => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new DomainError('tags must be an array of strings', httpStatus.BAD_REQUEST);
  }
  return uniqueStrings(raw.map(normalizeTag).filter(isNonEmptyString));
};

const parseTagFilter = (raw) => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const assertCardAuthor = (card, authUser) => {
  if (card.author?.toString?.() === authUser.id) return;
  throw new DomainError('Forbidden', httpStatus.FORBIDDEN, { code: 'forbidden' });
};

const loadCardOr404 = async (cardId) => {
  const card = await cardRepository.findById(cardId);
  if (!card) {
    throw new DomainError('Card not found', httpStatus.NOT_FOUND);
  }
  return card;
};

// Creating a card and linking it to a deck are two writes. If the link fails,
// roll the card back so we never leave an orphaned card with no deck.
const linkCardOrRollback = async ({ deckId, cardId, tags }) => {
  try {
    const link = await deckCardRepository.create({
      deck: toObjectId(deckId),
      card: toObjectId(cardId),
      tags,
    });
    return asPlain(link);
  } catch (error) {
    await cardRepository.deleteById(cardId);
    throw error;
  }
};

export async function addCardToDeck(authUser, deckId, body) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  const deck = await deckService.loadDeckOr404(deckId);
  deckService.assertDeckOwner(deck, authUser);

  const front = parseCardSide(body?.front, 'front');
  const back = parseCardSide(body?.back, 'back');
  const tags = parseTags(body?.tags);

  const card = await cardRepository.create({
    author: toObjectId(authUser.id),
    front,
    back,
  });
  const deckCard = await linkCardOrRollback({ deckId, cardId: card._id, tags });
  return toDeckCardEntry({ card: asPlain(card), deckCard });
}

export async function addExistingCardToDeck(authUser, deckId, cardId, body) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  assertObjectId(cardId, 'cardId');
  const deck = await deckService.loadDeckOr404(deckId);
  deckService.assertDeckOwner(deck, authUser);
  const card = await loadCardOr404(cardId);
  const tags = parseTags(body?.tags);

  const { doc, created } = await deckCardRepository.createIfMissing({
    deckId,
    cardId,
    tags,
  });
  if (!created) {
    throw new DomainError('Card is already in this deck', httpStatus.CONFLICT, {
      code: 'cardAlreadyInDeck',
    });
  }
  return toDeckCardEntry({ card, deckCard: asPlain(doc) });
}

const buildCardMap = (cards) =>
  new Map(cards.map((card) => [card._id.toString(), card]));

const toEntryFromMap = (cardMap) => (deckCard) => {
  const card = cardMap.get(deckCard.card.toString());
  if (!card) return null;
  return toDeckCardEntry({ card, deckCard });
};

const isPresent = (value) => value !== null;

export async function getDeckCards(authUser, deckId, query) {
  assertObjectId(deckId, 'deckId');
  const deck = await deckService.loadDeckOr404(deckId);
  deckService.assertCanAccessDeck(deck, authUser);

  const tag = parseTagFilter(query?.tag);
  const deckCards = await deckCardRepository.listByDeck({ deckId, tag });
  const cardIds = deckCards.map((deckCard) => deckCard.card.toString());
  const cards = await cardRepository.findByIds(cardIds);
  const cardMap = buildCardMap(cards);
  return deckCards.map(toEntryFromMap(cardMap)).filter(isPresent);
}

export async function getCard(authUser, cardId) {
  assertObjectId(cardId, 'cardId');
  const card = await loadCardOr404(cardId);
  return toCardDTO(card);
}

const buildCardPatch = (body) => {
  const patch = {};
  if (hasOwn(body, 'front')) {
    patch.front = parseCardSide(body.front, 'front');
  }
  if (hasOwn(body, 'back')) {
    patch.back = parseCardSide(body.back, 'back');
  }
  return patch;
};

export async function updateCard(authUser, cardId, body) {
  assertAuth(authUser);
  assertObjectId(cardId, 'cardId');
  const card = await loadCardOr404(cardId);
  assertCardAuthor(card, authUser);

  const patch = buildCardPatch(body ?? {});
  if (Object.keys(patch).length === 0) {
    throw new DomainError('Nothing to update', httpStatus.BAD_REQUEST);
  }
  const updated = await cardRepository.updateById(cardId, patch);
  return toCardDTO(updated);
}

export async function updateCardTags(authUser, deckId, cardId, body) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  assertObjectId(cardId, 'cardId');
  const deck = await deckService.loadDeckOr404(deckId);
  deckService.assertDeckOwner(deck, authUser);

  const tags = parseTags(body?.tags);
  const updated = await deckCardRepository.updateTags({ deckId, cardId, tags });
  if (!updated) {
    throw new DomainError('Card is not in this deck', httpStatus.NOT_FOUND);
  }
  return toDeckCardDTO(updated);
}

export async function removeCardFromDeck(authUser, deckId, cardId) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  assertObjectId(cardId, 'cardId');
  const deck = await deckService.loadDeckOr404(deckId);
  deckService.assertDeckOwner(deck, authUser);

  const removed = await deckCardRepository.deleteOne({ deckId, cardId });
  if (!removed) {
    throw new DomainError('Card is not in this deck', httpStatus.NOT_FOUND);
  }
  return { deckId, cardId, removed: true };
}

export async function deleteCard(authUser, cardId) {
  assertAuth(authUser);
  assertObjectId(cardId, 'cardId');
  const card = await loadCardOr404(cardId);
  assertCardAuthor(card, authUser);

  const [removedLinks, removedReviews] = await Promise.all([
    deckCardRepository.deleteManyByCard(cardId),
    reviewRepository.deleteManyByCard(cardId),
  ]);
  await cardRepository.deleteById(cardId);
  return { id: cardId, removedLinks, removedReviews };
}
