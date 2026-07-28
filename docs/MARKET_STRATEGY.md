# Tare / YardLedger — Market Strategy

Status: **Draft for discussion** · Owner: Damian · Created: 2026-07-28

The go-to-market view: who we sell to, how we're positioned, the wedge, what we
win on, and how it makes money. The feature-level analysis and v1 build order
live in [COMPETITIVE_STRATEGY.md](./COMPETITIVE_STRATEGY.md); the monetization
mechanics in [ENTITLEMENTS_AND_PORTAL_RFC.md](./ENTITLEMENTS_AND_PORTAL_RFC.md).

> **Confidence note.** The positioning below is an **informed hypothesis** built
> from competitor research + domain reasoning, not yet validated with paying
> yards. Treat the "validate" section as gating before heavy spend.

## 1. Positioning statement

> **The modern scrap-yard POS that keeps you legal automatically and runs on the
> device you already own — no $300/month, no Windows PC bolted to the scale.**
> Starts free-and-simple for a one-person yard; scales to multi-site, accounts,
> and processing without switching software.

## 2. Who we sell to

- **Beachhead — small/independent yards (1–3 people).** Priced out of the
  incumbents ($200–300+/mo + hardware + install). Fear compliance fines. Want
  something that works on a phone/tablet today. **Lowest friction, fastest "yes."**
- **Expansion — mid-size & multi-site recyclers.** Have peripherals and B2B
  accounts. Underserved by "too enterprise / too expensive / too dated." We land
  small, then grow into them with paid modules (pricing, dispatch, processing).
- **Not us (yet) — large enterprise processors** running Recy/AMCS with ERP +
  hedging desks. Revisit once the mid-market modules are proven.

## 2.5 First market reality: LA / California (validated demand)

Damian personally knows **many smaller LA yards** who'd take an affordable **MVP
tier** — the strongest signal we have, and it confirms the small-yard +
affordability thesis. **But the beachhead is therefore _California_, and our
compliance engine is New Mexico-only today.** "Compliance autopilot" is the moat;
it doesn't cover these customers until we ship a **California jurisdiction
module**. That module — not NM — is the real v1 revenue gate.

California is one of the strictest states (good for the moat, real work to
build). Verified requirements (2026-07-28, confirm with a CA yard before build):

- **3-day payment hold**, paid by **non-transferable check mailed to the seller's
  home** or picked up in person after the hold — **no cash**. Hold waivable for
  frequent sellers (5+ transactions on 5 different days/month for 3 consecutive
  months).
- **AB 476 (eff. 1/1/2026):** copper sellers need a **CSLB license**; fine for
  knowingly buying stolen metal raised **$1,000 → $10,000**.
- **Photo-ID copy** (thumbprint in some localities); **no nonferrous purchases
  from under-18**; record retention + local law-enforcement reporting (commonly
  LeadsOnline / CARS).

