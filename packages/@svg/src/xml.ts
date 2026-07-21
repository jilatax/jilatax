const XML_ENTITIES: Readonly<Record<string, string>> = {
  '"': '&quot;',
  '&': '&amp;',
  "'": '&apos;',
  '<': '&lt;',
  '>': '&gt;',
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) =>
    XML_ENTITIES[character] ?? character,
  );
}
