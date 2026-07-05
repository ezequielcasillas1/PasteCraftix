import { safeRuntimeSendMessage } from '../shared.js';
import { injectQuickViewStyles } from './widget.styles.js';

export function openQuickViewPanel(widget) {
    try {
      console.log('👁️ ===== OPENING QUICK VIEW =====');
      console.log('👁️ Opening Quick View (slide-in panel from right)');
      console.log('👁️ Current open states:', widget.openStates);
      
      // Check if panel already exists
      if (document.getElementById('pastecraft-quickview-panel')) {
        console.log('⚠️ Quick View panel already exists');
        return;
      }
      
      console.log('👁️ Creating Quick View panel elements...');
      
      // Set open state
      widget.openStates.quickView = true;
      
      // Slide widget to the left (attached to panel)
      widget.widget.classList.add('panel-open');

      // Push the website content left (docked mode)
      widget.syncPageDocking();
      
      // Add active class to quick view button
      const quickViewButton = widget.widget.querySelector('.quick-view-button');
      if (quickViewButton) {
        quickViewButton.classList.add('active');
      }
      
      // Create backdrop
      const backdrop = document.createElement('div');
      backdrop.id = 'pastecraft-quickview-backdrop';
      backdrop.className = 'pastecraft-quickview-backdrop';
      
      // Create panel
      const panel = document.createElement('div');
      panel.id = 'pastecraft-quickview-panel';
      panel.className = 'pastecraft-quickview-panel';
      
      // Create close button
      const closeButton = document.createElement('button');
      closeButton.className = 'pastecraft-overlay-close';
      closeButton.innerHTML = '×';
      closeButton.setAttribute('aria-label', 'Close');
      
      // Create iframe to load the Quick Paste interface
      const iframe = document.createElement('iframe');
      iframe.className = 'pastecraft-quickview-iframe';
      iframe.setAttribute('allowtransparency', 'true');
      
      // Assemble panel
      panel.appendChild(closeButton);
      panel.appendChild(iframe);
      document.body.appendChild(backdrop);
      document.body.appendChild(panel);
      
      // Add styles
      injectQuickViewStyles();
      
      // Load Quick Paste content into iframe
      loadQuickViewIframeContent(widget, iframe);
      
      // Setup close handlers
      closeButton.addEventListener('click', () => closeQuickViewPanel(widget));
      // Close on outside click (without blocking page interaction) if setting allows
      if (widget._quickViewOutsidePointerDown) {
        document.removeEventListener('pointerdown', widget._quickViewOutsidePointerDown, true);
        widget._quickViewOutsidePointerDown = null;
      }
      if (!widget.settings.keepQuickViewOpen) {
        widget._quickViewOutsidePointerDown = (e) => {
          const currentPanel = document.getElementById('pastecraft-quickview-panel');
          if (!currentPanel) return;
          const target = e.target;
          if (currentPanel.contains(target)) return;
          if (widget.widget && widget.widget.contains(target)) return;
          closeQuickViewPanel(widget);
        };
        document.addEventListener('pointerdown', widget._quickViewOutsidePointerDown, true);
      }
      
      // ESC key to close
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          closeQuickViewPanel(widget);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    
      // Animate in
      setTimeout(() => {
        backdrop.classList.add('visible');
        panel.classList.add('visible');
        // Recompute width once visible (responsive cases)
        widget.syncPageDocking();
      }, 10);
      
      console.log('✅ Quick View panel opened');
    } catch (error) {
      console.error('❌ Error opening Quick View:', error);
      console.error('❌ Error stack:', error.stack);
      alert('Error opening Quick View. Check console for details.');
    }
}

