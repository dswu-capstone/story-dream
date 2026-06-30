import type { Profile } from "../types/profile";

const mockProfiles: Profile[] = [
  { id: 1, name: "\uAE40\uBBFC\uC900" },
  { id: 2, name: "\uBC15\uC11C\uC5F0" },
  { id: 3, name: "\uC774\uC9C0\uD638" },
];

export async function getProfiles(): Promise<Profile[]> {
  // Temporary mock response. Replace with a real fetch call when the backend API is ready.
  return Promise.resolve(mockProfiles);
}
