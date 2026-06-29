import mongoose from 'mongoose';

export const DECK_VISIBILITIES = ['private', 'public', 'unlisted'];

const deckSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
    visibility: {
      type: String,
      enum: DECK_VISIBILITIES,
      required: true,
      default: 'private',
    },
  },
  { timestamps: true }
);

deckSchema.index({ owner: 1 });
deckSchema.index({ visibility: 1 });

export const Deck = mongoose.model('Deck', deckSchema);
