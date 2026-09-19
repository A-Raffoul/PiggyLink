import { describe, expect, it, vi } from "vitest";
import { EXAMPLE_COVER_URL, loadCoverAudio } from "./cover";

describe("cover audio loading", () => {
  it("uses an uploaded file without fetching the example", async () => {
    const uploaded = new Uint8Array([1, 2, 3]).buffer;
    const fetchCover = vi.fn();

    await expect(loadCoverAudio({ arrayBuffer: async () => uploaded }, fetchCover)).resolves.toBe(uploaded);
    expect(fetchCover).not.toHaveBeenCalled();
  });

  it("loads the included example when no file is selected", async () => {
    const example = new Uint8Array([4, 5, 6]).buffer;
    const fetchCover = vi.fn(async () => ({ ok: true, arrayBuffer: async () => example }));

    await expect(loadCoverAudio(undefined, fetchCover)).resolves.toBe(example);
    expect(fetchCover).toHaveBeenCalledWith(EXAMPLE_COVER_URL);
  });

  it("reports an unavailable example", async () => {
    const fetchCover = vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }));
    await expect(loadCoverAudio(undefined, fetchCover)).rejects.toThrow("could not be loaded");
  });
});
