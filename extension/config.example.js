// Copy to config.js for local dev and CI (config.js is gitignored).
const PASTECRAFT_CONFIG = {
  supabase: {
    url: 'https://example.supabase.co',
    anonKey: 'example-anon-key'
  },
  stripe: {
    publishableKey: 'pk_test_example'
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PASTECRAFT_CONFIG;
}
