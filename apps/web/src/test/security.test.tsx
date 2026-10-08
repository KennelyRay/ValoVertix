import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { fakeAccessUrl } from "@valovertix/riot/test-utils";
import staticData from "@/mocks/fixtures/static.json";
import { queryClient } from "@/lib/query-client";
import { server } from "./server";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

beforeEach(() => {
  resetApp();
  localStorage.removeItem("vv.gameVersion");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("resilience", () => {
  it("keeps working from cached game data when valorant-api.com's version check is down", async () => {
    await signInFixtureAccount();
    // A previous visit saw this version (and cached the data under it).
    renderApp("/collection");
    expect(
      await screen.findByLabelText("Search by name", {}, { timeout: 20000 }),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("vv.gameVersion")!).version).toBe(
      staticData.version.version,
    );

    // Now the version endpoint fails; the app falls back to the saved version.
    resetApp();
    await signInFixtureAccount();
    queryClient.removeQueries({ queryKey: ["static", "version"] });
    server.use(
      http.get("https://valorant-api.com/v1/version", () => HttpResponse.json({}, { status: 503 })),
    );
    localStorage.setItem("vv.gameVersion", JSON.stringify(staticData.version));
    renderApp("/collection");
    expect(
      await screen.findByLabelText("Search by name", {}, { timeout: 20000 }),
    ).toBeInTheDocument();
  });
});

describe("sign-in hygiene", () => {
  it("clears the clipboard after a pasted sign-in by default", async () => {
    const user = userEvent.setup(); // installs a test clipboard
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderApp("/");
    const box = await screen.findByLabelText(/Paste the address/, {}, { timeout: 20000 });
    expect(screen.getByRole("checkbox", { name: /Clear my clipboard/ })).toBeChecked();
    await user.click(box);
    await user.paste(fakeAccessUrl({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    await user.click(screen.getByRole("button", { name: "Show my account" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(""));
  });

  it("caps how much can be pasted into the sign-in box", async () => {
    renderApp("/");
    const box = await screen.findByLabelText(/Paste the address/, {}, { timeout: 20000 });
    expect(box).toHaveAttribute("maxLength", "8192");
  });
});
