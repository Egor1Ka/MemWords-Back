import * as deckRepository from '../repository/deck.js';
import * as deckCardRepository from '../repository/deckCard.js';
import * as deckSubscriptionRepository from '../repository/deckSubscription.js';
import * as userRepository from '../repository/user.js';
import { toDeckDTO, toExploreDeckDTO, toSavedDeckDTO } from '../dto/deckDto.js';
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

const resolveOwnerName = async (ownerId) => {
  const owner = await userRepository.findById(ownerId);
  return owner ? owner.name : null;
};

const resolveIsSubscribed = async (authUser, ownerFlag, deckId) => {
  if (!authUser || !authUser.id || ownerFlag) return false;
  return deckSubscriptionRepository.exists({ userId: authUser.id, deckId });
};

export async function getDeck(authUser, deckId) {
  assertObjectId(deckId, 'deckId');
  const deck = await loadDeckOr404(deckId);
  assertCanAccessDeck(deck, authUser);

  const base = await withCardCount(deck);
  const ownerFlag = isOwner(deck, authUser);
  const [ownerName, isSubscribed] = await Promise.all([
    resolveOwnerName(deck.owner),
    resolveIsSubscribed(authUser, ownerFlag, deckId),
  ]);
  return { ...base, isOwner: ownerFlag, ownerName, isSubscribed };
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
  await deckSubscriptionRepository.deleteManyByDeck(deckId);
  await deckRepository.deleteById(deckId);
  return { id: deckId, removedLinks };
}

// ── Discovery / subscriptions ───────────────────────────────────────────────

const EXPLORE_SORTS = ['new', 'popular', 'name'];
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 100;

const parsePage = (raw) => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return value;
};

const parsePageSize = (raw) => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(value, MAX_PAGE_SIZE);
};

const parseSort = (raw) => (EXPLORE_SORTS.includes(raw) ? raw : 'new');

const parseQuery = (raw) => {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_QUERY_LENGTH);
};

const toDeckIdString = (doc) => doc._id.toString();

const toAnonymousExploreDTO = (doc) =>
  toExploreDeckDTO(doc, { isSubscribed: false, isOwner: false });

const ownerIdOf = (doc) =>
  doc.owner && doc.owner._id ? doc.owner._id.toString() : null;

const toExploreDecorator = (authUserId, subscribedSet) => (doc) =>
  toExploreDeckDTO(doc, {
    isSubscribed: subscribedSet.has(doc._id.toString()),
    isOwner: ownerIdOf(doc) === authUserId,
  });

const decorateExploreItems = async (authUser, docs) => {
  if (!authUser || !authUser.id) return docs.map(toAnonymousExploreDTO);
  const deckIds = docs.map(toDeckIdString);
  const subscribedIds = await deckSubscriptionRepository.findSubscribedDeckIds({
    userId: authUser.id,
    deckIds,
  });
  const subscribedSet = new Set(subscribedIds);
  return docs.map(toExploreDecorator(authUser.id, subscribedSet));
};

export async function exploreDecks(authUser, query) {
  const page = parsePage(query?.page);
  const pageSize = parsePageSize(query?.pageSize);
  const sort = parseSort(query?.sort);
  const q = parseQuery(query?.q);
  const skip = (page - 1) * pageSize;

  const [docs, total] = await Promise.all([
    deckRepository.searchPublic({ q, sort, skip, limit: pageSize }),
    deckRepository.countPublic({ q }),
  ]);

  const items = await decorateExploreItems(authUser, docs);
  return { items, total, page, pageSize, sort };
}

export async function subscribeToDeck(authUser, deckId) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  const deck = await loadDeckOr404(deckId);
  if (deck.visibility === 'private') {
    throw new DomainError('Deck not found', httpStatus.NOT_FOUND);
  }
  if (isOwner(deck, authUser)) {
    throw new DomainError('Cannot subscribe to your own deck', httpStatus.BAD_REQUEST, {
      code: 'ownDeck',
    });
  }
  await deckSubscriptionRepository.create({ userId: authUser.id, deckId });
  return { deckId, subscribed: true };
}

export async function unsubscribeFromDeck(authUser, deckId) {
  assertAuth(authUser);
  assertObjectId(deckId, 'deckId');
  await deckSubscriptionRepository.deleteOne({ userId: authUser.id, deckId });
  return { deckId, subscribed: false };
}

const toSubscriptionDeckId = (sub) => sub.deck.toString();

const toMetaEntry = (doc) => [doc._id.toString(), doc];

const buildDeckMetaMap = (docs) => new Map(docs.map(toMetaEntry));

const toSavedEntry = (deckMap) => (sub) => {
  const doc = deckMap.get(sub.deck.toString());
  if (!doc) return null;
  return toSavedDeckDTO(doc, { subscribedAt: sub.createdAt });
};

const isPresent = (value) => value !== null;

export async function listSavedDecks(authUser) {
  assertAuth(authUser);
  const subscriptions = await deckSubscriptionRepository.listByUser(authUser.id);
  if (subscriptions.length === 0) return [];
  const deckIds = subscriptions.map(toSubscriptionDeckId);
  const docs = await deckRepository.findAccessibleMetaByIds(deckIds);
  const deckMap = buildDeckMetaMap(docs);
  return subscriptions.map(toSavedEntry(deckMap)).filter(isPresent);
}
