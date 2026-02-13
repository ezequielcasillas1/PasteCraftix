# REDDIT100 Testing Plan - Basic Plan In-Depth Validation

## Important: What You're Testing

**REDDIT100 coupon unlocks:** Basic plan (cloud sync + database storage)  
**REDDIT100 does NOT unlock:** AI features (those are Enhanced plan only)

You're helping us validate that Basic plan works flawlessly for real-world clipboard management with cloud sync.

---

## Phase 1: Installation & Account Setup (5-10 min)

### 1.1 Extension Installation
- [ ] Install PasteCraft from Edge Add-ons store
- [ ] Pin extension to toolbar (should show clipboard icon)
- [ ] Click icon - extension popup opens without errors
- [ ] Extension UI loads completely (no blank screens or partial loads)

**Report if:** Extension doesn't install, icon doesn't appear, popup fails to open, or UI is broken/blank

### 1.2 Account Creation
Choose ONE signup method and test thoroughly:

**Option A: Google OAuth 2.0**
- [ ] Click "Sign in with Google"
- [ ] Google consent screen appears correctly
- [ ] Select your Google account
- [ ] Grant permissions
- [ ] Redirected back to PasteCraft successfully
- [ ] Your profile shows correct name/email from Google

**Option B: Email/Password Signup**
- [ ] Enter email and create password (min 6 characters)
- [ ] Receive confirmation email (check spam folder)
- [ ] Click confirmation link or enter code
- [ ] Account activates successfully
- [ ] Can log in with email/password

**Report if:** OAuth flow fails, email not received within 5 minutes, confirmation link broken, login fails after signup

### 1.3 Coupon Redemption - CRITICAL STEP
- [ ] Navigate to Settings (gear icon or Settings menu)
- [ ] Find "Coupon Code" or "Promo Code" field
- [ ] Enter: **REDDIT100** (case-sensitive, no spaces)
- [ ] Click "Redeem" or "Apply"
- [ ] Success message appears confirming Basic plan activation
- [ ] Plan status shows "Basic" (not "Free" or "Freemium")
- [ ] Expiration date shows approximately 1 year from redemption

**Report if:** Code doesn't work, no confirmation shown, plan status doesn't change, or expiration date is wrong

---

## Phase 2: Core Clipboard Features (15-20 min)

### 2.1 Saving Clips (Copy Operations)
Test various content types:

- [ ] **Plain text:** Copy a sentence, open extension, verify it appears in clips list
- [ ] **Code snippet:** Copy JavaScript/Python code with indentation
- [ ] **Markdown:** Copy formatted markdown text (headers, lists, links)
- [ ] **JSON data:** Copy a JSON object
- [ ] **HTML:** Copy HTML tags
- [ ] **URLs:** Copy website URLs
- [ ] **Long text:** Copy 500+ word paragraph
- [ ] **Special characters:** Copy text with emojis, symbols (€, ©, ™, etc.)

**For each clip, verify:**
- Appears in clips list immediately (no delay)
- Content is complete and accurate
- Formatting/indentation preserved
- Timestamp shows correctly

**Report if:** Clips don't save, content is truncated, formatting is lost, duplicates appear, or saves are delayed

### 2.2 Pasting Clips (Paste Operations)
- [ ] Click a saved clip - it copies to clipboard
- [ ] Paste into text editor - content matches exactly
- [ ] Click multiple different clips in sequence - each one copies correctly
- [ ] Paste special characters/emojis - no corruption
- [ ] Paste long text - no truncation

**Report if:** Clicking clip doesn't copy, pasted content differs from saved clip, or paste action fails

### 2.3 Managing Clips
**Editing:**
- [ ] Click edit icon/button on a clip
- [ ] Modify the content
- [ ] Save changes
- [ ] Verify edited content persists
- [ ] Edit again - previous edit is still there

**Deleting:**
- [ ] Delete a single clip - confirmation prompt appears (if applicable)
- [ ] Confirm deletion - clip removed from list
- [ ] Clip stays deleted after refresh

**Bulk actions:**
- [ ] Select multiple clips (if checkboxes available)
- [ ] Delete selected clips
- [ ] Copy multiple clips at once (if feature exists)

**Report if:** Edits don't save, deletions don't work, clips reappear after deletion, or bulk actions fail

---

## Phase 3: Organization Features (10-15 min)

### 3.1 Categories
- [ ] Create a new category (e.g., "Work", "Code Snippets", "Personal")
- [ ] Assign clips to categories
- [ ] Filter clips by category
- [ ] Rename a category
- [ ] Delete a category
- [ ] Verify clips move to default/uncategorized when category deleted

**Test with:**
- 5+ categories with different names
- 10+ clips across categories
- Special characters in category names

**Report if:** Categories don't save, assignments don't persist, filters don't work, or category deletion breaks clips

