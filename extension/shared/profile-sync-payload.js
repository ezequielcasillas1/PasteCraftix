/** Build Supabase user_profiles upsert payload — omit empty names so cloud values are not nulled. */
export function buildProfileUpsertPayload(localProfile) {
  const l = localProfile && typeof localProfile === 'object' ? localProfile : {};
  const payload = {
    updated_at: new Date().toISOString(),
  };

  const userName = typeof l.userName === 'string' ? l.userName.trim() : '';
  const aiName = typeof l.aiGeneratedName === 'string' ? l.aiGeneratedName.trim() : '';

  if (userName) payload.user_name = userName;
  if (aiName) payload.ai_generated_name = aiName;

  return payload;
}
