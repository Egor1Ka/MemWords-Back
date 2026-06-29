const toIso = (value) => (value instanceof Date ? value.toISOString() : null);

/** The deck<->card link itself (returned after linking or editing tags). */
export function toDeckCardDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    deckId: doc.deck?.toString?.() ?? null,
    cardId: doc.card?.toString?.() ?? null,
    tags: doc.tags ?? [],
    addedAt: toIso(doc.addedAt),
  };
}
