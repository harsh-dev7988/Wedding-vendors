export function normalizeIndianPhone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");

  if (/^[6-9][0-9]{9}$/.test(compact)) return `+91${compact}`;
  if (/^91[6-9][0-9]{9}$/.test(compact)) return `+${compact}`;
  if (/^\+[1-9][0-9]{7,14}$/.test(compact)) return compact;

  return null;
}
