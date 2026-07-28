# Competitive Strategy & v1 Focus

Status: **Draft for discussion** · Owner: Damian · Created: 2026-07-28

How Tare/YardLedger wins against incumbent scrap-yard software — the market
gaps worth attacking, an honest read on the "web vs Windows POS" question, and
the 2–3 bets we lead with in **v1** to get yards to switch.

Companion to [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md),
[ENTITLEMENTS_AND_PORTAL_RFC.md](./ENTITLEMENTS_AND_PORTAL_RFC.md) (how these
become paid add-ons), and the positioning summary in project memory.

## 1. Goal

Beat the incumbents (ScrapRight, Scrap Dragon, cieTrade, ScrapWare, AMCS/Recy)
for **small yards first, bigger yards next**, and monetize via à-la-carte
add-ons. We don't win by having _everything_ — we win by being **10× better on
2–3 things they're bad at**, while matching table stakes.

## 2. Table stakes (match, don't win on)

Walk-in POS, scale weigh-in, printed tickets, buy/sell inventory, compliance &
state reporting, basic grades & price sheets, per-line overrides, accounting
export. **Most already built.** These get us in the room; they don't win the deal.

## 3. Where incumbents are weak — our openings

1. **The software is old, slow, and hardware-bound.** Reviews cite trivial bugs
   taking a _month_ to fix and constant hardware/connectivity pain. Most are
   legacy Windows POS. **Our modern, fast, no-hardware-required, offline-first,
   phone/tablet UX is itself the wedge** — and already our moat.
2. **Processing & yield tracking (most under-served).** Bigger yards _process_:
   buy #2 copper, shear/strip/chop into a clean sellable grade. That's
   "1,000 lb dirty → 850 lb clean + 150 lb loss," with cost rolled forward. Most
   software treats inventory as static buy→sell and can't model the
   transformation or true processed cost. Hard, valuable, differentiating.
3. **Commercial/industrial accounts — where the money is.** Bigger yards live on
   **B2B**: standing accounts, **per-customer negotiated price sheets**, net-30
   terms, AR/AP, monthly statements, **contracts** (fixed/unfixed price, volume,
   recovery %). Incumbents do it at enterprise pricing.
4. **Dispatch / containers / roll-offs.** Drop a container at the customer's
   site, schedule pickups, track "where are my 40 roll-offs?", route. A whole
   upsell module — fits our entitlement plan.
5. **Shipment settlement reconciliation.** Ship a load to a mill/broker; they
   reweigh & reassay and pay on _their_ number. Tracking your-weight-vs-settled,
   disputes, and reconciliation is painful and thinly served.
6. **Internal theft/fraud analytics.** Employee collusion on weights/prices,
   curbstoning. Anomaly detection + audit + camera hooks — extends our
   compliance moat _inward_ ("keep you legal AND honest").
7. **Real-time inventory + real BI.** Live position across grades and multiple
   sites, margin per commodity, buyer performance. Incumbent reporting is slow.
8. **(Premium, later) Hedging / price-risk.** COMEX/LME hedging + contracts is
   emerging and mostly absent mid-market. High-end differentiator, not a start.

## 4. Honest answer: is Windows POS "stronger" than our web POS?

**It's a different trade-off, not strictly stronger — but on one axis (hardware)
it genuinely is today, and that matters for bigger yards.**

**Where Windows POS is stronger (today):**

- **Peripheral integration.** Native OS drivers talk to truck-scale indicators,
  pole displays, cash drawers, thermal/label printers, signature pads, ID
  scanners, and LPR cameras reliably and with low latency. Scrap yards run a lot
  of peripherals; this is the incumbents' real advantage.
- **Rock-solid offline** (local install + local DB) and no browser-sandbox
  limits.
- Mature, battle-tested over 20 years.

**Where our web / no-hardware POS is stronger:**

- **Zero install, instant updates, runs anywhere** (phone/tablet/any browser),
  **mobile at the scale**, modern fast UX, **cloud multi-site native**, low cost
  of entry. Deploying and iterating runs circles around per-machine Windows
  installs.

