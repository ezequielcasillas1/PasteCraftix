/** Local unsubscribe: clear chrome.storage and reset in-memory state. */

export function showUnsubscribeConfirmation(app) {
  if (confirm('Are you sure you want to unsubscribe from PasteCraft?\n\nThis will:\n- Delete all your clips\n- Remove all categories\n- Clear your profile data\n- This action cannot be undone.')) {
    if (confirm('FINAL WARNING: This will permanently delete ALL your data. Continue?')) {
      handleUnsubscribe(app);
    }
  }
}

export async function handleUnsubscribe(app) {
  try {
    app.showToast('Deleting all data…', 'info');

    await chrome.storage.local.clear();

    app.clips = [];
    app.searchOnlyClips = [];
    app.categories = [];
    app.userProfile = null;

    app.renderChips();
    app.renderCategories();
    app.updateCategoryFilter();
    app.updateManualInputCategories();
    app.hideProfileModal();

    app.showToast('All data deleted. You have been unsubscribed.', 'success');

    console.log('User unsubscribed - all local data cleared');
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    app.showToast('Failed to unsubscribe', 'error');
  }
}
