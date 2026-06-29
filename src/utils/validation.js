import mongoose from 'mongoose';
import { DomainError } from './http/httpError.js';
import { httpStatus } from './http/httpStatus.js';

export const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

export const assertObjectId = (value, label) => {
  if (isValidObjectId(value)) return;
  throw new DomainError(`Invalid ${label}`, httpStatus.BAD_REQUEST);
};

export const assertAuth = (authUser) => {
  if (authUser && authUser.id) return;
  throw new DomainError('Unauthorized', httpStatus.UNAUTHORIZED);
};

export const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
