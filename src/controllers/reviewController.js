import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as reviewService from '../services/reviewService.js';

export async function listDue(req, res) {
  try {
    const result = await reviewService.getDueCards(
      req.user,
      req.params?.deckId,
      req.query ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function listNew(req, res) {
  try {
    const result = await reviewService.getNewCards(
      req.user,
      req.params?.deckId,
      req.query ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function start(req, res) {
  try {
    const result = await reviewService.startCard(req.user, req.params?.cardId);
    created(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function answer(req, res) {
  try {
    const result = await reviewService.submitAnswer(
      req.user,
      req.params?.cardId,
      req.body ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function reset(req, res) {
  try {
    const result = await reviewService.resetProgress(req.user, req.params?.cardId);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