**The strategic nuance that decides our roadmap:** "no hardware" is a **wedge for
small yards** but a **liability for big yards** — nobody hand-keys a 40,000 lb
truck weight. So the winning stance is **no-hardware-_required_, hardware-
_optional_**: work with zero peripherals, but **integrate the truck scale, label
printer, etc. when present**.

**Two ways to read the scale, and the honest browser limits (verified
2026-07-28):**

- **Direct via Web Serial API** — browsers _can_ read RS-232/USB serial now, but
  only on **desktop Chrome/Edge/Opera** and **Android Chrome** (landed Chrome
  148, Apr 2026). **iOS/iPad: not supported at all** (Apple forces WebKit) and
  Firefox: no. ~72% global support ([caniuse](https://caniuse.com/web-serial),
  [Chrome Status](https://chromestatus.com/feature/6043992171085824)). Needs a
  one-time permission gesture. Great for a desktop/Android scale station; a
  dead-end on iPhone/iPad.
- **Serial→network bridge (device-agnostic)** — a cheap serial-to-WiFi/Bluetooth
  bridge at the indicator streams the weight over the LAN, so **any** device
  (iPhone included) reads it. This is a small BOM item, not a Windows PC, and is
  the path that keeps the phone-first pitch intact on Apple hardware.

So scale integration is real, but the _zero-adapter_ version is desktop/Android
only; iOS parity needs the bridge. Plan for both.

**Verdict:** don't claim web is universally stronger — it isn't on the hardware
axis. Claim: _"All the speed, mobility, and cost of web — and it still reads your
scale"_ (direct on desktop/Android, via a cheap bridge on iPhone/iPad). Closing
the scale gap neutralizes the incumbents' one real edge.

_Caveat: §3 gaps are "expensive & clunky for mid-market," not "absent" — Scrap
Dragon / cieTrade / AMCS do these at enterprise price/UX. Our opening is
affordability + modern/mobile, and this whole doc is an **informed hypothesis to
validate with real yards**, not a proven plan._

## 5. v1 — the 2–3 bets we lead with

Lead with what's built, add the two things that make yards actually switch:

1. **Compliance autopilot + modern no-hardware POS (the headline).** Mostly
   built. "Stay legal automatically, run the yard from your phone, no hardware,
   no $300/mo." This is the hook that gets small yards to come to us.
2. **Real pricing: quality grades + per-customer price levels + permissioned
   overrides (the money).** Extends work already in flight (per-piece, client
   statements, customer records). Grades handle dirty-copper; price levels
   (dealer vs walk-in) unlock B2B and bigger yards; overrides are the universal
   fallback. Ships as a paid "Advanced Pricing" add-on for bigger yards.
3. **Optional truck-scale integration (Web Serial/WebHID) (the credibility).**
   Read the weight straight off the indicator when a scale is present. Kills the
   "web can't do hardware" objection, huge in a demo, and is the beachhead for
   more peripherals (label printer, cash drawer) later.

**Deferred to post-v1 paid modules:** processing/yield, dispatch/containers,
shipment settlement, BI dashboards, hedging. Each becomes an entitlement.

## 6. How it makes money

Base subscription = POS + compliance + basic pricing. Everything in §3/§5.2–3
and the deferred list are **à-la-carte add-ons** (see the entitlements RFC), so
small yards pay little and bigger yards self-select into Advanced Pricing,
Dispatch, Processing, BI, etc. The pricing engine (v1 bet #2) is the first paid
module and the template for the rest.

## 7. Open questions

- Grade model: named grade-materials vs a base + % modifier vs both (leaning
  "both": grades as materials for the common cases, % modifier for recovery wire
  and ad-hoc haircuts). Needs its own pricing-engine design note.
- Price levels: per-customer fixed sheets vs tiers (Dealer/Public/VIP) vs both.
- Scale integration: which indicator protocols first (most common: Rice Lake,
  Cardinal, Avery/GSE ASCII streams). See scale-integration memory.

## Sources

- ScrapRight reviews — GetApp
- Scrap Dragon — Slashdot / SourceForge
- Recycling software comparison — GetApp
- AMCS / Recy Systems (enterprise)
- Scrap futures / hedging — scrapfutures.com, TDC Ventures
