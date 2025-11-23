# PasteCraft - Future Feature Requests

**Last Updated:** November 9, 2025  
**MVP Status:** ✅ COMPLETE AND DEPLOYED

**Note:** All completed implementations are logged in `program-study/Completed/Implementations.md`

---

## 📋 **FUTURE ENHANCEMENTS (Post-MVP)**

---

#### 1. Authorization & Subscription Enforcement
**Priority:** HIGH (Required for monetization)  
**Status:** Foundation exists, enforcement needed  

**Subscription Tiers:**
- **FREE:** Basic features only
  - 20 active clips
  - 1,000 archived clips (searchable)
  - Basic categories
  - No AI features
  
- **PREMIUM:** Full access
  - Unlimited active clips
  - Unlimited clips
  - All AI features (Breakdown, Summaries, Image Generation)
  - Priority sync
  - Premium support

**Pricing Structure (Stripe):**
- Weekly: $1.99/week
- Monthly: $6.99/month (most popular - best value)
- Yearly: $69.99/year (save $14 vs monthly)

**Requirements:**
- Add authorization checks before premium features (AI Breakdown, AI Summaries, Image Generation)
- Enforce storage limits by subscription tier
- Implement API rate limiting per subscription tier
- Add upgrade modal/paywall when free users attempt premium features
- Validate subscription status on backend before AI API calls
- Create subscription tier constants (FREE, PREMIUM)
- Add grace period handling for expired subscriptions
- Show feature-locked badges on premium features for free users
- Implement weekly/monthly/yearly billing cycles

**Current State:**
- Authentication working (login/signup via Supabase)
- Subscription tier stored in database
- getUserSubscription() method exists
- Need to add permission checks throughout app

**Blocks:** Monetization, feature gating, storage limits

---

#### 2. Payment Integration (Stripe)
**Priority:** HIGH (Required for monetization)  
**Status:** Not started  

**Pricing Plans:**
- Weekly: $1.99/week
- Monthly: $6.99/month (recommended)
- Yearly: $69.99/year (2 months free)

**Stripe Costs:**
- No monthly fees
- No setup fees
- Per transaction: 2.9% + $0.30 only when paid
- Example: $6.99/month → $0.50 to Stripe, $6.49 net revenue

**Break-Even Analysis:**
- Monthly costs: ~$25 (Supabase) + ~$20 (OpenAI) = $45/mo
- Need ~7 monthly subscribers to break even
- Need ~25 weekly subscribers to break even
- Or 1 yearly subscriber covers ~1 month of costs

**Requirements:**
- Integrate Stripe Checkout for subscription payments
- Create 3 subscription products (weekly, monthly, yearly)
- Add webhook handlers for payment events (success, failed, canceled, renewed)
- Update user subscription_tier in database on successful payment
- Handle subscription lifecycle (trial, active, past_due, canceled)
- Add "Upgrade" button throughout app (settings, AI features)
- Add "Manage Subscription" button in settings (links to Stripe portal)
- Implement subscription cancellation flow
- Stripe sends invoicing and receipt emails automatically
- Handle proration for plan changes (weekly to monthly, monthly to yearly)
- Add 7-day free trial option (optional marketing hook)

---

#### 5. Analytics & Usage Tracking
**Priority:** Low  
**Requirements:**
- Track metrics: clips created, images generated, active users, retention
- Privacy-conscious (no personally identifiable information)
- User can opt-out via settings


---

#### 6. AI Lab Gallery - Photo Download
**Priority:** Medium  
**Requirements:**
- Add download button for each generated image
- Support PNG and JPEG formats
- Allow users to save photos for personal use
- Include filename with timestamp/prompt reference


---

#### 7c. Clips to AI Image Generator
**Priority:** Medium  
**Requirements:**
- AI Generator page has input box for clips from clips/search/categories pages
- Selected clips sent to Generator display in input box ready for transformation
- Second input box allows manual paste (placeholder: "paste your delicious crafted clip")
- Error handling for non-visual clips (study notes, text-only content)
- Warn user if clip lacks visual image correspondence

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

#### 12. Auto-Copy on Clip Click (Settings Option)
**Priority:** Medium  
**Requirements:**
- Add settings toggle: "Enable auto-copy on clip click"
- **When Enabled:** User can copy clips by simply clicking them (no copy button needed)
  - Single click on clip automatically copies to clipboard
  - Multi-select: clicking multiple clips accumulates them (space-separated) into clipboard
  - Works across all pages (clips page, search results, categories)
- **When Disabled:** User must manually click copy button to copy clips
- Preference persists across sessions

---

#### 13. Quick Copy Button Below Clips Module, should be right above the pagination numbered system.
**Priority:** Low  
**Requirements:**
- Add copy button positioned directly below clips module
- Allows quick copying without scrolling to bottom delimiter section
- Button copies selected clip content to clipboard
- Provides instant visual feedback on copy action

---

#### 14. Persistent Popup & Quick View (Stay-Open Behavior)
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

#### 15. AI Knowledge Base & Clipboard Journey Analyzer
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

#### 16. Website Pricing Update - Unlimited Clips Display
**Priority:** High  
**Status:** Complete  
**Requirements:**
- Update pricing.html to show "Unlimited clips" instead of "25,000 archived clips"
- Change applies to all three pricing tiers (Weekly, Monthly, Yearly)
- Keep consistency with homepage messaging

---

#### 17. Freemium Tier Display on Pricing Page
**Priority:** High  
**Status:** Complete  
**Requirements:**
- Add Free tier card to pricing.html showing freemium features
- Display: 20 active clips, 1,000 archived clips, basic categories, cloud sync
- Show AI features as unavailable (crossed out)
- Link to Edge extension store for free installation

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
