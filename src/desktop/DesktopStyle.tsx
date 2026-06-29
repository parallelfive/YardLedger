// Global stylesheet for the web/desktop shell — theme tokens (light "Daybook" /
// dark "Nightshift"), type helpers, animations, scrollbars. Ported verbatim
// from the Claude Design handoff (Tare · Desktop) so the desktop UI is
// pixel-faithful. Injected once at the shell root; only mounts on desktop web
// (the RN mobile tree is not rendered at the same time, so the global class
// names can't collide).

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=Archivo+Expanded:wght@500;600;700;800&family=Spline+Sans+Mono:wght@400;500;600;700&display=swap');

.yl-app, .yl-app *, .yl-app *::before, .yl-app *::after { box-sizing: border-box; }

.yl-app {
  --accent: #b3592f;
  --accent-ink: #ffffff;
  --accent-soft: color-mix(in oklab, var(--accent) 14%, transparent);
  --accent-line: color-mix(in oklab, var(--accent) 32%, transparent);
  --teal:  #3f7d82;
  --moss:  #5d7a4e;
  --rust:  #b5462f;
  --gold:  #b08a32;
  width: 100%;
  height: 100%;
  display: flex;
  position: relative;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Archivo', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "ss01" 1, "cv01" 1;
}

.yl-app[data-theme="light"] {
  --bg: #f3efe8; --surface: #ffffff; --surface-2: #faf7f1; --raised: #ffffff;
  --ink: #1b1813; --ink-2: #6a6258; --ink-3: #a39b8e;
  --line: #e6e0d5; --line-2: #d7d0c2; --line-strong: #c8c0b0;
  --shadow: 0 1px 2px rgba(40,33,22,0.04), 0 6px 18px rgba(40,33,22,0.05);
  --shadow-lg: 0 8px 40px rgba(40,33,22,0.14);
  --chip: #f0ebe2;
  --rail: #19160f; --rail-2: #221d15; --rail-line: #322c20;
  --rail-ink: #f1ebdd; --rail-ink-2: #b3a994; --rail-ink-3: #7c7361;
}

.yl-app[data-theme="dark"] {
  --bg: #15130f; --surface: #201d17; --surface-2: #1b1813; --raised: #262219;
  --ink: #f1ebdd; --ink-2: #a89e8c; --ink-3: #6f6657;
  --line: #322d24; --line-2: #3c372c; --line-strong: #4a4435;
  --shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35);
  --shadow-lg: 0 12px 50px rgba(0,0,0,0.55);
  --chip: #2b261d;
  --rail: #100e0a; --rail-2: #1a160f; --rail-line: #2a251c;
  --rail-ink: #f1ebdd; --rail-ink-2: #a89e8c; --rail-ink-3: #6f6657;
}

.yl-app .mono { font-family: 'Spline Sans Mono', ui-monospace, monospace; font-feature-settings: "tnum" 1; }
.yl-app .num  { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.yl-app .exp  { font-family: 'Archivo Expanded', 'Archivo', sans-serif; }

.yl-app ::-webkit-scrollbar { width: 10px; height: 10px; }
.yl-app ::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.yl-app ::-webkit-scrollbar-thumb:hover { background: var(--line-strong); background-clip: padding-box; }
.yl-app ::-webkit-scrollbar-track { background: transparent; }

.yl-app button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
.yl-app input, .yl-app select, .yl-app textarea { font-family: inherit; }

.yl-app .tap { transition: transform .1s ease, background .15s ease, border-color .15s ease, box-shadow .2s ease, color .15s ease; }
.yl-app .tap:active { transform: scale(0.99); }
.yl-app .lift { transition: transform .14s cubic-bezier(.2,.7,.2,1), box-shadow .2s ease, border-color .15s ease, background .15s ease; }
.yl-app .lift:hover { transform: translateY(-1px); }
.yl-app .focusring:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

@keyframes ylFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes ylScrim { from { opacity: 0; } to { opacity: 1; } }
@keyframes ylSlideR { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes ylBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.yl-app .stagger.in > * { opacity: 0; animation: ylFade .5s cubic-bezier(.2,.7,.2,1) forwards; }
.yl-app .stagger.in > *:nth-child(1) { animation-delay: .02s; }
.yl-app .stagger.in > *:nth-child(2) { animation-delay: .06s; }
.yl-app .stagger.in > *:nth-child(3) { animation-delay: .10s; }
.yl-app .stagger.in > *:nth-child(4) { animation-delay: .14s; }
.yl-app .stagger.in > *:nth-child(5) { animation-delay: .18s; }
.yl-app .stagger.in > *:nth-child(6) { animation-delay: .22s; }
@media (prefers-reduced-motion: reduce) {
  .yl-app .stagger.in > * { animation: none !important; opacity: 1 !important; }
}

.yl-app .ml-bar { transform-origin: left; transform: scaleX(1); }
.yl-app .stagger.in .ml-bar { transform: scaleX(0); animation: ylBar .6s var(--bd, 0s) cubic-bezier(.2,.8,.2,1) forwards; }

.yl-app .trow { transition: background .12s ease; }
.yl-app .trow:hover { background: var(--surface-2); }

.yl-app .screen-scroll { scrollbar-width: thin; }
`;

export default function DesktopStyle() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
