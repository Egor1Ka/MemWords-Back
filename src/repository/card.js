import mongoose from 'mongoose';
import { Card } from '../models/Card.js';

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

export function create(data) {
  return Card.create(data);
}

export async function findById(id) {
  return Card.findById(id).lean().exec();
}

export async function findByIds(ids) {
  const objectIds = ids.map(toObjectId);
  return Card.find({ _id: { $in: objectIds } })
    .lean()
    .exec();
}

export async function updateById(id, patch) {
  return Card.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  })
    .lean()
    .exec();
}

export async function deleteById(id) {
  const result = await Card.deleteOne({ _id: toObjectId(id) }).exec();
  return result.deletedCount > 0;
}
