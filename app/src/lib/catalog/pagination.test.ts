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
  it("holds still at the start until the current page reaches the middle", () => {
    expect(pageWindow(1, 16)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(2, 16)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 16)).toEqual([1, 2, 3, 4, 5]);
  });

  it("carries the current page in the middle once past the start", () => {
    expect(pageWindow(4, 16)).toEqual([2, 3, 4, 5, 6]);
    expect(pageWindow(8, 16)).toEqual([6, 7, 8, 9, 10]);
  });

  it("holds still at the end rather than running past the last page", () => {
    expect(pageWindow(14, 16)).toEqual([12, 13, 14, 15, 16]);
    expect(pageWindow(15, 16)).toEqual([12, 13, 14, 15, 16]);
    expect(pageWindow(16, 16)).toEqual([12, 13, 14, 15, 16]);
  });

  it("shows only what exists in a catalogue shorter than the window", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(3, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("shows every page when there are exactly five", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns a single page for an empty catalogue", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("never leaves a gap between the numbers it offers", () => {
    for (let page = 1; page <= 16; page += 1) {
      const window = pageWindow(page, 16);
      expect(window).toHaveLength(5);
      expect(window).toContain(page);
      expect(window.every((value, index) => index === 0 || value === window[index - 1] + 1)).toBe(
        true,
      );
    }
  });

  it("clamps a page number from a stale link", () => {
    expect(pageWindow(99, 16)).toEqual([12, 13, 14, 15, 16]);
    expect(pageWindow(0, 16)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(Number.NaN, 16)).toEqual([1, 2, 3, 4, 5]);
  });
});
