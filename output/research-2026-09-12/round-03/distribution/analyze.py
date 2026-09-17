"""Read-only analysis of preserved ALL public data. No network or wallet access."""
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def dump(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def median(values):
    values = [x for x in values if x is not None]
    return statistics.median(values) if values else None


def summary(rows):
    return {
        "n": len(rows),
        "priced": sum(r["marketCapUsd"] is not None for r in rows),
        "unpriced": sum(r["marketCapUsd"] is None for r in rows),
        "median_mc_usd_priced": median([r["marketCapUsd"] for r in rows]),
        "payout_positive": sum(r.get("payouts") is not None and r["payouts"] > 0 for r in rows),
        "payout_zero": sum(r.get("payouts") == 0 for r in rows),
        "payout_null": sum(r.get("payouts") is None for r in rows),
        "median_payouts": median([r.get("payouts") for r in rows]),
        "mc_lte_10000": sum(r["marketCapUsd"] is not None and r["marketCapUsd"] <= 10000 for r in rows),
        "mc_gt_10000": sum(r["marketCapUsd"] is not None and r["marketCapUsd"] > 10000 for r in rows),
        "paid_usd_null": sum(r.get("paidUsd") is None for r in rows),
    }


initial = json.loads((ROOT / "discover-initial.json").read_text(encoding="utf-8-sig"))
rows = initial["coins"]
cutoff = initial["at"]
for row in rows:
    created = row.get("createdAt")
    age = (cutoff - created) / 3600000 if created is not None else None
    row["createdUtc"] = datetime.fromtimestamp(created / 1000, timezone.utc).isoformat() if created else None
    row["ageHours"] = age
    row["ageBand"] = "unknown" if age is None else "0-3h" if age < 3 else "3-6h" if age < 6 else "6h+"
    row["rewardLabels"] = row.get("stocks") or ["ALL (default)"]
dump("cohort.json", {"source": "https://www.allonsol.fun/discover", "at": cutoff, "coins": rows})
groups = {}
for band in ["0-3h", "3-6h", "6h+", "unknown"]:
    group = [r for r in rows if r["ageBand"] == band]
    groups[band] = summary(group)
    groups[band]["with_payout"] = summary([r for r in group if (r.get("payouts") or 0) > 0])
    groups[band]["zero_payout"] = summary([r for r in group if r.get("payouts") == 0])
rewards = {}
for label in sorted({str(r["rewardLabels"]) for r in rows}):
    group = [r for r in rows if str(r["rewardLabels"]) == label]
    rewards[label] = summary(group)
dump("cohort-summary.json", {"at": cutoff, "overall": summary(rows), "age": groups, "rewards": rewards})

top = sorted([r for r in rows if r["marketCapUsd"] is not None], key=lambda r: (-r["marketCapUsd"], r["mint"]))[:4]
sample = [{**r, "sampleReason": "top four by exact listed market cap"} for r in top]
for band in ["0-3h", "3-6h", "6h+"]:
    for paid in [True, False]:
        candidates = sorted([
            r for r in rows if r["ageBand"] == band and r["marketCapUsd"] is not None
            and r["marketCapUsd"] <= 10000 and (r["payouts"] > 0) == paid
        ], key=lambda r: (r["ageHours"], r["mint"]))
        if candidates:
            sample.append({**candidates[len(candidates) // 2], "sampleReason": f"upper median age among <=10K, {band}, payout {'positive' if paid else 'zero'}; n={len(candidates)}"})
dump("sample.json", sample)
print(json.dumps({"cutoff": datetime.fromtimestamp(cutoff / 1000, timezone.utc).isoformat(), "overall": summary(rows), "sample": [{k:r[k] for k in ["n", "symbol", "mint", "ageHours", "marketCapUsd", "payouts", "sampleReason"]} for r in sample]}, ensure_ascii=False, indent=2))
