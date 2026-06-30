const toIso = (value) => (value instanceof Date ? value.toISOString() : null);

export function toDeckDTO(doc, { cardCount } = {}) {
  if (!doc) return null;
  const result = {
    id: doc._id.toString(),
    ownerId: doc.owner?.toString?.() ?? null,
    name: doc.name ?? null,
    description: doc.description ?? null,
    visibility: doc.visibility ?? 'private',
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
  if (typeof cardCount === 'number') {
    result.cardCount = cardCount;
  }
  return result;
}

const toOwnerId = (owner) =>
  owner && owner._id ? owner._id.toString() : null;

const toOwnerName = (owner) => (owner && owner.name ? owner.name : null);

const toOwnerAvatar = (owner) =>
  owner && owner.avatar ? owner.avatar : null;

// Enriched deck row from the discovery/saved aggregation (owner is the populated
// user subdoc; cardCount/subscriberCount are computed counts).
export function toExploreDeckDTO(doc, { isSubscribed, isOwner } = {}) {
  if (!doc) return null;
  const owner = doc.owner ?? null;
  return {
    id: doc._id.toString(),
    name: doc.name ?? null,
    description: doc.description ?? null,
    ownerId: toOwnerId(owner),
    ownerName: toOwnerName(owner),
    ownerAvatar: toOwnerAvatar(owner),
    visibility: doc.visibility ?? 'private',
    cardCount: doc.cardCount ?? 0,
    subscriberCount: doc.subscriberCount ?? 0,
    createdAt: toIso(doc.createdAt),
    isSubscribed: !!isSubscribed,
    isOwner: !!isOwner,
  };
}

export function toSavedDeckDTO(doc, { subscribedAt } = {}) {
  const base = toExploreDeckDTO(doc, { isSubscribed: true, isOwner: false });
  if (!base) return null;
  return { ...base, subscribedAt: toIso(subscribedAt) };
}
