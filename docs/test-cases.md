# Tare — manual / agent test cases

Point an MCP-driving session at these: "run the test cases in docs/test-cases.md
on the simulator." Each case lists steps + the expected result.

**Local test staffers** (Gorilla Recycling, local DB):

| Name     | Role   | PIN  |
| -------- | ------ | ---- |
| Tomás R. | worker | 1942 |
| Dana K.  | admin  | 4827 |
| Gabe M.  | owner  | 7310 |

Device email login: `owner@gorilla.test` / `tare1234` (= Gabe).

---

## 1. Passcode terminal & roles

1.1 **Worker sign-in** — From the passcode pad, enter `1942`.
_Expect:_ resolves to "Tomás R." with a **gold** ring + "WORKER", signs in. The
bottom tab bar shows **no Reports tab**; the avatar sheet has **no** Pricing /
Users / Company.

1.2 **Admin sign-in** — Avatar → Switch staffer → enter `4827`.
_Expect:_ "Dana K.", **moss** ring, "ADMIN". Reports tab present; avatar sheet
shows Pricing / Users / Company.

1.3 **Owner sign-in** — Switch staffer → `7310`.
_Expect:_ "Gabe M.", moss ring, "OWNER". Full access.

1.4 **Wrong PIN** — enter `0000`.
_Expect:_ dots turn red + shake, hint reads "Wrong passcode"; stays on pad.

1.5 **Lockout** — enter a wrong PIN 5× within 15 min.
_Expect:_ rejected with a lockout message ("Too many attempts…").

1.6 **Sign out escape** — on the pad, tap "Not you? Sign out".
_Expect:_ returns to the email/invite login screen.

---

## 2. New buy — tiers (compliance engine)

2.1 **Open tier** — New buy → add an _open_ metal (e.g. Aluminum Cans) → it goes
straight **Materials → Review** (no seller/vehicle steps). Pay → ticket saved.

2.2 **Regulated tier** — add a regulated metal (e.g. #1 Copper). Steps grow to
**Seller → Vehicle**; Review shows a 24-hour hold notice. Can't advance past
Seller without name + ID.

2.3 **Catalytic tier** — add a Catalytic Converter. A **Converter** step appears
(VIN + serials); payment is **locked to Check** (cash disabled); Review shows a
**60-day hold** + "queued for state upload".

2.4 **Price override** — on the keypad, tap Override and enter a different price →
the access-code gate appears; a valid code applies the override and badges the
line "OVERRIDE".

2.5 **Attribution** — while PIN'd in as Tomás, complete a buy. Confirm the
receipt's worker is Tomás (Reports → the receipt, or the DB query in the chat).

---

## 3. Compliance / holds / reporting

3.1 **Compliance tab** — header title "Compliance", right label "New Mexico".
Stats triplet (Transactions / Restricted / Unreported); a red deadline strip
appears when there are unreported buys.

3.2 **Export CSV** — Export CSV → a share sheet opens with the NMRLD CSV; the
cached file is purged after sharing.

3.3 **On hold** — a catalytic buy shows under On-hold with a 60-day countdown;
tapping a row opens the receipt.

---

## 4. Theme, search, navigation

4.1 **Theme** — Avatar → Theme toggles light/dark; the whole app switches live.

4.2 **Global search** — header search → type a customer name or receipt #;
results group by Receipts / Customers / Metals; tapping a receipt opens it.

4.3 **FAB quick actions** — center ＋ opens New buy / New sale.

4.4 **Header consistency** — every tab shows the same header (tare + yard left;
Search · Alerts · Avatar right); only the title + right label change.
