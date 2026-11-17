const countryFlags = import.meta.glob<string>(
  '../../../../../node_modules/country-flag-icons/string/3x2/[A-Z][A-Z].js',
  { import: 'default' },
);

export async function countryFlag(code?: string): Promise<string | undefined> {
  const country = code?.trim().toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country)) return undefined;
  const load = countryFlags[`../../../../../node_modules/country-flag-icons/string/3x2/${country}.js`];
  if (!load) return undefined;
  return `data:image/svg+xml,${encodeURIComponent(await load())}`;
}
