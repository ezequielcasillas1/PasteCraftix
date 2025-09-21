# PasteCraft Edge Extension Testing Guide

## 🚀 Quick Setup

### 1. Load Extension in Edge
1. Open Microsoft Edge
2. Navigate to `edge://extensions/`
3. Enable **Developer mode** (toggle in left sidebar)
4. Click **Load unpacked**
5. Select the PasteCraft project root directory: `C:\Users\ezequiel-casillas\OneDrive\Documents\PasteCraft`
6. Extension should appear with PasteCraft icon

### 2. Test Text Capture
1. Navigate to any webpage with text
2. Select some text with your mouse
3. Press `Alt+Shift+C` to capture
4. You should see a notification: "Text Captured!"

### 3. Test Extension Popup
1. Click the PasteCraft icon in Edge toolbar
2. Popup should open showing:
   - Last capture timestamp
   - Captured text chips
   - Format controls (Comma, Newline, Space, Custom)
   - Transformation toggles (Deduplicate, Sort A→Z, Case)
   - Preview area
   - Copy button

### 4. Test Formatting
1. Click on captured text chips to select them
2. Try different delimiter options
3. Toggle deduplicate/sort options
4. Preview should update in real-time
5. Click "Copy Crafted Output" to copy formatted text

### 5. Test Magic Wand (Auto-Format)
1. Click the ✨ magic wand button (bottom-right)
2. Should automatically:
   - Select all captures
   - Enable deduplicate and sort
   - Set comma delimiter
   - Update preview

## 🔧 Development Features

### Extension Permissions
- ✅ **clipboardRead/Write**: For copying formatted output
- ✅ **storage**: For persisting captured text
- ✅ **activeTab**: For text selection capture
- ✅ **scripting**: For injecting capture scripts
- ✅ **notifications**: For capture feedback

### Keyboard Shortcuts
- `Alt+Shift+C`: Capture selected text

### Storage Management
- Configurable history size (default: 500 captures)
- Automatic cleanup of old captures
- Cross-tab synchronization

## 🐛 Troubleshooting

### Extension Not Loading
- Ensure you selected the correct directory (project root)
- Check console for errors in `edge://extensions/`
- Verify all required files are present

### Capture Not Working
- Ensure text is selected before pressing `Alt+Shift+C`
- Check if notifications are blocked
- Verify scripting permissions are granted

### Popup Not Showing Data
- Check if extension has storage permissions
- Look for errors in popup console (F12 in popup)
- Verify background.js is running

### Icons Not Displaying
- SVG icons should load automatically
- If missing, check `icons/` directory
- Verify manifest.json paths are correct

## 📊 Testing Checklist

### Basic Functionality
- [ ] Extension loads without errors
- [ ] Icons display correctly in toolbar
- [ ] Popup opens and shows UI
- [ ] Text capture works with keyboard shortcut
- [ ] Notifications appear on capture

### Format Controls
- [ ] Delimiter buttons work (Comma, Newline, Space, Custom)
- [ ] Deduplicate toggle removes duplicates
- [ ] Sort toggle alphabetizes text
- [ ] Case toggle transforms to uppercase
- [ ] Preview updates in real-time

### User Experience
- [ ] Capture chips are clickable and selectable
- [ ] Visual feedback on selection (blue highlighting)
- [ ] Copy button works and shows success feedback
- [ ] Magic wand auto-selects and formats
- [ ] Empty states display correctly

### Performance
- [ ] Popup opens quickly (< 500ms)
- [ ] Large amounts of text don't freeze UI
- [ ] Memory usage stays reasonable
- [ ] No console errors during normal usage

## 🔄 Development Workflow

1. Make changes to extension files
2. Click **Reload** in `edge://extensions/`
3. Test changes immediately
4. Use browser dev tools for debugging
5. Check background script console for service worker logs

## 📱 Next Steps

Once basic functionality is confirmed:
1. Test with various websites and text types
2. Verify cross-tab capture synchronization  
3. Test storage limits and cleanup
4. Optimize performance for large datasets
5. Add advanced formatting options
6. Integrate with React dashboard for full workflow
