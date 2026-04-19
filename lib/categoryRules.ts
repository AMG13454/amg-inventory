export type CategoryRequirements = {
  requiresLot: boolean;
  requiresExpiration: boolean;
  confirmLotUnknown: boolean;
  confirmNoExpiration: boolean;
};

const DEFAULT_REQUIREMENTS: CategoryRequirements = {
  requiresLot: false,
  requiresExpiration: false,
  confirmLotUnknown: false,
  confirmNoExpiration: false,
};

export function getCategoryRequirements(category: string | null | undefined): CategoryRequirements {
  const c = (category ?? '').trim();

  if (c === 'Injectables' || c === 'PPE') {
    return {
      requiresLot: true,
      requiresExpiration: true,
      confirmLotUnknown: true,
      confirmNoExpiration: true,
    };
  }

  if (c === 'General Supplies' || c === 'Wound Care' || c === 'Skin Care') {
    return {
      requiresLot: false,
      requiresExpiration: true,
      confirmLotUnknown: false,
      confirmNoExpiration: false,
    };
  }

  if (
    c === "Men's Garments" ||
    c === "Women's Garments" ||
    c === 'Unisex Garments' ||
    c === 'Surgical Tools' ||
    c === 'Uncategorized'
  ) {
    return DEFAULT_REQUIREMENTS;
  }

  return DEFAULT_REQUIREMENTS;
}

