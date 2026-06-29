import { Router } from 'express';
import * as cardController from '../../controllers/cardController.js';
import * as reviewController from '../../controllers/reviewController.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import {
  uploadFor,
  handleUploadError,
  ASSET_TYPES,
} from '../../modules/media/index.js';

const router = Router();
const uploadCardImage = uploadFor(ASSET_TYPES.CARD_IMAGE);

// Image upload (shared by card forms) — must come before "/:cardId"
router.post(
  '/images',
  requireAuth,
  uploadCardImage.single('file'),
  handleUploadError,
  cardController.uploadImage,
);

// Card content (shared across decks)
router.get('/:cardId', optionalAuth, cardController.getById);
router.patch('/:cardId', requireAuth, cardController.update);
router.delete('/:cardId', requireAuth, cardController.remove);

// Per-user study progress for a card (SM-2)
router.post('/:cardId/review/start', requireAuth, reviewController.start);
router.post('/:cardId/review', requireAuth, reviewController.answer);
router.delete('/:cardId/review', requireAuth, reviewController.reset);

export default router;
