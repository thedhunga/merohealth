# Payment provider — a decision for the owner

Status: **undecided.** This document exists to make that decision easy, not to
make it. Nothing in this repository integrates a real payment gateway, and
nothing should until the owner picks one and supplies the merchant
credentials. See `docs/compliance/compliance-gap-register.md`'s
"Payments/refunds" row — taxes, settlement and consumer-protection treatment
are all listed as unresolved, with "configurable ledger; mock provider" as the
interim engineering control. This document does not change that control.

## Why this exists now

`packages/billing` (clinical-suite capability map row 10) already models an
invoice lifecycle — `DRAFT -> ISSUED -> PAID`, multi-payer line items typed as
`BillingPayerType = 'CASH' | 'INSURANCE' | 'NHIF'` — and `PaymentRecord` has a
`provider` field typed `PaymentProvider = 'MOCK'`. That single-literal type is
deliberate: unlike other capability-map rows where this repo's own text names
what the real value would become, nothing in the repo names a real settlement
integration, so the type was left at `'MOCK'` rather than guess a vendor.
Round four's task G asks for exactly that missing decision, written down, so
a future run can widen `PaymentProvider` to a real second value instead of
guessing one.

**This document does not integrate a provider.** No SDK is added, no API key
is wired, no `PaymentProvider` value beyond `'MOCK'` is introduced. That is
explicit follow-on work, gated on the owner's choice below and on the
compliance register's "finance/legal approval" launch gate — not on this
document.

## The three real options

These are the payment rails that actually operate in Nepal today and that a
consumer health app could plausibly settle through. All three descriptions
below are general public information about how each gateway works, not a
claim that Mero Health has a relationship with any of them — no such
relationship exists.

| | **eSewa** | **Khalti** | **ConnectIPS** |
|---|---|---|---|
| Operator | F1Soft International | Sparrow Pay (formerly Khalti Digital Pay) | Nepal Clearing House Ltd. (NCHL) — bank-consortium owned |
| What it is | Digital wallet + payment gateway, the longest-established consumer wallet in Nepal | Digital wallet + payment gateway, strong in e-commerce and OTT checkout flows | Bank-account-linked interbank payment gateway; not a wallet — it debits the payer's own bank account directly |
| Integration shape | REST API + hosted checkout redirect; merchant server verifies a transaction signature after redirect | REST API (e-payment) with both hosted checkout and an embeddable widget; server-side verification call after payment | Merchant registration through NCHL, integration is bank/NCHL-mediated rather than a simple public signup; connects to essentially every major Nepali bank |
| Reach | Largest installed wallet base among Nepali digital payment apps as of general public knowledge | Second-largest wallet base; younger, product-forward, common in Nepali app-based checkouts | No wallet install needed — reaches anyone with a Nepali bank account and mobile/internet banking, which is a broader base than either wallet for a health app whose users may not already carry a wallet |
| Settlement | To merchant's own eSewa merchant account, then bank withdrawal | To merchant's own Khalti merchant account, then bank withdrawal | Near-direct bank-to-bank; no intermediate wallet balance to hold or withdraw |
| Merchant onboarding | Business registration (PAN/VAT), bank account, merchant agreement with F1Soft | Business registration, bank account, merchant agreement with Sparrow Pay | Registration mediated by NCHL and the merchant's own bank; historically the heavier onboarding of the three |
| Refunds | Supported via merchant-initiated reversal through the gateway | Supported via merchant-initiated reversal through the gateway | Bank-mediated; typically slower than a wallet reversal |
| Best fit if... | The product wants the widest existing wallet coverage and the most mature Nepali integration ecosystem | The product wants a modern checkout widget and younger user base | The product prefers direct bank settlement with no wallet intermediary, or expects institutional/insurer payers who already move money by bank transfer |

Fee schedules, exact API versions, minimum settlement periods and current
KYC/merchant-onboarding paperwork all change over time and are not
reproduced here as numbers — quoting a specific percentage or rupee figure in
this file without a current rate card from the provider would be exactly the
kind of fabricated-looking statistic the standing constraints forbid. Confirm
current commercial terms directly with the chosen provider before committing.

## What the owner needs to decide, and to supply

1. **Which one** (a single primary is enough to start; nothing here blocks
   supporting more than one later — `PaymentProvider` can grow past two
   literals the same way `BillingPayerType` already has three).
2. Business registration documents for the merchant application (PAN/VAT,
   bank account) — this is the owner's legal entity, not something this
   repository can supply or fabricate.
3. API credentials once onboarded (merchant/product code, secret key or
   equivalent) — these belong in `.env.server.example` as **names only**,
   the same pattern `GEMINI_API_KEY` and `GOOGLE_CLIENT_ID` already follow:
   documented as required, never given a real or placeholder-that-looks-real
   value in the repo.
4. Sign-off from whoever owns the compliance register's "Payments/refunds"
   row — taxes, settlement and consumer-protection treatment are explicitly
   unresolved there, and that gate is independent of which vendor is picked.

## What changes in the codebase once a provider is chosen

Sequenced so a future run can pick this up without re-deriving it:

1. Widen `PaymentProvider` in `packages/shared-types` past `'MOCK'` to
   include the chosen provider's literal (e.g. `'MOCK' | 'ESEWA'`) — keep
   `'MOCK'` for tests and any environment without live credentials, the same
   way `apps/api/src/auth/sms-provider.ts` keeps a logging mock alongside a
   real provider gate.
2. A new port in `apps/api` (`payment-provider.ts`, mirroring
   `delivery-provider.ts`'s and `record-extraction.service.ts`'s
   `setup-required` / `unavailable` / `complete` contract) so a missing API
   key degrades to a clear state rather than a crash, and the real
   implementation never runs in tests.
3. `BillingService.recordPayment` calls the port instead of writing a
   `'MOCK'` record directly, with the existing `DRAFT -> ISSUED -> PAID`
   state machine and `InvoicePaidCannotBeVoidedError` untouched.
4. A fault-isolation test forcing the provider DOWN, per this round's
   standing rule — billing must degrade to "payment could not be confirmed,
   try again" rather than losing the invoice or crash-looping the API.
5. No card, wallet or bank credential of the *payer's* is ever stored by
   Mero Health — only the provider's transaction/reference id, matching how
   every OAuth/OTP flow in this repo already treats third-party secrets as
   opaque tokens rather than something to persist.

None of the above is built by this document. It stops here, as the task
required.
