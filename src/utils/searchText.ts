// Los registros históricos o importados pueden contener campos vacíos o numéricos.
export const matchesSearchText = (values: readonly unknown[], query: string): boolean => {
  const normalizedQuery = query.toLowerCase();
  return values.some(value => String(value ?? '').toLowerCase().includes(normalizedQuery));
};
