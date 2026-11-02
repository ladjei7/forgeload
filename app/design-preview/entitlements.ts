// Entitlements for the prototype. In the real app the tier comes from the server (see docs/design/free-vs-pro.md); the client only reads it to draw the UI.
// Rule: Pro gates premium ANALYSIS and RECOMMENDATIONS. It never gates ownership of data, logging, exercise choice, or safety information.
export type Tier = 'free' | 'pro';
export type Feature =
  // Always free. Listed so a test can prove they stay free.
  | 'log' | 'history' | 'export' | 'delete-account' | 'substitute' | 'custom-exercise' | 'comfort-prefs' | 'preferred-exercises' | 'starter-plan' | 'targets' | 'basic-suggestions'
  // Pro (premium intelligence).
  | 'behavior-recommendations' | 'plateau-analysis' | 'volume-adjustment' | 'deload' | 'trend-analytics' | 'progression-custom' | 'multi-program';

export const FEATURE_TIER: Record<Feature, Tier> = {
  log: 'free', history: 'free', export: 'free', 'delete-account': 'free', substitute: 'free', 'custom-exercise': 'free', 'comfort-prefs': 'free', 'preferred-exercises': 'free',
  'starter-plan': 'free', targets: 'free', 'basic-suggestions': 'free',
  'behavior-recommendations': 'pro', 'plateau-analysis': 'pro', 'volume-adjustment': 'pro', deload: 'pro', 'trend-analytics': 'pro', 'progression-custom': 'pro', 'multi-program': 'pro',
};
/** Built in the prototype vs only designed. Shown in docs and Proto tools so nobody mistakes a plan for a product. */
export const STATUS: Partial<Record<Feature, 'prototype' | 'planned'>> = {
  'basic-suggestions': 'prototype', 'plateau-analysis': 'prototype', 'volume-adjustment': 'prototype',
  'behavior-recommendations': 'planned', deload: 'planned', 'trend-analytics': 'planned', 'progression-custom': 'planned', 'multi-program': 'planned',
};
export const can = (tier: Tier, f: Feature) => FEATURE_TIER[f] === 'free' || tier === 'pro';
