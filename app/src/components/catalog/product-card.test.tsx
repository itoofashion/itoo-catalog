import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    ...overrides,
  };
}

function renderCard(
  overrides: Partial<PublicProduct> = {},
  props: Partial<Parameters<typeof ProductCard>[0]> = {},
) {
  const onOpen = vi.fn();
  const onToggleSelect = vi.fn();
  render(
    <ProductCard
      product={product(overrides)}
      selectable
      selected={false}
      lockedByCategory={false}
      onToggleSelect={onToggleSelect}
      onOpen={onOpen}
      {...props}
    />,
  );
  return { onOpen, onToggleSelect };
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
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("aria-pressed", "true");
    // No padlock: the tick itself, faded.
    expect(box.className).toContain("opacity-45");
    expect(box.querySelector("svg")).toBeTruthy();

    await user.click(box);
    expect(onToggleSelect).not.toHaveBeenCalled();
  });
});
