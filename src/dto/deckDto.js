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
