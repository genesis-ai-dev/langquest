export function getQueryParams(input: string): {
  errorCode: string | null;
  params: Record<string, string>;
  path: string;
} {
  const url = new URL(input, 'https://phony.example');

  const path = input.split('://')[1]?.split('?')[0]?.split('#')[0];

  // Pull errorCode off of params
  const errorCode = url.searchParams.get('errorCode');
  url.searchParams.delete('errorCode');

  // Merge search and hash
  const params = Object.fromEntries(
    // @ts-ignore: [Symbol.iterator] is indeed, available on every platform.
    url.searchParams
  );

  // Get hash (#abc=example)
  if (url.hash) {
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] = value;
    });
  }

  return {
    errorCode,
    params,
    path
  };
}
