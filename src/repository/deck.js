import mongoose from 'mongoose';
import { Deck } from '../models/Deck.js';

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

export function create(data) {
  return Deck.create(data);
}

export async function findById(id) {
  return Deck.findById(id).lean().exec();
}

export async function listByOwner(ownerId) {
  return Deck.find({ owner: toObjectId(ownerId) })
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
    .exec();
}

export async function updateById(id, patch) {
  return Deck.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  })
    .lean()
    .exec();
}

export async function deleteById(id) {
  const result = await Deck.deleteOne({ _id: toObjectId(id) }).exec();
  return result.deletedCount > 0;
}
