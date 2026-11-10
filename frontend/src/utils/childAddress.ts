/** Keep the stored profile name intact; shorten only the spoken address. */
export function getChildAddressName(profileName: string): string {
  const name = profileName.trim();
  if (!name || name === "아이") return "우리 친구";
  const letters = Array.from(name);
  return letters.length === 2 || letters.length === 3
    ? letters.slice(1).join("")
    : name;
}

export function callChild(profileName: string): string {
  const name = getChildAddressName(profileName);
  const codePoint = name.codePointAt(name.length - 1) ?? 0;
  const hasFinalConsonant = codePoint >= 0xac00 && codePoint <= 0xd7a3
    && (codePoint - 0xac00) % 28 !== 0;
  return `${name}${hasFinalConsonant ? "아" : "야"}`;
}
