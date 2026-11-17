// PasteCraft public Supabase project (anon key only — safe to ship in the extension).
const PASTECRAFT_CONFIG = {
  supabase: {
    url: 'https://blpngeeqcegquiydreyu.supabase.co',
    anonKey: [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscG5nZWVxY2VncXVpeWRyZXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzkyOTAsImV4cCI6MjA3NzUxNTI5MH0',
      'eRuh8Eu66wyAMNu0tRyc9LCGVRp7Dhm_87BiQhnRY2o',
    ].join('.'),
  },
  stripe: {
    publishableKey: 'pk_test_example',
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PASTECRAFT_CONFIG;
}