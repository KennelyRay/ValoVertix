import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LazyMotion, domMax } from "framer-motion";
import { Dropdown } from "./dropdown";

const OPTIONS = [
  { value: "vandal", label: "Vandal" },
  { value: "phantom", label: "Phantom" },
  { value: "operator", label: "Operator" },
  { value: "sheriff", label: "Sheriff" },
] as const;
type Weapon = (typeof OPTIONS)[number]["value"];

function Harness({ onChange = () => {} }: { onChange?: (v: Weapon) => void }) {
  const [value, setValue] = useState<Weapon>("vandal");
  return (
    <LazyMotion features={domMax}>
      <Dropdown<Weapon>
        label="Weapon"
        value={value}
        options={OPTIONS}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    </LazyMotion>
  );
}

describe("Dropdown", () => {
  it("exposes a labelled combobox showing the selected option", () => {
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Weapon" });
    expect(box).toHaveTextContent("Vandal");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("opens on click and selects with the pointer", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Weapon" });
    await user.click(box);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Vandal" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Operator" }));
    expect(onChange).toHaveBeenCalledWith("operator");
    expect(box).toHaveTextContent("Operator");
    expect(box).toHaveFocus();
  });

  it("works fully from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Weapon" });
    box.focus();
    await user.keyboard("{ArrowDown}");
    expect(box).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(box.getAttribute("aria-activedescendant")).toContain("opt-2");
    await user.keyboard("{Enter}");
    expect(box).toHaveTextContent("Operator");
    await user.keyboard("{Enter}{End}{Enter}");
    expect(box).toHaveTextContent("Sheriff");
    await user.keyboard("{ArrowUp}{Home}{Enter}");
    expect(box).toHaveTextContent("Vandal");
  });

  it("jumps to an option by typing and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Weapon" });
    box.focus();
    await user.keyboard(" ");
    await user.keyboard("sh");
    expect(box.getAttribute("aria-activedescendant")).toContain("opt-3");
    await user.keyboard("{Escape}");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).toHaveTextContent("Vandal");
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole("combobox", { name: "Weapon" }));
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.getByRole("combobox", { name: "Weapon" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
