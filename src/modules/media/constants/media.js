/**
 * Типы ассетов, которые умеем загружать.
 * Используется для выбора папки в провайдере и резолва лимитов.
 */
export const ASSET_TYPES = Object.freeze({
  USER_AVATAR: 'user-avatar',
  PLAYGROUND_PHOTO: 'playground-photo',
  CARD_IMAGE: 'card-image',
});

const ALLOWED_MIMES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const AVATAR_LIMITS = Object.freeze({
  maxBytes: 2 * 1024 * 1024,
  mimes: ALLOWED_MIMES,
});

const LARGE_IMAGE_LIMITS = Object.freeze({
  maxBytes: 15 * 1024 * 1024,
  mimes: ALLOWED_MIMES,
});

const CARD_IMAGE_LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  mimes: ALLOWED_MIMES,
});

export const ASSET_LIMITS = Object.freeze({
  [ASSET_TYPES.USER_AVATAR]: AVATAR_LIMITS,
  [ASSET_TYPES.PLAYGROUND_PHOTO]: LARGE_IMAGE_LIMITS,
  [ASSET_TYPES.CARD_IMAGE]: CARD_IMAGE_LIMITS,
});

export const getAssetLimits = (assetType) => {
  const limits = ASSET_LIMITS[assetType];
  if (!limits) {
    throw new Error(`Unknown assetType: ${assetType}`);
  }
  return limits;
};
