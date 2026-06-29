import mongoose from 'mongoose';

const cardSideSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 4000,
    },
    imageUrl: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const cardSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    front: {
      type: cardSideSchema,
      required: true,
    },
    back: {
      type: cardSideSchema,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

cardSchema.index({ author: 1 });

export const Card = mongoose.model('Card', cardSchema);
