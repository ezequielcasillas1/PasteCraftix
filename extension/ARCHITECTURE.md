# PasteCraft Architecture (PC1.5)

## Overview

This document describes the modular architecture introduced in PC1.5. The new structure follows MV3 best practices and provides better code organization, reusability, and maintainability.

## Directory Structure

```
extension/
├── manifest.json
├── background.js              # Legacy (still active)
├── content-script.js          # Legacy (still active)
├── popup.js                   # Legacy (still active)
├── popup.html
├── config.js                  # Supabase/Stripe config
│
├── background/                # NEW: Modular background
│   ├── service-worker.js      # Entry point
│   └── handlers/
│       ├── auth.handler.js
│       ├── clip.handler.js
│       ├── context-menu.handler.js
│       ├── proxy.handler.js
│       └── window.handler.js
│
├── content/                   # NEW: Modular content script
│   ├── content.js             # Entry point
│   ├── widget.css             # Shadow DOM styles
│   └── modules/
│       ├── ui-injector.js     # Shadow DOM factory
│       ├── messaging.js       # Content messaging
│       └── clipboard.js       # Clipboard operations
│
├── popup/                     # NEW: Modular popup
│   ├── popup-entry.js         # Entry point
│   ├── components/
│   │   ├── toast.js
│   │   └── modal.js
│   └── modules/
│       ├── clips.js
│       ├── categories.js
│       ├── notes.js
│       ├── settings.js
│       └── search.js
│
├── shared/                    # NEW: Shared utilities
│   ├── index.js               # Barrel export
│   ├── constants.js           # App-wide constants
│   ├── store.js               # Observer state
│   ├── messaging.js           # Message helpers
│   ├── storage-adapter.js     # chrome.storage adapter
│   ├── api.js                 # Supabase client
│   └── auth.js                # Auth helpers
│
└── assets/
    └── styles/
        └── tokens.css         # CSS custom properties
```

## Migration Status

| Component | Legacy File | New Module | Status |
|-----------|-------------|------------|--------|
| Background | `background.js` | `background/service-worker.js` | Parallel |
| Content | `content-script.js` | `content/content.js` | Parallel |
| Popup | `popup.js` | `popup/popup-entry.js` | Parallel |
| Shared | (scattered) | `shared/index.js` | Ready |

**Parallel** = Both legacy and new modules exist. Legacy is active in manifest.

## Key Modules

### Shared Layer (`shared/`)

Import all shared utilities from one place:

```js
import {
  STORAGE_KEYS,
  MESSAGE_TYPES,
  sendToBackground,
  getStorageItems,
  getUserId,
  toast
} from './shared/index.js';
```

### Background Handlers (`background/handlers/`)

Each handler is responsible for one concern:
- `clip.handler.js` - Clip CRUD operations
- `auth.handler.js` - External auth messages
- `context-menu.handler.js` - Right-click menu
- `window.handler.js` - Popup window management
- `proxy.handler.js` - Edge function fetch proxy

### Popup Modules (`popup/modules/`)

Feature-specific logic separated from UI:
- `clips.js` - Load, save, delete, search clips
- `categories.js` - Category CRUD
- `notes.js` - Notes/albums management
- `settings.js` - User preferences
- `search.js` - Search with highlighting

### Content Modules (`content/modules/`)

- `ui-injector.js` - Shadow DOM factory for isolated UI
- `messaging.js` - Background communication
- `clipboard.js` - Copy/paste operations

## Golden Rules

1. **IDs from server only** - Local IDs are temporary placeholders
2. **Shadow DOM for injected UI** - CSS isolation
3. **Service worker is stateless** - Use chrome.storage
4. **No inline scripts** - MV3 CSP compliance
5. **Use chrome.* namespace** - Not browser.*

## Switching to New Architecture

To switch manifest to use the new modular background:

```json
{
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  }
}
```

**Note**: ES modules in service workers require `"type": "module"` and all imports must use `.js` extension.

## Schema Reference

See `Schema.md` for database structure. Key tables:
- `clips` - User clips
- `categories` - Custom categories
- `notes` - Notes and albums
- `user_profiles` - User settings
- `user_subscriptions` - Stripe subscription status

## ID Generation Rules

From `Schema.md`, these client-generated ID columns should be eliminated over time:
- `clips.clip_id` → use server `id` (uuid)
- `categories.category_id` → use server `id` (uuid)
- `notes.note_id` → use server `id` (uuid)

The extension should:
1. Create entities **without** specifying ID
2. Let Postgres assign `gen_random_uuid()`
3. Use the returned server ID for all references
