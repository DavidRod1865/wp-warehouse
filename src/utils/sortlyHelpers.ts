import type { SortlyItem } from '../types/sortly';

export function getCustomAttribute(item: SortlyItem, attributeName: string): string | null {
  if (!item.custom_attribute_values) return null;
  const attr = item.custom_attribute_values.find(
    a => a.custom_attribute_name.toLowerCase() === attributeName.toLowerCase()
  );
  return attr?.value || null;
}

export function getBrand(item: SortlyItem): string | null {
  return getCustomAttribute(item, 'Brand');
}

export function getPartNumber(item: SortlyItem): string | null {
  return getCustomAttribute(item, 'Part Number');
}