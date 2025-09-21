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

// Force create context menus on startup
async function createContextMenus() {
    console.log('🔧 PasteCraft: Force creating context menus');
    
    // Clear existing menus first
    chrome.contextMenus.removeAll(() => {
        console.log('🧹 Cleared existing context menus');
        
        // Create save menu
        chrome.contextMenus.create({
            id: 'pastecraft-save',
            title: '💎 Save to PasteCraft',
            contexts: ['selection']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ Save menu failed:', chrome.runtime.lastError);
            } else {
                console.log('✅ Save menu created');
            }
        });
        
        // Create paste menu
        chrome.contextMenus.create({
            id: 'pastecraft-paste-menu',
            title: '📋 PasteCraft Clips',
            contexts: ['editable']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ Paste menu failed:', chrome.runtime.lastError);
            } else {
                console.log('✅ Paste menu created');
            }
        });
    });
}

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 PasteCraft: onInstalled triggered');
    createContextMenus();
});

// Also create on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('🚀 PasteCraft: onStartup triggered');
    createContextMenus();
});

// Force create immediately when script loads
console.log('🚀 PasteCraft: Background script loaded');
createContextMenus();

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'pastecraft-save' && info.selectionText) {
        await saveTextCapture(info.selectionText, tab);
    } else if (info.menuItemId.startsWith('paste-')) {
        const captureIndex = parseInt(info.menuItemId.replace('paste-', ''));
        await pasteCapture(captureIndex, tab);
    }
});

// Update context menu with recent captures
async function updateContextMenu() {
    const { captures = [] } = await chrome.storage.local.get(['captures']);
    
    // Remove old paste items
    chrome.contextMenus.removeAll(() => {
        // Recreate base menu
        chrome.contextMenus.create({
            id: 'pastecraft-save',
            title: 'Save to PasteCraft',
            contexts: ['selection']
        });
        
        chrome.contextMenus.create({
            id: 'pastecraft-paste-menu',
            title: 'PasteCraft Clips',
            contexts: ['editable']
        });
        
        chrome.contextMenus.create({
            id: 'pastecraft-separator',
            type: 'separator',
            contexts: ['editable']
        });
        
        // Add recent captures (max 5)
        captures.slice(0, 5).forEach((capture, index) => {
            const preview = capture.text.substring(0, 30) + (capture.text.length > 30 ? '...' : '');
            chrome.contextMenus.create({
                id: `paste-${index}`,
                title: preview,
                contexts: ['editable'],
                parentId: 'pastecraft-paste-menu'
            });
        });
        
        if (captures.length === 0) {
            chrome.contextMenus.create({
                id: 'no-clips',
                title: 'No clips saved yet',
                contexts: ['editable'],
                enabled: false,
                parentId: 'pastecraft-paste-menu'
            });
        }
    });
}

async function saveTextCapture(text, tab) {
    const timestamp = new Date().toISOString();
    const capture = {
        text: text.trim(),
        timestamp,
        url: tab.url,
        title: tab.title
    };

    const { captures = [], preferences = {} } = await chrome.storage.local.get(['captures', 'preferences']);
    captures.unshift(capture);
    
    const maxHistory = preferences.historySize || 500;
    if (captures.length > maxHistory) {
        captures.length = maxHistory;
    }
    
        await chrome.storage.local.set({ captures });
        await updateContextMenu();
        
        // Show onboarding on first capture if not completed
        const { preferences = {} } = await chrome.storage.local.get(['preferences']);
        if (!preferences.onboardingComplete && captures.length === 1) {
            chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
        }
    
    await showNotification(
        'Text Saved!', 
        `Saved "${text.substring(0, 50)}..." to PasteCraft`
    );
}

async function pasteCapture(index, tab) {
    const { captures = [] } = await chrome.storage.local.get(['captures']);
    const capture = captures[index];
    
    if (!capture) return;
    
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: (text) => {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                        const start = activeElement.selectionStart;
                        const end = activeElement.selectionEnd;
                        activeElement.value = activeElement.value.substring(0, start) + text + activeElement.value.substring(end);
                        activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
                    } else {
                        document.execCommand('insertText', false, text);
                    }
                    activeElement.focus();
                }
            },
            args: [capture.text]
        });
        
        await showNotification('Pasted!', `Inserted "${capture.text.substring(0, 30)}..."`);
    } catch (error) {
        console.error('Paste failed:', error);
    }
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
            await updateContextMenu();
            
            // Show onboarding on first capture if not completed
            const { preferences: prefs = {} } = await chrome.storage.local.get(['preferences']);
            if (!prefs.onboardingComplete && captures.length === 1) {
                chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
                return; // Don't show notification during onboarding
            }
            
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