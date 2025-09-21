// Check and request permissions if needed
async function ensurePermissions() {
    const permissions = {
        permissions: ['scripting', 'notifications']
    };
    
    const hasPermissions = await chrome.permissions.contains(permissions);
    if (!hasPermissions) {
        return chrome.permissions.request(permissions);
    }
    return true;
}

// Show notification
async function showNotification(title, message) {
    await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title,
        message
    });
}

chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'capture-selection') {
        try {
            const hasPermissions = await ensurePermissions();
            if (!hasPermissions) {
                throw new Error('Required permissions not granted');
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                throw new Error('No active tab found');
            }

            // Inject content script to get selection
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => window.getSelection().toString().trim()
            });

            if (!result) {
                throw new Error('No text selected');
            }

            // Store in chrome.storage
            const timestamp = new Date().toISOString();
            const capture = {
                text: result,
                timestamp,
                url: tab.url,
                title: tab.title
            };

            const { captures = [], preferences = {} } = await chrome.storage.local.get(['captures', 'preferences']);
            captures.unshift(capture);
            
            // Respect user's history size preference
            const maxHistory = preferences.historySize || 500;
            if (captures.length > maxHistory) {
                captures.length = maxHistory;
            }
            
            await chrome.storage.local.set({ captures });
            
            // Notify user
            await showNotification(
                'Text Captured!', 
                `Captured ${result.length} characters. Click the extension icon to format.`
            );

        } catch (error) {
            console.error('Capture failed:', error);
            await showNotification(
                'Capture Failed', 
                error.message || 'Failed to capture text. Please try again.'
            );
        }
    }
});