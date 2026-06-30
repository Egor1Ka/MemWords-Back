import mongoose from 'mongoose';
import { DeckSubscription } from '../models/DeckSubscription.js';

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

const toObjectIds = (values) => values.map(toObjectId);

const toIdString = (id) => id.toString();

export async function create({ userId, deckId }) {
  try {
    const doc = await DeckSubscription.create({
      user: toObjectId(userId),
      deck: toObjectId(deckId),
    });
    return { doc, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await findOne({ userId, deckId });
      return { doc: existing, created: false };
    }
    throw error;
  }
}

export async function findOne({ userId, deckId }) {
  return DeckSubscription.findOne({
    user: toObjectId(userId),
    deck: toObjectId(deckId),
  })
    .lean()
    .exec();
}

export async function exists({ userId, deckId }) {
  const found = await findOne({ userId, deckId });
  return found !== null;
}

export async function deleteOne({ userId, deckId }) {
  const result = await DeckSubscription.deleteOne({
    user: toObjectId(userId),
    deck: toObjectId(deckId),
  }).exec();
  return result.deletedCount > 0;
}

export async function listByUser(userId) {
  return DeckSubscription.find({ user: toObjectId(userId) })
    .sort({ createdAt: -1, _id: -1 })
    .lean()
    .exec();
}

export async function findSubscribedDeckIds({ userId, deckIds }) {
  const ids = await DeckSubscription.find({
    user: toObjectId(userId),
    deck: { $in: toObjectIds(deckIds) },
  })
    .distinct('deck')
    .exec();
  return ids.map(toIdString);
}

export async function deleteManyByDeck(deckId) {
  const result = await DeckSubscription.deleteMany({
    deck: toObjectId(deckId),
  }).exec();
  return result.deletedCount;
}
