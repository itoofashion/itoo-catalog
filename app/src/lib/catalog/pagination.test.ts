import { describe, expect, it } from "vitest";
import { pageWindow, paginate, PER_PAGE } from "./pagination";

const items = Array.from({ length: 100 }, (_, index) => index + 1);

describe("paginate", () => {
  it("hands back the first page by default", () => {
    const result = paginate(items, 1, 10);
    expect(result).toMatchObject({ page: 1, pages: 10, total: 100 });
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("moves along the list", () => {
    expect(paginate(items, 3, 10).items[0]).toBe(21);
  });

  it("clamps a page number past the end, so a stale link still shows something", () => {
    const result = paginate(items, 99, 10);
    expect(result.page).toBe(10);
    expect(result.items).toHaveLength(10);
  });

  it("clamps nonsense to the first page", () => {
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate(items, -5, 10).page).toBe(1);
    expect(paginate(items, Number.NaN, 10).page).toBe(1);
  });

  it("copes with a short last page", () => {
    const result = paginate(items.slice(0, 95), 10, 10);
    expect(result.items).toHaveLength(5);
  });

  it("stays on one page when there is nothing to show", () => {
    expect(paginate([], 1, 10)).toMatchObject({ pages: 1, total: 0, page: 1 });
  });

  it("fits the whole catalogue in a sane number of pages", () => {
    expect(paginate(Array.from({ length: 737 }, (_, i) => i), 1).pages).toBe(
      Math.ceil(737 / PER_PAGE),
    );
  });
});

describe("pageWindow", () => {
  it("lists them all when there are few", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it("keeps first, last and the neighbours, marking the gaps", () => {
    expect(pageWindow(8, 16)).toEqual([1, null, 7, 8, 9, null, 16]);
  });

  it("does not open a gap that would hide a single page", () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles being at either end", () => {
    expect(pageWindow(1, 16)).toEqual([1, 2, null, 16]);
    expect(pageWindow(16, 16)).toEqual([1, null, 15, 16]);
  });

  it("returns a single page for an empty catalogue", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
