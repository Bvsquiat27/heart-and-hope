# Hearth & Hope

A calm, mobile-first **Progressive Web App (PWA)** that helps new and expecting mothers find resources, local pro-life–aligned support, and draft outreach to nearby centers — with explicit consent before anything is sent.

> **Framing:** Supports life as Christ intended, with dignity for every woman. No Planned Parenthood. No abortion referrals.

## Find help anywhere

Enter **any US city, town, or ZIP**. Find help and Get Help sort by distance using ZIP centroids and center coordinates.

The directory lists **verified real** pregnancy resource centers from public **Option Line** (Heartbeat International) and **Birthright** directories (retrieved 2026-09-23), plus national helplines. More listings may be added over time. Optional **Use my location** uses browser geolocation when allowed.

## Support tools

**Postpartum Ember** (anonymous glowing dots + kind notes), contraction timer, baby tracker, and gentle reminders/sounds — under **Support** / **Postpartum**.

Crisis path, ultrasound companion, first-90-days checklist, mentor request, goods ask, family invite, work overview, hope stories (opt-in), and a simple resume + job email templates — all under **Support**. Dignity-first; no AI mentor; no fake government enrollment.

## Payday budget

Plan Wednesday paychecks on-device (`localStorage`). Mark bills paid, track leftovers, archive past weeks. No personal sample debts ship with the app.

## Coming later

Per-section voice / read-aloud controls may return later. Full-page reader is not included in this release.

## Quick start (local)

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`.

## Live

- Ember API (durable): https://hearth-ember-api.hearthandhope.workers.dev
- GitHub Pages: https://bvsquiat27.github.io/hearth-and-hope/
- Android APK: see GitHub Releases (v1.6.12+)

## License / data notes

Local center listings from public Option Line and Birthright directories (see `source` / `source_date` on each record). ZIP centroids from SimpleMaps US Zips basic data. Verify hours before referral. No Planned Parenthood or abortion providers.


## Postpartum Ember

Live glowing-ember dots on a quiet night map for moms who opt in (no whole-state fill). Public REST API in `beacon-api/`.
