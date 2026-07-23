/** @forward-slice — Quick Paste styles: scrollbar, selection, footer */

export const QP_STYLES_CLIPS = `    /* Custom scrollbar */
    .pastecraft-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .pastecraft-content::-webkit-scrollbar-track {
      background: #eff6ff;
    }
    
    .pastecraft-content::-webkit-scrollbar-thumb {
      background: #93c5fd;
      border-radius: 3px;
    }
    
    .pastecraft-content::-webkit-scrollbar-thumb:hover {
      background: #60a5fa;
    }
    
    /* Delete button styling */
    .pastecraft-delete {
      background: #ef4444 !important;
      color: white !important;
      font-size: 16px !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      margin-left: 4px !important;
    }
    
    .pastecraft-delete:hover {
      background: #dc2626 !important;
      transform: scale(1.1);
    }
    
    /* Multi-select functionality - NUCLEAR SPECIFICITY */
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
      color: white !important;
      border: 4px solid #ff6b35 !important;
      box-shadow: 0 8px 25px rgba(255, 107, 53, 0.9) !important;
      transform: scale(1.08) !important;
      z-index: 50 !important;
      position: relative !important;
      outline: 3px solid rgba(255, 107, 53, 0.5) !important;
      outline-offset: 2px !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected * {
      color: white !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-clip-text {
      color: white !important;
      font-weight: 900 !important;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
      font-size: 1.1em !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-clip-meta {
      color: rgba(255, 255, 255, 1) !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-category {
      background: rgba(255, 255, 255, 0.6) !important;
      color: #ff6b35 !important;
      border: 2px solid white !important;
      font-weight: 700 !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-time {
      color: rgba(255, 255, 255, 1) !important;
      font-weight: 600 !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-btn {
      background: rgba(255, 255, 255, 0.3) !important;
      color: white !important;
      border: 2px solid rgba(255, 255, 255, 0.8) !important;
    }
    
    /* Dark / blue theme override for selection */
    .pastecraft-interface.dark.pastecraft-interface .pastecraft-clip.selected.selected,
    .pastecraft-interface.blue.pastecraft-interface .pastecraft-clip.selected.selected {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
      border-color: #ff6b35 !important;
    }
    
    /* Copy Multiple button styling */
    .pastecraft-copy-multiple {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1a1f5e 100%) !important;
      color: white !important;
      font-weight: 600 !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      border: 1px solid #1a1f5e !important;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35) !important;
      flex: none !important;
      min-width: auto !important;
      max-width: 140px !important;
      text-align: center !important;
      white-space: nowrap !important;
      margin-left: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    
    .pastecraft-copy-multiple:hover:not(:disabled) {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #0d1240 100%) !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 14px rgba(26, 31, 94, 0.45) !important;
    }
    
    .pastecraft-copy-multiple:disabled {
      background: #d1d5db !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
      border-color: #d1d5db !important;
    }
    
    .pastecraft-interface.dark .pastecraft-footer,
    .pastecraft-interface.blue .pastecraft-footer {
      background: #0b1220 !important;
      border-top-color: #1e3a8a !important;
    }
    
    /* NUCLEAR STICKY FOOTER FIX */
    .pastecraft-quick-paste .pastecraft-footer {
      position: -webkit-sticky !important;
      position: sticky !important;
      bottom: 0px !important;
      z-index: 9999 !important;
      margin-top: auto !important;
    }
    
    .pastecraft-quick-paste .pastecraft-content {
      display: -webkit-flex !important;
      display: flex !important;
      -webkit-flex-direction: column !important;
      flex-direction: column !important;
      height: 100% !important;
      min-height: 300px !important;
    }
    
    .pastecraft-quick-paste .pastecraft-clips-container {
      -webkit-flex: 1 !important;
      flex: 1 !important;
      overflow-y: auto !important;
      min-height: 0 !important;
    }
  `;
