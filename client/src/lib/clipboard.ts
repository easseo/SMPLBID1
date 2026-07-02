// navigator.clipboard.writeText requires a secure context (HTTPS or literally
// "localhost") — it's unavailable/rejects on a plain-HTTP LAN address, which
// is exactly how this app gets accessed from a second device during local
// testing. Falls back to the legacy execCommand('copy') path, which works in
// insecure contexts, before giving up.
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
