import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as deckService from '../services/deckService.js';

export async function create(req, res) {
  try {
    const result = await deckService.createDeck(req.user, req.body ?? {});
    created(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function list(req, res) {
  try {
    const result = await deckService.listDecks(req.user);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function getById(req, res) {
  try {
    const result = await deckService.getDeck(req.user, req.params?.deckId);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function update(req, res) {
  try {
    const result = await deckService.updateDeck(
      req.user,
      req.params?.deckId,
      req.body ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function remove(req, res) {
  try {
    const result = await deckService.deleteDeck(req.user, req.params?.deckId);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
