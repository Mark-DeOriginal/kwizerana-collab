export const formatFollowers = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`;
  return value.toLocaleString();
};

export const truncateBio = (bio: string | null | undefined, maxLength = 60) => {
  const text = bio ?? "";
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return `${chars.slice(0, maxLength).join("").trimEnd()}…`;
};
