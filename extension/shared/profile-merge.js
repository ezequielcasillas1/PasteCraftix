/** Merge local + remote user profile without cloud nulls wiping saved names. */
export function preferProfileText(localVal, remoteVal) {
  const local = typeof localVal === 'string' ? localVal.trim() : '';
  const remote = typeof remoteVal === 'string' ? remoteVal.trim() : '';
  return local || remote || '';
}

export function mergeUserProfileLocalRemote(local, remote, pickUrl) {
  const l = local && typeof local === 'object' ? local : {};
  const r = remote && typeof remote === 'object' ? remote : {};
  const pick = typeof pickUrl === 'function' ? pickUrl : (_local, remoteUrl) => remoteUrl || _local || '';

  return {
    ...l,
    ...r,
    userName: preferProfileText(l.userName, r.userName),
    aiGeneratedName: preferProfileText(l.aiGeneratedName, r.aiGeneratedName),
    profileImageUrl: pick(l.profileImageUrl, r.profileImageUrl),
    profileImageBase64: r.profileImageBase64 ? r.profileImageBase64 : (l.profileImageBase64 || null),
    generatedImageUrl: r.generatedImageUrl || l.generatedImageUrl || null,
    aiGeneratedImage: typeof r.aiGeneratedImage === 'boolean' ? r.aiGeneratedImage : !!l.aiGeneratedImage,
  };
}
