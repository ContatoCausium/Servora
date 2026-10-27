export type ModifierOption = {
  id: string;
  name: string;
  priceCents: number;
};

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
};

export type MenuItem = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  prepTimeMinutes: number;
  imageUrl?: string;
  notes?: string;
  active: boolean;
  locationIds: string[]; // empty array = all locations
  modifierGroups: ModifierGroup[];
  createdAt: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  description?: string;
};

const STORAGE_KEY_PREFIX = "servora.menu.";

const INITIAL_CATEGORIES: MenuCategory[] = [];

function getStoreKey(orgId: string, suffix: string) {
  return `${STORAGE_KEY_PREFIX}${orgId}.${suffix}`;
}

export function listCategories(orgId: string): MenuCategory[] {
  if (!orgId || typeof window === "undefined") return [];
  const saved = localStorage.getItem(getStoreKey(orgId, "categories"));
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function saveCategory(orgId: string, category: MenuCategory): MenuCategory[] {
  const existing = listCategories(orgId);
  const index = existing.findIndex((c) => c.id === category.id);
  const updated = index >= 0 ? existing.map((c, i) => (i === index ? category : c)) : [...existing, category];
  if (typeof window !== "undefined") {
    localStorage.setItem(getStoreKey(orgId, "categories"), JSON.stringify(updated));
  }
  return updated;
}

export function deleteCategory(orgId: string, categoryId: string): MenuCategory[] {
  const existing = listCategories(orgId);
  const updated = existing.filter((c) => c.id !== categoryId);
  if (typeof window !== "undefined") {
    localStorage.setItem(getStoreKey(orgId, "categories"), JSON.stringify(updated));
  }
  return updated;
}

export function duplicateMenuItem(orgId: string, itemId: string): MenuItem[] {
  const existing = listMenuItems(orgId);
  const target = existing.find((i) => i.id === itemId);
  if (!target) return existing;
  const duplicated: MenuItem = {
    ...target,
    id: `item-${Date.now()}`,
    name: `${target.name} (Copy)`,
    createdAt: new Date().toISOString(),
  };
  return saveMenuItem(orgId, duplicated);
}

export function listMenuItems(orgId: string): MenuItem[] {
  if (!orgId || typeof window === "undefined") return [];
  const saved = localStorage.getItem(getStoreKey(orgId, "items"));
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? (parsed as MenuItem[]).filter((i) => i.orgId === orgId) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function listMenuProducts(orgId: string): Array<MenuItem & { categoryName?: string }> {
  const items = listMenuItems(orgId);
  const categories = listCategories(orgId);
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  return items.map((i) => ({
    ...i,
    categoryName: catMap.get(i.category) ?? i.category,
  }));
}

export function saveMenuItem(orgId: string, item: MenuItem): MenuItem[] {
  const existing = listMenuItems(orgId);
  const index = existing.findIndex((i) => i.id === item.id);
  const updated = index >= 0 ? existing.map((cur, i) => (i === index ? item : cur)) : [item, ...existing];
  if (typeof window !== "undefined") {
    localStorage.setItem(getStoreKey(orgId, "items"), JSON.stringify(updated));
  }
  return updated;
}

export function deleteMenuItem(orgId: string, itemId: string): MenuItem[] {
  const existing = listMenuItems(orgId);
  const updated = existing.filter((i) => i.id !== itemId);
  if (typeof window !== "undefined") {
    localStorage.setItem(getStoreKey(orgId, "items"), JSON.stringify(updated));
  }
  return updated;
}
