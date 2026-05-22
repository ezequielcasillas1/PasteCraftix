/** Vertical slice: profile-images.js */
export const profileImagesMixin = {
// PROFILE IMAGE URL NORMALIZATION (avoid expiring URLs)
// =====================================================
_pcIsDataImageUrl(u) {
  return typeof u === 'string' && u.startsWith('data:image/');
},

_pcTryParseUrl(u) {
  try { return new URL(String(u || '')); } catch (_) { return null; }
},

_pcGetSupabaseHost() {
  try {
    const url = (typeof PASTECRAFT_CONFIG !== 'undefined' && PASTECRAFT_CONFIG?.supabase?.url)
      ? String(PASTECRAFT_CONFIG.supabase.url)
      : '';
    return url ? (new URL(url)).hostname : '';
  } catch (_) {
    return '';
  }
},

_pcIsExpiredSas(u) {
  const urlObj = this._pcTryParseUrl(u);
  if (!urlObj) return false;
  const se = urlObj.searchParams.get('se');
  if (!se) return false;
  const ms = Date.parse(se);
  if (!Number.isFinite(ms)) return false;
  return Date.now() > ms;
},

async uploadDataUrlToProfileImages(dataUrl, userId) {
  if (!this.client) return null;
  const u = typeof dataUrl === 'string' ? dataUrl : '';
  if (!this._pcIsDataImageUrl(u)) return null;
  try {
    const t0 = Date.now();
    // Avoid fetch(data:) (can be unreliable for very large data URLs in extension contexts).
    const comma = u.indexOf(',');
    const header = comma >= 0 ? u.slice(0, comma) : '';
    const b64 = comma >= 0 ? u.slice(comma + 1) : '';
    const m = header.match(/^data:([^;]+);base64$/i);
    const ct = m && m[1] ? m[1] : 'image/png';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: ct });
    const t1 = Date.now();
    const ext =
      ct.includes('png') ? 'png' :
      ct.includes('jpeg') ? 'jpg' :
      ct.includes('webp') ? 'webp' :
      ct.includes('gif') ? 'gif' :
      'png';

    // Path must live under a `{userId}/` folder so the Storage RLS policy
    // `(storage.foldername(name))[1] = auth.uid()::text` passes.
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.${ext}`;

    const { error } = await this.client.storage
      .from('profile-images')
      .upload(filePath, blob, { contentType: ct || 'image/png', upsert: false });
    const t2 = Date.now();
    if (error) throw error;

    const { data: urlData } = this.client.storage
      .from('profile-images')
      .getPublicUrl(filePath);
    const t3 = Date.now();

    return urlData?.publicUrl || null;
  } catch (_) {
    return null;
  }
},

async convertToPermanentProfileImageUrl(imageUrl, userId) {
  const u = typeof imageUrl === 'string' ? imageUrl : '';
  if (!u) return '';
  if (!this.client) return u;
  const t0 = Date.now();

  if (this._pcIsDataImageUrl(u)) {
    const uploaded = await this.uploadDataUrlToProfileImages(u, userId);
    return uploaded || u;
  }

  const urlObj = this._pcTryParseUrl(u);
  const supaHost = this._pcGetSupabaseHost();
  if (urlObj && supaHost && urlObj.hostname === supaHost) {
    return u;
  }

  const looksLikeAzureBlob = !!(urlObj && urlObj.hostname && urlObj.hostname.includes('blob.core.windows.net'));
  const hasSig = !!(urlObj && urlObj.searchParams && urlObj.searchParams.has('sig'));
  if (looksLikeAzureBlob || hasSig || this._pcIsExpiredSas(u)) {
    try {
      const perm = await this.downloadAndUploadImage(u, userId);
      return perm || u;
    } catch (_) {
      return u;
    }
  }

  return u;
}

};
