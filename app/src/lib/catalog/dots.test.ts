import { describe, expect, it } from "vitest";
import { dotWindow, MAX_DOTS } from "./dots";

/** The row as it is drawn, for reading a whole case in one line. */
const drawn = (count: number, current: number) =>
  dotWindow(count, current)
    .map((dot) => `${dot.index}${{ full: "", medium: "-", small: "." }[dot.size]}`)
    .join(" ");

describe("a strip with fewer photographs than dots", () => {
  it("gives every photograph a dot of its own", () => {
    expect(dotWindow(4, 0).map((dot) => dot.index)).toEqual([0, 1, 2, 3]);
  });

  it("draws all of them full size: there is nothing past either end", () => {
    expect(dotWindow(4, 2).every((dot) => dot.size === "full")).toBe(true);
  });

  it("has nothing to draw for a style with no photographs", () => {
    expect(dotWindow(0, 0)).toEqual([]);
  });
});

describe("a strip of exactly seven photographs", () => {
  it("still gives every photograph a dot", () => {
    expect(dotWindow(7, 3)).toHaveLength(7);
    expect(dotWindow(7, 3).map((dot) => dot.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("tapers none of them, because none of them is hiding anything", () => {
    expect(drawn(7, 0)).toBe("0 1 2 3 4 5 6");
    expect(drawn(7, 6)).toBe("0 1 2 3 4 5 6");
  });
});

describe("a strip of more photographs than the row can hold", () => {
  it("opens on the first photograph and tapers only the far edge", () => {
    expect(drawn(12, 0)).toBe("0 1 2 3 4 5- 6.");
  });

  it("carries the current frame in the middle once past the start", () => {
    expect(drawn(12, 5)).toBe("2. 3- 4 5 6 7- 8.");
  });

  it("holds still at the end rather than running off past the last photograph", () => {
    expect(drawn(12, 11)).toBe("5. 6- 7 8 9 10 11");
  });

  it("shows the same seven for every frame the window has already reached", () => {
    // Frames 0 to 3 all sit inside the window that starts at the beginning, so
    // the row does not move under the reader until it has to.
    expect(drawn(12, 3)).toBe("0 1 2 3 4 5- 6.");
  });
});

describe("whatever the strip", () => {
  const strips = Array.from({ length: 30 }, (_, index) => index + 1);

  it("never draws more than seven dots", () => {
    for (const count of strips) {
      for (let frame = 0; frame < count; frame++) {
        expect(dotWindow(count, frame).length).toBeLessThanOrEqual(MAX_DOTS);
      }
    }
  });

  it("always has a dot for the frame on screen, and draws it full size", () => {
    for (const count of strips) {
      for (let frame = 0; frame < count; frame++) {
        const dot = dotWindow(count, frame).find((entry) => entry.index === frame);
        expect(dot, `${count} photos on frame ${frame}`).toBeDefined();
        expect(dot?.size).toBe("full");
      }
    }
  });

  it("draws a run of consecutive photographs, with no gap in the middle", () => {
    for (const count of strips) {
      const indexes = dotWindow(count, Math.floor(count / 2)).map((dot) => dot.index);
      expect(indexes).toEqual(indexes.map((_, at) => indexes[0] + at));
    }
  });
});

describe("a frame the strip does not have", () => {
  it("is clamped rather than left to draw a row around nothing", () => {
    expect(drawn(12, 99)).toBe(drawn(12, 11));
    expect(drawn(12, -4)).toBe(drawn(12, 0));
  });
});
