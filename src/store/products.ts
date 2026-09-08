export type Inventory = { blast: number; wildcard: number; rescue: number };

export type Product = {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  grants: Partial<Inventory>;
};

export const PRODUCTS: Product[] = [
  { id: 'pakus.booster.small.099', title: 'Mini Boost', description: '2× Blast + 1× Wildcard', priceLabel: '0,99 €', grants: { blast: 2, wildcard: 1 } },
  { id: 'pakus.special.149', title: 'Special Blocks', description: '2× Wildcard + 2× Rescue', priceLabel: '1,49 €', grants: { wildcard: 2, rescue: 2 } },
  { id: 'pakus.mega.199', title: 'Mega Pack', description: '5× Blast + 3× Wildcard + 3× Rescue', priceLabel: '1,99 €', grants: { blast: 5, wildcard: 3, rescue: 3 } },
];

export function grantPurchase(inventory: Inventory, product: Product): Inventory {
  return {
    blast: inventory.blast + (product.grants.blast ?? 0),
    wildcard: inventory.wildcard + (product.grants.wildcard ?? 0),
    rescue: inventory.rescue + (product.grants.rescue ?? 0),
  };
}
