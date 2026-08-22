/** PasteCraft Scholar vs Merchant — marketing copy + use cases. */

export const productLines = {
  scholar: {
    name: 'PasteCraft Scholar',
    tagline: 'Your durable clipboard for thinking, coding, studying, and shipping knowledge work.',
    audience: 'Builders, students, researchers, writers, and anyone who copies more than they can remember.',
    storageModel: 'Clips, notes, and categories meant to last — local forever on Freemium, cloud-synced on paid Scholar tiers.',
    signatureTools: [
      'Unlimited clips, notes, and categories',
      'Searchable clipboard history',
      'Markup formats and multilingual paste',
      'Cloud sync across devices (Basic+)',
      'AI Lab: summaries, breakdowns, image→text (Enhanced)',
    ],
  },
  merchant: {
    name: 'PasteCraft Merchant',
    comingSoon: true,
    statusLabel: 'Coming soon',
    tagline: 'Coming soon — ephemeral listing staging for Etsy, POD, and marketplace sellers.',
    audience: 'Etsy, Printify, Shopify, Amazon, Redbubble, TeePublic, and other listing-heavy sellers.',
    storageModel: 'Temporary Listing Dock with TTL — staging that is meant to vanish after Seal & Ship, not a permanent archive.',
    signatureTools: [
      'Merchant top strip + Pulse indicator',
      'Listing Dock (title / description / tags staging)',
      'Tag queue with platform presets (Etsy 13×20, Printify, generic…)',
      'Materials + snippet paste helpers',
      'Spot + Image→Text on the seller strip',
      'Seal & Ship purge when the listing is done',
    ],
  },
};

export const comparisonRows = [
  {
    dimension: 'Primary job',
    scholar: 'Keep copied knowledge usable for days, weeks, or forever.',
    merchant: 'Fill marketplace listing fields fast, then clear the staging layer.',
  },
  {
    dimension: 'Who it is for',
    scholar: 'Vibe coders, engineers, students, PMs, writers, researchers.',
    merchant: 'Sellers listing products on Etsy, POD platforms, and storefronts.',
  },
  {
    dimension: 'Data lifespan',
    scholar: 'Durable clips & notes (local or cloud archive).',
    merchant: 'Corruptible / TTL staging — not a Scholar archive.',
  },
  {
    dimension: 'UI surface',
    scholar: 'Popup workspace, categories, search, AI Lab.',
    merchant: 'Page-top Merchant strip, Listing Dock, tag queue on listing pages.',
  },
  {
    dimension: 'AI cost model',
    scholar: 'AI Lab uses text credits (Enhanced) for summaries & breakdowns.',
    merchant: 'Client-side Spot / strip workflow — no per-call AI burn like Scholar AI Lab.',
  },
  {
    dimension: 'Subscription',
    scholar: 'Freemium / Basic / Enhanced Scholar tiers — available now.',
    merchant: 'Coming soon — not for sale yet.',
  },
  {
    dimension: 'Success looks like',
    scholar: 'You find the snippet you copied three days ago in under five seconds.',
    merchant: 'You publish a listing with correct tags/materials and the dock is empty.',
  },
];

