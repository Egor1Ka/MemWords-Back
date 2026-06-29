import mongoose from 'mongoose';

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
    },
    easeFactor: {
      type: Number,
      required: true,
      default: DEFAULT_EASE_FACTOR,
      min: MIN_EASE_FACTOR,
    },
    interval: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    repetitions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastReviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: false }
);

reviewSchema.index({ user: 1, dueDate: 1 });
reviewSchema.index({ user: 1, card: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