### 3.2 Notes Feature
- [ ] Create a new note
- [ ] Add title and content to note
- [ ] Save note
- [ ] Edit existing note
- [ ] Delete note
- [ ] Create note with long content (1000+ words)

**Report if:** Notes don't save, content is lost, edits fail, or notes corrupt clips

### 3.3 Search & Filter
- [ ] Use search bar to find specific clip by keyword
- [ ] Search partial matches (e.g., "java" finds "javascript")
- [ ] Search with no results - shows "no clips found" message
- [ ] Clear search - all clips reappear
- [ ] Filter by date/timestamp (if available)

**Report if:** Search doesn't work, results are inaccurate, or filter breaks the UI

---

## Phase 4: Cloud Sync Validation - CRITICAL FOR BASIC PLAN (20-30 min)

This is the main feature you're testing with REDDIT100!

### 4.1 Data Persistence (Same Device)
- [ ] Create 10 clips, 3 categories, 2 notes
- [ ] Close extension popup
- [ ] Reopen extension - all data is there
- [ ] Close Edge browser completely
- [ ] Reopen Edge - all data persists
- [ ] Restart computer
- [ ] Reopen Edge - data still intact

**Report if:** Data disappears after closing popup, browser restart, or computer restart

### 4.2 Cross-Device Sync (If You Have Multiple Devices)

**Device 1 (Primary):**
- [ ] Create a clip with unique content (e.g., "TEST SYNC 123")
- [ ] Create a category named "Sync Test"
- [ ] Wait 10-15 seconds

**Device 2 (Secondary - Edge on another computer/laptop):**
- [ ] Install PasteCraft
- [ ] Log in with SAME account used on Device 1
- [ ] Wait 20-30 seconds for sync
- [ ] Check if "TEST SYNC 123" clip appears
- [ ] Check if "Sync Test" category appears

**Back to Device 1:**
- [ ] Delete the "TEST SYNC 123" clip
- [ ] Wait 15 seconds

**Back to Device 2:**
- [ ] Refresh or reopen extension
- [ ] Verify clip is deleted

**Report if:** Clips don't sync between devices, sync takes longer than 60 seconds, or deletions don't sync

### 4.3 Conflict Resolution
- [ ] **Device 1:** Create clip "Conflict Test A"
- [ ] **Device 2:** Create clip "Conflict Test B" (while Device 1 is offline if possible)
- [ ] Reconnect both devices to internet
- [ ] Wait 30 seconds
- [ ] **Both devices:** Check if both clips appear (no data loss)

**Report if:** Clips disappear, duplicate, or overwrite each other incorrectly

---

## Phase 5: Plan Enforcement & Restrictions (10 min)

### 5.1 AI Feature Blocking - CRITICAL
Basic plan should NOT have AI features. Test that these are blocked:

**AI Breakdown:**
- [ ] Find AI Breakdown button/feature
- [ ] Click it
- [ ] Should see "Upgrade to Enhanced" or paywall message
- [ ] Should NOT process AI request

**AI Summaries:**
- [ ] Find AI Summary button
- [ ] Click it
- [ ] Verify upgrade prompt appears
- [ ] Should NOT generate summary

**AI Image Generation:**
- [ ] Find AI Image/Generate Image feature
- [ ] Click it
- [ ] Should be blocked with upgrade prompt

**Report if:** ANY AI feature works on Basic plan, no paywall appears, or you get AI results without paying

### 5.2 Plan Display
- [ ] Go to Profile or Account section
- [ ] Plan shows as "Basic" (not "Free", "Freemium", or "Enhanced")
- [ ] Expiration date visible and correct (~1 year)
- [ ] AI access shows as "Not Included" or similar

**Report if:** Plan name is wrong, no expiration shown, or AI access shows as active

---

## Phase 6: Upgrade Flow Testing (5-10 min)

### 6.1 Pricing Page Access
- [ ] Click "Upgrade" button (wherever it appears)
- [ ] Pricing page loads correctly
- [ ] Shows Free/Basic/Enhanced comparison
- [ ] Basic plan shows as "Current Plan" or marked as active
- [ ] Enhanced plan features listed clearly

**Report if:** Pricing page doesn't load, plan comparison is confusing, or current plan not indicated

### 6.2 Checkout Cancellation
- [ ] Click "Get Started" on Enhanced plan
- [ ] Checkout flow begins (may be disabled, should say "Coming soon")
- [ ] If checkout available: cancel/close before paying
- [ ] Return to extension
- [ ] Verify Basic plan still active
- [ ] Verify clips/data still intact

**Report if:** Canceling checkout logs you out, corrupts data, or downgrades your plan

---

## Phase 7: Security & Reliability (10-15 min)

### 7.1 Session Management
- [ ] Log out of PasteCraft
- [ ] Try to access clips - should be blocked/require login
- [ ] Log back in
- [ ] All data restored correctly

**Report if:** Data accessible while logged out, login fails after logout, or data is lost

