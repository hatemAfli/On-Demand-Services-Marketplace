/** Response item from `GET /services` / `GET /services/category/:id` (localized). */
export type MarketplaceServiceItem = {
  id: string;
  name: string;
  description: string | null;
  /** Public catalog image URL when set by admin. */
  servicePhoto: string | null;
  categoryId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    iconKey: string | null;
    iconUrl: string | null;
  };
};
