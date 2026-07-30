export function canonicalPair(
  userId1: string,
  userId2: string,
): [string, string] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}
