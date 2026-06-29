import mongoose from 'mongoose';
import { DeckCard } from '../models/DeckCard.js';

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

const buildDeckFilter = ({ deckId, tag }) => {
  const filter = { deck: toObjectId(deckId) };
  if (typeof tag === 'string' && tag.length > 0) {
    filter.tags = tag;
  }
  return filter;
};

export function create(data) {
  return DeckCard.create(data);
}

export async function createIfMissing({ deckId, cardId, tags = [] }) {
  try {
    const doc = await DeckCard.create({
      deck: toObjectId(deckId),
      card: toObjectId(cardId),
      tags,
    });
    return { doc, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await findOne({ deckId, cardId });
      return { doc: existing, created: false };
    }
    throw error;
  }
}

export async function findOne({ deckId, cardId }) {
  return DeckCard.findOne({
    deck: toObjectId(deckId),
    card: toObjectId(cardId),
  })
    .lean()
    .exec();
}

export async function listByDeck({ deckId, tag, limit }) {
  const filter = buildDeckFilter({ deckId, tag });
  const baseQuery = DeckCard.find(filter).sort({ addedAt: 1, _id: 1 });
  const query = typeof limit === 'number' ? baseQuery.limit(limit) : baseQuery;
  return query.lean().exec();
}

export async function listByCard(cardId) {
  return DeckCard.find({ card: toObjectId(cardId) })
    .sort({ addedAt: 1, _id: 1 })
    .lean()
    .exec();
}

export async function countByDeck(deckId) {
  return DeckCard.countDocuments({ deck: toObjectId(deckId) }).exec();
}

export async function updateTags({ deckId, cardId, tags }) {
  return DeckCard.findOneAndUpdate(
    { deck: toObjectId(deckId), card: toObjectId(cardId) },
    { tags },
    { new: true, runValidators: true }
  )
    .lean()
    .exec();
}

export async function deleteOne({ deckId, cardId }) {
  const result = await DeckCard.deleteOne({
    deck: toObjectId(deckId),
    card: toObjectId(cardId),
  }).exec();
  return result.deletedCount > 0;
}

export async function deleteManyByDeck(deckId) {
  const result = await DeckCard.deleteMany({ deck: toObjectId(deckId) }).exec();
  return result.deletedCount;
}

export async function deleteManyByCard(cardId) {
  const result = await DeckCard.deleteMany({ card: toObjectId(cardId) }).exec();
  return result.deletedCount;
}
