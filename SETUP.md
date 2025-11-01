# PasteCraft Setup Guide

## 🚀 Quick Setup

### 1. Configure API Keys

PasteCraft now connects to Supabase and uses OpenAI for AI features. Follow these steps to set up your API keys:

#### Step 1: Get Your API Keys

**Supabase:**
1. Go to your Supabase project: https://blpngeeqcegquiydreyu.supabase.co
2. Navigate to Project Settings → API
3. Copy your `anon/public` key

**OpenAI:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (you won't be able to see it again!)

#### Step 2: Update config.js

Open `config.js` in your PasteCraft folder and replace the placeholder values:

```javascript
const PASTECRAFT_CONFIG = {
  supabase: {
    url: 'https://blpngeeqcegquiydreyu.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY_HERE' // ← Replace this
  },
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY_HERE' // ← Replace this
  }
};
```

**⚠️ Security Note:** Never commit `config.js` with real API keys to version control. The file is already added to `.gitignore`.

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the PasteCraft folder
5. The extension should now be loaded!

## ✨ New Features

### Profile Section

Click the 👤 icon in the top right of the extension popup to access your profile.

#### AI-Generated Funky Name
1. Enter your name in the profile
2. Click "Generate AI Name"
3. Get a unique, funky username!

#### AI Profile Image
Two options:
- **Upload Photo**: Upload your own image
- **AI Generate**: Let AI create a funky cartoon avatar for you
  - If you've uploaded a photo, AI will use it as reference
  - Otherwise, AI creates a unique avatar based on your name

#### Dark Mode (Coming Soon)
The UI text is there, but functionality will be added in a future update.

#### Unsubscribe
Permanently delete all your data from PasteCraft (with double confirmation for safety).

## 🗄️ Database Setup (Optional)

If you want to store data in Supabase, create these tables:

### user_profiles table

```sql
create table user_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_name text,
  ai_name text,
  profile_image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table user_profiles enable row level security;

-- Create policy to allow all operations (adjust based on your auth needs)
create policy "Allow all operations" on user_profiles
  for all using (true);
```

### profile-images storage bucket

1. Go to Storage in Supabase dashboard
2. Create a new bucket called `profile-images`
3. Set it to public
4. Add policy to allow uploads

## 🔧 Troubleshooting

### "Please configure API keys" error
- Make sure you've updated `config.js` with real API keys
- Reload the extension after updating config.js

### Supabase not connecting
- Check that your Supabase URL is correct
- Verify your anon key has the right permissions
- Check browser console for specific errors

### OpenAI API errors
- Verify your API key is valid
- Check you have credits in your OpenAI account
- Make sure API key has access to GPT-3.5 and DALL-E 3

## 📝 Usage Tips

1. **Generate Name First**: Create your AI name before generating profile image for best results
2. **Upload Reference Photo**: For better AI-generated avatars, upload a photo first
3. **Test API Keys**: Try generating a name first (uses less credits) to verify your setup

## 🆘 Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Verify API keys are correctly configured
3. Ensure you have credits/quota in your API accounts
4. Check network tab for failed API requests

## 🎉 You're All Set!

Enjoy your enhanced PasteCraft experience with AI-powered features!

