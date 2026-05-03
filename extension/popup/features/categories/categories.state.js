export function getCategoryIdKey(category) {
  return String(category?.id ?? category?.createdAt ?? category?.name ?? '');
}
