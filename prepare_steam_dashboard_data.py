import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(r"C:\Users\Karlo\Desktop\Vizualizacija projekt")
CSV_ROOT = ROOT / "steam_dataset_2025_csv_package_v1" / "steam_dataset_2025_csv"
OUTPUT_PATH = ROOT / "steam_dashboard_data.json"

VALID_YEAR_MIN = 1997
VALID_YEAR_MAX = 2025
TOP_GENRES = [
    "Action",
    "Adventure",
    "RPG",
    "Strategy",
    "Simulation",
    "Casual",
    "Indie",
    "Sports",
    "Racing",
    "Massively Multiplayer",
]
MODEL_KEYS = ("all", "free", "paid")
METRIC_KEYS = (
    "count",
    "priceSum",
    "priceN",
    "recommendationsSum",
    "recommendationsN",
    "metacriticSum",
    "metacriticN",
    "achievementsSum",
    "achievementsN",
    "discountSum",
    "discountN",
)


def empty_stats():
    return {key: 0 for key in METRIC_KEYS}


def add_to_stats(stats, record):
    stats["count"] += 1
    if record["price"] is not None:
      stats["priceSum"] += record["price"]
      stats["priceN"] += 1
    if record["recommendations"] is not None:
      stats["recommendationsSum"] += record["recommendations"]
      stats["recommendationsN"] += 1
    if record["metacritic"] is not None:
      stats["metacriticSum"] += record["metacritic"]
      stats["metacriticN"] += 1
    if record["achievements"] is not None:
      stats["achievementsSum"] += record["achievements"]
      stats["achievementsN"] += 1
    if record["discount"] is not None:
      stats["discountSum"] += record["discount"]
      stats["discountN"] += 1


def make_bucket():
    return {model: empty_stats() for model in MODEL_KEYS}


def serialise_models(bucket):
    return {
        model: {
            key: round(value, 4) if isinstance(value, float) else value
            for key, value in stats.items()
        }
        for model, stats in bucket.items()
    }


def parse_year(date_value):
    if not date_value:
        return None
    year_text = date_value[:4]
    if not year_text.isdigit():
        return None
    year = int(year_text)
    if VALID_YEAR_MIN <= year <= VALID_YEAR_MAX:
        return year
    return None


def parse_number(value, divide_by_100=False):
    if value in ("", None):
        return None
    number = float(value)
    if divide_by_100:
        number /= 100.0
    return number


def choose_primary_genre(names):
    if not names:
        return "Other"
    for genre in TOP_GENRES:
        if genre in names:
            return genre
    return "Other"


def main():
    genre_names = {}
    with (CSV_ROOT / "genres.csv").open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            genre_names[row["id"]] = row["name"]

    app_genres = defaultdict(list)
    with (CSV_ROOT / "application_genres.csv").open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            name = genre_names.get(row["genre_id"])
            if name:
                app_genres[row["appid"]].append(name)

    aggregates = {
        "type": {
            "categories": set(),
            "totals": defaultdict(make_bucket),
            "yearly": defaultdict(lambda: defaultdict(make_bucket)),
        },
        "primaryGenre": {
            "categories": set(TOP_GENRES + ["Other"]),
            "totals": defaultdict(make_bucket),
            "yearly": defaultdict(lambda: defaultdict(make_bucket)),
        },
    }

    sample_apps = []
    sample_by_year = defaultdict(int)
    sample_per_year_limit = 260
    years_present = set()
    valid_apps = 0

    with (CSV_ROOT / "applications.csv").open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            year = parse_year(row["release_date"])
            if year is None:
                continue

            valid_apps += 1
            years_present.add(year)

            appid = row["appid"]
            app_type = row["type"] or "unknown"
            is_free = row["is_free"] == "True"
            model_key = "free" if is_free else "paid"
            currency = row["mat_currency"] or None
            raw_price = parse_number(row["mat_final_price"], divide_by_100=True)
            price = raw_price if currency == "USD" else None
            discount = parse_number(row["mat_discount_percent"])
            recommendations = parse_number(row["recommendations_total"])
            metacritic = parse_number(row["metacritic_score"])
            achievements = parse_number(row["mat_achievement_count"])
            platform_count = sum(
                row[column] == "True"
                for column in ("mat_supports_windows", "mat_supports_mac", "mat_supports_linux")
            )
            primary_genre = choose_primary_genre(app_genres.get(appid, []))

            record = {
                "price": price,
                "discount": discount,
                "recommendations": recommendations,
                "metacritic": metacritic,
                "achievements": achievements,
            }

            for dimension, category in (("type", app_type), ("primaryGenre", primary_genre)):
                aggregates[dimension]["categories"].add(category)

                totals_bucket = aggregates[dimension]["totals"][category]
                yearly_bucket = aggregates[dimension]["yearly"][year][category]

                add_to_stats(totals_bucket["all"], record)
                add_to_stats(totals_bucket[model_key], record)
                add_to_stats(yearly_bucket["all"], record)
                add_to_stats(yearly_bucket[model_key], record)

            if sample_by_year[year] < sample_per_year_limit and (int(appid) % 3 == 0):
                sample_by_year[year] += 1
                sample_apps.append(
                    {
                        "appid": int(appid),
                        "name": row["name"] or row["appid"],
                        "year": year,
                        "type": app_type,
                        "primaryGenre": primary_genre,
                        "isFree": is_free,
                        "price": round(price, 2) if price is not None else None,
                        "currency": currency,
                        "discount": round(discount, 2) if discount is not None else None,
                        "recommendations": int(recommendations) if recommendations is not None else None,
                        "metacritic": round(metacritic, 2) if metacritic is not None else None,
                        "achievements": int(achievements) if achievements is not None else None,
                        "platformCount": platform_count,
                    }
                )

    payload = {
        "generatedFrom": "Steam Dataset 2025",
        "validYearRange": [VALID_YEAR_MIN, VALID_YEAR_MAX],
        "validApps": valid_apps,
        "years": sorted(years_present),
        "dimensions": {},
        "sampleApps": sample_apps,
    }

    for dimension, bundle in aggregates.items():
        payload["dimensions"][dimension] = {
            "categories": sorted(
                bundle["categories"],
                key=lambda value: (
                    value == "Other",
                    TOP_GENRES.index(value) if value in TOP_GENRES else value,
                ),
            ) if dimension == "primaryGenre" else sorted(bundle["categories"]),
            "totals": [
                {"category": category, "models": serialise_models(models)}
                for category, models in bundle["totals"].items()
            ],
            "yearly": [
                {
                    "year": year,
                    "category": category,
                    "models": serialise_models(models),
                }
                for year, category_map in sorted(bundle["yearly"].items())
                for category, models in category_map.items()
            ],
        }

    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Wrote {OUTPUT_PATH.name}")
    print(f"Valid apps: {valid_apps}")
    print(f"Sample apps: {len(sample_apps)}")


if __name__ == "__main__":
    main()
