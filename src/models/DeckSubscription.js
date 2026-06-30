import mongoose from 'mongoose';

// A subscription is a user saving someone else's public/unlisted deck to their
// own library. We never copy cards; the subscriber studies the original deck and
// keeps their own per-card Review progress. createdAt doubles as "saved at".
const deckSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
    },
  },
  { timestamps: true }
);

deckSubscriptionSchema.index({ user: 1, deck: 1 }, { unique: true });
deckSubscriptionSchema.index({ deck: 1 });
deckSubscriptionSchema.index({ user: 1, createdAt: -1 });

export const DeckSubscription = mongoose.model(
  'DeckSubscription',
  deckSubscriptionSchema
);
