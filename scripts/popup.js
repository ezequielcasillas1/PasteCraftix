document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load preferences and latest captures
        const { captures = [], preferences = {} } = await chrome.storage.local.get(['captures', 'preferences']);
        
        // UI Elements
        const chipArea = document.getElementById('chipArea');
        const preview = document.getElementById('preview');
        const copyButton = document.getElementById('copyButton');
        const formatBtns = document.querySelectorAll('.format-btn');
        const deduplicateToggle = document.getElementById('deduplicate');
        const sortToggle = document.getElementById('sort');
        const caseToggle = document.getElementById('case');
        
        // State
        let selectedCaptures = new Set();
        let currentDelimiter = 'comma';
        
        // Initialize UI
        updateLastCapture(captures[0]);
        renderCaptures(captures);
        setupEventListeners();
        
        function updateLastCapture(lastCapture) {
            const lastCaptureElement = document.querySelector('.last-capture');
            if (lastCapture) {
                const timeAgo = getTimeAgo(lastCapture.timestamp);
                lastCaptureElement.textContent = `Last: ${timeAgo}`;
            } else {
                lastCaptureElement.textContent = 'No recent captures';
            }
        }
        
        function getTimeAgo(timestamp) {
            const now = new Date();
            const captureTime = new Date(timestamp);
            const diffMs = now - captureTime;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays}d ago`;
        }
        
        function renderCaptures(captures) {
            if (captures.length === 0) {
                chipArea.innerHTML = '<div class="empty-state"><p>No captures yet. Select text and press Alt+Shift+C</p></div>';
                return;
            }
            
            chipArea.innerHTML = '';
            captures.forEach((capture, index) => {
                const chip = document.createElement('div');
                chip.className = 'capture-chip';
                chip.textContent = capture.text.substring(0, 50) + (capture.text.length > 50 ? '...' : '');
                chip.title = capture.text;
                chip.dataset.index = index;
                
                chip.addEventListener('click', () => toggleCapture(index, chip));
                chipArea.appendChild(chip);
            });
        }
        
        function toggleCapture(index, chipElement) {
            if (selectedCaptures.has(index)) {
                selectedCaptures.delete(index);
                chipElement.classList.remove('selected');
            } else {
                selectedCaptures.add(index);
                chipElement.classList.add('selected');
            }
            updatePreview();
        }
        
        function updatePreview() {
            const selectedTexts = Array.from(selectedCaptures)
                .map(index => captures[index]?.text)
                .filter(Boolean);
            
            if (selectedTexts.length === 0) {
                preview.value = '';
                return;
            }
            
            let processedTexts = [...selectedTexts];
            
            // Apply transformations
            if (deduplicateToggle?.checked) {
                processedTexts = [...new Set(processedTexts)];
            }
            
            if (sortToggle?.checked) {
                processedTexts.sort();
            }
            
            if (caseToggle?.checked) {
                processedTexts = processedTexts.map(t => t.toUpperCase());
            }
            
            // Apply delimiter
            const delimiters = {
                comma: ', ',
                newline: '\n',
                space: ' ',
                custom: ' | '
            };
            
            const output = processedTexts.join(delimiters[currentDelimiter] || ', ');
            preview.value = output;
        }
        
        function setupEventListeners() {
            // Format buttons
            formatBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    formatBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentDelimiter = btn.textContent.toLowerCase();
                    updatePreview();
                });
            });
            
            // Toggle controls
            [deduplicateToggle, sortToggle, caseToggle].forEach(toggle => {
                toggle?.addEventListener('change', updatePreview);
            });
            
            // Copy button
            copyButton?.addEventListener('click', async () => {
                if (!preview.value) return;
                
                try {
                    await navigator.clipboard.writeText(preview.value);
                    copyButton.textContent = 'Copied!';
                    copyButton.classList.add('success');
                    
                    setTimeout(() => {
                        copyButton.textContent = 'Copy Crafted Output';
                        copyButton.classList.remove('success');
                    }, 2000);
                } catch (error) {
                    console.error('Copy failed:', error);
                    copyButton.textContent = 'Copy Failed';
                    copyButton.classList.add('error');
                    
                    setTimeout(() => {
                        copyButton.textContent = 'Copy Crafted Output';
                        copyButton.classList.remove('error');
                    }, 2000);
                }
            });
            
            // Magic wand button (auto-format)
            const magicWand = document.querySelector('.magic-wand-btn');
            magicWand?.addEventListener('click', () => {
                // Select all captures
                captures.forEach((_, index) => {
                    selectedCaptures.add(index);
                    const chip = chipArea.children[index];
                    chip?.classList.add('selected');
                });
                
                // Enable all formatting options
                if (deduplicateToggle) deduplicateToggle.checked = true;
                if (sortToggle) sortToggle.checked = true;
                
                // Set comma delimiter
                formatBtns.forEach(btn => {
                    btn.classList.toggle('active', btn.textContent.toLowerCase() === 'comma');
                });
                currentDelimiter = 'comma';
                
                updatePreview();
            });
        }
        
    } catch (error) {
        console.error('Popup initialization failed:', error);
        chipArea.innerHTML = '<div class="error-state"><p>Error loading captures. Please try again.</p></div>';
    }
});