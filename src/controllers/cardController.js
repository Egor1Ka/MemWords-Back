import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as cardService from '../services/cardService.js';
import { uploadAsset, ASSET_TYPES } from '../modules/media/index.js';

/**
 * POST /cards/images (multipart/form-data, field: "file")
 * Uploads a card image to the media service and returns its public URL.
 */
export async function uploadImage(req, res) {
  try {
    if (!req.file) {
      res
        .status(400)
        .json({ error: 'file is required (multipart field "file")' });
      return;
    }
    const { url } = await uploadAsset({
      assetType: ASSET_TYPES.CARD_IMAGE,
      ownerId: req.user.id,
      file: req.file,
    });
    created(res, { url });
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function addToDeck(req, res) {
  try {
    const result = await cardService.addCardToDeck(
      req.user,
      req.params?.deckId,
      req.body ?? {}
    );
    created(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function addExistingToDeck(req, res) {
  try {
    const result = await cardService.addExistingCardToDeck(
      req.user,
      req.params?.deckId,
      req.params?.cardId,
      req.body ?? {}
    );
    created(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function listByDeck(req, res) {
  try {
    const result = await cardService.getDeckCards(
      req.user,
      req.params?.deckId,
      req.query ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function getById(req, res) {
  try {
    const result = await cardService.getCard(req.user, req.params?.cardId);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function update(req, res) {
  try {
    const result = await cardService.updateCard(
      req.user,
      req.params?.cardId,
      req.body ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function updateTags(req, res) {
  try {
    const result = await cardService.updateCardTags(
      req.user,
      req.params?.deckId,
      req.params?.cardId,
      req.body ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function removeFromDeck(req, res) {
  try {
    const result = await cardService.removeCardFromDeck(
      req.user,
      req.params?.deckId,
      req.params?.cardId
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function remove(req, res) {
  try {
    const result = await cardService.deleteCard(req.user, req.params?.cardId);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
