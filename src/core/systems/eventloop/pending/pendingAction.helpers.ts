import type { PendingAction } from './pendingAction.types';

export function isPendingActionExpired(pending: PendingAction): boolean {
  return Date.now() > pending.expiresAt;
}

const CANCEL_WORDS = ['stop', 'anuluj', 'cancel', 'przerwij', 'niewazne', 'nieważne'];

export function isCancelCommand(input: string): boolean {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return CANCEL_WORDS.includes(normalized);
}
