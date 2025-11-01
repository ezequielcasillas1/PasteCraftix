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
}

// Initialize global instance
const pasteCraftSupabase = new PasteCraftSupabase();

