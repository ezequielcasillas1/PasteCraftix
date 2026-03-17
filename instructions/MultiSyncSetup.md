Agent Prompt: Multi-Device Clipboard Sync Implementation
Objective: Build a real-time, multi-device clipboard manager using Supabase (PostgreSQL + Realtime), Vanilla JS, and HTML/CSS. The system must ensure that Device B can "catch up" on data from Device A, even if Device B was offline or closed when the data was saved.
Phase 1: Supabase Schema & Security
Table Setup: Create a table clipboard_history with the following columns:
id (uuid, primary key)
user_id (uuid, references auth.users)
content (text)
device_id (text) — To identify the source of the data.
created_at (timestamptz, default now())
Constraints: Add a unique constraint to (user_id, content) to prevent duplicate entries if multiple devices sync the same data.
Realtime: Enable PostgreSQL Replication for the clipboard_history table.
RLS Policies:
Enable Row Level Security.
Create policies so users can only INSERT and SELECT their own data based on auth.uid().
Phase 2: Logic Implementation (The "Sync Engine")
Implement the following logic in a single JavaScript module:
1. Identity & Initialization:
Generate or retrieve a currentDeviceId using crypto.randomUUID() and store it in localStorage.
Initialize the Supabase client.
2. The "Catch-Up" (Reconciliation):
Create a function syncClipboard() that:
Fetches the latest 50 records from Supabase for the logged-in user.
Compares the IDs in the database with the IDs currently rendered in the UI.
Appends any missing records to the UI (sorted by created_at).
Trigger: Run syncClipboard() on page load AND whenever the window regains focus (window.onfocus).
3. The "Live-Update" (Realtime):
Initialize a Supabase Channel subscribing to postgres_changes.
Filter: Listen for INSERT events on clipboard_history where user_id equals the current user.
Echo Prevention: Inside the listener, if payload.new.device_id === currentDeviceId, ignore it (as it was sent by the current device). Otherwise, prepend the new data to the UI.
4. Data Outbound (Saving):
Create a function saveClip(text) that inserts the text into Supabase along with the user_id and currentDeviceId.
Phase 3: UI & UX Requirements
Handling System Limitations: Because browsers block background clipboard access, the UI must render a "Copy" button for each synced item.
Visual Feedback: Show a "Synced" indicator when a new item arrives from another device.
State Management: Ensure the UI stays sorted with the most recent clip at the top, regardless of which device it came from.