const toIso = (value) => (value instanceof Date ? value.toISOString() : null);

const toCardSide = (side) => {
  if (!side) return null;
  return {
    text: side.text ?? null,
    description: side.description ?? null,
    imageUrl: side.imageUrl ?? null,
  };
};

export function toCardDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    authorId: doc.author?.toString?.() ?? null,
    front: toCardSide(doc.front),
    back: toCardSide(doc.back),
    createdAt: toIso(doc.createdAt),
  };
}

/**
 * A card as it appears inside a deck: the card content plus the
 * deck-specific context (tags, when it was added).
 */
export function toDeckCardEntry({ card, deckCard }) {
  const base = toCardDTO(card);
  if (!base) return null;
  return {
    ...base,
    tags: deckCard?.tags ?? [],
    addedAt: toIso(deckCard?.addedAt),
  };
}
