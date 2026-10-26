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

const INITIAL_CATEGORIES: MenuCategory[] = [
  { id: "smash-burgers", name: "Smash Burgers", description: "Signature fresh-ground certified Angus beef patties on brioche" },
  { id: "sides", name: "Sides & Starters", description: "Crispy, made-to-order accompaniments" },
  { id: "shakes", name: "Shakes & Drinks", description: "Hand-spun milkshakes and craft sodas" },
];

const INITIAL_ITEMS: MenuItem[] = [
  {
    id: "item-1",
    orgId: "default",
    name: "The Classic Double Smash",
    description: "Two 3.5oz Angus beef smash patties, American cheese, house pickles, caramelized onion, roasted garlic mayo.",
    category: "smash-burgers",
    priceCents: 1450,
    prepTimeMinutes: 8,
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
    active: true,
    locationIds: [],
    modifierGroups: [
      {
        id: "mg-temp",
        name: "Patty Cook Temperature",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: "opt-med", name: "Medium", priceCents: 0 },
          { id: "opt-well", name: "Well Done (Crispy edges)", priceCents: 0 },
        ],
      },
      {
        id: "mg-extras",
        name: "Add Extra Goodness",
        required: false,
        minSelections: 0,
        maxSelections: 4,
        options: [
          { id: "opt-bacon", name: "Applewood Smoked Bacon", priceCents: 250 },
          { id: "opt-patty", name: "Extra Smash Patty + Cheese", priceCents: 400 },
          { id: "opt-jalapeno", name: "Pickled Jalapeños", priceCents: 75 },
          { id: "opt-truffle", name: "Truffle Mayo Drizzle", priceCents: 150 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "item-2",
    orgId: "default",
    name: "Truffle Rosemary Fries",
    description: "Skin-on Idaho russets tossed in white truffle oil, fresh rosemary, sea salt and freshly grated parmesan.",
    category: "sides",
    priceCents: 750,
    prepTimeMinutes: 5,
    imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80",
    active: true,
    locationIds: [],
    modifierGroups: [
      {
        id: "mg-sauce",
        name: "Dipping Sauce",
        required: true,
        minSelections: 1,
        maxSelections: 2,
        options: [
          { id: "opt-aioli", name: "House Garlic Aioli", priceCents: 0 },
          { id: "opt-bbq", name: "Smoked Bourbon BBQ", priceCents: 50 },
          { id: "opt-ranch", name: "Buttermilk Ranch", priceCents: 50 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "item-3",
    orgId: "default",
    name: "Salted Caramel Bourbon Shake",
    description: "Vanilla bean custard spun with sea salt caramel and crushed butter toffee.",
    category: "shakes",
    priceCents: 850,
    prepTimeMinutes: 4,
    imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80",
    active: true,
    locationIds: [],
    modifierGroups: [
      {
        id: "mg-dairy",
        name: "Dairy Options",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: "opt-std", name: "Whole Milk Custard", priceCents: 0 },
          { id: "opt-oat", name: "Oat Milk Base", priceCents: 150 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

function getStoreKey(orgId: string, suffix: string) {
  return `${STORAGE_KEY_PREFIX}${orgId}.${suffix}`;
}

export function listCategories(orgId: string): MenuCategory[] {
  if (typeof window === "undefined") return INITIAL_CATEGORIES;
  const saved = localStorage.getItem(getStoreKey(orgId, "categories"));
  if (saved) {
    try {
      return JSON.parse(saved) as MenuCategory[];
    } catch {
      // fallback
    }
  }
  return INITIAL_CATEGORIES;
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
  if (typeof window === "undefined") return INITIAL_ITEMS;
  const saved = localStorage.getItem(getStoreKey(orgId, "items"));
  if (saved) {
    try {
      return JSON.parse(saved) as MenuItem[];
    } catch {
      // fallback
    }
  }
  const seeded = INITIAL_ITEMS.map((item) => ({ ...item, orgId }));
  localStorage.setItem(getStoreKey(orgId, "items"), JSON.stringify(seeded));
  return seeded;
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
