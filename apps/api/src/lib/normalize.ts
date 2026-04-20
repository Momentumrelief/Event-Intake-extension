export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function applyTransform(value: string, transform: string): string {
  switch (transform) {
    case "uppercase":
      return value.toUpperCase();
    case "date_iso":
      return new Date(value).toISOString().split("T")[0] ?? value;
    case "phone_e164":
      return normalizePhone(value);
    case "none":
    default:
      return value;
  }
}
