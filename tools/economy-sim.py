#!/usr/bin/env python3
"""Economy-Sim v2 — session-basiert, kalibriert an echten Spielerdaten.

Kalibrierungsanker (Supabase, Season 2026-07, 31 Tage):
  AJ:        1.70e11 total_earned, 4228 Klicks, 0 Prestiges, 290 Gebäude, 12 Upgrades
  BloodiedFK: 4.1e10, 8323 Klicks, 2 Prestiges
  Kaktus:    1.2e10, 27045 Klicks, 1 Prestige

Modell: N Sessions/Tag. Zwischen Sessions Offline-Ertrag (50 %, Cap 12 h).
Während einer Session volle Produktion + Klicken. Käufe nur in Sessions,
greedy nach Amortisation. Prestige optional (Ist: aus, wie AJ; Neu: an).
"""

import math

BUILDINGS = [
    ("seedling", 15, 0.1), ("greenhouse", 100, 1), ("ranch", 1100, 8),
    ("oasis", 12000, 47), ("factory", 130000, 260), ("harvest-drone", 1.4e6, 1400),
    ("lab", 2e7, 7800), ("server-farm", 3.3e8, 44000), ("orbital-greenhouse", 5.1e9, 260000),
    ("monsoon-rig", 7.5e10, 1.6e6), ("canyon-refinery", 1e12, 1e7),
    ("plasma-irrigation", 1.4e13, 6.5e7), ("lunar-nursery", 1.7e14, 4.2e8),
    ("asteroid-hacienda", 2.1e15, 2.8e9), ("solar-silo", 2.6e16, 1.8e10),
    ("quantum-spine", 3.1e17, 1.2e11), ("nebula-pipeline", 3.7e18, 7.9e11),
    ("rift-garden", 4.4e19, 5.2e12), ("prism-foundry", 5.2e20, 3.4e13),
    ("void-terrace", 6.2e21, 2.2e14), ("starloom", 7.4e22, 1.45e15),
    ("thorn-reactor", 8.9e23, 9.6e15), ("chrono-orchard", 1.07e25, 6.3e16),
    ("singularity-nursery", 1.28e26, 4.2e17), ("galaxy-vault", 1.54e27, 2.8e18),
    ("mythic-desert", 1.85e28, 1.85e19), ("cactus-matrix", 2.22e29, 1.22e20),
    ("nopal-ark", 2.66e30, 8.1e20), ("cosmic-root", 3.19e31, 5.4e21),
    ("endless-bloom", 3.83e32, 3.6e22),
]
GROWTH = 1.15

# Neue CPS-Kurve: Amortisation = 120 * 1.4^i Sekunden statt explodierend
NEW_BUILDINGS = [(bid, cost, cost / (120 * 1.4 ** i))
                 for i, (bid, cost, _) in enumerate(BUILDINGS)]


def base_upgrades():
    ups = [("click", None, 100, 2), ("click", None, 500, 2), ("click", None, 10000, 2)]
    legacy = {0: 100, 1: 1000, 2: 11000, 3: 120000, 4: 1.3e6, 5: 1.4e7, 6: 2e8, 7: 3.3e9, 8: 5.1e10}
    for i, (bid, cost, cps) in enumerate(BUILDINGS):
        if i in legacy:
            ups.append(("building", i, legacy[i], 2))
        elif i >= 9:
            ups.append(("building", i, math.ceil(cost * (9 + ((i - 9) % 4))), 2))
    return ups


def tier_upgrades(buildings):
    """Neue gestaffelte Upgrades: bei 10/25/50/100 Besitz je x2.
    Kosten ~ 2,5x der Stückkosten an der Schwelle."""
    ups = []
    for i, (bid, cost, cps) in enumerate(buildings):
        for thr in (10, 25, 50, 100):
            ups.append(("tier", i, math.ceil(cost * GROWTH ** thr * 2.5), 2, thr))
    return ups


ACH_CLICK = [1, 100, 1000, 5000, 25000, 100000]
ACH_EARN = [100, 1000, 1e6, 1e9, 1e12, 1e18, 1e30]


