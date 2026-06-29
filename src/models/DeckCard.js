import mongoose from 'mongoose';

const deckCardSchema = new mongoose.Schema(
  {
    deck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
    },
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: { createdAt: 'addedAt', updatedAt: false } }
);

deckCardSchema.index({ deck: 1 });
deckCardSchema.index({ card: 1 });
deckCardSchema.index({ deck: 1, card: 1 }, { unique: true });
deckCardSchema.index({ deck: 1, tags: 1 });

export const DeckCard = mongoose.model('DeckCard', deckCardSchema);
