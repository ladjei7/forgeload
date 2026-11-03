export type Tier = 'free' | 'pro';

/** Anything other than an exact 'pro' is free. A missing function, network error, or odd value never grants Pro. */
export const normalizeTier = (v: unknown): Tier => (v === 'pro' ? 'pro' : 'free');
