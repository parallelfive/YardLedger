// Web build of shareTextFile: there's no OS share sheet, so trigger a browser
// download via a Blob + temporary anchor. The file lands in the user's
// Downloads folder — the regulated PII it carries is then the operator's to
// handle, the same trust boundary as picking a share target on native. We hold
// nothing at rest in app storage.
export async function shareTextFile(
  filename: string,
  content: string,
  mimeType: string,
  _uti?: string
): Promise<void> {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on the next tick so the click-initiated download has resolved.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