export function loadQuickViewIframeContent(widget, iframe) {
    // srcdoc iframe has opaque ("null") origin — postMessage targetOrigin must be '*'.
    // Sender/receiver validate via e.source identity checks instead of origin.
    const quickViewTargetOrigin = '*';
    // Create a custom HTML content for the Quick View
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .quickview-header {
            background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1d4ed8 100%);
            color: white;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .quickview-title {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .clip-count {
            font-size: 13px;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 10px;
            border-radius: 12px;
            color: rgba(255, 255, 255, 0.9);
          }
          .quickview-controls {
            display: flex;
            gap: 8px;
          }
          .quickview-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 6px;
            padding: 6px 10px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          }
          .quickview-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
          }
          .quickview-btn svg,
          .quickview-btn svg *,
          .quickview-btn span {
            pointer-events: none;
          }
          .quickview-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
          }
          .clip-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }
          .clip-item:hover {
            background: #e0f2fe;
            border-color: #3b82f6;
            transform: translateX(-4px);
          }
          .clip-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .clip-text {
            font-size: 14px;
            color: #1f2937;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.5;
          }
          .clip-meta {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .clip-category {
            font-size: 11px;
            color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 500;
          }
          .clip-actions {
            display: flex;
            gap: 4px;
          }
          .clip-btn {
            background: #3b82f6;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            color: white;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
          }
          .clip-btn:hover {
            background: #2563eb;
          }
          .clip-btn.delete {
            background: #ef4444;
          }
          .clip-btn.delete:hover {
            background: #dc2626;
          }
          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #64748b;
          }
          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .empty-text {
            font-size: 16px;
            margin-bottom: 8px;
          }
          .empty-hint {
            font-size: 14px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="quickview-header">
          <div class="quickview-title">
            <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></span>
            <span>Quick View</span>
            <span class="clip-count" id="clip-count">0 clips</span>
          </div>
          <div class="quickview-controls">
            <button class="quickview-btn" onclick="openMiniWindow()" title="Open mini Quick View (window)" aria-label="Open mini Quick View window"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg></button>
            <button class="quickview-btn" onclick="dockMiniBottomRight()" title="Open mini Quick View (bottom-right)" aria-label="Dock mini Quick View to bottom-right"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 13V19H13"/><path d="M5 5L19 19"/></svg></button>
            <button class="quickview-btn" onclick="refreshClips()" title="Refresh">🔄</button>
            <button class="quickview-btn" onclick="openSettings()" title="Settings">⚙️</button>
          </div>
        </div>
        <div class="quickview-content" id="quickview-content">
          <div class="empty-state">
            <div class="empty-icon">✨</div>
            <div class="empty-text">No clips saved yet</div>
            <div class="empty-hint">Right-click selected text to save clips</div>
          </div>
        </div>
        <script>
          // srcdoc iframe origin is the opaque string "null"; window.location.origin is invalid as targetOrigin.
          function postToParent(msg) {
            try {
              window.parent.postMessage(msg, '*');
            } catch (err) {
              console.warn('[PasteCraft quick view] postMessage failed:', err);
            }
          }

          function loadClips() {
            postToParent({ type: 'quickview-get-clips' });
          }

          function refreshClips() {
            loadClips();
          }

          function openSettings() {
            postToParent({ type: 'quickview-open-settings' });
          }

          function openMiniWindow() {
            postToParent({ type: 'quickview-open-mini', mode: 'window' });
          }

          function dockMiniBottomRight() {
            postToParent({ type: 'quickview-open-mini', mode: 'corner' });
          }

          function isFromExtension(e) {
            return e && e.data && e.source === window.parent;
          }
          
          function copyClip(text, index) {
            // Decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = text;
            const decodedText = textarea.value;
            
            navigator.clipboard.writeText(decodedText).then(() => {
              showToast('✓ Copied to clipboard!');
            }).catch(err => {
              console.error('Copy failed:', err);
              showToast('❌ Copy failed', true);
            });
          }
          
          function deleteClip(clipId, index, archived) {
            if (confirm('Delete this clip?')) {
              postToParent({ type: 'quickview-delete-clip', clipId: String(clipId), index: index, archived: !!archived });
            }
          }
          
          function showToast(message, isError = false) {
            // Simple toast notification
            const toast = document.createElement('div');
            toast.textContent = message;
            const bgColor = isError ? '#ef4444' : '#2563eb';
            toast.style.cssText = \`position:fixed;top:20px;left:50%;transform:translateX(-50%);background:\${bgColor};color:white;padding:10px 20px;border-radius:8px;z-index:9999;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:slideDown 0.3s ease\`;
            document.body.appendChild(toast);
            setTimeout(() => {
              toast.style.opacity = '0';
              toast.style.transform = 'translateX(-50%) translateY(-10px)';
              toast.style.transition = 'all 0.3s ease';
              setTimeout(() => toast.remove(), 300);
            }, 2000);
          }
          
          // Listen for clip data from parent
          window.addEventListener('message', (e) => {
            if (!e || !e.data) return;
            if (e.source !== window.parent) return;
            if (e.data.type === 'quickview-clips-data') {
              renderClips(e.data.clips);
            }
          });
          
          function renderClips(clips) {
            const container = document.getElementById('quickview-content');
            const counter = document.getElementById('clip-count');
            
            // Update counter
            if (counter) {
              counter.textContent = \`\${clips.length} clip\${clips.length !== 1 ? 's' : ''}\`;
            }
            
            if (!clips || clips.length === 0) {
              container.innerHTML = \`
                <div class="empty-state">
                  <div class="empty-icon">✨</div>
                  <div class="empty-text">No clips saved yet</div>
                  <div class="empty-hint">Right-click selected text to save clips</div>
                </div>
              \`;
              return;
            }
            
            container.innerHTML = clips.map((clip, index) => {
              const text = clip.text || clip;
              const displayText = text.length > 60 ? text.substring(0, 60) + '...' : text;
              const category = clip.category || 'Uncategorized';
              const escapedText = escapeHtml(text).replace(/'/g, '&apos;');
              const clipId = (clip && clip.id != null) ? String(clip.id) : String(index);
              const clipIdArg = JSON.stringify(clipId);
              const isArchived = !!(clip && (clip.archived === true || clip.source === 'archived'));
              const archivedArg = isArchived ? 'true' : 'false';
              
              return \`
                <div class="clip-item">
                  <div class="clip-content">
                    <div class="clip-text" title="\${escapeHtml(text)}">\${escapeHtml(displayText)}</div>
                    <div class="clip-meta">
                      <span class="clip-category">\${escapeHtml(category)}</span>
                    </div>
                  </div>
                  <div class="clip-actions">
                    <button class="clip-btn" onclick="copyClip('\${escapedText}', \${index})" title="Copy">📋</button>
                    <button class="clip-btn delete" onclick="deleteClip(\${clipIdArg}, \${index}, \${archivedArg})" title="Delete">×</button>
                  </div>
                </div>
              \`;
            }).join('');
          }
          
          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }
          
          // Load clips on startup
          try { loadClips(); } catch (err) { console.warn('[PasteCraft quick view] initial loadClips failed:', err); }
        </script>
      </body>
      </html>
    `;
    
    iframe.srcdoc = content;
    
    const hashText = (s) => {
      const str = String(s || '');
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(36);
    };

    const normalizeClip = (clip, index, source) => {
      if (typeof clip === 'string') {
        const ts = Date.now();
        return {
          id: `${ts}_${hashText(clip)}_${index}`,
          text: clip,
          category: 'Uncategorized',
          timestamp: ts,
          source
        };
      }
      if (!clip || typeof clip !== 'object') return null;
      const text = clip.text ?? clip;
      if (!text) return null;
      const ts = (typeof clip.timestamp === 'number') ? clip.timestamp : Date.now();
      const id = clip.id ?? clip.clip_id ?? clip.clipId ?? `${ts}_${hashText(text)}_${index}`;
      return {
        ...clip,
        id: String(id),
        text: String(text),
        category: clip.category || 'Uncategorized',
        timestamp: ts,
        source
      };
    };

    const getQuickViewClips = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'pcGetQuickViewClips' });
        if (response?.success && Array.isArray(response.clips)) {
          return response.clips;
        }
      } catch (_) {}

      const result = await new Promise((resolve) => chrome.storage.local.get(['clips', 'searchOnlyClips'], resolve));
      const active = Array.isArray(result?.clips) ? result.clips : [];
      const archived = Array.isArray(result?.searchOnlyClips) ? result.searchOnlyClips : [];

      const merged = [
        ...active.map((c, i) => normalizeClip(c, i, 'active')).filter(Boolean),
        ...archived.map((c, i) => normalizeClip(c, i, 'archived')).filter(Boolean).map(c => ({ ...c, archived: true }))
      ];

      // Newest-first, stable fallback (id) for tie-break.
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));

      // Keep panel fast: Quick View is for “recent”, not infinite scroll.
      return merged.slice(0, 200);
    };

    // Listen for storage changes to auto-refresh clips
    const storageListener = (changes, area) => {
      if (area !== 'local' || !iframe.contentWindow) return;
      if (!changes.clips && !changes.searchOnlyClips) return;
      getQuickViewClips()
        .then((clips) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, quickViewTargetOrigin);
          }
        })
        .catch(() => {});
    };
    chrome.storage.onChanged.addListener(storageListener);
    
    // Store listener reference for cleanup
    widget._quickViewStorageListener = storageListener;
    
    // Listen for messages from iframe
    const messageHandler = (e) => {
      if (!e || !e.data) return;
      if (iframe.contentWindow && e.source !== iframe.contentWindow) return;

      if (e.data.type === 'quickview-get-clips') {
        getQuickViewClips().then((clips) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, quickViewTargetOrigin);
          }
        }).catch(() => {});
      } else if (e.data.type === 'quickview-delete-clip') {
        safeRuntimeSendMessage({
          action: 'pcDeleteQuickViewClip',
          clipId: String(e.data.clipId || ''),
          archived: e.data.archived === true,
          index: e.data.index,
        })
          .then((response) => {
            const clips = response?.success && Array.isArray(response.clips) ? response.clips : [];
            if (iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, quickViewTargetOrigin);
            }
            if (response?.success) {
              chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {});
            }
          })
          .catch(() => {});
      } else if (e.data.type === 'quickview-open-settings') {
        // Open settings from quick view
        closeQuickViewPanel(widget);
        setTimeout(() => widget.openSettings(), 100);
      } else if (e.data.type === 'quickview-open-mini') {
        const mode = String(e.data.mode || 'window');
        openMiniQuickViewPanel(widget, mode === 'corner' ? 'corner' : 'window');
      }
    };
    
    window.addEventListener('message', messageHandler);
    // Store reference for cleanup
    widget._quickViewMessageHandler = messageHandler;
}

