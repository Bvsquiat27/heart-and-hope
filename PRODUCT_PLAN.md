# Hearth & Hope — Product Plan

**Working title for prototype:** Hearth & Hope  
**Audience:** New and expecting mothers seeking practical resources, information, and warm, dignifying aid  
**Framing:** Explicitly pro-life / Christian-encouraging (“supports life as Christ intended”) while never treating women as bad people — brave, valued, not alone  
**Owner / stakeholder:** Angel Feliciano  

---

## 1. Name options

| Option | Feel | Notes |
|--------|------|--------|
| **Hearth & Hope** *(chosen)* | Warm home + forward-looking hope | Clear, memorable, non-clinical |
| Beacon for Moms | Guidance / light | Strong “find help” metaphor |
| GracePath | Faith + journey | Softer faith cue; good for later branding |

**Prototype uses:** Hearth & Hope.

---

## 2. Vision & positioning

Hearth & Hope is a quiet, caring companion for women who are pregnant or newly parenting. It offers:

- Trustworthy, non-medical educational resources
- A curated directory of pro-life–aligned local help (pregnancy centers, maternity homes, churches, food/housing/financial aid)
- A consent-first flow that drafts email or text to nearby centers **on her behalf**

It is **not** a clinic, a political campaign site, or a substitute for emergency or medical care.

**Tagline (prototype):** *You are valued. You are not alone. Help is near.*

**Faith line (gentle, optional):** *Supporting life as Christ intended — with dignity for every mother.*

---

## 3. Tone & content rules

### What’s in
- Affirm the woman: brave, valued, capable, not alone
- Practical next steps (who to call, what to bring, what to ask)
- Faith as encouragement: optional short prayer / verse snippets she can skip
- Clear privacy and consent language before any outreach
- Disclaimers: not medical advice; talk to your doctor; if in danger call 911
- Pro-life–aligned resource categories only

### What’s out
- **Absolutely no** Planned Parenthood, abortion clinics, abortion referrals, or abortion-adjacent links
- Shame, blame, or “you should have…” language about past choices
- Condemnation framed as faith
- Clinic-brochure or political-flyer voice
- Medical diagnoses, dosage advice, or “guaranteed outcomes”
- Collecting more personal data than needed for the referral draft

### Voice checklist (every screen)
1. Does this honor her dignity?
2. Is the next step clear and small?
3. Could faith content be skipped without losing the page’s value?
4. Would a woman in crisis feel safe here?

---

## 4. MVP features (v1 — this prototype + near-term)

| Feature | MVP scope |
|---------|-----------|
| Home | Welcoming headline, gentle faith line, CTAs: Resources / Find help nearby / I’m pregnant / New mom |
| Resources | Categorized cards + search/filter; placeholder but realistic content; “talk to your doctor” where needed |
| Directory | 8–12 fictional-but-realistic centers; ZIP/city client-side filter; phone + email + services |
| Get Help | Consent-gated form; match 1–3 centers; preview message; `mailto:` / optional `sms:`; success + copyable text |
| About / Our promise | Dignity, support for life, no abortion referrals, privacy note |
| Tech | Static SPA (hash nav), vanilla HTML/CSS/JS, **installable PWA** (manifest + service worker), no backend |

### Resource categories (MVP)
1. Pregnancy & health  
2. Parenting basics  
3. Adoption options  
4. Financial & housing aid  
5. Emotional support & faith  
6. Crisis help  

### Sample center types (directory)
- Pregnancy resource / medical pregnancy centers (ultrasound, counseling — **pro-life aligned only**)
- Maternity homes / residential support
- Church-based moms’ ministries and benevolence teams
- Food pantries & diaper banks
- Housing / rental assistance partners
- Financial aid / baby supplies programs
- Mentoring / doula / peer-support networks (non-medical)

---

## 5. Referral / email–SMS flow (privacy & consent)

### Steps
1. User enters: first name, preferred contact (email and/or phone), city or ZIP, situation (multi-select), short message, optional church preference.
2. App suggests 1–3 matching centers (city/ZIP + needs heuristics).
3. User reviews selection (can adjust if UI allows; MVP auto-selects matches).
4. **Explicit checkbox required:** *“I allow this app to contact the selected centers on my behalf.”*
5. Live preview of email subject/body (and SMS body if phone path used).
6. On submit with consent:
   - Open `mailto:` with filled subject/body to selected centers’ emails (BCC or To list as appropriate for client mail clients).
   - Optionally open `sms:` with the message body if a center phone is available and user prefers SMS.
   - Show success confirmation + copyable message for manual follow-up.
7. Without consent checkbox → block send; show clear reason.

### What gets sent (MVP draft content)
- Her first name  
- Preferred contact method(s) she provided  
- City/ZIP  
- Situation tags she selected  
- Her short message  
- Optional church preference  
- Note that she asked Hearth & Hope to reach out  

### What does **not** get sent
- Storage of her data on a server (MVP has none)
- Any medical records
- Tracking pixels or third-party advertising IDs

### Privacy note (About + form)
> We only use what you type to draft a message you approve. In this prototype, nothing is uploaded to our servers — your device opens your own email or messaging app. Always review before sending.

---

## 6. Information architecture (prototype)

```
#home          Welcome + CTAs
#resources     Cards + search/filter + detail panels
#directory     Center list + ZIP/city filter
#help          Get Help form + preview + mailto/sms
#about         Our promise, disclaimers, privacy
```

