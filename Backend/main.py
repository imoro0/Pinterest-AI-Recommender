
from pathlib import Path

import numpy as np
import torch

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from database import initialize_database, get_connection


PROJECT_ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = PROJECT_ROOT / "Data" / "images"
EMBEDDINGS_PATH = PROJECT_ROOT / "Models" / "clip_image_embeddings.pt"

app = FastAPI(title="Pinspire AI Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/static/images",
    StaticFiles(directory=str(IMAGES_DIR)),
    name="static-images",
)

# Recommendation model data
image_embeddings = None
filename_to_index = {}


@app.on_event("startup")
def startup():
    global image_embeddings, filename_to_index

    initialize_database()

    if not EMBEDDINGS_PATH.is_file():
        raise FileNotFoundError(
            f"CLIP embeddings not found: {EMBEDDINGS_PATH}"
        )

    saved_data = torch.load(
        EMBEDDINGS_PATH,
        map_location="cpu",
        weights_only=False,
    )

    image_embeddings = saved_data["embeddings"].float().numpy()

    filenames = saved_data["filenames"]
    filename_to_index = {
        filename: index
        for index, filename in enumerate(filenames)
    }

    print("CLIP embeddings loaded:", image_embeddings.shape[0])
    print("Recommendation system ready!")


@app.get("/")
def home():
    return {
        "message": "Pinspire AI Recommendation API is running!"
    }


@app.get("/images")
def get_images(
    limit: int = Query(default=500, ge=1, le=2000),
    category: str | None = None,
):
    with get_connection() as connection:
        if category:
            rows = connection.execute(
                """
                SELECT * FROM images
                WHERE LOWER(category) = LOWER(?)
                ORDER BY RANDOM()
                LIMIT ?
                """,
                (category, limit),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT * FROM images
                ORDER BY RANDOM()
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

    results = []

    for row in rows:
        filename = row["filename"]

        if filename not in filename_to_index:
            continue

        if not (IMAGES_DIR / filename).is_file():
            continue

        results.append({
            "image_id": row["image_id"],
            "filename": filename,
            "category": row["category"],
            "label": row["label"],
            "image_url": (
                f"http://127.0.0.1:8000/static/images/{filename}"
            ),
        })

    return {
        "total_returned": len(results),
        "images": results,
    }


@app.get("/search")
def search_images(
    q: str = Query(default="", max_length=200),
    category: str = Query(default="All", max_length=100),
    limit: int = Query(default=90, ge=1, le=200)
):
    connection = get_connection()

    try:
        rows = connection.execute(
            """
            SELECT image_id, filename, category, label
            FROM images
            WHERE (
                LOWER(COALESCE(filename, '')) LIKE ?
                OR LOWER(COALESCE(label, '')) LIKE ?
                OR LOWER(COALESCE(category, '')) LIKE ?
            )
            AND (? = 'All' OR category = ?)
            ORDER BY filename
            """,
            (
                f"%{q.strip().lower()}%",
                f"%{q.strip().lower()}%",
                f"%{q.strip().lower()}%",
                category,
                category
            )
        ).fetchall()

    finally:
        connection.close()

    results = []

    for row in rows:
        filename = row["filename"]

        if filename not in filename_to_index:
            continue

        if not (IMAGES_DIR / filename).is_file():
            continue

        results.append({
            "image_id": row["image_id"],
            "filename": filename,
            "category": row["category"],
            "label": row["label"],
            "image_url": f"/static/images/{filename}"
        })

        if len(results) >= limit:
            break

    return {
        "query": q,
        "category": category,
        "total_returned": len(results),
        "images": results
    }

    
@app.get("/preferences/{visitor_id}")
def get_user_preferences(visitor_id: str):
    if not visitor_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Visitor ID is required",
        )

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                COALESCE(
                    NULLIF(TRIM(images.category), ''),
                    'Uncategorized'
                ) AS category,
                COUNT(*) AS click_count
            FROM click_history
            JOIN images
                ON click_history.image_id = images.image_id
            WHERE click_history.visitor_id = ?
            GROUP BY COALESCE(
                NULLIF(TRIM(images.category), ''),
                'Uncategorized'
            )
            ORDER BY click_count DESC
            """,
            (visitor_id,),
        ).fetchall()

    preferences = [
        {
            "category": row["category"],
            "click_count": row["click_count"],
        }
        for row in rows
    ]

    return {
        "visitor_id": visitor_id,
        "total_categories": len(preferences),
        "preferences": preferences,
    }



@app.get("/feed/{visitor_id}")
def get_personalized_feed(
    visitor_id: str,
    limit: int = Query(default=90, ge=1, le=200),
):
    if not visitor_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Visitor ID is required",
        )

    import random

    PERSONALIZED_SHARE = 0.40  # feed ka itna hissa clicked categories ko

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                images.*,
                COALESCE(preferences.click_count, 0) AS category_clicks
            FROM images
            LEFT JOIN (
                SELECT
                    images.category,
                    COUNT(*) AS click_count
                FROM click_history
                JOIN images
                    ON click_history.image_id = images.image_id
                WHERE click_history.visitor_id = ?
                GROUP BY images.category
            ) AS preferences
                ON images.category = preferences.category
            """,
            (visitor_id,),
        ).fetchall()

    # Category ke hisaab se images group karo
    categories = {}

    for row in rows:
        filename = row["filename"]

        if filename not in filename_to_index:
            continue

        if not (IMAGES_DIR / filename).is_file():
            continue

        category = (row["category"] or "Other").strip() or "Other"

        image = {
            "image_id": row["image_id"],
            "filename": filename,
            "category": row["category"],
            "label": row["label"],
            "category_clicks": row["category_clicks"],
            "image_url": (
                f"http://127.0.0.1:8000/static/images/{filename}"
            ),
        }

        if category not in categories:
            categories[category] = {
                "clicks": row["category_clicks"],
                "images": [],
            }

        categories[category]["images"].append(image)

    if not categories:
        return {
            "visitor_id": visitor_id,
            "total_returned": 0,
            "images": [],
        }

    # Har category ki images shuffle karo
    for category_data in categories.values():
        random.shuffle(category_data["images"])

    # Zyada clicks wali categories pehle
    category_order = sorted(
        categories.keys(),
        key=lambda c: categories[c]["clicks"],
        reverse=True,
    )

    quota = {c: 0 for c in category_order}

    # 1) Personalized slots: clicks ke ratio se
    total_clicks = sum(categories[c]["clicks"] for c in category_order)

    if total_clicks > 0:
        personalized_slots = int(limit * PERSONALIZED_SHARE)

        for c in category_order:
            share = categories[c]["clicks"] / total_clicks
            quota[c] += int(personalized_slots * share)

    # 2) Baqi slots: sab categories mein barabar (discovery)
    remaining = limit - sum(quota.values())

    for i in range(remaining):
        quota[category_order[i % len(category_order)]] += 1

    # 3) Quota ke mutabiq images uthao
    feed = []

    for c in category_order:
        feed.extend(categories[c]["images"][:quota[c]])

    # 4) Agar kisi category mein images kam thin to baqi pool se fill karo
    if len(feed) < limit:
        pool = [
            img
            for c in category_order
            for img in categories[c]["images"][quota[c]:]
        ]
        random.shuffle(pool)
        feed.extend(pool[:limit - len(feed)])

    # Categories mix kar do aur limit tak kaato
    random.shuffle(feed)
    feed = feed[:limit]

    return {
        "visitor_id": visitor_id,
        "total_returned": len(feed),
        "images": feed,
    }