export function closeQuickViewPanel(widget) {
    const backdrop = document.getElementById('pastecraft-quickview-backdrop');
    const panel = document.getElementById('pastecraft-quickview-panel');
    
    if (widget._quickViewOutsidePointerDown) {
      document.removeEventListener('pointerdown', widget._quickViewOutsidePointerDown, true);
      widget._quickViewOutsidePointerDown = null;
    }
    
    if (backdrop) backdrop.classList.remove('visible');
    if (panel) panel.classList.remove('visible');
    
    if (backdrop || panel) {
      // Remove after animation
      setTimeout(() => {
        if (backdrop) backdrop.remove();
        if (panel) panel.remove();
      }, 300);
      
      // Update open state
      widget.openStates.quickView = false;
      
      // Slide widget back to right edge (if no other panels open)
      if (!widget.openStates.popup && !widget.openStates.settings) {
        widget.widget.classList.remove('panel-open');
      }
      
      // Remove active class from quick view button
      const quickViewButton = widget.widget.querySelector('.quick-view-button');
      if (quickViewButton) {
        quickViewButton.classList.remove('active');
      }
      
      // Clean up storage listener
      if (widget._quickViewStorageListener) {
        chrome.storage.onChanged.removeListener(widget._quickViewStorageListener);
        widget._quickViewStorageListener = null;
      }
      
      // Clean up message handler
      if (widget._quickViewMessageHandler) {
        window.removeEventListener('message', widget._quickViewMessageHandler);
        widget._quickViewMessageHandler = null;
      }

      // Update docked page push based on remaining panels
      widget.syncPageDocking();
      
      console.log('✅ Quick View panel closed');
    }
}

