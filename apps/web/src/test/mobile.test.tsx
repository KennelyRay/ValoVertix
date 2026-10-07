import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog } from "@/components/ui/primitives";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

// jsdom has no PointerEvent; a MouseEvent with the pointer fields is enough here.
class FakePointerEvent extends MouseEvent {
  pointerType: string;
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? "mouse";
    this.pointerId = init.pointerId ?? 1;
  }
}
globalThis.PointerEvent ??= FakePointerEvent as unknown as typeof PointerEvent;

/** Pretend to be a phone: every max-width query matches. */
const realMatchMedia = window.matchMedia;
beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: /max-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});
afterAll(() => {
  window.matchMedia = realMatchMedia;
});

beforeEach(() => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function Picker() {
  const [v, setV] = useState("a");
  return (
    <>
      <Dropdown
        label="Fruit"
        value={v}
        onChange={setV}
        options={[
          { value: "a", label: "Apple" },
          { value: "b", label: "Banana" },
        ]}
      />
      <p>Picked {v}</p>
    </>
  );
}

describe("phone menus", () => {
  it("opens dropdown options in a bottom sheet and picks on tap, not on touch-down", async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole("combobox", { name: "Fruit" }));
    const sheet = document.querySelector("[data-sheet]") as HTMLElement;
    expect(sheet).not.toBeNull();
    const banana = within(sheet).getByRole("option", { name: "Banana" });
    // A finger landing on an option to scroll the list doesn't choose it.
    fireEvent.pointerDown(banana, { pointerType: "touch" });
    expect(screen.getByText("Picked a")).toBeInTheDocument();
    fireEvent.click(banana);
    expect(screen.getByText("Picked b")).toBeInTheDocument();
    expect(document.querySelector("[data-sheet]")).toBeNull();
  });

  it("closes a sheet from the backdrop", async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole("combobox", { name: "Fruit" }));
    await user.click(
      within(document.querySelector("[data-sheet]")!).getAllByLabelText("Close")[0]!,
    );
    expect(document.querySelector("[data-sheet]")).toBeNull();
  });
});

function SheetDialog() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Details">
      <p>Body</p>
    </Dialog>
  );
}

describe("phone dialogs", () => {
  beforeAll(() => {
    // jsdom has no <dialog> methods.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  it("render as bottom sheets that close on a downward swipe", async () => {
    render(<SheetDialog />);
    const dialog = document.querySelector("dialog")!;
    expect(dialog).toHaveClass("sheet");
    const handle = within(dialog).getByRole("heading", { name: "Details" }).closest(".touch-none")!;
    fireEvent.pointerDown(handle, { pointerType: "touch", clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerType: "touch", clientY: 260, pointerId: 1 });
    await act(async () => {
      fireEvent.pointerUp(handle, { pointerType: "touch", clientY: 260, pointerId: 1 });
    });
    await waitFor(() => expect(screen.queryByText("Body")).not.toBeInTheDocument());
  });
});

describe("phone app shell", () => {
  beforeEach(async () => {
    await signInFixtureAccount();
  });

  it("shows a bottom tab bar with a More sheet", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/dashboard");
    const bar = await screen.findByRole("navigation", { name: "Tab bar" }, { timeout: 20000 });
    expect(document.documentElement).toHaveClass("has-tabbar");
    for (const name of ["Home", "Store", "Stats", "Collection"]) {
      expect(within(bar).getByRole("link", { name })).toBeInTheDocument();
    }
    await user.click(within(bar).getByRole("button", { name: "More" }));
    const sheet = await screen.findByRole("dialog", { name: "More" });
    await user.click(within(sheet).getByRole("link", { name: /Spending/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/spending"));
    expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument();
  });

  it("filters the collection with weapon chips and a Filters sheet", async () => {
    const user = userEvent.setup();
    renderApp("/collection");
    const chips = await screen.findByRole("radiogroup", { name: "Weapon" }, { timeout: 20000 });
    const before = screen.getByText(/^Showing \d+ of/).textContent;
    const firstWeapon = within(chips).getAllByRole("radio")[1]!;
    await user.click(firstWeapon);
    expect(firstWeapon).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/^Showing \d+ of/).textContent).not.toBe(before);

    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByRole("combobox", { name: "Tier" })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: /^Show \d+ skins/ }));
    expect(screen.queryByRole("dialog", { name: "Filters" })).not.toBeInTheDocument();
  });
});