### 7.2 Multiple Tabs/Windows
- [ ] Open 3 Edge tabs
- [ ] Open PasteCraft in each tab
- [ ] Create clip in Tab 1
- [ ] Switch to Tab 2 - clip appears
- [ ] Delete clip in Tab 3
- [ ] Check Tab 1 and Tab 2 - clip deleted everywhere

**Report if:** Clips don't sync across tabs, extension crashes, or actions in one tab don't reflect in others

### 7.3 Performance Under Load
- [ ] Create 50+ clips rapidly (copy/paste quickly)
- [ ] Create 10+ categories
- [ ] Create 10+ notes
- [ ] Extension remains responsive
- [ ] Search still works quickly
- [ ] No lag when scrolling clip list

**Report if:** Extension slows down, crashes, or becomes unresponsive with many clips

### 7.4 Data Privacy
- [ ] Open extension popup
- [ ] Inspect UI for exposed sensitive data
- [ ] Should NOT see: payment info, API keys, passwords, tokens
- [ ] Should only see: your clips, categories, notes, profile info

**Report if:** You see any sensitive data exposed in the UI

---

## Phase 8: Edge Cases & Stress Testing (15-20 min)

### 8.1 Unusual Content
- [ ] Copy and save a 10,000+ character clip
- [ ] Copy binary/non-UTF8 characters
- [ ] Copy RTF or formatted Word document content
- [ ] Copy content with line breaks, tabs, multiple spaces
- [ ] Copy content from PDF (with weird formatting)

**Report if:** Extension crashes, content is corrupted, or saves fail

### 8.2 Network Issues
- [ ] Disconnect from internet
- [ ] Create clips offline
- [ ] Reconnect to internet
- [ ] Verify clips sync to cloud

**Report if:** Clips are lost when going offline/online, or sync never completes

### 8.3 Rapid Actions
- [ ] Copy 20 items in 10 seconds
- [ ] Click edit on multiple clips rapidly
- [ ] Create and delete categories quickly
- [ ] Switch between tabs while performing actions

**Report if:** Extension crashes, actions don't register, or data gets corrupted

---

## Phase 9: 20+ Markup Formats Testing (10 min)

Test that the "20+ markup formats & 190+ languages" feature works:

- [ ] Copy Markdown and verify formatting is detected
- [ ] Copy JSON and verify it's recognized as JSON
- [ ] Copy XML and verify it's parsed correctly
- [ ] Copy YAML and verify it's handled
- [ ] Copy code in: Python, JavaScript, Java, C++, Ruby
- [ ] Copy LaTeX formulas
- [ ] Copy CSV/TSV data

**For each format:**
- Extension should recognize the format
- Formatting/syntax should be preserved
- Pasting should maintain structure

**Report if:** Formats aren't recognized, syntax is broken, or content is corrupted

---

## How to Report Bugs

**Required Info in Every Bug Report:**

1. **What you were doing:** Step-by-step actions that led to the bug
2. **What you expected:** What should have happened
3. **What actually happened:** The bug/error you saw
4. **Error messages:** Copy any error text or messages
5. **Screenshots:** If applicable, show the bug visually
6. **Can you reproduce it?** Can you make it happen again?
7. **Your setup:** Edge version, OS (Windows/Mac/Linux), device type

**Where to Report:**
- Open PasteCraft extension
- Look for "Report a Bug" link in top nav bar (near Sign Out)
- Click it to open email contact form
- Fill out all fields with bug details

**Severity Levels to Mention:**
- **Critical:** Extension crashes, data loss, can't log in, features completely broken
- **High:** Major feature doesn't work, frequent errors, blocks normal usage
- **Medium:** Feature works but has issues, occasional errors, workarounds exist
- **Low:** Minor UI issues, typos, cosmetic problems

---

## Testing Checklist Summary

- [ ] Installation & setup complete
- [ ] Coupon REDDIT100 redeemed successfully
- [ ] All clipboard operations tested
- [ ] Categories and notes tested
- [ ] Cloud sync validated (same device)
- [ ] Cloud sync validated (cross-device if available)
- [ ] AI features confirmed blocked
- [ ] Search and filters tested
- [ ] Upgrade flow tested
- [ ] Security checks passed
- [ ] Multiple tabs/windows tested
- [ ] Edge cases and stress testing done
- [ ] Markup formats tested
- [ ] At least 3 bug reports submitted (or none if no bugs found!)

---

## Expected Testing Time

**Minimum:** 1.5 hours for basic validation  
**Recommended:** 3-4 hours for thorough testing  
**Ideal:** 1-2 weeks of regular daily usage

The more you use it like a real clipboard manager, the more likely you'll find bugs we missed!

---

## Thank You!

Your testing is invaluable. The more detailed your bug reports, the better the product will be for everyone. Don't hold back - break things, try weird stuff, and tell us what doesn't work.

Every bug you find is one less bug our paying customers will encounter. 🙏