export function openMiniQuickViewPanel(widget, mode = 'window') {
    try {
      // Ensure base styles exist
      injectQuickViewStyles();

      const existing = document.getElementById('pastecraft-mini-quickview');
      if (existing) {
        existing.classList.toggle('docked', mode === 'corner');
        // Bring to front
        existing.style.zIndex = '2147483647';
        return;
      }

      const el = document.createElement('div');
      el.id = 'pastecraft-mini-quickview';
      el.className = `pastecraft-mini-quickview${mode === 'corner' ? ' docked' : ''}`;

      const header = document.createElement('div');
      header.className = 'pastecraft-mini-quickview-header';

      const title = document.createElement('div');
      title.className = 'pastecraft-mini-quickview-title';
      title.textContent = 'Quick View (Mini)';

      const controls = document.createElement('div');
      controls.className = 'pastecraft-mini-quickview-controls';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'pastecraft-mini-quickview-btn';
      closeBtn.type = 'button';
      closeBtn.title = 'Close';
      closeBtn.textContent = '×';

      controls.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(controls);

      const body = document.createElement('div');
      body.className = 'pastecraft-mini-quickview-body';
      el.appendChild(header);
      el.appendChild(body);
      document.body.appendChild(el);

      populateMiniQuickViewBody(body);

      const storageListener = (changes, area) => {
        if (area !== 'local') return;
        if (!changes.clips && !changes.searchOnlyClips) return;
        if (!document.body.contains(el)) return;
        populateMiniQuickViewBody(body);
      };
      chrome.storage.onChanged.addListener(storageListener);

      const closeMini = () => {
        try { chrome.storage.onChanged.removeListener(storageListener); } catch (_) {}
        el.remove();
      };
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMini();
      });

      // Initial position (window mode): place it slightly left of the Quick View panel.
      if (mode !== 'corner') {
        const w = el.getBoundingClientRect().width || 360;
        const viewportW = Math.max(320, window.innerWidth || 0);
        const left = Math.max(12, viewportW - 476 - w - 16);
        el.style.left = `${left}px`;
        el.style.top = '90px';
      }

      // Draggable header
      const dragState = { dragging: false, dx: 0, dy: 0 };
      const onPointerMove = (e) => {
        if (!dragState.dragging) return;
        const nextLeft = Math.max(0, (e.clientX - dragState.dx));
        const nextTop = Math.max(0, (e.clientY - dragState.dy));
        el.style.left = `${nextLeft}px`;
        el.style.top = `${nextTop}px`;
      };
      const onPointerUp = () => {
        dragState.dragging = false;
        try { header.releasePointerCapture?.(dragState.pointerId); } catch (_) {}
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', onPointerUp, true);
      };

      header.addEventListener('pointerdown', (e) => {
        if (!e || e.button !== 0) return;
        if (e.target?.closest?.('.pastecraft-mini-quickview-btn')) return;
        const rect = el.getBoundingClientRect();
        el.classList.remove('docked');
        el.style.right = '';
        el.style.bottom = '';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;

        dragState.dragging = true;
        dragState.pointerId = e.pointerId;
        dragState.dx = e.clientX - rect.left;
        dragState.dy = e.clientY - rect.top;
        try { header.setPointerCapture?.(e.pointerId); } catch (_) {}
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
      });
    } catch (err) {
      console.error('❌ Error opening mini Quick View:', err);
    }
}

