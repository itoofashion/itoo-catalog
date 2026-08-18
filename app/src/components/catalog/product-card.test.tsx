import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "./product-card";
import type { PublicProduct } from "@/lib/catalog/public";

function product(overrides: Partial<PublicProduct> = {}): PublicProduct {
  return {
    sku: "Y-542",
    name: "Romantic Lace Top",
    price: 19.75,
    category: "Tops",
    colors: ["Beige", "Black"],
    images: [
      { url: "/i/one", color: "Beige" },
      { url: "/i/two", color: "Black" },
    ],
    sizes: ["S", "M", "L"],
    packBreakdown: [2, 2, 2],
    minimumUnits: 6,
    isNew: false,
    isHidden: false,
    ...overrides,
  };
}

function renderCard(
  overrides: Partial<PublicProduct> = {},
  props: Partial<Parameters<typeof ProductCard>[0]> = {},
) {
  const onOpen = vi.fn();
  const onToggleSelect = vi.fn();
  const onPickColor = vi.fn();
  const onShowPhoto = vi.fn();
  const onToggleHidden = vi.fn().mockResolvedValue(undefined);
  const item = product(overrides);
  render(
    <ProductCard
      product={item}
      selectable
      selected={false}
      lockedByCategory={false}
      onToggleSelect={onToggleSelect}
      // Both of the team's controls are on by default, because the team's view
      // is the one with anything to test on it.
      hideable
      hidden={false}
      onToggleHidden={onToggleHidden}
      // The chosen color is the catalog's to hold, not the card's; the card is
      // shown one and reports the presses. See catalog-view.tsx.
      color={item.colors[0] ?? null}
      onPickColor={onPickColor}
      // The frame on screen is the catalog's to hold as well, for the same
      // reason: the card and the open style are one gallery. See catalog-view.
      photoIndex={0}
      onShowPhoto={onShowPhoto}
      path="/p/y-542?c=beige"
      onOpen={onOpen}
      {...props}
    />,
  );
  return { onOpen, onToggleSelect, onPickColor, onShowPhoto, onToggleHidden };
}

describe("the pack on the card", () => {
  it("hangs the count on each size instead of a line of its own", () => {
    renderCard();
    expect(screen.getByText(/Y-542/)).toHaveTextContent("Y-542 · S ×2 · M ×2 · L ×2");
  });

  it("drops the minimum, which the counts already add up to", () => {
    renderCard();
    expect(screen.queryByText(/min 6 pcs/)).not.toBeInTheDocument();
  });

  it("states the minimum where the vendor fixed no split", () => {
    renderCard({ packBreakdown: null });
    expect(screen.getByText(/Y-542/)).toHaveTextContent("Y-542 · S · M · L");
    expect(screen.getByText("min 6 pcs")).toBeInTheDocument();
  });
});

