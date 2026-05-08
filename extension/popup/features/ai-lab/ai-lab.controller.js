import * as credits from './ai-lab.credits.js';
import * as summary from './ai-lab.summary.js';
import * as history from './ai-lab.history.js';
import * as magic from './ai-lab.magic.js';

export function initAiLabFeature(_app) {
  return {
    credits,
    summary,
    history,
    magic,
  };
}