@app.get("/recommend/{image_id}")
def recommend_images(
    image_id: str,
    limit: int = Query(default=12, ge=1, le=50),
):
    if image_embeddings is None:
        raise HTTPException(
            status_code=503,
            detail="Recommendation system is not ready",
        )

    with get_connection() as connection:
        selected_image = connection.execute(
            "SELECT * FROM images WHERE image_id = ?",
            (image_id,),
        ).fetchone()

        if selected_image is None:
            raise HTTPException(
                status_code=404,
                detail="Image not found",
            )

        selected_filename = selected_image["filename"]
        selected_index = filename_to_index.get(selected_filename)

        if selected_index is None:
            raise HTTPException(
                status_code=404,
                detail="Embedding not found for this image",
            )

        # Normalize embeddings for cosine similarity.
        norms = np.linalg.norm(
            image_embeddings,
            axis=1,
            keepdims=True,
        )

        normalized_embeddings = (
            image_embeddings / np.maximum(norms, 1e-12)
        )

        query_vector = normalized_embeddings[selected_index]
        similarities = normalized_embeddings @ query_vector
        ranked_indices = np.argsort(similarities)[::-1]

        embedding_filenames = list(filename_to_index.keys())
        recommendations = []

        for index in ranked_indices:
            candidate_filename = embedding_filenames[index]

            # Skip the selected image.
            if candidate_filename == selected_filename:
                continue

            # Skip missing image files.
            if not (IMAGES_DIR / candidate_filename).is_file():
                continue

            candidate = connection.execute(
                """
                SELECT *
                FROM images
                WHERE filename = ?
                LIMIT 1
                """,
                (candidate_filename,),
            ).fetchone()

            if candidate is None:
                continue

            recommendations.append({
                "image_id": candidate["image_id"],
                "filename": candidate_filename,
                "category": candidate["category"],
                "label": candidate["label"],
                "similarity": round(
                    float(similarities[index]), 4
                ),
                "image_url": (
                    "/static/images/" + candidate_filename
                ),
            })

            if len(recommendations) >= limit:
                break

    return {
        "query_image_id": image_id,
        "total_returned": len(recommendations),
        "images": recommendations,
        "recommendations": recommendations,
    }


# Click tracking request model
class ClickRequest(BaseModel):
    visitor_id: str
    image_id: str

    


@app.post("/click")
def track_click(request: ClickRequest):
    if not request.visitor_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Visitor ID is required",
        )

    with get_connection() as connection:
        image = connection.execute(
            "SELECT image_id FROM images WHERE image_id = ?",
            (request.image_id,),
        ).fetchone()

        if image is None:
            raise HTTPException(
                status_code=404,
                detail="Image not found",
            )

        connection.execute(
            """
            INSERT INTO click_history (visitor_id, image_id)
            VALUES (?, ?)
            """,
            (request.visitor_id, request.image_id),
        )

    return {"message": "Click saved successfully"}
