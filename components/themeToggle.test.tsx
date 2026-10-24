import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "@/components/ThemeToggle";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("cycles Auto -> Light -> Dark -> Auto and persists the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /theme: auto/i });

    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");

    await user.click(screen.getByRole("button", { name: /theme: light/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(screen.getByRole("button", { name: /theme: dark/i }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("theme")).toBeNull();
  });
});
