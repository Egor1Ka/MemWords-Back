import { Router } from 'express';
import * as deckController from '../../controllers/deckController.js';
import * as cardController from '../../controllers/cardController.js';
import * as reviewController from '../../controllers/reviewController.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

const router = Router();

// Decks
router.post('/', requireAuth, deckController.create);
router.get('/', requireAuth, deckController.list);
router.get('/:deckId', optionalAuth, deckController.getById);
router.patch('/:deckId', requireAuth, deckController.update);
router.delete('/:deckId', requireAuth, deckController.remove);

// Cards inside a deck
router.get('/:deckId/cards', optionalAuth, cardController.listByDeck);
router.post('/:deckId/cards', requireAuth, cardController.addToDeck);
router.post('/:deckId/cards/:cardId', requireAuth, cardController.addExistingToDeck);
router.patch('/:deckId/cards/:cardId/tags', requireAuth, cardController.updateTags);
router.delete('/:deckId/cards/:cardId', requireAuth, cardController.removeFromDeck);

// Studying a deck
router.get('/:deckId/study/due', requireAuth, reviewController.listDue);
router.get('/:deckId/study/new', requireAuth, reviewController.listNew);

export default router;