export async function populateMiniQuickViewBody(body) {
    if (!body) return;
    body.textContent = '';

    let active = [];
    let archived = [];
    try {
      const res = await new Promise((resolve) => chrome.storage.local.get(['clips', 'searchOnlyClips'], resolve));
      active = Array.isArray(res?.clips) ? res.clips : [];
      archived = Array.isArray(res?.searchOnlyClips) ? res.searchOnlyClips : [];
    } catch (_) {
      // ignore — render empty state below
    }

    const merged = [...active, ...archived]
      .filter((c) => c && typeof c === 'object')
      .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
      .slice(0, 100);

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pastecraft-mini-quickview-empty';
      empty.textContent = 'No clips yet. Right-click selected text to save your first clip.';
      body.appendChild(empty);
      return;
    }

    merged.forEach((clip) => {
      const card = document.createElement('div');
      card.className = 'pastecraft-mini-quickview-clip';
      card.title = 'Click to copy';

      const text = String(clip.text ?? '').trim() || '(empty)';
      const category = String(clip.category ?? '').trim();

      if (category) {
        const cat = document.createElement('div');
        cat.className = 'pastecraft-mini-quickview-clip-category';
        cat.textContent = category;
        card.appendChild(cat);
      }

      const txt = document.createElement('div');
      txt.className = 'pastecraft-mini-quickview-clip-text';
      txt.textContent = text;
      card.appendChild(txt);

      const flashCopied = () => {
        const original = txt.textContent;
        const originalColor = card.style.borderColor;
        txt.textContent = '✓ Copied!';
        card.style.borderColor = '#2563eb';
        setTimeout(() => {
          txt.textContent = original;
          card.style.borderColor = originalColor;
        }, 800);
        try { window.pasteCraftQuickPaste?.showToast?.('Copied!', 'success'); } catch (_) {}
      };

      card.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          flashCopied();
        } catch (_) {
          try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            flashCopied();
          } catch (e) {
            try { window.pasteCraftQuickPaste?.showToast?.('Copy failed', 'error'); } catch (_) {}
          }
        }
      });

      body.appendChild(card);
    });
}