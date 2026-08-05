import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogStatus } from "./catalog-status";

const SYNCED_AT = "2026-08-04T12:00:00.000Z";

function renderStatus({ productCount = 42, syncedAt = SYNCED_AT } = {}) {
  return render(<CatalogStatus productCount={productCount} syncedAt={syncedAt} />);
}

describe("catalog status", () => {
  it("reports how much catalog there is", () => {
    renderStatus({ productCount: 137 });
    expect(screen.getByText("Styles").parentElement).toHaveTextContent("137");
  });

  it("prints the sync time for a reader to read, and for a machine to parse", () => {
    const { container } = renderStatus();
    const stamp = container.querySelector("time");
    expect(stamp).toHaveAttribute("datetime", SYNCED_AT);
    // Formatted in the reader's own timezone, so the test can only insist that
    // the raw timestamp is not what ends up on screen.
    expect(stamp?.textContent).not.toBe(SYNCED_AT);
    expect(stamp?.textContent).toMatch(/2026/);
  });

  it("says never rather than showing an unreadable date", () => {
    renderStatus({ syncedAt: "" });
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("names where the products come from without promising a date", () => {
    renderStatus();
    const source = screen.getByText(/snapshot of FashionGo/i);
    expect(source).toHaveTextContent(/official FashionGo REST API/i);
  });

  it("leads back to the catalog", () => {
    renderStatus();
    expect(screen.getByRole("link", { name: /catalog/i })).toHaveAttribute("href", "/");
  });

  it("signs out with a plain form, which works without JavaScript", () => {
    const { container } = renderStatus();
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/admin/sign-out");
    expect(form?.method).toBe("post");
    expect(screen.getByRole("button", { name: /sign out/i })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
