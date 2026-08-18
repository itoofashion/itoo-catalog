import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HiddenStylesReview, RecentArrivals } from "./catalog-review";
import type { ReviewStyle } from "./review-style";

/**
 * Restoring goes through the same action the eye on a card uses, and what it
 * does on the server is the action's own test. What matters here is that the
 * press gets sent, the row leaves at once, and a refusal puts it back.
 */
const { setStyleHidden } = vi.hoisted(() => ({ setStyleHidden: vi.fn() }));
vi.mock("@/app/actions", () => ({ setStyleHidden }));

function style(overrides: Partial<ReviewStyle> & { sku: string }): ReviewStyle {
  return {
    name: `Style ${overrides.sku}`,
    price: 19.75,
    category: "Tops",
    photo: "/i/abc",
    addedAt: "2026-08-01T09:00:00.000Z",
    hidden: false,
    ...overrides,
  };
}

/** "YYYY-MM-DD", n days back, against the same clock the component reads. */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

beforeEach(() => {
  setStyleHidden.mockReset().mockResolvedValue({ ok: true });
});

describe("the review of hidden styles", () => {
  const styles = [
    style({ sku: "TOP-1" }),
    style({ sku: "TOP-2", hidden: true, name: "Ruffled Blouse" }),
    style({ sku: "PANT-1", hidden: true, category: "Pants" }),
  ];

  it("lists every hidden style, and only those", () => {
    render(<HiddenStylesReview styles={styles} />);
    const list = screen.getByRole("list");

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Ruffled Blouse")).toBeInTheDocument();
    expect(within(list).queryByText("Style TOP-1")).not.toBeInTheDocument();
  });

  it("says what a row is: the style, its category, its price", () => {
    render(<HiddenStylesReview styles={styles} />);
    expect(screen.getByText(/Style TOP-2 · Tops · \$19.75/)).toBeInTheDocument();
  });

  it("takes the way back to the server, and the row leaves at once", async () => {
    const user = userEvent.setup();
    render(<HiddenStylesReview styles={styles} />);

    await user.click(screen.getByRole("button", { name: "Show TOP-2 to clients again" }));

    expect(setStyleHidden).toHaveBeenCalledWith("TOP-2", false);
    expect(screen.queryByText("Ruffled Blouse")).not.toBeInTheDocument();
  });

  it("puts the row back and says why when the server refuses", async () => {
    setStyleHidden.mockResolvedValue({ error: "Could not save that just now. Try again." });
    const user = userEvent.setup();
    render(<HiddenStylesReview styles={styles} />);

    await user.click(screen.getByRole("button", { name: "Show TOP-2 to clients again" }));

    expect(await screen.findByText(/Could not save that just now/)).toBeInTheDocument();
    expect(screen.getByText("Ruffled Blouse")).toBeInTheDocument();
  });

  it("says where hidden styles come from when there are none", () => {
    render(<HiddenStylesReview styles={[style({ sku: "TOP-1" })]} />);
    expect(screen.getByText(/Nothing is hidden/)).toBeInTheDocument();
  });
});

describe("recent arrivals", () => {
  const styles = [
    style({ sku: "OLD-1", addedAt: daysAgo(90) }),
    style({ sku: "NEW-1", addedAt: daysAgo(3) }),
    style({ sku: "NEW-2", addedAt: daysAgo(10), hidden: true }),
  ];
  const monthBack = daysAgo(30).slice(0, 10);

  it("opens on the day it was handed, newest first", () => {
    render(<RecentArrivals styles={styles} initialSince={monthBack} />);
    const rows = screen.getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("NEW-1");
    expect(rows[1]).toHaveTextContent("NEW-2");
  });

  it("counts what it shows", () => {
    render(<RecentArrivals styles={styles} initialSince={monthBack} />);
    expect(screen.getByRole("status")).toHaveTextContent(/^2 styles added since/);
  });

  it("reaches further back when an earlier day is chosen", async () => {
    render(<RecentArrivals styles={styles} initialSince={monthBack} />);
    const dayBox = screen.getByLabelText(/added after/i);

    // fireEvent-style direct change: typing into a date input character by
    // character never forms a valid date for jsdom to accept.
    const user = userEvent.setup();
    await user.clear(dayBox);
    await user.type(dayBox, daysAgo(120).slice(0, 10));

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("writes the chosen day down, so a reload reopens on it", async () => {
    render(<RecentArrivals styles={styles} initialSince={monthBack} />);
    const day = daysAgo(120).slice(0, 10);

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/added after/i));
    await user.type(screen.getByLabelText(/added after/i), day);

    // The other half of the round trip lives in the page, which reads this
    // cookie on the way in (see page.test).
    expect(document.cookie).toContain(`arrivals-after=${day}`);
  });

  it("marks a hidden arrival rather than pretending it is on sale", () => {
    render(<RecentArrivals styles={styles} initialSince={monthBack} />);
    expect(screen.getByText(/NEW-2 · Tops · hidden/)).toBeInTheDocument();
  });

  it("says when a long answer is cut, instead of cutting it quietly", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      style({ sku: `N-${i}`, addedAt: daysAgo(2) }),
    );
    render(<RecentArrivals styles={many} initialSince={monthBack} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    expect(screen.getByText(/Showing the first 50/)).toBeInTheDocument();
  });
});
