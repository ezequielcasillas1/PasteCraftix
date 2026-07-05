import { etsyAdapter } from './etsy.adapter.js';
import { redbubbleAdapter } from './redbubble.adapter.js';
import { teepublicAdapter } from './teepublic.adapter.js';
import { printifyAdapter } from './printify.adapter.js';
import { genericAdapter } from './generic.adapter.js';

const ADAPTERS = [
  etsyAdapter,
  redbubbleAdapter,
  teepublicAdapter,
  printifyAdapter,
  genericAdapter,
];

export function resolveMerchantAdapter(ctx = {}) {
  for (const adapter of ADAPTERS) {
    if (adapter.canHandle(ctx)) return adapter;
  }
  return genericAdapter;
}

export { ADAPTERS, genericAdapter };