def simulate(cfg, sessions_per_day, session_min, clicks_per_session,
             use_prestige, days=31, label=""):
    B = cfg["buildings"]
    UPS = cfg["upgrades"]
    click_pct = cfg.get("click_pct", 0.0)

    owned = [0] * len(B)
    bought = set()
    cactus = total_earned = clicks = 0.0
    nopal = nopal_total = prestiges = 0
    milestones = {}
    targets = [1e6, 1e9, 1e12, 1e15, 1e18, 1e21]

    def ach():
        n = sum(1 for x in ACH_CLICK if clicks >= x) + sum(1 for x in ACH_EARN if total_earned >= x)
        n += (1 if prestiges >= 1 else 0) + (1 if prestiges >= 10 else 0)
        n += (1 if nopal_total >= 10 else 0)
        n += 4  # Sonstige (Frenzies, Events, Gebäudezahl) über den Monat
        return min(n, 20)

    def mult():
        return (1 + ach() * 0.1) * cfg["prestige_mult"](nopal)

    def bmult(i):
        m = 1.0
        for u in UPS:
            if u[1] == i and u[:3] in bought and u[0] in ("building", "tier"):
                m *= u[3]
        return m

    def cmult():
        m = 1.0
        for u in UPS:
            if u[0] == "click" and u[:3] in bought:
                m *= u[3]
        return m

    def cps():
        return sum(owned[i] * B[i][2] * bmult(i) for i in range(len(B))) * mult()

    def click_yield():
        return cmult() * mult() + click_pct * cps()

    def session_buy(budget_time):
        """Greedy kaufen bis nichts Sinnvolles mehr leistbar ist."""
        nonlocal cactus
        for _ in range(400):
            g = mult()
            best, best_pay = None, float("inf")
            for i in range(len(B)):
                c = math.ceil(B[i][1] * GROWTH ** owned[i])
                if c > cactus:
                    continue
                gain = B[i][2] * bmult(i) * g
                if c / gain < best_pay:
                    best, best_pay = ("b", i, c), c / gain
            for u in UPS:
                if u[:3] in bought or u[2] > cactus:
                    continue
                if u[0] == "tier" and owned[u[1]] < u[4]:
                    continue
                if u[0] in ("building", "tier"):
                    gain = owned[u[1]] * B[u[1]][2] * bmult(u[1]) * g * (u[3] - 1)
                else:
                    gain = 0.05 * cps() + cmult() * g  # Klick-Upgrade: grober Nutzwert
                if gain > 0 and u[2] / gain < best_pay:
                    best, best_pay = u[:3], u[2] / gain
            if best is None:
                return
            cactus -= best[2]
            if best[0] == "b":
                owned[best[1]] += 1
            else:
                bought.add(best)

    def try_prestige():
        nonlocal nopal, nopal_total, prestiges, owned, bought, cactus
        if not use_prestige:
            return
        gain = cfg["prestige_gain"](total_earned) - nopal_total
        if gain <= 0:
            return
        if cfg["prestige_mult"](nopal + gain) / cfg["prestige_mult"](nopal) < 1.5:
            return
        nopal += gain; nopal_total += gain; prestiges += 1
        owned = [0] * len(B); bought = set(); cactus = 0.0

    t = 0.0
    gap = 86400 / sessions_per_day
    while t < days * 86400:
        # Session: aktiv spielen
        active = session_min * 60
        for _ in range(4):  # kaufen -> klicken -> kaufen ...
            session_buy(active)
            earn = cps() * (active / 4) + click_yield() * (clicks_per_session / 4)
            cactus += earn; total_earned += earn
            clicks += clicks_per_session / 4
        session_buy(active)
        try_prestige()
        t += active
        # Offline bis zur nächsten Session
        off = min(gap - active, 12 * 3600) * 0.5
        earn = cps() * off
        cactus += earn; total_earned += earn
        t += gap - active
        for m in targets:
            if total_earned >= m and m not in milestones:
                milestones[m] = t / 86400

    top_b = max((i + 1 for i in range(len(B)) if owned[i] > 0), default=0)
    return dict(label=label, te=total_earned, clicks=clicks, prestiges=prestiges,
                nopal=nopal, top_building=top_b, buildings=sum(owned),
                upgrades=len(bought), milestones=milestones)


def fmt(x):
    for s, v in [("Trd", 1e18), ("Brd", 1e15), ("Bio", 1e12), ("Mrd", 1e9), ("Mio", 1e6), ("Tsd", 1e3)]:
        if x >= v:
            return f"{x/v:.2f} {s}"
    return f"{x:.0f}"


def show(r):
    ms = " | ".join(f"{fmt(m):>8}: Tag {d:.1f}" for m, d in sorted(r["milestones"].items()))
    print(f"  {r['label']:<34} Monatsende: {fmt(r['te']):>12} | Klicks {r['clicks']:.0f} | "
          f"Prestiges {r['prestiges']} (Nopal {fmt(r['nopal'])}) | Top-Gebäude #{r['top_building']} | "
          f"{r['buildings']} Gebäude, {r['upgrades']} Upgrades")
    if ms:
        print(f"      {ms}")


CURRENT = dict(
    buildings=BUILDINGS, upgrades=base_upgrades(), click_pct=0.0,
    prestige_gain=lambda te: math.floor((max(0, te) / 1e5) ** 0.35),
    prestige_mult=lambda n: 1 + max(0, n) ** 0.6 * 0.15,
)

NEW = dict(
    buildings=NEW_BUILDINGS,
    upgrades=base_upgrades() + tier_upgrades(NEW_BUILDINGS) + [
        ("click", None, 1e8, 2), ("click", None, 1e12, 2),  # neue Klick-Tiers
    ],
    click_pct=0.01,
    prestige_gain=lambda te: math.floor((max(0, te) / 5e4) ** 0.4),
    prestige_mult=lambda n: 1 + max(0, n) ** 0.7 * 0.2,
)

print("=" * 110)
print("KALIBRIERUNG — Ist-Economy, Verhalten wie echte Spieler (Ziel: AJ ~1,7e11 = 169 Mrd)")
print("=" * 110)
show(simulate(CURRENT, 3, 8, 45, False, label="'AJ' (3 Sessions/Tag, kein Prestige)"))
show(simulate(CURRENT, 3, 8, 300, True, label="'Kaktus' (3 Sessions, klickt, prestiged)"))
show(simulate(CURRENT, 1.5, 5, 60, False, label="Casual (1-2 Sessions/Tag)"))

print()
print("=" * 110)
print("VORSCHLAG — gleiche Spieler, neue Economy")
print("=" * 110)
show(simulate(NEW, 3, 8, 45, True, label="'AJ' (3 Sessions/Tag, mit Prestige)"))
show(simulate(NEW, 3, 8, 300, True, label="'Kaktus' (3 Sessions, klickt viel)"))
show(simulate(NEW, 1.5, 5, 60, True, label="Casual (1-2 Sessions/Tag)"))
show(simulate(NEW, 6, 15, 400, True, label="Hardcore (6 Sessions/Tag, 15 min)"))
print()
print("Tag-1-Check (Autoban-Grenze neue Accounts):")
r = simulate(NEW, 6, 15, 400, True, days=1, label="Hardcore-Neuling nach Tag 1")
show(r)
