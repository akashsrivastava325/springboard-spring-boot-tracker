# Springboard — Spring Boot study tracker

A mobile-friendly interview notebook with 204 questions in 20 prerequisite-led sections.

## Study features

- Question checkboxes and per-section progress.
- Separate Complete and Skim note editors and revision views.
- Red **+ Pre-REQUISITE** buttons inside each question card. Add a question or standalone note immediately before the selected question.
- Complete and Skim notes can be entered directly while adding an item.
- Search across questions and notes; filter by section, source, or progress.
- Automatic browser-local saving, validated JSON backup export/import, and printing.
- Comfortable 16px answer typography with neutral colors, spacious paragraphs, Markdown tables, and code blocks in all answer views and previews.
- Paste Markdown from ChatGPT’s Copy button, or paste selected formatted text to convert headings, lists, tables, and code into editable Markdown. Custom ChatGPT visual widgets are not portable Markdown and may paste as text.
- Comments buttons on every question and personal note, with private per-account threads, timestamped bubbles, and a new-comment composer.
- Visible Delete buttons for all personal questions and notes, including prerequisites, with confirmation and a 15-second Undo that restores notes and position.

## Publish on GitHub Pages

In this repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/(root)**, and click **Save**. GitHub then builds the site.

The site has no build step. Publish `index.html`, `firebase-config.js`, `firebase-sync.mjs`, `sync-engine.mjs`, `answer-style.css`, `paste-markdown.js`, `comments.js`, `comments.css`, and `comments-store.mjs` together. Firebase SDK modules load from Google’s CDN only when configured.

## Account sync with Firebase

Guest notes remain in the current browser. Signed-in notebooks are private to each Firebase account and sync across devices. Email/password registration, sign-in, password reset, and sign-out are available. Use the same account on your phone.

### One-time setup

1. Sign in to [Firebase Console](https://console.firebase.google.com/) with your Gmail and create a project. Analytics is optional.
2. In Project settings → Your apps, register a Web app. Copy its `apiKey`, `authDomain`, `projectId`, and `appId` into `firebase-config.js`. This configuration is public; never add a service-account JSON or private key.
3. In Authentication → Sign-in method, enable Email/Password. In Authentication → Settings → Authorized domains, add `akashsrivastava325.github.io` (and `localhost` for local testing).
4. Create the default Cloud Firestore database in production mode, choosing your preferred region.
5. In Firestore → Rules, paste the contents of `firestore.rules` and Publish. These rules restrict access to the signed-in owner’s notebook. Alternatively, use `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID` with the Firebase CLI.
6. Publish these files to GitHub Pages. Create a tracker account, then choose **Copy guest notebook to account** from the browser that holds your existing notes. This replaces the account notebook after confirmation. Export a backup first if both have notes.
7. On your phone, open the same Pages URL and sign in to that tracker account.

Signing into Firebase Console with Gmail creates/manages your Firebase project. Your tracker’s email/password accounts are separate from that console sign-in.

### Saving and conflicts

Edits save locally immediately and upload after 800 ms of inactivity. An open, visible page checks for remote changes every 15 seconds while no editor is open. Refreshing also loads cloud changes. Offline edits are kept in a per-account local queue, retried when online, and restored after reload once signed in. Check **Saved to your account** before switching devices. Sign-out waits for pending saves and keeps you signed in if they fail.

Firestore stores each notebook at `users/{uid}/notebooks/main`. Each save uses a transaction and checks the cloud revision. If both devices have changed the notebook, sync pauses and offers **Load cloud copy** or **Replace cloud with this copy**. Export a backup first; no automatic merge is attempted. Guest notes are never uploaded automatically or mixed between accounts. Local account caches remain in the browser after sign-out; use a trusted browser profile.

A notebook’s UTF-8 JSON must be below 900,000 bytes to fit safely within Firestore’s document limit. Larger notebooks remain locally available with an explicit sync error; export a backup and shorten notes before retrying. JSON export/import and printing remain available. Import while signed in replaces that account notebook after confirmation and syncs it to the cloud.

### Validation

Run `node --test tests/sync.test.mjs` for cross-device saving, revision conflict handling, restored pending edits, network retry, and edits arriving during an upload. Use a real Firebase project or the Firestore emulator to verify the deployed rules and authentication setup before merging. Verify account A cannot read account B’s document and signed-out requests are denied.

## Curriculum

Questions are adapted from CodingShuttle, GeeksforGeeks, and InterviewBit, with added Foundation questions. Source links appear in the tracker. Learn version-specific APIs against your chosen Spring Boot version.

For reader and deletion checks, serve an isolated local copy with `window.SPRINGBOARD_FIREBASE_CONFIG = {};` and open `tests/reader-browser.html`. The 12 browser checks cover clipboard conversion, code whitespace, unsafe HTML stripping, editor paste saving, prerequisite deletion, cancellation, Undo, protected seed items, both revision views, and answer typography. This harness refuses to run on production hosts.

## Private question comments

Open **Comments** beside a question, sign in, and use **New comment** or the composer at the bottom. Each comment shows its author and full local date/time. Comments appear on your other devices when signed into the same account. Threads are private; the Facebook-style appearance does not make them public. Comments are plain text and support up to 5,000 characters.

Comments are append-only documents under `users/{uid}/questionComments/{commentId}`. Existing notebook records and their schema are unchanged. Creating or reading a comment never calls the notebook saving code. The added Firestore rule permits only the account owner to read/create comments and denies updates and deletion of comments. No migration, record replacement, database cleanup, or cascade deletion is performed. Notebook import/export does not modify or include these separate comments.

Timestamp values come from Firestore server timestamps. Comment IDs remain stable for retries to avoid duplicate posts. A failed post keeps an account- and question-specific local draft. New posts require a working connection; the interface reports failures and offers retry through the Post comment button.

Run `node --test tests/sync.test.mjs tests/comments-store.test.mjs` for data-preservation, retry idempotency, account isolation, validation, sorting, and existing sync checks. In an isolated local preview with Firebase disabled, open `tests/comments-browser.html` for the comments UI checks. No production records are used or modified by these tests.
