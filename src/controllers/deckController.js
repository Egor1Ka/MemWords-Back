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

export async function explore(req, res) {
  try {
    const result = await deckService.exploreDecks(req.user, req.query ?? {});
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function listSaved(req, res) {
  try {
    const result = await deckService.listSavedDecks(req.user);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function subscribe(req, res) {
  try {
    const result = await deckService.subscribeToDeck(req.user, req.params?.deckId);
    created(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function unsubscribe(req, res) {
  try {
    const result = await deckService.unsubscribeFromDeck(
      req.user,
      req.params?.deckId
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
