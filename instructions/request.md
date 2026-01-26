# PasteCraft - Future Feature Requests

**Last Updated:** December 21, 2025  
**MVP Status:** ✅ COMPLETE AND DEPLOYED

**Note:** All completed implementations are logged in `program-study/Completed/Implementations.md`

---

## 📋 **FUTURE ENHANCEMENTS (Post-MVP)**

---

#### 1. Authorization & Subscription Enforcement
**Priority:** HIGH (Required for monetization)  
**Status:** Partial (gating exists, cloud sync enforcement needed)  

**Subscription Tiers:**
- **FREE:** Unlimited clips via local storage (no cloud sync), no AI
- **PREMIUM:** Cloud sync + AI features (Breakdown/Summary/Image) + backup/restore

**Requirements:**
- Block cloud sync for FREE users (local-only mode)
- Keep AI premium gating + subscription validation (already exists)
- Grace period handling for expired subscriptions
- Weekly/monthly/yearly billing cycle consistency

---

#### 2. Payment Integration (Stripe)
**Priority:** HIGH (Required for monetization)  
**Status:** Partial (Edge Functions exist, deployment/verification needed)  

**Requirements:**
- Deploy `create-checkout`, `stripe-webhook`, `create-portal-session` to Supabase
- Fix webhook DB write (payments succeeding but not recorded)
- Enable Manage/Cancel subscription via Stripe portal
- End-to-end test payment → webhook → premium unlock

---

#### 3. Subscription Description (Website + Upgrade Page)
**Priority:** HIGH  
**Status:** Coming soon  

**Requirements:**
- Add clear FREE vs PREMIUM descriptions on pricing + upgrade + home
- Emphasize: FREE = unlimited local clips; PREMIUM = cloud sync + AI
- Keep messaging consistent across pages

---

#### 4. Home Page SEO Target / Landing Page Adjustments
**Priority:** HIGH  
**Status:** Coming soon  

**Requirements:**
- Improve homepage SEO (meta/title/description/keywords + schema)
- Landing page headline/hero/CTA conversion adjustments
- Performance + mobile-first checks

---

#### 5. Batch Copy Process (Top-Right Mainframe Widget)
**Priority:** Medium  
**Status:** Not started  

**Requirements:**
- Add a **top-right mainframe widget** (fixed) with 3 icons stacked **above** the main widget: **Batch Copy**, **Add to Copy**, **Image → Text**
- Styling: top-right icons + cursor bar should **match the main widget style** (colors, rounded edges, glow, spacing, tooltips)
- Batch icon: **green = ON**, **black = OFF** (like auto-copy)
- When ON: sequential copies append into **one** batch clip (delimiter-based)
- On copy: show fingernail-size rectangular bar near cursor (right side), **50% transparent blue**
- If user dismisses the top-right indicator, it reappears near cursor on next copy (while still ON)

---

#### 6. Add to Copy (Top-Right Mainframe Widget + Search Catalog)
**Priority:** Medium  
**Status:** Not started  

**Requirements:**
- Add-to-Copy icon lives in the **top-right mainframe widget**
- On copy: system automatically captures **ONLY the most recent copy** (refreshes each new copy)
- Cursor bar: clickable **“Add to Copy”** button (50% transparent blue bar, right of cursor)
- Opens compact card-sized search catalog (same sort/filter behavior as Search tab)
- Multi-select clips to append to the **current (most recent) copy** or active batch (delimiter-based)

---

#### 7. Widget Icon = Profile / Gallery Image
**Priority:** Medium  
**Status:** Not started  

**Requirements:**
- Replace the PasteCraft logo **on the main widget icon** with the user's **profile-made image** (profile image or selected Images → Gallery image)
- Preferences: add button under Dark Mode: "Set profile image to widget icon" (rectangular)
- Images → Gallery: per-image widget-icon button with tooltip: "Set as widget icon"
- Persist setting in storage; fallback to default logo if image fails

---

#### 8. Analytics & Usage Tracking
**Priority:** Low  
**Requirements:**
- Track metrics: clips created, images generated, active users, retention
- Privacy-conscious (no personally identifiable information)
- User can opt-out via settings


---

#### 9. Images Page (Image → Text + Image Copy + Gallery)
**Priority:** Medium  
**Requirements:**
- Add new **Images** page/tab (replaces AI Lab Gallery page + removes AI Image Generator)
- Images page includes: **Image → Text analyzer**, **Image Copy library**, **Gallery**
- Gallery shows images created by AI via the **Profile popup module**
- Gallery supports **download** (PNG/JPEG) + filename with timestamp/prompt reference


---

#### 11. Export/Import Functionality
**Priority:** Low  
**Requirements:**
- Export all clips to JSON/CSV
- Import clips from other sources
- Full backup of PasteCraft data

---

#### 12. Collaboration Features
**Priority:** Low (Post-MVP v2.0)  
**Requirements:**
- Share clips with other users
- Team workspaces
- Shared categories