export const useCaseCategories = [
  {
    id: 'vibe-coding',
    title: 'Vibe coding',
    eyebrow: 'Prompt → paste → ship',
    intro:
      'When you are bouncing between Cursor, ChatGPT, Claude, docs, Stack Overflow, and your editor, Scholar is the memory layer that keeps the good fragments from vanishing into the void.',
    cases: [
      {
        title: 'Prompt library that actually sticks',
        detail:
          'Save system prompts, agent instructions, and “works every time” few-shot examples as categorized clips. Reuse them across Cursor chats, Claude projects, and custom GPTs without retyping from memory.',
      },
      {
        title: 'Capture AI output before the tab dies',
        detail:
          'Model replies disappear when you close a chat or hit a rate limit. Copy the useful block into Scholar immediately — code, SQL, regex, or a rewritten README — then keep prompting without fear of losing the last good answer.',
      },
      {
        title: 'Multi-model comparison scratchpad',
        detail:
          'Run the same task in two models, clip both answers, and keep them side-by-side in notes or categories (“Claude draft” vs “GPT draft”) so you can merge the best parts into one final paste.',
      },
      {
        title: 'Scaffold packs for greenfield apps',
        detail:
          'Store boilerplate packs: env templates, folder trees, ESLint configs, Supabase RLS snippets, and “first PR checklist” text. When vibe coding a new idea, paste the pack instead of rebuilding ritual from scratch.',
      },
      {
        title: 'Error → fix loops',
        detail:
          'Clip the exact stack trace, the failing test output, and the fix that worked. Next time the same red wall appears, search Scholar instead of re-explaining the bug to an AI from zero.',
      },
      {
        title: 'Design-token and CSS fragment kits',
        detail:
          'Keep color tokens, spacing scales, and component CSS snippets you like. Paste them into new UI experiments without hunting through old repos.',
      },
      {
        title: 'Agent handoff notes',
        detail:
          'When you switch agents or machines mid-feature, clip the current plan, file list, and “do not touch” warnings so the next session starts with context instead of archaeology.',
      },
      {
        title: 'Demo script + sample data',
        detail:
          'For livestreams or friend demos, keep sample JSON, seed SQL, and spoken demo scripts ready to paste so the vibe stays smooth on camera.',
      },
    ],
  },
  {
    id: 'software-engineering',
    title: 'Software engineering',
    eyebrow: 'Serious shipping workflows',
    intro:
      'Engineers copy constantly — tickets, diffs, configs, API payloads, runbooks. Scholar turns that firehose into a searchable personal knowledge base that travels with your browser.',
    cases: [
      {
        title: 'PR review comment bank',
        detail:
          'Save reusable review comments (security nits, naming conventions, test gaps) and paste them into GitHub/GitLab reviews with consistent tone and standards.',
      },
      {
        title: 'Incident runbook fragments',
        detail:
          'Clip kubectl commands, rollback steps, feature-flag toggles, and status-page templates. During an incident, search and paste instead of scrolling Slack history.',
      },
      {
        title: 'API contract playground',
        detail:
          'Keep request/response JSON examples, curl recipes, and auth header shapes for the services you touch weekly. Paste into Postman, Insomnia, or a terminal without rebuilding payloads.',
      },
      {
        title: 'Migration & SQL snippet vault',
        detail:
          'Store idempotent SQL, RLS policy templates, and “safe alter” patterns. Especially useful when you cannot risk inventing a migration under pressure.',
      },
      {
        title: 'Cross-repo config parity',
        detail:
          'When multiple services share CI, lint, or deploy config, keep the canonical snippet in Scholar and paste updates into each repo so drift shrinks.',
      },
      {
        title: 'Onboarding buddy for new teammates',
        detail:
          'Build a category of “day-one pastes”: VPN notes, local setup commands, staging URLs, and “who owns what.” Share by exporting or walking through clips live.',
      },
      {
        title: 'Debug evidence packs',
        detail:
          'Clip logs, HAR excerpts, feature flags, and reproduction steps into one note before filing a bug. Reviewers get a complete pack instead of a vague “it broke.”',
      },
      {
        title: 'Architecture decision scratch',
        detail:
          'Capture ADR drafts, trade-off lists, and meeting quotes. Later, AI Lab summaries (Enhanced) can compress a long decision thread into a pasteable ADR body.',
      },
      {
        title: 'Release checklist paste',
        detail:
          'Keep version bump steps, store upload checklists, and smoke-test scripts as clips so releases stay consistent across Chrome/Edge packages.',
      },
      {
        title: 'Security & secrets hygiene reminders',
        detail:
          'Store non-secret checklists (“never commit .env”, “rotate after leak”) and paste them into PR templates or team chats when someone is about to ship credentials.',
      },
    ],
  },
  {
    id: 'study',
    title: 'Study & learning',
    eyebrow: 'From lecture to lasting notes',
    intro:
      'Students and lifelong learners copy definitions, proofs, citations, and flashcard text all day. Scholar keeps study material organized so revision is search, not scroll.',
    cases: [
      {
        title: 'Lecture capture without losing the thread',
        detail:
          'Copy key slides, formulas, and professor asides into categorized clips (by course or week). After class, you still have the fragments that mattered.',
      },
      {
        title: 'Citation & quote bank',
        detail:
          'Save APA/MLA citation strings, DOI links, and quotable passages with source labels so papers and essays assemble faster and more accurately.',
      },
      {
        title: 'Language learning phrase decks',
        detail:
          'Clip example sentences, conjugations, and idiom explanations. Paste into Anki, Quizlet, or a notes app in batches without retyping.',
      },
      {
        title: 'Exam formula sheets',
        detail:
          'Build a category of allowed formulas, unit conversions, and mnemonic lines. Search during practice exams the same way you will search during open-note assessments.',
      },
      {
        title: 'Research rabbit-hole recovery',
        detail:
          'When a Wikipedia → paper → blog chain goes deep, clip the useful paragraphs and URLs so you can return tomorrow without reconstructing the path.',
      },
      {
        title: 'Coding bootcamp / tutorial checkpoints',
        detail:
          'Save “gotcha” notes from tutorials (wrong Node version, missing env var) next to the working command so future you does not repeat the same two-hour trap.',
      },
      {
        title: 'AI tutor dialogue archives',
        detail:
          'Clip the explanations that finally made a concept click. Re-read them before the exam instead of hoping the chat history still exists.',
      },
      {
        title: 'Group project paste board',
        detail:
          'Keep shared meeting notes, task lists, and draft paragraphs in Scholar categories so each teammate can paste the latest version into Docs or Notion.',
      },
      {
        title: 'Certification exam dumps (ethical study)',
        detail:
          'Store your own practice answers, weak-topic lists, and official objective statements — not pirated dumps — as a personal revision library.',
      },
    ],
  },
  {
    id: 'productivity',
    title: 'Productivity & knowledge work',
    eyebrow: 'Everyday clipboard clarity',
    intro:
      'Beyond code and class: email, ops, content, and life admin all generate copy-paste chaos. Scholar is the calm inbox for text you will need again.',
    cases: [
      {
        title: 'Email & message templates',
        detail:
          'Save outreach intros, follow-ups, refund replies, and meeting-request templates. Paste, personalize one line, send — without rewriting the same politeness every time.',
      },
      {
        title: 'Meeting action capture',
        detail:
          'During calls, copy decisions and owners into clips tagged by project. After the call, paste a clean action list into Slack or Linear.',
      },
      {
        title: 'Content repurposing pipeline',
        detail:
          'Clip a long LinkedIn post, then keep shorter X/Threads variants and a newsletter blurb in the same category for scheduled publishing.',
      },
      {
        title: 'Form-fill personal data (non-secret)',
        detail:
          'Store address lines, bio blurbs, portfolio URLs, and “about me” paragraphs for applications and speaker forms — never passwords or card numbers.',
      },
      {
        title: 'Support & customer reply macros',
        detail:
          'Support folks keep troubleshooting steps and empathy openers as clips, then paste the right macro into helpdesk tools in seconds.',
      },
      {
        title: 'Travel & logistics snippets',
        detail:
          'Confirmation numbers (non-sensitive), packing lists, and itinerary blocks stay searchable when airports and hotels ask for the same info twice.',
      },
      {
        title: 'Cross-device continuity',
        detail:
          'Copy research on a laptop, paste on a desktop after Basic sync — Scholar’s cloud tier exists so your clipboard brain is not trapped on one machine.',
      },
      {
        title: 'AI Lab compression for long reads',
        detail:
          'On Enhanced, paste a long article or transcript into AI Lab for a summary or breakdown, then save the result as a durable clip for later writing.',
      },
      {
        title: 'Personal wiki without the wiki tax',
        detail:
          'Not everyone wants Notion structure. Scholar lets lightweight “wiki pages” live as notes and categorized clips that appear the moment you copy something useful.',
      },
    ],
  },
];

