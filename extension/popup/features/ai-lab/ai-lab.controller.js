import * as credits from './ai-lab.credits.js';
import * as summary from './ai-lab.summary.js';
import * as history from './ai-lab.history.js';
import * as magic from './ai-lab.magic.js';
import * as bulk from './ai-lab.bulk.js';
import * as sessionState from './ai-lab.session-state.js';
import * as breakdown from './ai-lab.breakdown.js';
import * as summaryModal from './ai-lab.summary-modal.js';
import * as analysisHistory from './ai-lab.analysis-history.js';

export function initAiLabFeature(_app) {
  return {
    credits,
    summary,
    history,
    magic,
    bulk,
    sessionState,
    breakdown,
    summaryModal,
    analysisHistory,
  };
}
