/**
 * Background → popup message routing (clipSaved, showCategoryModal).
 */
export async function handlePopupMessage(message) {
  const popup = window.pasteCraftPopup;
  if (!popup) return;

  if (message.action === 'showCategoryModal' && message.text) {
    popup.pendingText = message.text;
    popup.showCategoryModal(false);
  } else if (message.action === 'clipsUpdated') {
    setTimeout(() => {
      Promise.resolve()
        .then(() => popup.loadData())
        .then(() => {
          if (popup.currentTab === 'clips') {
            popup.renderChips();
            popup.updateLastCapture();
            popup.updatePreview();
          } else if (popup.currentTab === 'search') {
            popup.renderSearchResults();
          } else if (popup.currentTab === 'categories') {
            popup.renderCategories();
          }
          popup.renderCategories();
          popup.updateCategoryFilter();
          popup.updateManualInputCategories();
        })
        .catch(() => {});
    }, 120);
  } else if (message.action === 'clipSaved') {
    const incoming = message.clip && typeof message.clip === 'object' ? message.clip : null;
    if (incoming && incoming.id != null) {
      const idKey = popup._clipIdKey(incoming.id);
      const exists = popup.clips && popup.clips.some(c => popup._clipIdKey(c?.id) === idKey);
      if (!exists) {
        popup.clips.unshift(incoming);
        popup.currentPage = 0;
      }
    }

    if (popup.currentTab === 'clips') {
      popup.renderChips();
      popup.updateLastCapture();
      popup.updatePreview();
    }
    popup.renderCategories();
    popup.updateCategoryFilter();
    popup.updateManualInputCategories();

    setTimeout(() => {
      Promise.resolve()
        .then(async () => {
          if (popup._idbReady && popup.idb) {
            const stored = await chrome.storage.local.get(['clips']);
            const clips = Array.isArray(stored?.clips) ? stored.clips : [];
            await popup.idb.syncEntityFromLocalStorage('clips', clips);
          }
        })
        .then(() => popup.loadData())
        .then(() => {
          if (popup.currentTab === 'clips') {
            popup.renderChips();
            popup.updateLastCapture();
            popup.updatePreview();
          } else if (popup.currentTab === 'search') {
            popup.renderSearchResults();
          } else if (popup.currentTab === 'categories') {
            popup.renderCategories();
          }
        })
        .catch(() => {});
    }, 120);
  }
}
