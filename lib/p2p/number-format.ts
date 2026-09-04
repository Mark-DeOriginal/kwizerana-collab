export function sanitizeDecimalInput(value: string): string {
  let s = value.replace(/[^\d.,]/g, "");
  s = s.replace(/,/g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = `${parts[0]}.${parts.slice(1).join("")}`;
  return s;
}

export function formatThousandsInput(value: string): string {
  if (!value) return "";
  const [intPart, ...decParts] = value.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decParts.length ? `${withCommas}.${decParts.join("")}` : withCommas;
}