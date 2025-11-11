# PasteCraft - Future Feature Requests

**Last Updated:** November 9, 2025  
**MVP Status:** ✅ COMPLETE AND DEPLOYED

**Note:** All completed implementations are logged in `program-study/Completed/Implementations.md`

---

## 📋 **FUTURE ENHANCEMENTS (Post-MVP)**

### **Phase 2 Features (Not Yet Implemented)**

#### 1. Categories Cloud Sync ⭐ **MUST IMPLEMENT**
**Priority:** HIGH (Required for Production)  
**Requirements:**
- Implement bidirectional sync similar to clips
- Add `syncCategoriesToSupabase()` and `fetchCategoriesFromSupabase()` methods
- Create `categories` table in Supabase database
- Essential for cross-device functionality

---

#### 2. Archived Clips Sync (Search-Only Clips) ⭐ **MUST IMPLEMENT**
**Priority:** HIGH (Required for Production)  
**Requirements:**
- Sync all archived clips beyond the 20 active clips to Supabase
- Users get unlimited storage up to 25,000 total clips (base subscription)
- After 25,000 clips, users must upgrade to premium storage subscription
- All archived clips remain searchable
- Add `is_archived` flag and batch sync functionality

---

#### 3. Offline Mode & Sync Queue ⭐ **MUST IMPLEMENT**
**Priority:** CRITICAL (Required for Production)  
**Requirements:**
- Full offline functionality with local storage (e.g., viewing PDFs, managing clips)
- Auto-sync when internet connection is restored
- Sync queue persists in local storage to survive restarts
- Show sync status indicator (offline, syncing, synced)
- User warning: Do not clear browser cache while offline

---

#### 4. Real-time Cross-Device Sync
**Priority:** Medium  
**Requirements:**
- Use Supabase Realtime (WebSocket) for instant sync across devices
- When user has two computers open simultaneously, changes appear instantly on both
- Subscribe to database changes for clips, categories, settings, profiles

---

#### 5. Analytics & Usage Tracking
**Priority:** Low  
**Requirements:**
- Track metrics: clips created, images generated, active users, retention
- Privacy-conscious (no personally identifiable information)
- User can opt-out via settings

---

#### 6. Conflict Resolution UI
**Priority:** Medium  
**Requirements:**
- Show user when conflicts occur during sync
- Let user choose which version to keep (local vs cloud)
- Currently uses "newest timestamp wins" strategy automatically

---

#### 7. Bulk Operations & Batch Sync
**Priority:** Medium  
**Requirements:**
- Batch upload/download for users with many clips
- Show progress indicator for large syncs
- Optimize performance for 10,000+ clips

---

#### 8. Export/Import Functionality
**Priority:** Low  
**Requirements:**
- Export all clips to JSON/CSV
- Import clips from other sources
- Full backup of PasteCraft data

---

#### 9. Collaboration Features
**Priority:** Low (Post-MVP v2.0)  
**Requirements:**
- Share clips with other users
- Team workspaces
- Shared categories

---

#### 10. Browser Extension - Cross-Browser Support
**Status:** Partial (Edge only)  
**Priority:** Medium  
**Description:**
- Currently optimized for Microsoft Edge
- Add Chrome Web Store support
- Test Firefox compatibility

---

## 🎯 **PRIORITY ROADMAP**

### Immediate (Post-MVP Release):
1. Monitor production issues
2. Gather user feedback
3. Performance optimization

### Short-term (1-2 months):
1. Offline mode & sync queue (reliability)
2. Categories cloud sync (feature parity)
3. Conflict resolution UI (UX improvement)

### Medium-term (3-6 months):
1. Real-time cross-device sync (premium feature)
2. Analytics & usage tracking (product insights)
3. Bulk operations & batch sync (performance)

### Long-term (6+ months):
1. Export/Import functionality
2. Collaboration features
3. Cross-browser expansion

---

## 📝 **FEATURE REQUEST PROCESS**

To request a new feature:

1. **Check Existing Requests** - See if it's already listed above
2. **Create Issue** - Document the feature request with:
   - Use case / problem it solves
   - Proposed solution
   - Priority (High/Medium/Low)
   - Technical considerations
3. **User Voting** - Let users vote on most wanted features
4. **Development Sprint** - Highest priority features get scheduled

---

## 🔧 **TECHNICAL DEBT & REFACTORING**

### Code Cleanup Needed:
- [ ] Remove debug console.logs before production
- [ ] Optimize image upload/download for performance
- [ ] Add comprehensive error handling
- [ ] Implement retry logic for failed syncs
- [ ] Add unit tests for sync methods
- [ ] Performance profiling and optimization

### Documentation Needed:
- [ ] API documentation for Supabase methods
- [ ] User guide for cloud sync features
- [ ] Developer guide for contributing
- [ ] Troubleshooting guide for common issues

---

**Status:** All MVP features complete. Extension ready for production deployment.  
**Next Review:** After user feedback from MVP release.

---

## 📁 Related Files

- **Completed Features:** `program-study/Completed/Implementations.md` - All MVP v1.0 implementations
- **Fixed Bugs:** `program-study/Fixed/RefreshFixedLog.md` - Resolved issues
- **Deployment Guide:** `MVP_DEPLOYMENT_CHECKLIST.md` - Production deployment steps
