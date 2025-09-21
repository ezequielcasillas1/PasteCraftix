document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load preferences and latest captures
        const { captures = [], preferences = {} } = await chrome.storage.local.get(['captures', 'preferences']);
        
        // UI Elements
        const chipArea = document.getElementById('chipArea');
        const preview = document.getElementById('preview');
        const copyButton = document.getElementById('copyButton