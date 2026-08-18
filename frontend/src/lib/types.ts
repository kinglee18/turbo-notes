export const CATEGORY_SLUGS = [
  "random-thoughts",
  "school",
  "personal",
  "drama",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export function isCategorySlug(value: unknown): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}

export interface Category {
  slug: CategorySlug;
  name: string;
  note_count: number;
}

export interface Note {
  id: string;
  category: CategorySlug;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: number;
  email: string;
  date_joined: string;
}
