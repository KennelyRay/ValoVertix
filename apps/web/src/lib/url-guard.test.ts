import { scrubCredentialsFromUrl } from "./url-guard";

describe("scrubCredentialsFromUrl", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("removes tokens from the fragment or query", () => {
    window.history.replaceState(null, "", "/dashboard#access_token=abc&id_token=def");
    expect(scrubCredentialsFromUrl()).toBe(true);
    expect(window.location.href).toMatch(/\/dashboard$/);

    window.history.replaceState(null, "", "/?id_token=x");
    expect(scrubCredentialsFromUrl()).toBe(true);
    expect(window.location.search).toBe("");
  });

  it("leaves share links and ordinary URLs alone", () => {
    window.history.replaceState(null, "", "/c#AQRQ_QCsERaA_X2lDC-sFNyn");
    expect(scrubCredentialsFromUrl()).toBe(false);
    expect(window.location.hash).toBe("#AQRQ_QCsERaA_X2lDC-sFNyn");
    window.history.replaceState(null, "", "/?demo=1");
    expect(scrubCredentialsFromUrl()).toBe(false);
  });
});