---

#### 13. Browser Extension - Cross-Browser Support
**Status:** Partial (Edge only)  
**Priority:** Medium  
**Description:**
- Currently optimized for Microsoft Edge
- Add Chrome Web Store support
- Test Firefox compatibility


---

#### 14. Auto-Copy on Clip Click (Settings Option) {this is done after all copy and delete buttons have been implemented}
**Priority:** Medium  
**Requirements:**
- Add settings toggle: "Enable auto-copy on clip click"
- **When Enabled:** User can copy clips by simply clicking them (no copy button needed)
  - Single click on clip automatically copies to clipboard
  - Multi-select: clicking multiple clips accumulates them (space-separated) into clipboard
  - Works across all pages (clips page, search results, categories)
  - Hide/disable all copy buttons (quick copy button on search page, category folder copy button)
  - Categories: Show only delete button (not `copy | delete`, just `delete` button in full)
- **When Disabled:** User must manually click copy button to copy clips
  - Show all copy buttons as normal (`copy | delete` format for categories)
- Preference persists across sessions

---

#### 15. Persistent Popup & Quick View (Stay-Open Behavior)
**Priority:** High  
**Requirements:**
- **Main Popup Issue:** Popup closes when user clicks on website or navigates to different tab/page
- **Quick View Issue:** Quick View menu closes/loses position when user interacts with page or switches tabs
- **Solution:** Both should remain open and maintain state during website interaction and tab navigation
- **Settings Control:** Add two toggles in settings:
  - "Keep popup open when clicking on pages" (main application)
  - "Keep quick view open when clicking on pages" (quick view menu)
- **Default:** Enabled (stays open when user navigates between pages and clicks things on website)
- When disabled: Returns to current behavior (closes on outside click/navigation)

---

#### 16. AI Knowledge Base & Clipboard Journey Analyzer
**Priority:** Medium  
**Status:** Future Enhancement  
**Requirements:**
- **AI-Powered Analysis Bot:** Intelligent system that analyzes user's entire clipboard history
- **Scope of Analysis:**
  - All clips (singles, batches, categories)
  - Usage patterns over time
  - Most copied content types
  - Category distribution
  - Temporal patterns (when user copies most)
- **Knowledge Base Creation:**
  - AI summarizes user's clipboard journey
  - Identifies themes and topics from clipboard history
  - Creates personalized insights dashboard
  - Tracks what user copies most frequently
- **User Dashboard Integration:**
  - Display on pastecraft.com/account page
  - Show AI-generated summary of clipboard usage
  - Visualize patterns (charts, graphs, word clouds)
  - "Your Clipboard Story" narrative
- **Smart Features:**
  - Discover content patterns user might not notice
  - Suggest optimal categories based on usage
  - Predict what user might need based on history
  - Create "memory timeline" of clipboard activity
- **Privacy Considerations:**
  - User opt-in/opt-out setting
  - Local processing option
  - Clear data retention policies
  - Transparent about what AI analyzes
- **Implementation Notes:**
  - Integrate with existing clip storage in Supabase
  - Use OpenAI for natural language analysis
  - Real-time updates as user copies new content
  - Export knowledge base as PDF/report

---

#### 17. Freemium Tier Display on Pricing Page
**Priority:** High  
**Status:** Needs Update  
**Requirements:**
- Update Free tier card: **Unlimited clips (local storage only)**
- Show: ❌ No cloud sync, ❌ No AI
- Add copy line: “Clips stay on your device”


---

#### 20. Right-Side Widget UI Polish (Transparency + Tight Fit)
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Widget background **50% transparent**
- Background/container should tightly fit buttons (no extra padding)
- Button outer edges flush with background edges

---

#### 21. Image-to-Text Analyzer (Snipping Tool OCR → Clip)
**Priority:** Medium  
**Status:** Not started  
**Requirements:**
- Icon lives in the **top-right mainframe widget** (above main widget)
- Snipping-tool style: click + drag to capture a screen region (area of interest)
- Send captured image to AI for text extraction (OCR) and save result as a clip
- Works on any website (content-script overlay), respects privacy + clear user intent
- Optional: auto-open preview before saving (confirm/cancel)
- Popup/module option: allow **manual** Image → Text via **image upload** or **copy/paste image** (clipboard) for users not using the widget


---

#### 22. Quick Login Code (3-digit PIN lock)
**Priority:** Medium  
**Status:** Implemented (Extension)  
**Requirements:**
- Opt-in “Remember login with 3-digit code” on Sign In
- Require PIN to unlock the extension UI on open (keep Supabase session; don’t store passwords)
- Settings: enable/disable + change/reset code
- Store salted hash in browser sync; add lockout on repeated failures

---

#### 26. URL Link Clips (Clickable + Redeemable)
**Priority:** Medium  
**Status:** Not started  
**Requirements:**
- Support saving copied **URL links** as clips (same as text clips)
- URLs display in **Clips**, **Search**, and **Categories** aka treat it like a regular clip
- URLs are **clickable/redeemable**: click opens the link in a new tab
- Support sending URL clips to **Notes** (album/note attachment)