Maps well onto primitives we already have (holds, check-only payment, ID capture,
reporting queue) via the jurisdiction layer (`src/compliance/jurisdictions/`).
New work vs NM: a **3-day _payment_ hold** (delayed-payout workflow + mailed
check, not just a material hold), the **frequent-seller waiver**, the **CSLB
copper-license** field/gate, and the **under-18** block. Sources:
[AB 476](https://legiscan.com/CA/text/AB476/id/3220273),
[CA scrap laws (ScrapMonster)](https://www.scrapmonster.com/scrap-laws/california/3370),
[AB 476 fines (P&T Metals)](https://www.ptmetals.com/blog/ab-476-scrap-metal-fine-increase/).

## 3. The wedge (why they switch)

1. **Compliance autopilot** — "we keep you legal automatically" (holds, VIN +
   attestations, report deadlines, state uploads). Small yards can't afford a
   compliance person; this is the fear we remove. Already built.
2. **No hardware _required_, runs on your device** — zero-install, BYO
   phone/tablet, offline-first, modern fast UX. Deploy + iterate runs circles
   around per-machine Windows installs.

One-liner: **"Stay legal and run your yard from your phone — no hardware, no
$300/month."**

## 4. Differentiation vs incumbents

| Axis       | Incumbents (ScrapRight, Scrap Dragon, cieTrade, AMCS) | Us                                         |
| ---------- | ----------------------------------------------------- | ------------------------------------------ |
| Deploy     | Windows install, per-machine, IT overhead             | Zero-install web + mobile, instant updates |
| Price      | $200–300+/mo + hardware                               | Low base + à-la-carte add-ons              |
| UX / speed | Dated; simple bug fixes take weeks                    | Modern, fast, iterate weekly               |
| Mobility   | Deskbound                                             | Phone/tablet at the scale                  |
| Compliance | A feature                                             | **The headline / autopilot**               |
| Hardware   | **Their real edge** (native drivers)                  | Optional; see §5                           |

We do **not** claim to out-feature the enterprise suites on day one. We claim
**affordable + modern + mobile + automatically-compliant**, and we close the one
gap that matters (the scale).

## 5. The hardware question (handled honestly)

"No hardware" is a **wedge for small yards but a liability for big ones** — nobody
hand-keys a 40,000 lb truck weight. Stance: **no-hardware-_required_,
hardware-_optional_.**

Reading the scale from the browser is real, with **verified limits (2026-07-28):**

- **Direct (Web Serial API):** works on **desktop Chrome/Edge** + **Android
  Chrome** (Chrome 148, Apr 2026); **not iOS/iPad at all**; ~72% global support.
- **Serial→WiFi/Bluetooth bridge:** a cheap indicator add-on that streams weight
  over the LAN so **any** device (iPhone included) reads it.

So: direct on desktop/Android, bridge for Apple. Either way it's a small BOM
item, not a Windows PC — which is the whole point. Pitch: **"All the speed and
cost of web, and it still reads your scale."** Label printer / cash drawer follow
the same optional-peripheral pattern later.

## 6. v1 — what we lead with to earn the first customers

**0. California jurisdiction module (revenue gate for the LA beachhead).** The
compliance moat only counts if it covers the customer's state. See §2.5. This is
a prerequisite, not a "nice to have," for the LA yards.

1. **Compliance autopilot + modern no-hardware POS** — the headline (built for
   NM; needs the CA module above to serve the beachhead).
2. **Real pricing: quality grades + per-customer price levels + permissioned
   overrides** — table-stakes-plus and the first paid "Advanced Pricing" module;
   unlocks B2B / bigger yards.
3. **Optional truck-scale integration** — kills the "web can't do hardware"
   objection; huge in a demo.

Deferred to paid modules: processing/yield, dispatch/containers, shipment
settlement, fraud analytics, BI, hedging.

## 7. How it makes money

Base subscription = POS + compliance + basic pricing (cheap, gets the beachhead).
Everything a bigger yard needs is an **à-la-carte add-on / bundle** (entitlements
RFC): Advanced Pricing, Dispatch, Processing, Multi-site, BI. Small yards pay
little; bigger yards self-select into modules. **The pricing engine (v1 #2) is the
first paid module and the template for the rest.**

## 8. Validate before heavy build (de-risk the hypothesis)

- Interview 5–10 real yards (small + mid) — confirm compliance-fear, price
  sensitivity, phone/tablet vs PC, and which peripherals are non-negotiable.
- Confirm the **scale-integration** path with the actual indicators they run
  (Rice Lake / Cardinal / Avery-GSE ASCII) — direct vs bridge.
- Price-test the base + Advanced Pricing add-on.
- Watch churn drivers: offline reliability, printing (see the web-print bug),
  data migration off their current software.

## Sources

- ScrapRight / Scrap Dragon / cieTrade / AMCS-Recy product + reviews (GetApp,
  Slashdot, vendor sites)
- Web Serial API support: caniuse.com/web-serial, Chrome Status (Android),
  MDN
- Copper grade + pricing references (sgt-scrap, millbridgemetals)
