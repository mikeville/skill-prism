// Trigger a browser download for a Blob or data URL.
//
// Embedded WebViews (Claude Desktop, Electron, some in-app browsers on macOS)
// intercept blob URLs whose MIME types match a viewer they own — most
// commonly `application/pdf`. The interception strips the `download` attribute
// and saves the file to a sandboxed temp path with a random name (no
// extension), so the user has to manually rename it after downloading. We
// sidestep that by re-typing the blob as `application/octet-stream` right
// before download, which makes the WebView treat it as "just bytes" and
// respect the filename. The bytes are still a valid PDF/SVG/PNG — the
// extension on the filename communicates the format to the OS.
export function triggerDownload(source: Blob | string, filename: string) {
  const isBlob = source instanceof Blob;
  const downloadBlob =
    isBlob && source.type !== 'application/octet-stream'
      ? new Blob([source], { type: 'application/octet-stream' })
      : source;
  const url =
    downloadBlob instanceof Blob
      ? URL.createObjectURL(downloadBlob)
      : (downloadBlob as string);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (downloadBlob instanceof Blob) {
    // Defer revoke so the browser has time to commit the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'poster';
}