---

#### 27. Zero-Loss Sync + Durable Storage
**Priority:** High  
**Status:** In progress  
**Requirements:**
- Soft-delete + audit log for clips/categories/notes (no hard deletes)
- Notes + attachments sync to Supabase with history snapshots
- Device sync state + conflict merge by updatedAt
- Tombstones for cross-device deletion consistency

---

#### 28. Restore Merge Mode (No Overwrite)
**Priority:** High  
**Status:** In progress  
**Requirements:**
- Restore should merge snapshot/backup into current data
- Deduplicate by content/id; newest wins on conflicts
- Applies to local restore, sync backup restore, and cloud restore
- Keep settings/profile from current device unless missing

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

---

## **Mission Briefing: Standard Operating Protocol**

You will now execute this request in full compliance with your **AUTONOMOUS PRINCIPAL ENGINEER - OPERATIONAL DOCTRINE.** Each phase is mandatory. Deviations are not permitted.

---

## **Phase 0: Reconnaissance & Mental Modeling (Read-Only)**

-   **Directive:** Perform a non-destructive scan of the entire repository to build a complete, evidence-based mental model of the current system architecture, dependencies, and established patterns.

-   **Output:** Produce a concise digest (≤ 200 lines) of your findings. This digest will anchor all subsequent actions.

-   **Constraint:** **No mutations are permitted during this phase.**

---

## **Phase 1: Planning & Strategy**

-   **Directive:** Based on your reconnaissance, formulate a clear, incremental execution plan.

-   **Plan Requirements:**

    1.  **Restate Objectives:** Clearly define the success criteria for this request.

    2.  **Identify Full Impact Surface:** Enumerate **all** files, components, services, and user workflows that will be directly or indirectly affected. This is a test of your system-wide thinking.

    3.  **Justify Strategy:** Propose a technical approach. Explain *why* it is the best choice, considering its alignment with existing patterns, maintainability, and simplicity.

-   **Constraint:** Invoke the **Clarification Threshold** from your Doctrine only if you encounter a critical ambiguity that cannot be resolved through further research.

---

## **Phase 2: Execution & Implementation**

-   **Directive:** Execute your plan incrementally. Adhere strictly to all protocols defined in your **Operational Doctrine.**

-   **Core Protocols in Effect:**

    -   **Read-Write-Reread:** For every file you modify, you must read it immediately before and immediately after the change.

    -   **Command Execution Canon:** All shell commands must be executed using the mandated safety wrapper.

    -   **Workspace Purity:** All transient analysis and logs remain in-chat. No unsolicited files.

    -   **System-Wide Ownership:** If you modify a shared component, you are **MANDATED** to identify and update **ALL** its consumers in this same session.

---

## **Phase 3: Verification & Autonomous Correction**

-   **Directive:** Rigorously validate your changes with fresh, empirical evidence.

-   **Verification Steps:**

    1.  Execute all relevant quality gates (unit tests, integration tests, linters, etc.).

    2.  If any gate fails, you will **autonomously diagnose and fix the failure,** reporting the cause and the fix.

    3.  Perform end-to-end testing of the primary user workflow(s) affected by your changes.

---

## **Phase 4: Mandatory Zero-Trust Self-Audit**

-   **Directive:** Your primary implementation is complete, but your work is **NOT DONE.** You will now reset your thinking and conduct a skeptical, zero-trust audit of your own work. Your memory is untrustworthy; only fresh evidence is valid.

-   **Audit Protocol:**

    1.  **Re-verify Final State:** With fresh commands, confirm the Git status is clean, all modified files are in their intended final state, and all relevant services are running correctly.

    2.  **Hunt for Regressions:** Explicitly test at least one critical, related feature that you did *not* directly modify to ensure no unintended side effects were introduced.

    3.  **Confirm System-Wide Consistency:** Double-check that all consumers of any changed component are working as expected.

---

## **Phase 5: Final Report & Verdict**

-   **Directive:** Conclude your mission with a single, structured report.

-   **Report Structure:**

    -   **Changes Applied:** A list of all created or modified artifacts.

    -   **Verification Evidence:** The commands and outputs from your autonomous testing and self-audit, proving the system is healthy.

    -   **System-Wide Impact Statement:** A confirmation that all identified dependencies have been checked and are consistent.

    -   **Final Verdict:** Conclude with one of the two following statements, exactly as written:

        -   `"Self-Audit Complete. System state is verified and consistent. No regressions identified. Mission accomplished."`

        -   `"Self-Audit Complete. CRITICAL ISSUE FOUND. Halting work. [Describe issue and recommend immediate diagnostic steps]."`

-   **Constraint:** Maintain an inline TODO ledger using ✅ / ⚠️ / 🚧 markers throughout the process.
