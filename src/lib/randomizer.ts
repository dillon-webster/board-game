export type Random = () => number;

export function pick<T>(values: readonly T[], random: Random = Math.random): T {
  if (!values.length) throw new Error("No compatible mystery results are available.");
  return values[Math.floor(random() * values.length)];
}

export function shuffle<T>(values: readonly T[], random: Random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
