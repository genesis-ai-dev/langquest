export function collectAudioValues(links: { audio?: unknown }[]): string[] {
  return links
    .flatMap((link) => {
      const audio = link.audio;
      if (Array.isArray(audio)) return audio;
      if (typeof audio === 'string' && audio.length > 0) {
        try {
          const parsed: unknown = JSON.parse(audio);
          return Array.isArray(parsed) ? parsed : [audio];
        } catch {
          return [audio];
        }
      }
      return [];
    })
    .filter((value): value is string => typeof value === 'string' && !!value);
}
