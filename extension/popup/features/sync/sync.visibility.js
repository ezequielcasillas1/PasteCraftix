/**
 * Refreshes popup UI when the extension panel becomes visible again.
 */

export function setupVisibilityListener(app) {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;

    await app.loadData();
    await app.loadUserProfile();
    app.renderChips();
    app.updateLastCapture();
    app.updatePreview();
    app.renderCategories();
    app.updateCategoryFilter();
    app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
  });
}
