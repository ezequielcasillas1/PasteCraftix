// Supabase Client for PasteCraft
// This file initializes the Supabase client for the extension
console.log('🟢 supabase-client.js LOADED at', new Date().toISOString());

class PasteCraftSupabase {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.init();
  }
  
  async init() {
    try {
      if (typeof PASTECRAFT_CONFIG === 'undefined') {
        console.error('❌ Config not loaded. Make sure config.js is included before supabase-client.js');
        return;
      }
      
      // Check for placeholder API keys
      if (PASTECRAFT_CONFIG.supabase.anonKey.includes('YOUR_SUPABASE_ANON_KEY_HERE')) {
        console.warn('⚠️ Supabase key not configured - using placeholder');
        this.initialized = true; // Still mark as initialized for OpenAI-only features
        return;
      }
      
      // Check if Supabase is loaded from CDN
      if (typeof supabase === 'undefined' || !supabase.createClient) {
        console.warn('⚠️ Supabase library not loaded from CDN - Supabase features disabled, but OpenAI features will work');
        this.initialized = true; // Still mark as initialized for OpenAI-only features
        return;
      }
      
      // Initialize Supabase client
      this.client = supabase.createClient(
        PASTECRAFT_CONFIG.supabase.url,
        PASTECRAFT_CONFIG.supabase.anonKey
      );
      
      this.initialized = true;
      console.log('✅ Supabase client initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      this.initialized = true; // Still allow OpenAI features to work
    }
  }
  
  // User Profile Methods
  async getUserProfile(userId) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }
  
  async createUserProfile(profileData) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .insert([profileData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      return null;
    }
  }
  
  async updateUserProfile(userId, updates) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      return null;
    }
  }
  
  async uploadProfileImage(userId, imageFile) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;
      
      const { data, error } = await this.client.storage
        .from('profile-images')
        .upload(filePath, imageFile);
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = this.client.storage
        .from('profile-images')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      return null;
    }
  }
  
  // OpenAI Integration Methods
  async generateAIName(userName) {
    try {
      if (typeof PASTECRAFT_CONFIG === 'undefined' || !PASTECRAFT_CONFIG.openai.apiKey || PASTECRAFT_CONFIG.openai.apiKey.includes('YOUR_OPENAI_API_KEY_HERE')) {
        console.error('❌ OpenAI API key not configured');
        throw new Error('OpenAI API key not configured. Please update config.js with your real API key.');
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.openai.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a creative name generator. Combine the user\'s name with a random cool animal type. Format: [Name][Animal]. Examples: ZekeRabbit, SarahTiger, JohnDragon, MikeFox, LilyPanda. Pick fun animals like: Rabbit, Tiger, Dragon, Fox, Wolf, Bear, Panda, Lion, Eagle, Phoenix, Unicorn, Owl. Keep it under 20 characters. Only respond with the combined name, nothing else.'
            },
            {
              role: 'user',
              content: `Create an animal username for: ${userName}`
            }
          ],
          max_tokens: 30,
          temperature: 1.0
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const aiName = data.choices[0].message.content.trim();
      console.log('✅ Generated AI name:', aiName);
      return aiName;
      
    } catch (error) {
      console.error('Failed to generate AI name:', error);
      return null;
    }
  }
  
  async analyzePhotoWithVision(imageBase64) {
    try {
      if (typeof PASTECRAFT_CONFIG === 'undefined' || !PASTECRAFT_CONFIG.openai.apiKey || PASTECRAFT_CONFIG.openai.apiKey.includes('YOUR_OPENAI_API_KEY_HERE')) {
        console.error('❌ OpenAI API key not configured');
        throw new Error('OpenAI API key not configured.');
      }

      console.log('🔍 Analyzing photo with GPT-4 Vision...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.openai.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this person in detail for creating a cartoon avatar. Focus on: face shape, hair style and color, eye color, glasses/facial hair if any, skin tone, distinctive features, and overall vibe. Be specific and descriptive. Keep it under 100 words.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageBase64
                  }
                }
              ]
            }
          ],
          max_tokens: 200
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Vision API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const description = data.choices[0].message.content;
      console.log('✅ Photo analysis complete:', description);
      return description;

    } catch (error) {
      console.error('Failed to analyze photo:', error);
      throw error;
    }
  }

  async generateProfileImageWithReplicate(userImageBase64, description) {
    try {
      // Debug logging
      console.log('🔍 Checking Replicate config...');
      console.log('Config exists?', typeof PASTECRAFT_CONFIG !== 'undefined');
      console.log('Replicate object exists?', PASTECRAFT_CONFIG?.replicate);
      console.log('Token exists?', !!PASTECRAFT_CONFIG?.replicate?.apiToken);
      console.log('Token value:', PASTECRAFT_CONFIG?.replicate?.apiToken?.substring(0, 10) + '...');
      
      if (typeof PASTECRAFT_CONFIG === 'undefined') {
        throw new Error('PASTECRAFT_CONFIG not loaded. Check if config.js is loaded before supabase-client.js');
      }
      
      if (!PASTECRAFT_CONFIG.replicate) {
        throw new Error('Replicate configuration missing in config.js');
      }
      
      if (!PASTECRAFT_CONFIG.replicate.apiToken || PASTECRAFT_CONFIG.replicate.apiToken.includes('YOUR_REPLICATE_API_TOKEN_HERE')) {
        throw new Error('Replicate API token not configured. Please add your token to config.js line 18');
      }

      console.log('✅ Replicate config validated');
      console.log('🎨 Creating cartoon remix with Replicate...');

      // Create prediction with image-to-image model
      const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${PASTECRAFT_CONFIG.replicate.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: 'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4', // SDXL cartoon model
          input: {
            image: userImageBase64,
            prompt: "transform this person into a colorful cartoon character, preserve facial features and likeness, funky vibrant style, bold outlines, animated look, keep same face shape and hair",
            negative_prompt: "multiple people, different person, unrecognizable, realistic photo, blurry, low quality, distorted",
            strength: 0.5,
            guidance_scale: 8.5,
            num_inference_steps: 40,
            disable_safety_checker: true
          }
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        console.error('❌ Replicate API Response:', {
          status: createResponse.status,
          statusText: createResponse.statusText,
          errorData: errorData,
          detail: errorData.detail || errorData.error || 'No error details'
        });
        throw new Error(`Replicate API error (${createResponse.status}): ${errorData.detail || errorData.error || createResponse.statusText}`);
      }

      const prediction = await createResponse.json();
      console.log('⏳ Prediction created, waiting for result...');

      // Poll for completion
      let result = prediction;
      while (result.status === 'starting' || result.status === 'processing') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: {
            'Authorization': `Token ${PASTECRAFT_CONFIG.replicate.apiToken}`
          }
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to check prediction status');
        }

        result = await statusResponse.json();
        console.log('⏳ Status:', result.status);
      }

      if (result.status === 'succeeded') {
        const imageUrl = result.output[0]; // Replicate returns array of URLs
        console.log('✅ Cartoon generated:', imageUrl);
        return imageUrl;
      } else {
        throw new Error(`Replicate failed: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Failed to generate with Replicate:', error);
      throw error;
    }
  }

  async generateProfileImage(description, userImageBase64 = null, aiGeneratedName = null) {
    try {
      // Check if this is an animal avatar request
      if (userImageBase64 === 'animal' && aiGeneratedName) {
        // Extract animal type from AI generated name
        const animalMatch = aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Racoon|Shark|Dolphin|Cheetah|Leopard|Panther)$/i);
        if (animalMatch) {
          const animalType = animalMatch[1];
          console.log(`🐾 Creating ${animalType} avatar from AI name...`);
          
          // Enhanced prompt with personality and style
          const animalTraits = {
            Rabbit: 'quick, energetic, playful with big expressive eyes',
            Tiger: 'fierce, confident, bold with striking stripes',
            Dragon: 'mystical, powerful, majestic with vibrant scales',
            Fox: 'clever, sly, charming with a mischievous grin',
            Wolf: 'loyal, strong, noble with piercing eyes',
            Bear: 'friendly, strong, cuddly with a warm smile',
            Panda: 'chill, cute, peaceful with bamboo vibes',
            Lion: 'regal, courageous, majestic with flowing mane',
            Eagle: 'sharp, focused, soaring with spread wings',
            Phoenix: 'fiery, reborn, radiant with flame feathers',
            Unicorn: 'magical, sparkly, whimsical with rainbow mane',
            Owl: 'wise, mysterious, intelligent with big round eyes'
          };
          
          const trait = animalTraits[animalType] || 'cool, funky, energetic';
          const prompt = `Create a single ultra-funky cartoon ${animalType} character avatar. The ${animalType} is ${trait}. Style: vibrant neon colors (pink, cyan, yellow, purple), bold thick black outlines, modern animated/anime style, playful and full of energy. The ${animalType} is anthropomorphic - standing upright on two legs, wearing cool streetwear or accessories, expressive face with personality. Background: simple gradient or solid color. Composition: portrait style, centered, showing character from chest up. Make it colorful, fun, and bursting with character! Show ONLY ONE ${animalType}, no other animals or people.`;
          
          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${PASTECRAFT_CONFIG.openai.apiKey}`
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: prompt,
              n: 1,
              size: '1024x1024',
              quality: 'standard'
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`DALL-E API error: ${errorData.error?.message || response.statusText}`);
          }
          
          const data = await response.json();
          const imageUrl = data.data[0].url;
          console.log(`✅ Generated funky ${animalType} avatar!`);
          return imageUrl;
        }
      }
      
      // Extract animal type from AI generated name if available
      let animalType = null;
      if (aiGeneratedName) {
        // Extract animal from name like "ZekeRabbit" → "Rabbit"
        const animalMatch = aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Racoon|Shark|Dolphin|Cheetah|Leopard|Panther)$/i);
        if (animalMatch) {
          animalType = animalMatch[1];
          console.log('🐾 Detected animal type from name:', animalType);
        }
      }
      
      // If user uploaded a photo but has an animal name, create animal hybrid
      if (userImageBase64 && userImageBase64 !== 'animal' && animalType) {
        console.log(`🎨 Creating funky ${animalType} cartoon character...`);
        
        const prompt = `Create a single funky cartoon ${animalType} character avatar. Style: vibrant neon colors, bold black outlines, modern animated style, playful and energetic. The ${animalType} should be anthropomorphic (standing upright, expressive face), cool and confident pose, portrait orientation. Make it colorful, fun, and full of personality. Show ONLY ONE ${animalType} character, centered.`;
        
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PASTECRAFT_CONFIG.openai.apiKey}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard'
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`DALL-E API error: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        const imageUrl = data.data[0].url;
        console.log(`✅ Generated funky ${animalType} avatar!`);
        return imageUrl;
      }
      
      // If user uploaded a photo but no animal name, analyze photo
      if (userImageBase64) {
        console.log('📸 User photo detected, analyzing features with GPT-4 Vision...');
        const personDescription = await this.analyzePhotoWithVision(userImageBase64);
        
        if (!personDescription) {
          throw new Error('Failed to analyze photo. Please try again.');
        }
        
        console.log('✅ Photo analyzed:', personDescription);
        console.log('🎨 Generating cartoon with DALL-E 3 based on your features...');
        
        // Use DALL-E with the detailed description
        const prompt = `Create a single funky cartoon avatar portrait of this person: ${personDescription}. Style: vibrant colors, bold black outlines, modern cartoon/animated character style, playful and fun. Show ONLY ONE person, centered, portrait orientation. Make it colorful and energetic while keeping their recognizable features.`;
        
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PASTECRAFT_CONFIG.openai.apiKey}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard'
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`DALL-E API error: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        const imageUrl = data.data[0].url;
        console.log('✅ Generated cartoon avatar with DALL-E');
        return imageUrl;
      }
      
      // If no photo uploaded, fall back to OpenAI DALL-E for text-to-image
      if (typeof PASTECRAFT_CONFIG === 'undefined' || !PASTECRAFT_CONFIG.openai.apiKey || PASTECRAFT_CONFIG.openai.apiKey.includes('YOUR_OPENAI_API_KEY_HERE')) {
        throw new Error('No photo uploaded and OpenAI not configured. Please upload a photo first or configure OpenAI API key.');
      }

      console.log('🎨 No photo uploaded, using OpenAI DALL-E...');
      const prompt = `Create a single funky cartoon avatar portrait. Style: vibrant, colorful, modern cartoon art with bold outlines. Show only ONE person, centered, portrait style. Theme: ${description}`;
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.openai.apiKey}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DALL-E API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      const imageUrl = data.data[0].url;
      console.log('✅ Generated profile image with DALL-E');
      return imageUrl;
      
    } catch (error) {
      console.error('Failed to generate profile image:', error);
      throw error;
    }
  }

  // =====================================================
  // REAL-TIME DATA SYNC METHODS
  // =====================================================

  /**
   * Get Chrome user ID for syncing
   */
  async getChromeUserId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['chromeUserId'], (result) => {
        if (result.chromeUserId) {
          resolve(result.chromeUserId);
        } else {
          // Generate new user ID
          const newUserId = `chrome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          chrome.storage.local.set({ chromeUserId: newUserId }, () => {
            resolve(newUserId);
          });
        }
      });
    });
  }

  /**
   * Set RLS context for user
   */
  async setUserContext(userId) {
    if (!this.client) return;
    
    try {
      await this.client.rpc('set_config', {
        setting: 'app.current_user_id',
        value: userId
      });
      console.log('✅ User context set:', userId);
    } catch (error) {
      console.warn('⚠️ Could not set user context (RLS may not be configured):', error.message);
    }
  }

  // =====================================================
  // CLIPS SYNC METHODS
  // =====================================================

  /**
   * Sync local clips to Supabase
   */
  async syncClipsToSupabase(localClips) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping clip sync');
      return false;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log(`📤 Syncing ${localClips.length} clips to Supabase...`);

      // Transform local clips to DB format
      const dbClips = localClips.map(clip => ({
        user_id: userId,
        clip_id: clip.id,
        text: clip.text,
        category: clip.category || 'Uncategorized',
        timestamp: clip.timestamp
      }));

      // Upsert clips (insert or update on conflict)
      const { data, error } = await this.client
        .from('clips')
        .upsert(dbClips, {
          onConflict: 'user_id,clip_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`✅ Synced ${data.length} clips to Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync clips to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync clips from Supabase to local storage
   */
  async syncClipsFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping clip sync');
      return null;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching clips from Supabase...');

      const { data, error } = await this.client
        .from('clips')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Transform DB format to local format
      const localClips = data.map(clip => ({
        id: clip.clip_id,
        text: clip.text,
        category: clip.category,
        timestamp: clip.timestamp
      }));

      console.log(`✅ Fetched ${localClips.length} clips from Supabase`);
      return localClips;
    } catch (error) {
      console.error('❌ Failed to fetch clips from Supabase:', error);
      return null;
    }
  }

  /**
   * Merge local and remote clips (newest wins)
   */
  async mergeClips(localClips, remoteClips) {
    const merged = new Map();

    // Add all local clips
    localClips.forEach(clip => {
      merged.set(clip.id, clip);
    });

    // Add/update with remote clips (newer timestamp wins)
    remoteClips.forEach(remoteClip => {
      const localClip = merged.get(remoteClip.id);
      if (!localClip || remoteClip.timestamp > localClip.timestamp) {
        merged.set(remoteClip.id, remoteClip);
      }
    });

    return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  // =====================================================
  // CATEGORIES SYNC METHODS
  // =====================================================

  /**
   * Sync categories to Supabase
   */
  async syncCategoriesToSupabase(localCategories) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping category sync');
      return false;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log(`📤 Syncing ${localCategories.length} categories to Supabase...`);

      const dbCategories = localCategories.map(cat => ({
        user_id: userId,
        category_id: cat.id,
        name: cat.name,
        icon: cat.icon || '📁'
      }));

      const { data, error } = await this.client
        .from('categories')
        .upsert(dbCategories, {
          onConflict: 'user_id,category_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`✅ Synced ${data.length} categories to Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync categories to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync categories from Supabase
   */
  async syncCategoriesFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping category sync');
      return null;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching categories from Supabase...');

      const { data, error } = await this.client
        .from('categories')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const localCategories = data.map(cat => ({
        id: cat.category_id,
        name: cat.name,
        icon: cat.icon
      }));

      console.log(`✅ Fetched ${localCategories.length} categories from Supabase`);
      return localCategories;
    } catch (error) {
      console.error('❌ Failed to fetch categories from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // SETTINGS SYNC METHODS
  // =====================================================

  /**
   * Sync settings to Supabase
   */
  async syncSettingsToSupabase(localSettings) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping settings sync');
      return false;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log('📤 Syncing settings to Supabase...');

      const dbSettings = {
        user_id: userId,
        auto_delete_period: localSettings.autoDeletePeriod || 'never',
        theme: localSettings.theme || 'light',
        auto_hide: localSettings.autoHide !== false,
        show_timestamps: localSettings.showTimestamps !== false,
        max_clips_display: localSettings.maxClipsDisplay || 20,
        delimiter: localSettings.delimiter || 'comma',
        custom_delimiter: localSettings.customDelimiter || ', ',
        deduplicate: localSettings.deduplicate || false,
        sort: localSettings.sort || false,
        uppercase: localSettings.uppercase || false
      };

      const { data, error } = await this.client
        .from('settings')
        .upsert(dbSettings, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log('✅ Settings synced to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to sync settings to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync settings from Supabase
   */
  async syncSettingsFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping settings sync');
      return null;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching settings from Supabase...');

      const { data, error } = await this.client
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No settings found in Supabase (first sync)');
          return null;
        }
        throw error;
      }

      const localSettings = {
        autoDeletePeriod: data.auto_delete_period,
        theme: data.theme,
        autoHide: data.auto_hide,
        showTimestamps: data.show_timestamps,
        maxClipsDisplay: data.max_clips_display,
        delimiter: data.delimiter,
        customDelimiter: data.custom_delimiter,
        deduplicate: data.deduplicate,
        sort: data.sort,
        uppercase: data.uppercase
      };

      console.log('✅ Fetched settings from Supabase');
      return localSettings;
    } catch (error) {
      console.error('❌ Failed to fetch settings from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // USER PROFILE SYNC METHODS
  // =====================================================

  /**
   * Sync user profile to Supabase
   */
  async syncUserProfileToSupabase(localProfile) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping profile sync');
      return false;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log('📤 Syncing user profile to Supabase...');

      const dbProfile = {
        user_id: userId,
        user_name: localProfile.userName || null,
        ai_generated_name: localProfile.aiGeneratedName || null,
        profile_image_url: localProfile.profileImageUrl || null,
        profile_image_base64: localProfile.profileImageBase64 || null,
        generated_image_url: localProfile.generatedImageUrl || null,
        ai_generated_image: localProfile.aiGeneratedImage || false
      };

      const { data, error } = await this.client
        .from('user_profiles')
        .upsert(dbProfile, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log('✅ User profile synced to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to sync user profile to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync user profile from Supabase
   */
  async syncUserProfileFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping profile sync');
      return null;
    }

    try {
      const userId = await this.getChromeUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching user profile from Supabase...');

      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No profile found in Supabase (first sync)');
          return null;
        }
        throw error;
      }

      const localProfile = {
        userName: data.user_name,
        aiGeneratedName: data.ai_generated_name,
        profileImageUrl: data.profile_image_url,
        profileImageBase64: data.profile_image_base64,
        generatedImageUrl: data.generated_image_url,
        aiGeneratedImage: data.ai_generated_image
      };

      console.log('✅ Fetched user profile from Supabase');
      return localProfile;
    } catch (error) {
      console.error('❌ Failed to fetch user profile from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================

  /**
   * Subscribe to real-time clip changes
   */
  subscribeToClipChanges(callback) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - cannot subscribe to realtime');
      return null;
    }

    const channel = this.client
      .channel('clips-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'clips' }, 
        (payload) => {
          console.log('🔔 Realtime clip change:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return channel;
  }

  /**
   * Subscribe to real-time category changes
   */
  subscribeToCategoryChanges(callback) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - cannot subscribe to realtime');
      return null;
    }

    const channel = this.client
      .channel('categories-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categories' }, 
        (payload) => {
          console.log('🔔 Realtime category change:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return channel;
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel) {
    if (channel) {
      this.client.removeChannel(channel);
      console.log('🔇 Unsubscribed from realtime channel');
    }
  }

  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('📝 Signing up user:', email);
      
      const { data, error } = await this.client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: chrome.runtime.getURL('popup.html')
        }
      });

      if (error) throw error;

      // Create user subscription record (default free tier)
      if (data.user) {
        await this.createUserSubscription(data.user.id, email, 'free');
      }

      console.log('✅ User signed up successfully');
      return { success: true, user: data.user };
    } catch (error) {
      console.error('❌ Sign up failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('📧 Resending verification email to:', email);
      
      const { data, error } = await this.client.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: chrome.runtime.getURL('popup.html')
        }
      });

      if (error) throw error;

      console.log('✅ Verification email resent');
      return { success: true };
    } catch (error) {
      console.error('❌ Resend failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('🔐 Signing in user:', email);
      
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      console.log('✅ User signed in successfully');
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle() {
    if (!this.client) {
      return { success: false, error: 'Supabase not initialized' };
    }

    try {
      console.log('🔐 Initiating Google sign in...');
      
      // For extensions, redirect to callback page
      const callbackUrl = chrome.runtime.getURL('callback.html');
      console.log('🔗 Callback URL:', callbackUrl);
      
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (data?.url) {
        console.log('✅ Opening Google OAuth...');
        // Open in new window - user completes auth there
        window.open(data.url, '_blank', 'width=500,height=600');
        return { 
          success: true, 
          message: 'Complete sign in in the new window, then close this popup and reopen' 
        };
      }

      return { success: false, error: 'No OAuth URL generated' };
    } catch (error) {
      console.error('❌ Google sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('👋 Signing out user...');
      
      const { error } = await this.client.auth.signOut();

      if (error) throw error;

      console.log('✅ User signed out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user session
   */
  async getCurrentUser() {
    if (!this.client) {
      return null;
    }

    try {
      const { data: { session }, error } = await this.client.auth.getSession();

      if (error) throw error;

      return session?.user || null;
    } catch (error) {
      console.error('❌ Get current user failed:', error);
      return null;
    }
  }

  /**
   * Create user subscription record
   */
  async createUserSubscription(userId, email, tier = 'free') {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('user_subscriptions')
        .insert([{
          user_id: userId,
          email: email,
          subscription_tier: tier,
          subscription_status: 'active'
        }]);

      if (error) throw error;

      console.log('✅ User subscription created');
      return true;
    } catch (error) {
      console.error('❌ Failed to create subscription:', error);
      return false;
    }
  }

  /**
   * Get user subscription info
   */
  async getUserSubscription(userId) {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('❌ Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Check if user has premium access
   */
  async isPremiumUser(userId) {
    const subscription = await this.getUserSubscription(userId);
    return subscription && 
           (subscription.subscription_tier === 'premium' || subscription.subscription_tier === 'admin') &&
           subscription.subscription_status === 'active';
  }

  /**
   * Admin sign in (checks for admin tier)
   */
  async signInAsAdmin(email, password) {
    const result = await this.signInWithEmail(email, password);
    
    if (result.success) {
      const subscription = await this.getUserSubscription(result.user.id);
      
      if (subscription && subscription.subscription_tier === 'admin') {
        return { success: true, user: result.user, isAdmin: true };
      } else {
        await this.signOut();
        return { success: false, error: 'Unauthorized: Admin access required' };
      }
    }
    
    return result;
  }

  // =====================================================
  // FULL SYNC METHOD (Call on startup)
  // =====================================================

  /**
   * Perform full bidirectional sync on extension startup
   */
  async performFullSync() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping full sync');
      return {
        success: false,
        message: 'Supabase not configured'
      };
    }

    try {
      console.log('🔄 Starting full bidirectional sync...');

      // Get local data from Chrome storage
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['clips', 'categories', 'settings', 'userProfile'], resolve);
      });

      const localClips = localData.clips || [];
      const localCategories = localData.categories || [];
      const localSettings = localData.settings || {};
      const localProfile = localData.userProfile || {};

      // Sync clips
      await this.syncClipsToSupabase(localClips);
      const remoteClips = await this.syncClipsFromSupabase();
      if (remoteClips) {
        const mergedClips = await this.mergeClips(localClips, remoteClips);
        await new Promise((resolve) => {
          chrome.storage.local.set({ clips: mergedClips }, resolve);
        });
        console.log(`✅ Clips merged: ${mergedClips.length} total`);
      }

      // Sync categories
      await this.syncCategoriesToSupabase(localCategories);
      const remoteCategories = await this.syncCategoriesFromSupabase();
      if (remoteCategories && remoteCategories.length > 0) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ categories: remoteCategories }, resolve);
        });
        console.log(`✅ Categories updated: ${remoteCategories.length} total`);
      }

      // Sync settings
      await this.syncSettingsToSupabase(localSettings);
      const remoteSettings = await this.syncSettingsFromSupabase();
      if (remoteSettings) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ settings: remoteSettings }, resolve);
        });
        console.log('✅ Settings updated');
      }

      // Sync user profile
      await this.syncUserProfileToSupabase(localProfile);
      const remoteProfile = await this.syncUserProfileFromSupabase();
      if (remoteProfile) {
        // Merge profiles (remote takes precedence for images, local for text)
        const mergedProfile = {
          ...localProfile,
          ...remoteProfile
        };
        await new Promise((resolve) => {
          chrome.storage.local.set({ userProfile: mergedProfile }, resolve);
        });
        console.log('✅ User profile updated');
      }

      console.log('✅ Full sync complete!');
      return {
        success: true,
        message: 'All data synced successfully',
        stats: {
          clips: remoteClips?.length || 0,
          categories: remoteCategories?.length || 0
        }
      };

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Initialize global instance
const pasteCraftSupabase = new PasteCraftSupabase();