export const merchantUseCases = [
  {
    title: 'Etsy tag grid without comma-list pain',
    detail:
      'Etsy’s 13×20 tag slots reject bulk paste. Merchant’s tag queue pastes one validated tag at a time with platform presets so listings stay within limits.',
  },
  {
    title: 'Materials chips & personalization snippets',
    detail:
      'Stage materials and checkout personalization notes in the Listing Dock, then paste into the right fields without mixing them into your permanent Scholar archive.',
  },
  {
    title: 'POD multi-platform listing packs',
    detail:
      'Move the same design across Printify, Redbubble, TeePublic, or Shopify with listing-pack shaped staging (title / description / tags) tuned per platform preset.',
  },
  {
    title: 'Amazon bullets vs backend search terms',
    detail:
      'Keep shopper-facing bullets separate from hidden backend keywords. Merchant helps stage and paste each stream into the correct Amazon inputs.',
  },
  {
    title: 'eBay item specifics values',
    detail:
      'Paste short values into name→value specifics (Material → Cotton) without treating them like Etsy tags or freeform Scholar notes.',
  },
  {
    title: 'Social promo after export',
    detail:
      'After a listing ships, use Merchant helpers for Instagram/Pinterest captions and hashtag slots — still ephemeral staging, not a forever clip library.',
  },
  {
    title: 'Seal & Ship cleanup',
    detail:
      'When the listing is live, Seal & Ship confirms purge so temporary tags and drafts do not clutter your seller workflow or leak into Scholar history.',
  },
  {
    title: 'Image→Text on the seller strip',
    detail:
      'Pull text from mockups or packaging photos into the Merchant strip for quick keyword harvest — optimized for listing speed, not long-term study notes.',
  },
];

export const chooseGuide = [
  {
    title: 'Choose Scholar if…',
    points: [
      'You lose useful text after closing a chat, tab, or IDE.',
      'You need categories, search, notes, and optional AI Lab.',
      'Your work is coding, studying, writing, or general productivity.',
      'You want clips that survive for weeks or forever (local or synced).',
    ],
  },
  {
    title: 'Merchant is coming soon if…',
    points: [
      'You publish marketplace listings with many small fields.',
      'You need tag queues, materials, and listing dock staging.',
      'You want staging that expires after Seal & Ship.',
      'Not available to buy yet — Scholar is the current product.',
    ],
  },
  {
    title: 'A future bundle if…',
    points: [
      'You sell online and also vibe-code, study, or write heavily.',
      'You want durable Scholar memory plus Merchant listing speed later.',
      'Bundle pricing is not for sale yet.',
    ],
  },
];
