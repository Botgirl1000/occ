export function formatName(name: string): string {
  return name.trim().toUpperCase();
}

export function saveUser(name: string): string {
  return `saved:${formatName(name)}`;
}
