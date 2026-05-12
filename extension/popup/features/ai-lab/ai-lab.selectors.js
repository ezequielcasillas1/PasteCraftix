export const AI_SELECTORS = {
  workflowOverrideToggle: 'aiWorkflowOverrideToggle',
  providerSelect: 'aiProviderSelect',
  workflowPresetSelect: 'aiWorkflowPresetSelect',
  imageCreditsPill: 'aiCreditsPill',
  textCreditsPill: 'aiTextCreditsPill',
  textCreditsCosts: 'aiTextCreditsCosts',
  historyList: 'aiHistoryList',
  historyModal: 'aiHistoryModal',
  historyModalTitle: 'aiHistoryModalTitle',
  historyModalSubtitle: 'aiHistoryModalSubtitle',
  historyResultContent: 'aiHistoryResultContent',
  historyThreadPagination: 'aiHistoryThreadPagination',
  historyTitleEditContainer: 'aiHistoryTitleEditContainer',
  historyTitleInput: 'aiHistoryTitleInput',
  editHistoryTitleButton: 'editAiHistoryTitleBtn',
};

export function byId(id) {
  return document.getElementById(id);
}

export function getWorkflowElements() {
  return {
    toggle: byId(AI_SELECTORS.workflowOverrideToggle),
    providerEl: byId(AI_SELECTORS.providerSelect),
    presetEl: byId(AI_SELECTORS.workflowPresetSelect),
  };
}

export function getCreditsElements() {
  return {
    imagePill: byId(AI_SELECTORS.imageCreditsPill),
    textPill: byId(AI_SELECTORS.textCreditsPill),
    textCosts: byId(AI_SELECTORS.textCreditsCosts),
  };
}

export function getHistoryModalElements() {
  return {
    modal: byId(AI_SELECTORS.historyModal),
    titleEl: byId(AI_SELECTORS.historyModalTitle),
    subtitleEl: byId(AI_SELECTORS.historyModalSubtitle),
    resultEl: byId(AI_SELECTORS.historyResultContent),
    paginationEl: byId(AI_SELECTORS.historyThreadPagination),
  };
}
