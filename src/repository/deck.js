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

// ── Discovery / saved-deck aggregation ──────────────────────────────────────

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Count related docs without pulling them into memory: a lookup sub-pipeline
// that matches by foreign key and $count-s, then defaults to 0 when empty.
const countLookupStage = (from, foreignField, asField) => ({
  $lookup: {
    from,
    let: { deckId: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: [`$${foreignField}`, '$$deckId'] } } },
      { $count: 'n' },
    ],
    as: asField,
  },
});

const META_STAGES = [
  countLookupStage('deckcards', 'deck', 'cardCountArr'),
  countLookupStage('decksubscriptions', 'deck', 'subscriberCountArr'),
  {
    $lookup: {
      from: 'users',
      localField: 'owner',
      foreignField: '_id',
      as: 'ownerArr',
    },
  },
  {
    $addFields: {
      cardCount: { $ifNull: [{ $arrayElemAt: ['$cardCountArr.n', 0] }, 0] },
      subscriberCount: {
        $ifNull: [{ $arrayElemAt: ['$subscriberCountArr.n', 0] }, 0],
      },
      owner: { $arrayElemAt: ['$ownerArr', 0] },
    },
  },
  {
    $project: {
      cardCountArr: 0,
      subscriberCountArr: 0,
      ownerArr: 0,
      'owner.email': 0,
    },
  },
];

const SORT_STAGES = {
  new: { createdAt: -1, _id: -1 },
  name: { name: 1, _id: 1 },
  popular: { subscriberCount: -1, createdAt: -1, _id: -1 },
};

const buildPublicMatch = (q) => {
  const match = { visibility: 'public' };
  if (typeof q !== 'string' || q.trim().length === 0) return match;
  const regex = new RegExp(escapeRegExp(q.trim()), 'i');
  return { ...match, $or: [{ name: regex }, { description: regex }] };
};

export async function searchPublic({ q, sort, skip, limit }) {
  const match = buildPublicMatch(q);
  const sortStage = SORT_STAGES[sort] ?? SORT_STAGES.new;
  const pipeline = [
    { $match: match },
    ...META_STAGES,
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit },
  ];
  return Deck.aggregate(pipeline).exec();
}

export async function countPublic({ q }) {
  return Deck.countDocuments(buildPublicMatch(q)).exec();
}

// Saved decks: same enriched shape, restricted to a set of ids and to decks the
// user can still access (a deck turned private after subscribing is hidden).
export async function findAccessibleMetaByIds(deckIds) {
  if (deckIds.length === 0) return [];
  const pipeline = [
    {
      $match: {
        _id: { $in: deckIds.map(toObjectId) },
        visibility: { $ne: 'private' },
      },
    },
    ...META_STAGES,
  ];
  return Deck.aggregate(pipeline).exec();
}
