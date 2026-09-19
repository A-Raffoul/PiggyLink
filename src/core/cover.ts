export const EXAMPLE_COVER_URL = "/example-cover.wav";

export interface CoverFile {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface CoverResponse {
  readonly ok: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type CoverFetcher = (url: string) => Promise<CoverResponse>;

export async function loadCoverAudio(
  file: CoverFile | undefined,
  fetchCover: CoverFetcher = (url) => fetch(url),
): Promise<ArrayBuffer> {
  if (file) return file.arrayBuffer();

  const response = await fetchCover(EXAMPLE_COVER_URL);
  if (!response.ok) throw new Error("The included example audio could not be loaded.");
  return response.arrayBuffer();
}
