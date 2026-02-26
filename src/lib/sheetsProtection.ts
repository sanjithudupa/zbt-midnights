const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAlwaysAllowedGmails(raw: string) {
  const split = raw
    .split(/\r?\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const unique = Array.from(new Set(split));
  const invalid = unique.filter((email) => !EMAIL_REGEX.test(email));
  return {
    emails: unique.filter((email) => EMAIL_REGEX.test(email)),
    invalid,
  };
}