describe("the arrows through the photos", () => {
  it("keeps both of them on the card at either end of the strip", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeInTheDocument();
  });

  it("disables the one with nowhere to go, and eats the click", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderCard();

    const back = screen.getByRole("button", { name: "Previous photo" });
    expect(back).toBeDisabled();
    // The point of leaving it there: a click that lands past the last photo
    // must not fall through and open the style.
    await user.click(back);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("the colors on the card", () => {
  it("shows the one the catalog says is chosen", () => {
    renderCard({}, { color: "Black" });
    expect(screen.getByRole("button", { name: "Black" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Beige" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("hands a press up rather than keeping the choice to itself", async () => {
    const user = userEvent.setup();
    const { onPickColor } = renderCard();
    await user.click(screen.getByRole("button", { name: "Black" }));

    expect(onPickColor).toHaveBeenCalledWith("Y-542", "Black");
  });
});

describe("the pick control", () => {
  it("is the square box the categories use", () => {
    renderCard();
    const box = screen.getByRole("button", { name: /Add Y-542/ });
    expect(box.className).toContain("size-5");
    expect(box.className).toContain("rounded-sm");
  });

  it("shows a style held by its category as a tick that cannot be taken back", async () => {
    const user = userEvent.setup();
    const { onToggleSelect } = renderCard({}, { lockedByCategory: true });

    const box = screen.getByRole("button", { name: /included through its category/ });
    // aria-disabled rather than disabled, so the button can still explain
    // itself on hover; the click test below is what "cannot be pressed" means.
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box).toHaveAttribute("aria-pressed", "true");
    // No padlock: the tick itself, faded.
    expect(box.className).toContain("opacity-45");
    expect(box.querySelector("svg")).toBeTruthy();

    await user.click(box);
    expect(onToggleSelect).not.toHaveBeenCalled();
  });
});

describe("the eye that takes a style out of the catalog", () => {
  it("is the same box as the tick beside it", () => {
    renderCard();
    const eye = screen.getByRole("button", { name: /Hide Y-542/ });
    expect(eye.className).toContain("size-5");
    expect(eye.className).toContain("rounded-sm");
  });

  it("is not on the card at all for anyone but the team", () => {
    // Not hidden by a style: a control a client can find in the markup is a
    // control a client can press.
    renderCard({}, { hideable: false });
    expect(screen.queryByRole("button", { name: /Hide Y-542/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show Y-542/ })).not.toBeInTheDocument();
  });

  it("reports the press rather than deciding anything itself", async () => {
    const user = userEvent.setup();
    const { onToggleHidden } = renderCard();
    await user.click(screen.getByRole("button", { name: /Hide Y-542/ }));

    expect(onToggleHidden).toHaveBeenCalledWith("Y-542");
  });

  it("offers to put a hidden style back", async () => {
    const user = userEvent.setup();
    const { onToggleHidden } = renderCard({}, { hidden: true });

    const eye = screen.getByRole("button", { name: "Show Y-542 to clients again" });
    expect(eye).toHaveAttribute("aria-pressed", "true");

    await user.click(eye);
    expect(onToggleHidden).toHaveBeenCalledWith("Y-542");
  });

  it("waits visibly while the server answers, and takes no second press", async () => {
    const user = userEvent.setup();
    let answer!: () => void;
    const onToggleHidden = vi.fn(
      () => new Promise<void>((resolve) => (answer = resolve)),
    );
    renderCard({}, { onToggleHidden });

    const eye = screen.getByRole("button", { name: /Hide Y-542/ });
    await user.click(eye);

    expect(eye).toBeDisabled();
    expect(eye.className).toContain("cursor-wait");
    await user.click(eye);
    expect(onToggleHidden).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer();
    });
    expect(eye).not.toBeDisabled();
  });
});

describe("a card the team has hidden", () => {
  it("says so in words, not only by going quiet", () => {
    renderCard({}, { hidden: true });
    expect(screen.getByText("Hidden from clients")).toBeInTheDocument();
  });

  it("is marked on the card itself and dims its photographs", () => {
    renderCard({}, { hidden: true });

    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("data-hidden");
    expect(card.querySelector(".photo-strip")?.className).toContain("opacity-30");
  });

  it("keeps its style number readable, since that is how it is found again", () => {
    renderCard({}, { hidden: true });
    expect(screen.getByText(/Y-542/)).toBeInTheDocument();
  });

  it("is neither marked nor dimmed while it is in the catalog", () => {
    renderCard();
    expect(screen.getByRole("article")).not.toHaveAttribute("data-hidden");
    expect(screen.queryByText("Hidden from clients")).not.toBeInTheDocument();
  });

  it("keeps both badges legible when it is also a new arrival", () => {
    renderCard({ isNew: true }, { hidden: true });
    const card = screen.getByRole("article");
    expect(card.querySelector('[data-badge="hidden"]')?.className).toContain("top-3");
    expect(card.querySelector('[data-badge="new"]')?.className).toContain("top-11");
  });
});
