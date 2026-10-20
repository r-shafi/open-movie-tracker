#!/usr/bin/env python3
"""
Synthetic Letterboxd Export Fixture Generator for Open Movie Tracker.
Generates small (~20 films), medium (~1,000 films), and stress (~5,000 films) exports,
including edge cases (unicode, accents, commas, quotes, newlines, duplicate titles,
films only in watched/ratings, profile.csv with private fields, CRLF, and BOM).
"""

import os
import csv
import io
import zipfile
import shutil

OUTPUT_BASE = "/home/usign/.temp/open-movie-tracker/tests/fixtures/letterboxd"

SMALL_FILMS = [
    # Normal popular titles with exact matches
    {"date": "2024-01-15", "name": "Inception", "year": "2010", "uri": "https://boxd.it/1sz2", "rating": "4.5", "rewatch": "Yes", "tags": "sci-fi, mind-bend", "watched_date": "2024-01-14", "review": "A masterpiece of structure and sound.\nStill holds up on every single viewing.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    {"date": "2024-01-20", "name": "Parasite", "year": "2019", "uri": "https://boxd.it/h4um", "rating": "5.0", "rewatch": "No", "tags": "korean, thriller, bong joon-ho", "watched_date": "2024-01-19", "review": "Unmatched tension and social commentary.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    {"date": "2024-02-01", "name": "Spirited Away", "year": "2001", "uri": "https://boxd.it/20pA", "rating": "5.0", "rewatch": "Yes", "tags": "anime, ghibli", "watched_date": "2024-01-31", "review": "Pure cinematic magic.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # Unicode and accented titles
    {"date": "2024-02-10", "name": "Amélie", "year": "2001", "uri": "https://boxd.it/2aeg", "rating": "4.0", "rewatch": "No", "tags": "french, romance", "watched_date": "2024-02-09", "review": "Whimsical, charming, and beautifully shot in Montmartre.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    {"date": "2024-02-14", "name": "Pan's Labyrinth", "year": "2006", "uri": "https://boxd.it/1W96", "rating": "4.5", "rewatch": "No", "tags": "dark fantasy, spanish", "watched_date": "2024-02-13", "review": "Brutal and poignant fairy tale for adults.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # Comma and quote handling in title & review
    {"date": "2024-03-01", "name": "Everything Everywhere All at Once", "year": "2022", "uri": "https://boxd.it/l1sU", "rating": "4.5", "rewatch": "No", "tags": "multiverse, a24", "watched_date": "2024-02-28", "review": 'He said, "In another life, I would have really liked just doing laundry and taxes with you."', "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    {"date": "2024-03-05", "name": "Oppenheimer", "year": "2023", "uri": "https://boxd.it/tzsA", "rating": "4.5", "rewatch": "No", "tags": "biopic, 70mm", "watched_date": "2024-03-04", "review": "The sound design during the Trinity test is unforgettable.", "liked": False, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # Same-film rewatch (second entry for Inception)
    {"date": "2024-04-12", "name": "Inception", "year": "2010", "uri": "https://boxd.it/1sz2", "rating": "5.0", "rewatch": "Yes", "tags": "rewatch-marathon", "watched_date": "2024-04-11", "review": "Upping to 5 stars. The rotating hallway fight scene remains iconic.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # Duplicate titles across different years
    {"date": "2024-04-20", "name": "The Thing", "year": "1982", "uri": "https://boxd.it/27bU", "rating": "5.0", "rewatch": "No", "tags": "horror, carpenter, practical-effects", "watched_date": "2024-04-19", "review": "Masterclass in paranoia.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    {"date": "2024-04-22", "name": "The Thing", "year": "2011", "uri": "https://boxd.it/Vyo", "rating": "2.5", "rewatch": "No", "tags": "prequel, cgi", "watched_date": "2024-04-21", "review": "CGI ruins what made the original so tactile.", "liked": False, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # Present ONLY in ratings.csv (no diary entry)
    {"date": "2023-11-05", "name": "Whiplash", "year": "2014", "uri": "https://boxd.it/70E6", "rating": "5.0", "rewatch": "No", "tags": "", "watched_date": "", "review": "", "liked": True, "in_diary": False, "in_ratings": True, "in_watched": True},
    {"date": "2023-10-12", "name": "The Matrix", "year": "1999", "uri": "https://boxd.it/2a1m", "rating": "4.5", "rewatch": "No", "tags": "", "watched_date": "", "review": "", "liked": True, "in_diary": False, "in_ratings": True, "in_watched": True},
    
    # Present ONLY in watched.csv (no rating, no review, date unknown)
    {"date": "2022-05-18", "name": "Casablanca", "year": "1942", "uri": "https://boxd.it/2a7y", "rating": "", "rewatch": "", "tags": "", "watched_date": "", "review": "", "liked": False, "in_diary": False, "in_ratings": False, "in_watched": True},
    {"date": "2022-06-01", "name": "Citizen Kane", "year": "1941", "uri": "https://boxd.it/29S2", "rating": "", "rewatch": "", "tags": "", "watched_date": "", "review": "", "liked": False, "in_diary": False, "in_ratings": False, "in_watched": True},
    
    # Formula injection edge case (title starts with =, @, +)
    {"date": "2024-05-01", "name": "=SUM(1,2) Movie", "year": "2020", "uri": "https://boxd.it/fake1", "rating": "3.0", "rewatch": "No", "tags": "test", "watched_date": "2024-04-30", "review": "=1+1 is two", "liked": False, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # Multi-line review with commas, quotes, and newlines
    {"date": "2024-05-15", "name": "Blade Runner 2049", "year": "2017", "uri": "https://boxd.it/6DcC", "rating": "5.0", "rewatch": "No", "tags": "cyberpunk, deakins, scifi", "watched_date": "2024-05-14", "review": "Lines like tears in rain.\n\n\"All the best memories are hers.\"\n\nA rare sequel that equals or surpasses the original.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # TMDb-unmatchable title to test ambiguity / unmatched handling
    {"date": "2024-06-01", "name": "Xyzzy Nonexistent Indie Film Unmatched", "year": "1977", "uri": "https://boxd.it/unmatched99", "rating": "3.0", "rewatch": "No", "tags": "obscure", "watched_date": "2024-05-31", "review": "Ultra rare 16mm student short.", "liked": False, "in_diary": True, "in_ratings": True, "in_watched": True},
    
    # Year tolerance (+/- 1 year difference from festival release)
    {"date": "2024-06-15", "name": "Past Lives", "year": "2023", "uri": "https://boxd.it/u9E6", "rating": "4.5", "rewatch": "No", "tags": "celine song, romance", "watched_date": "2024-06-14", "review": "In-Yun. Heartbreakingly delicate.", "liked": True, "in_diary": True, "in_ratings": True, "in_watched": True},
]

WATCHLIST_ITEMS = [
    {"date": "2024-01-01", "name": "Dune: Part Two", "year": "2024", "uri": "https://boxd.it/miHA"},
    {"date": "2024-01-02", "name": "Challengers", "year": "2024", "uri": "https://boxd.it/xq6c"},
    {"date": "2024-01-03", "name": "Furiosa: A Mad Max Saga", "year": "2024", "uri": "https://boxd.it/lz62"},
]

PROFILE_CSV_CONTENT = """Date,Username,Given Name,Family Name,Email Address,Pronoun,Location,Website,Bio,Favorite Films
2024-01-01,cinephile_dan,Dan,Miller,leaker@private-tracker.org,he/him,Montreal,https://danmiller.dev,"Film lover, physical media archivist, and 70mm enthusiast.","https://boxd.it/2a1m,https://boxd.it/20pA,https://boxd.it/1sz2,https://boxd.it/6DcC"
"""

LIST_TOP_NOIR = """Letterboxd list export v7
Date,Name,Tags,URL,Description
2024-02-01,Essential Neo-Noir,"noir, crime, thriller",https://boxd.it/list/noir,"A curated selection of defining neo-noir cinema."

Position,Name,Year,URL,Description
1,Blade Runner 2049,2017,https://boxd.it/6DcC,Visually stunning cyberpunk mystery.
2,The Thing,1982,https://boxd.it/27bU,Claustrophobic dread.
3,Inception,2010,https://boxd.it/1sz2,Heist inside a subconscious labyrinth.
"""

def generate_export_bundle(films, watchlist, target_dir, zip_path, crlf=False, bom=False):
    os.makedirs(target_dir, exist_ok=True)
    os.makedirs(os.path.join(target_dir, "likes"), exist_ok=True)
    os.makedirs(os.path.join(target_dir, "lists"), exist_ok=True)
    os.makedirs(os.path.join(target_dir, "deleted"), exist_ok=True)
    os.makedirs(os.path.join(target_dir, "orphaned"), exist_ok=True)

    newline = "\r\n" if crlf else "\n"
    encoding = "utf-8-sig" if bom else "utf-8"

    def write_csv(filepath, fieldnames, rows):
        with open(filepath, "w", newline="", encoding=encoding) as f:
            # Note: csv.writer will use the lineterminator
            writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator=newline, quoting=csv.QUOTE_MINIMAL)
            writer.writeheader()
            for r in rows:
                writer.writerow(r)

    # 1. diary.csv
    diary_rows = []
    for f in films:
        if f.get("in_diary"):
            diary_rows.append({
                "Date": f["date"],
                "Name": f["name"],
                "Year": f["year"],
                "Letterboxd URI": f["uri"],
                "Rating": f["rating"],
                "Rewatch": f["rewatch"],
                "Tags": f["tags"],
                "Watched Date": f["watched_date"],
            })
    write_csv(
        os.path.join(target_dir, "diary.csv"),
        ["Date", "Name", "Year", "Letterboxd URI", "Rating", "Rewatch", "Tags", "Watched Date"],
        diary_rows,
    )

    # 2. reviews.csv
    review_rows = []
    for f in films:
        if f.get("in_diary") and f.get("review"):
            review_rows.append({
                "Date": f["date"],
                "Name": f["name"],
                "Year": f["year"],
                "Letterboxd URI": f["uri"],
                "Rating": f["rating"],
                "Rewatch": f["rewatch"],
                "Review": f["review"],
                "Tags": f["tags"],
                "Watched Date": f["watched_date"],
            })
    write_csv(
        os.path.join(target_dir, "reviews.csv"),
        ["Date", "Name", "Year", "Letterboxd URI", "Rating", "Rewatch", "Review", "Tags", "Watched Date"],
        review_rows,
    )

    # 3. ratings.csv
    rating_rows = []
    for f in films:
        if f.get("in_ratings") and f.get("rating"):
            rating_rows.append({
                "Date": f["date"],
                "Name": f["name"],
                "Year": f["year"],
                "Letterboxd URI": f["uri"],
                "Rating": f["rating"],
            })
    write_csv(
        os.path.join(target_dir, "ratings.csv"),
        ["Date", "Name", "Year", "Letterboxd URI", "Rating"],
        rating_rows,
    )

    # 4. watched.csv
    watched_rows = []
    for f in films:
        if f.get("in_watched"):
            watched_rows.append({
                "Date": f["date"],
                "Name": f["name"],
                "Year": f["year"],
                "Letterboxd URI": f["uri"],
            })
    write_csv(
        os.path.join(target_dir, "watched.csv"),
        ["Date", "Name", "Year", "Letterboxd URI"],
        watched_rows,
    )

    # 5. watchlist.csv
    watchlist_rows = [
        {"Date": w["date"], "Name": w["name"], "Year": w["year"], "Letterboxd URI": w["uri"]}
        for w in watchlist
    ]
    write_csv(
        os.path.join(target_dir, "watchlist.csv"),
        ["Date", "Name", "Year", "Letterboxd URI"],
        watchlist_rows,
    )

    # 6. likes/films.csv
    likes_rows = []
    for f in films:
        if f.get("liked"):
            likes_rows.append({
                "Date": f["date"],
                "Name": f["name"],
                "Year": f["year"],
                "Letterboxd URI": f["uri"],
            })
    write_csv(
        os.path.join(target_dir, "likes", "films.csv"),
        ["Date", "Name", "Year", "Letterboxd URI"],
        likes_rows,
    )

    # 7. profile.csv
    with open(os.path.join(target_dir, "profile.csv"), "w", encoding=encoding, newline="") as pf:
        content = PROFILE_CSV_CONTENT.replace("\n", newline)
        pf.write(content)

    # 8. lists/top-noir.csv
    with open(os.path.join(target_dir, "lists", "top-noir.csv"), "w", encoding=encoding, newline="") as lf:
        content = LIST_TOP_NOIR.replace("\n", newline)
        lf.write(content)

    # 9. empty deleted and orphaned files
    with open(os.path.join(target_dir, "deleted", "reviews.csv"), "w", encoding=encoding, newline="") as ef:
        ef.write("Date,Name,Year,Letterboxd URI\n".replace("\n", newline))
    with open(os.path.join(target_dir, "orphaned", "diary.csv"), "w", encoding=encoding, newline="") as ef:
        ef.write("Date,Name,Year,Letterboxd URI\n".replace("\n", newline))

    # Package into ZIP archive
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(target_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, target_dir)
                zf.write(full_path, arcname=rel_path)

    print(f"Generated {target_dir} and {zip_path}")


def generate_synthetic_catalog(count):
    genres = ["Action", "Sci-Fi", "Drama", "Comedy", "Thriller", "Horror", "Documentary"]
    base_titles = [
        "Chronicle of Time", "Solaris Echo", "Midnight in Berlin", "The Glass Horizon",
        "Shadows of the Past", "Neon Dreams", "Lost Latitude", "Whispers in the Dark",
        "The Autumn Protocol", "Velocity", "Crimson Peak", "Subterranean", "A Silent Symphony",
        "Echoes of Eternity", "The Last Archivist", "Beyond the Rift", "Vortex 9", "Fragments",
        "The Cartographer", "Nightfall Over Tokyo"
    ]
    films = []
    for i in range(count):
        title = f"{base_titles[i % len(base_titles)]} Vol. {i+1}"
        year = str(1950 + (i % 75))
        rating = str(round(1.0 + ((i * 7) % 9) * 0.5, 1))
        in_diary = (i % 5 != 0) # 80% have diary entries
        in_ratings = True
        in_watched = True
        liked = (i % 4 == 0)
        review = f"Review for {title}. Quite an engaging film." if (i % 3 == 0) else ""

        log_m = (i % 12) + 1
        log_d = (i % 25) + 4
        watch_d = log_d - 2

        if in_diary:
            log_date = f"2023-{log_m:02d}-{log_d:02d}"
            if i % 10 == 1:
                # Empty Watched Date: falls back to Date marked approximate
                watched_date = ""
            else:
                # Watched Date strictly distinct from logged Date
                watched_date = f"2023-{log_m:02d}-{watch_d:02d}"
        else:
            # Watched/ratings only: Date is Letterboxd account creation date, no watched date
            log_date = "2019-12-31"
            watched_date = ""

        films.append({
            "date": log_date,
            "name": title,
            "year": year,
            "uri": f"https://boxd.it/synth{i+1}",
            "rating": rating,
            "rewatch": "Yes" if (i % 7 == 0) else "No",
            "tags": f"synth, {genres[i % len(genres)].lower()}",
            "watched_date": watched_date,
            "review": review,
            "liked": liked,
            "in_diary": in_diary,
            "in_ratings": in_ratings,
            "in_watched": in_watched,
        })
    return films

def main():
    os.makedirs(OUTPUT_BASE, exist_ok=True)
    
    # 1. Small bundle (20 films with all edge cases)
    small_dir = os.path.join(OUTPUT_BASE, "small")
    small_zip = os.path.join(OUTPUT_BASE, "small.zip")
    generate_export_bundle(SMALL_FILMS, WATCHLIST_ITEMS, small_dir, small_zip, crlf=False, bom=False)

    # 1b. Small bundle with UTF-8 BOM and CRLF
    small_bom_dir = os.path.join(OUTPUT_BASE, "small-bom-crlf")
    small_bom_zip = os.path.join(OUTPUT_BASE, "small-bom-crlf.zip")
    generate_export_bundle(SMALL_FILMS, WATCHLIST_ITEMS, small_bom_dir, small_bom_zip, crlf=True, bom=True)

    # 2. Medium bundle (~1,000 films)
    print("Generating medium bundle (~1,000 films)...")
    med_films = generate_synthetic_catalog(1000)
    med_dir = os.path.join(OUTPUT_BASE, "medium")
    med_zip = os.path.join(OUTPUT_BASE, "medium.zip")
    generate_export_bundle(med_films, WATCHLIST_ITEMS, med_dir, med_zip)

    # 3. Large bundle (~5,000 films stress test)
    print("Generating large bundle (~5,000 films stress test)...")
    large_films = generate_synthetic_catalog(5000)
    large_dir = os.path.join(OUTPUT_BASE, "large")
    large_zip = os.path.join(OUTPUT_BASE, "large.zip")
    generate_export_bundle(large_films, WATCHLIST_ITEMS, large_dir, large_zip)

    print("All Letterboxd test fixtures successfully generated.")

if __name__ == "__main__":
    main()
