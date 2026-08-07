import { Platform } from 'react-native';
import * as Print from 'expo-print';

// Print an HTML document on every platform.
//
// On NATIVE, expo-print renders the passed `html` and opens the OS print/share
// UI — works as intended. On WEB, expo-print's module is a stub that ignores
// `html` and just calls `window.print()`, which prints the *current app page*
// (the React shell — "the skeleton of the webpage"), not the document (#133).
//
// So on web we render the HTML into an isolated, off-screen <iframe> and print
// THAT frame. This fixes every web print surface at once (receipts, the NM
// purchase record, compliance/day-close exports, client statements) — callers
// use `printHtml(html)` instead of `Print.printAsync({ html })` directly.
export async function printHtml(html: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Print.printAsync({ html });
    return;
  }
  await printHtmlWeb(html);
}

// Web-only: print an isolated document via a hidden iframe, so the browser
// prints the passed HTML rather than the host app page.
function printHtmlWeb(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('printHtml: no document (web only)'));
      return;
    }

    const iframe = document.createElement('iframe');
    // Rendered (so it can paint + print) but out of the way and invisible.
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    });
    iframe.setAttribute('aria-hidden', 'true');

    let settled = false;
    const removeFrame = () => {
      try {
        iframe.remove();
      } catch {
        /* already gone */
      }
    };
    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        removeFrame();
        settle(new Error('printHtml: print frame unavailable'));
        return;
      }
      // Remove the frame once the print dialog closes (afterprint), with a long
      // fallback so a browser that never fires afterprint can't leak the node.
      const cleanup = () => setTimeout(removeFrame, 500);
      win.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 60000);
      // A short beat lets any images (e.g. a company logo) lay out before print.
      setTimeout(() => {
        try {
          win.focus();
          win.print();
          settle();
        } catch (error) {
          removeFrame();
          settle(error as Error);
        }
      }, 150);
    };
    iframe.onerror = () => {
      removeFrame();
      settle(new Error('printHtml: print frame failed to load'));
    };

    document.body.appendChild(iframe);
    // srcdoc gives the frame its own document, isolated from the app's styles.
    iframe.srcdoc = html;
  });
}
