import mongoose from 'mongoose';
import { Review } from '../models/Review.js';

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

const toObjectIds = (values) => values.map(toObjectId);

export async function findOne({ userId, cardId }) {
  return Review.findOne({
    user: toObjectId(userId),
    card: toObjectId(cardId),
  })
    .lean()
    .exec();
}

export async function startIfMissing({ userId, cardId, progress }) {
  try {
    const doc = await Review.create({
      user: toObjectId(userId),
      card: toObjectId(cardId),
      ...progress,
    });
    return { doc, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await findOne({ userId, cardId });
      return { doc: existing, created: false };
    }
    throw error;
  }
}

export async function saveProgress({ userId, cardId, progress }) {
  return Review.findOneAndUpdate(
    { user: toObjectId(userId), card: toObjectId(cardId) },
    { $set: progress },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  )
    .lean()
    .exec();
}

export async function listDueByUserAndCards({ userId, cardIds, now, limit }) {
  const filter = {
    user: toObjectId(userId),
    card: { $in: toObjectIds(cardIds) },
    dueDate: { $lte: now },
  };
  const baseQuery = Review.find(filter).sort({ dueDate: 1, _id: 1 });
  const query = typeof limit === 'number' ? baseQuery.limit(limit) : baseQuery;
  return query.lean().exec();
}

export async function findReviewedCardIds({ userId, cardIds }) {
  const ids = await Review.find({
    user: toObjectId(userId),
    card: { $in: toObjectIds(cardIds) },
  })
    .distinct('card')
    .exec();
  return ids.map((id) => id.toString());
}

export async function deleteOne({ userId, cardId }) {
  const result = await Review.deleteOne({
    user: toObjectId(userId),
    card: toObjectId(cardId),
  }).exec();
  return result.deletedCount > 0;
}

export async function deleteManyByCard(cardId) {
  const result = await Review.deleteMany({ card: toObjectId(cardId) }).exec();
  return result.deletedCount;
}
