import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkPanel, describeSelection } from "./link-panel";

/**
 * The panel's job after the move to a database: the code comes from the server
 * now, so the press is a round trip and the panel has to say so, hand back a
 * six-character address, and survive the server saying no.
 */
const { createLink } = vi.hoisted(() => ({ createLink: vi.fn() }));
vi.mock("@/app/s/actions", () => ({ createLink }));

const writeText = vi.fn();

beforeEach(() => {
  createLink.mockReset();
  writeText.mockReset().mockResolvedValue(undefined);
});

/**
 * After userEvent.setup(), never before: setting up a user installs a clipboard
 * of its own over navigator.clipboard, and this has to be the one that survives.
 */
function pressing() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return user;
}

function renderPanel({ newOnly = false } = {}) {
  return render(
    <LinkPanel
      selection={{ categories: ["Dresses"], skus: [] }}
      productCount={12}
      newOnly={newOnly}
      onClear={vi.fn()}
    />,
  );
}

const button = () => screen.getByRole("button", { name: /Get link|Copied|Copy again|Making/ });

describe("the link panel", () => {
  it("shows the short address the server minted, and copies it", async () => {
    createLink.mockResolvedValue({ code: "K7M2QP" });
    const user = pressing();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /Get link/ }));

    const link = `${window.location.origin}/s/K7M2QP`;
    expect(screen.getByTitle(link)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(link);
    expect(createLink).toHaveBeenCalledWith({ categories: ["Dresses"], skus: [] }, false);
  });

  it("waits on the server without letting the button be pressed twice", async () => {
    let release: (value: { code: string }) => void = () => {};
    createLink.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const user = pressing();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /Get link/ }));

    expect(button()).toBeDisabled();
    expect(button()).toHaveTextContent(/Making link/);

    release({ code: "K7M2QP" });
    await screen.findByTitle(`${window.location.origin}/s/K7M2QP`);
    expect(createLink).toHaveBeenCalledTimes(1);
  });

  it("mints once and copies again on the next press", async () => {
    createLink.mockResolvedValue({ code: "K7M2QP" });
    const user = pressing();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /Get link/ }));
    await user.click(button());

    expect(createLink).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("says what went wrong instead of showing a link that is not there", async () => {
    createLink.mockResolvedValue({ error: "Sign in to make a link." });
    const user = pressing();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /Get link/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in to make a link.");
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Get link/ })).toBeEnabled();
  });

  it("keeps the link on screen when the clipboard refuses", async () => {
    createLink.mockResolvedValue({ code: "K7M2QP" });
    writeText.mockRejectedValue(new Error("denied"));
    const user = pressing();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /Get link/ }));

    expect(screen.getByTitle(`${window.location.origin}/s/K7M2QP`)).toBeInTheDocument();
  });

  it("says what is in the link and how many styles that is", async () => {
    renderPanel();
    expect(screen.getByText("all of Dresses · 12 styles")).toBeInTheDocument();
  });

  it("sends the new-arrivals lens with the link when it is on", async () => {
    createLink.mockResolvedValue({ code: "K7M2QP" });
    const user = pressing();
    renderPanel({ newOnly: true });
    await user.click(button());

    expect(createLink).toHaveBeenCalledWith({ categories: ["Dresses"], skus: [] }, true);
  });

  it("says on its face that the link is only the new arrivals", () => {
    renderPanel({ newOnly: true });
    expect(
      screen.getByText("all of Dresses · 12 styles · new arrivals"),
    ).toBeInTheDocument();
  });
});

/**
 * These were written against a real complaint: a selection of five styles read
 * "5 picked items · 5 items", which says the same number twice and reads as a
 * bug. The total belongs on the line only when the selection names a category,
 * because a category is the one thing whose size the client cannot count.
 */
describe("what the link promises", () => {
  it("counts hand-picked styles once", () => {
    expect(describeSelection({ categories: [], skus: ["A", "B", "C", "D", "E"] }, 5)).toBe(
      "5 styles",
    );
  });

  it("keeps the grammar right for a single hand-picked style", () => {
    expect(describeSelection({ categories: [], skus: ["A"] }, 1)).toBe("1 style");
  });

  it("spells out the total for a category, which is the part nobody counted", () => {
    expect(describeSelection({ categories: ["Dresses"], skus: [] }, 67)).toBe(
      "all of Dresses · 67 styles",
    );
  });

  it("names the lens, so a shrunken number explains itself", () => {
    expect(describeSelection({ categories: ["Dresses"], skus: [] }, 3, true)).toBe(
      "all of Dresses · 3 styles · new arrivals",
    );
  });

  it("names several categories by their number", () => {
    expect(describeSelection({ categories: ["Dresses", "Tops", "Pants"], skus: [] }, 120)).toBe(
      "3 categories · 120 styles",
    );
  });

  it("adds hand-picked styles to a category without repeating the total", () => {
    expect(describeSelection({ categories: ["Dresses"], skus: ["A", "B"] }, 69)).toBe(
      "all of Dresses + 2 picked · 69 styles",
    );
  });

  it("says nothing is chosen rather than going blank", () => {
    expect(describeSelection({ categories: [], skus: [] }, 0)).toBe("0 styles");
  });
});
