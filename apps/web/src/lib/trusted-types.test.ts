import { allowScriptUrl, installTrustedTypesPolicy } from "./trusted-types";

describe("trusted types policy", () => {
  it("allows only the demo service worker as a script URL", () => {
    expect(allowScriptUrl("/mockServiceWorker.js", "https://app.test")).toBe(
      "/mockServiceWorker.js",
    );
    expect(() => allowScriptUrl("/evil.js", "https://app.test")).toThrow(TypeError);
    expect(() =>
      allowScriptUrl("https://evil.example/mockServiceWorker.js", "https://app.test"),
    ).toThrow(TypeError);
  });

  it("installs a default policy that refuses HTML and scripts", () => {
    const created: Record<string, Record<string, (s: string) => string>> = {};
    (globalThis as { trustedTypes?: unknown }).trustedTypes = {
      createPolicy: (name: string, rules: Record<string, (s: string) => string>) => {
        if (created[name]) throw new Error("exists");
        created[name] = rules;
      },
    };
    expect(installTrustedTypesPolicy()).toBe(true);
    expect(() => created.default!.createHTML!("<img onerror=x>")).toThrow(/raw HTML/);
    expect(() => created.default!.createScript!("alert(1)")).toThrow(/string/);
    expect(created.default!.createScriptURL!("/mockServiceWorker.js")).toBe(
      "/mockServiceWorker.js",
    );
    // A second install keeps the first policy.
    expect(installTrustedTypesPolicy()).toBe(false);
    delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
    expect(installTrustedTypesPolicy()).toBe(false);
  });
});
