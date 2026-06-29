import * as deckRepository from '../repository/deck.js';
import * as deckCardRepository from '../repository/deckCard.js';
import { toDeckDTO } from '../dto/deckDto.js';
import { DECK_VISIBILITIES } from '../models/Deck.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';
import { assertObjectId, assertAuth, toObjectId } from '../utils/validation.js';

const parseName = (raw) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new DomainError('name is required', httpStatus.BAD_REQUEST);
  }
  const trimmed = raw.trim();
  if (trimmed.length > 120) {
    throw new DomainError('name must be at most 120 characters', httpStatus.BAD_REQUEST);
  }
  return trimmed;
};

const parseDescription = (raw) => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new DomainError('description must be a string', httpStatus.BAD_REQUEST);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 1000) {
    throw new DomainError('description must be at most 1000 characters', httpStatus.BAD_REQUEST);
  }
  return trimmed;
};

const parseVisibility = (raw) => {
  if (raw === undefined || raw === null) return 'private';
  if (!DECK_VISIBILITIES.includes(raw)) {
    throw new DomainError(
      `visibility must be one of: ${DECK_VISIBILITIES.join(', ')}`,
      httpStatus.BAD_REQUEST
    );
  }
  return raw;
};

const isOwner = (deck, authUser) =>
  !!authUser && deck.owner?.toString?.() === authUser.id;

export async function loadDeckOr404(deckId) {
  const deck = await deckRepository.findById(deckId);
  if (!deck) {
    throw new DomainError('Deck not found', httpStatus.NOT_FOUND);
  }
  return deck;
}

export function assertCanAccessDeck(deck, authUser) {
  if (isOwner(deck, authUser)) return;
  if (deck.visibility !== 'private') return;
  throw new DomainError('Deck not found', httpStatus.NOT_FOUND);
}

export function assertDeckOwner(deck, authUser) {
  if (isOwner(deck, authUser)) return;
  throw new DomainError('Forbidden', httpStatus.FORBIDDEN, { code: 'forbidden' });
}

export async function createDeck(authUser, body) {
  assertAuth(authUser);
  const name = parseName(body?.name);
  const description = parseDescription(body?.description);
  const visibility = parseVisibility(body?.visibility);

  const created = await deckRepository.create({
    owner: toObjectId(authUser.id),
    name,
    description,
    visibility,
  });
  return toDeckDTO(created.toObject(), { cardCount: 0 });
}

const withCardCount = async (deck) => {
  const cardCount = await deckCardRepository.countByDeck(deck._id);
  return toDeckDTO(deck, { cardCount });
};

export async function listDecks(authUser) {
  assertAuth(authUser);
  const decks = await deckRepository.listByOwner(authUser.id);
  return Promise.all(decks.map(withCardCount));
}

export async function getDeck(authUser, deckId) {
  assertObjectId(deckId, 'deckId');
  const deck = await loadDeckOr404(deckId);
  assertCanAccessDeck(deck, authUser);
  return withCardCount(deck);
}

const ALLOWED_UPDATE_KEYS = ['name', 'description', 'visibility'];

const buildDeckPatch = (body) => {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    patch.name = parseName(body.name);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = parseDescription(body.description);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'visibility')) {
    patch.visibility = parseVisibility(body.visibility);
  }
  return patch;
};

export async function updateDeck(authUser, deckId, body) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  const deck = await loadDeckOr404(deckId);
  assertDeckOwner(deck, authUser);

  const allowedBody = Object.fromEntries(
    Object.entries(body ?? {}).filter(([key]) => ALLOWED_UPDATE_KEYS.includes(key))
  );
  const patch = buildDeckPatch(allowedBody);
  if (Object.keys(patch).length === 0) {
    throw new DomainError('Nothing to update', httpStatus.BAD_REQUEST);
  }
  const updated = await deckRepository.updateById(deckId, patch);
  return withCardCount(updated);
}

export async function deleteDeck(authUser, deckId) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  const deck = await loadDeckOr404(deckId);
  assertDeckOwner(deck, authUser);

  const removedLinks = await deckCardRepository.deleteManyByDeck(deckId);
  await deckRepository.deleteById(deckId);
  return { id: deckId, removedLinks };
}