Mobile-first; soft blues / creams / greens; accessible contrast and focus states.

---

## 7. Future phases

**Ship path:** Phase 1 (this PWA) ships first. Native apps build on the same content and ethics once outreach + directory backends exist.

### Phase 1 — Installable PWA *(current)*
- Manifest + icons + standalone display
- Service worker caches shell (home / resources / directory / about / help)
- Network-first updates; offline shows cached content only (never invents medical advice)
- “Install this app” / Add to Home Screen helper (Android `beforeinstallprompt`; iOS Safari Share tip)
- Safe-area insets, bottom nav, theme-color status bar feel

### Phase 2 — Real outreach
- Verified SMS gateway (e.g. Twilio) with double opt-in
- Server-side email (SendGrid / SES) with audit log of consent timestamp
- User account optional; encrypted storage of drafts she chooses to save

### Phase 3 — Verified directory
- Partner API / CMS for pregnancy centers, maternity homes, churches
- Verification badges, hours, languages spoken, wheelchair access
- Geo-radius search (not just ZIP string match)
- Exclude list enforced at data ingest (no abortion providers)

### Phase: Native apps (Expo / React Native)

**Goal:** True App Store / Play Store presence with the same dignity-first, pro-life framing — sharing content and policies with the PWA rather than forking ethics or copy.

#### Why Expo / React Native
- One TypeScript codebase for iOS + Android
- OTA updates (Expo) for copy/resources without full store resubmits where policy allows
- Access to push notifications, secure storage, and native share sheet for consent-gated outreach
- Can wrap or deep-link the existing PWA early, then replace screens progressively

#### Shared content strategy (from PWA)
| Layer | Approach |
|-------|----------|
| Voice & rules | Single source of truth: PRODUCT_PLAN tone checklist; no abortion referrals encoded in content schema |
| Resources | JSON/MD packs versioned in repo; PWA and native both fetch the same CDN/CMS endpoint |
| Directory | Same partner API as Phase 3; client filters + geo; shared exclude-list tests |
| Get Help | Same consent fields + message templates; native opens `mailto:` / `sms:` or calls Phase 2 backend |
| Offline | Mirror PWA: cache last-fetched resource/directory packs; never fabricate medical content |
| Branding | Shared icons, colors (cream / soft blue / sage), and “Hearth & Hope” naming |

#### Store requirements (high level)
- **Apple App Store:** Privacy Nutrition Labels; account deletion if accounts exist; medical disclaimer copy; no “diagnosis” claims; Age Rating; HTTPS APIs; Sign in with Apple if other social logins appear
- **Google Play:** Data safety form; foreground/background SMS/phone permissions justified only if used; target API level; content policy (health apps must not mislead)
- **Both:** Clear emergency disclaimer (911 / 988); consent screens before any outreach; no Planned Parenthood / abortion clinic listings in review builds or production data
- **Screenshots & copy:** Warm, woman-honoring; avoid political slogans that invite policy rejection

#### SMS / email backend needs (prerequisite or parallel)
- Server-held consent timestamp + which centers contacted (audit)
- Twilio (or similar) for SMS with STOP/HELP; SendGrid/SES for email
- Rate limits + abuse controls so centers aren’t spammed
- Secrets never shipped in the client; native apps call authenticated APIs
- Until backend exists, native can keep the PWA’s client-side `mailto:` / `sms:` draft pattern

#### Estimated native phases
| Sub-phase | Scope | Rough effort |
|-----------|--------|--------------|
| **N0 — Spike** | Expo app shell, bottom tabs matching PWA hashes, WebView or static bundle of current UI | 1–2 weeks |
| **N1 — Parity** | Native screens for Home, Resources, Directory, Get Help, About; shared JSON content | 4–6 weeks |
| **N2 — Platform** | Push opt-in reminders, secure local drafts, App Store / Play listing + disclaimers | 3–4 weeks |
| **N3 — Connected** | Wire Phase 2 SMS/email APIs + Phase 3 directory; analytics that respect privacy | 4–6 weeks |
| **N4 — Polish** | Accessibility audit, Spanish strings, offline packs, mentorship entry points (Phase 5) | ongoing |

PWA remains available on the web for women who prefer not to install from stores, and as the fastest path to share a link.

### Phase 5 — Deeper care (optional, partner-led)
- Mentorship matching with trained volunteers
- Church partner portal (still woman-centered, consent-first)
- Multilingual content (Spanish first)

---

## 8. Success metrics (post-MVP)

- Form completion with consent rate  
- Mailto/SMS open rate (client-side proxy: confirmation viewed)  
- Resource article engagement (category clicks)  
- Directory filter usage  
- Qualitative: “Did you feel respected?” pulse (1-click, optional)

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Medical advice confusion | Disclaimers on every health-adjacent card; 911 / emergency banner |
| Faith feeling pushy | Optional verse/prayer blocks; skip always available |
| Wrong center contacted | Preview + consent; small match set; later: verified directory |
| Privacy fear | Client-side prototype; plain-language privacy; minimal fields |
| Political perception | Warm product UI; dignity-first copy; no slogans or attack language |

---

## 10. MVP vs later (summary)

**MVP / Phase 1 (now):** Installable PWA — warm UI, resources, sample directory, consent-gated mailto/sms draft, About/promise, offline shell cache.  

**Later:** Real SMS/email gateway, verified partner directory API, accounts, geo search, **Expo/React Native apps** (see Phase: Native apps), multilingual, mentoring portal.
