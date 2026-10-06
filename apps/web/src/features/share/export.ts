/** Resolves once every <img> in the node has loaded (or failed) and fonts are ready. */
export async function waitForImages(node: HTMLElement): Promise<void> {
  const images = [...node.querySelectorAll("img")];
  await Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? img.decode().catch(() => {})
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
  await document.fonts?.ready;
}

export async function exportPng(node: HTMLElement, width: number, height: number): Promise<Blob> {
  await waitForImages(node);
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, { width, height, pixelRatio: 1, backgroundColor: "#0e1117" });
  if (!blob) throw new Error("export failed");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
