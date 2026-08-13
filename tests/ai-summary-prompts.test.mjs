import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(
  join(__dirname, '..', 'supabase/functions/_shared/ai_summary_prompts.js'),
).href;
const { buildTextPrompts, wantsBareOutput } = await import(url);

assert.equal(wantsBareOutput('Return ONLY the title'), true);
assert.equal(wantsBareOutput('Output titles only, one per line'), true);
assert.equal(wantsBareOutput('What is the main claim?'), false);

const summary = buildTextPrompts({ text: 'hello', hasImage: false });
assert.match(summary.systemPrompt, /## Sources/);

const title = buildTextPrompts({
  text: 'hello',
  question: 'Generate a short note title (max 6 words). Return ONLY the title, no quotes.',
  hasImage: false,
});
assert.equal(/## Sources/.test(title.systemPrompt), false);

const questions = buildTextPrompts({ text: 'hello', generateQuestions: true, hasImage: false });
assert.equal(/## Sources/.test(questions.systemPrompt), false);

const vision = buildTextPrompts({ text: 'img', hasImage: true });
assert.match(vision.systemPrompt, /## Sources/);

console.log('ai-summary-prompts.test.mjs ok');
