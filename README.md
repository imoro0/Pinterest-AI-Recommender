# Pinspire — AI-Powered Visual Discovery

Pinspire is a Pinterest-inspired visual discovery platform that helps users explore images, discover visually similar content, and receive personalized recommendations based on their interests.

The project combines a web frontend, a FastAPI backend, an SQLite database, and pretrained CLIP image embeddings to create an AI-powered image discovery experience.

## Features

- **Visual Discovery Feed:** Browse a collection of images in a Pinterest-style masonry grid.
- **Category Filtering:** Explore images from categories such as Vehicles, Nature, Fashion, Food, Travel, and more.
- **Image Search:** Search available images using keywords, labels, filenames, and categories.
- **Similar Image Recommendations:** Find visually similar images using CLIP embeddings and cosine similarity.
- **Personalized Feed:** Prioritize categories based on recorded visitor interactions.
- **Click Tracking:** Store image clicks to help identify visitor interests.
- **Recently Viewed History:** Keep track of recently viewed images in the browser.
- **Image Details:** Open an image and explore related recommendations.
- **REST API:** Access image retrieval, search, preferences, click tracking, and recommendation functionality.
- **Exploratory Notebooks:** Inspect the dataset and experiment with CLIP.

## Screenshots

### Home Feed
![Home Feed](docs/Screenshot/Home.png)

### Category Filter
![Category Filter](docs/Screenshot/Category.png)

### Search
![Search](docs/Screenshot/Search.png)

### Image Details
![Image Details](docs/Screenshot/Clicked.png)

### Similar Image Recommendations
![Similar Images](docs/Screenshot/Similar.png)

### Recently Viewed
![Recently Viewed](docs/Screenshot/RecentViewed.png)

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| Database | SQLite |
| Computer Vision | Pretrained CLIP |
| Embedding Operations | NumPy, PyTorch |
| Similarity Search | Cosine Similarity |
| API Documentation | FastAPI Swagger UI |
| Development Environment | Visual Studio Code, Jupyter Notebook |

## Project Architecture

```text
User
 |
 v
Frontend (HTML, CSS, JavaScript)
 |
 | HTTP Requests
 v
FastAPI Backend
 |
 +---------------------+
 |                     |
 v                     v
SQLite Database    CLIP Embeddings
 |                     |
 |                     v
 |               Cosine Similarity
 |                     |
 +----------+----------+
            |
            v
    Image Recommendations
            |
            v
       Visual Feed
```

## How It Works

### 1. Image Dataset

Images are stored in the `Data/images/` directory. The SQLite database maintains the image information required by the application, including image IDs, filenames, categories, and labels. The `Data/` folder also holds the metadata file and the source datasets used to build the collection.

### 2. CLIP Image Embeddings

CLIP is a pretrained model that can represent images as numerical vectors called embeddings.

Pinspire uses precomputed embeddings stored in:

- `Models/clip_image_embeddings.pt` — the embedding vectors
- `Models/clip_image_filenames.json` — the image filename for each embedding, in the same order

These vectors allow the system to compare images based on their visual representations.

### 3. Visual Similarity Recommendations

When a user opens an image:

1. The backend identifies the selected image.
2. It retrieves the corresponding image embedding.
3. It calculates cosine similarity against other image embeddings.
4. Candidate images are ranked by similarity.
5. The most similar available images are returned to the frontend.

### 4. Personalized Feed

Pinspire records image clicks and uses the visitor's interaction history to estimate category preferences. The feed uses these preferences to prioritize relevant image categories.

### 5. Visitor History

The frontend uses browser local storage for the visitor identifier and recently viewed history. Click interactions are sent to the backend for recording.

## Project Structure

```text
Pinterest-AI-Recommender/
│
├── Backend/
│   ├── main.py
│   └── database.py
│
├── Frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── Models/
│   ├── clip_image_embeddings.pt
│   └── clip_image_filenames.json
│
├── Notebooks/
│   ├── load_dataset.ipynb
│   └── clip_test.ipynb
│
├── docs/
│   └── Screenshot/
│
├── Data/                  (not included in this repository, see Dataset Setup)
│   ├── images/
│   └── metadata.csv
│
├── .gitignore
└── README.md
```

### Folder Description

- `Backend/` — FastAPI application and database operations.
- `Frontend/` — Website interface, styling, and JavaScript functionality.
- `Models/` — Precomputed CLIP image embeddings and their filename order.
- `Notebooks/` — Jupyter notebooks for dataset inspection and CLIP experiments.
- `docs/Screenshot/` — Application screenshots used in this README.
- `Data/` — Image dataset and metadata. **Not uploaded to GitHub because of its size.**

## Dataset Setup

The image dataset is too large for GitHub, so it is provided separately.

1. Download the data package: **[Download Dataset](PASTE_YOUR_GOOGLE_DRIVE_LINK_HERE)**
2. Extract it so that the project looks like this:

```text
Pinterest-AI-Recommender/
└── Data/
    ├── images/
    └── metadata.csv
```

3. Make sure the SQLite database file from the download is placed where the backend expects it.

## Installation and Setup

### Prerequisites

- Python 3.9 or newer
- Visual Studio Code (or any code editor)
- The dataset from the **Dataset Setup** section above

### 1. Clone the Repository

```powershell
git clone https://github.com/YOUR_USERNAME/Pinterest-AI-Recommender.git
cd Pinterest-AI-Recommender
```

### 2. Create a Virtual Environment (recommended)

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install Python Dependencies

```powershell
python -m pip install fastapi "uvicorn[standard]" numpy torch
```

Install any additional dependencies required by the current backend implementation.

### 4. Start the Backend

Run this from the project root folder:

```powershell
python -m uvicorn main:app --app-dir Backend --reload
```

The backend will run at:

http://127.0.0.1:8000

Interactive API documentation:

http://127.0.0.1:8000/docs

### 5. Start the Frontend

Open a second terminal in the project root and run:

```powershell
python -m http.server 5500 --directory Frontend
```

Open the application in your browser:

http://localhost:5500/index.html

Keep both terminals running while using the application.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/images` | Retrieve images |
| GET | `/feed/{visitor_id}` | Retrieve the visitor's feed |
| GET | `/search` | Search images by keyword and category |
| GET | `/preferences/{visitor_id}` | Retrieve category preference counts |
| GET | `/recommend/{image_id}` | Retrieve similar images |
| POST | `/click` | Record an image click |

For available query parameters, request schemas, and response examples, visit:

http://127.0.0.1:8000/docs

## Configuration and Data Requirements

Before running the application, verify that:

- The required image files exist in `Data/images/`.
- The SQLite database contains the expected image records.
- `Models/clip_image_embeddings.pt` and `Models/clip_image_filenames.json` exist.
- The embedding vectors correspond to the correct image filenames and ordering.
- The backend dependencies are installed in the Python environment used to run Uvicorn.

## Troubleshooting

### Images Are Not Displayed

- Confirm that the backend is running.
- Verify that the `Data/images/` folder exists and contains the images.
- Check the browser developer tools for failed image requests.
- Verify that the returned image URLs are correct.

### Recommendations Are Not Working

- Verify that the CLIP embeddings file exists.
- Check the backend terminal for errors.
- Confirm that the selected image has a corresponding embedding.
- Check the API response in `/docs`.

### Frontend Cannot Connect to the Backend

- Confirm that the backend is running on port `8000`.
- Open `http://127.0.0.1:8000/docs`.
- Check the browser Console for network or CORS errors.

### Missing Python Packages

Install missing packages using the same Python environment that runs the backend.

## Current Limitations

- Personalization is based on category click counts, not on the visual content of clicked images.
- Recommendation quality has not yet been measured with formal metrics.
- The app runs locally and is not deployed.

## Future Improvements

- Build a user taste vector by averaging the CLIP embeddings of clicked images, and rank the feed by similarity to it.
- Evaluate recommendation quality using suitable metrics (for example Precision@K).
- Optimize recommendation response times and image loading with caching.
- Refine responsive layouts and visual design.
- Add a `requirements.txt` for one-command setup.
- Deploy the frontend and backend for public access.

## Learning Outcomes

This project demonstrates practical experience with:

- Integrating a frontend with a Python REST API.
- Managing application data with SQLite.
- Working with pretrained computer vision embeddings.
- Implementing cosine similarity for visual recommendations.
- Tracking user interactions and using them for personalization.
- Exploring datasets and ML concepts with Jupyter notebooks.

## Author

Built by **Musa Khan**, During his internship period at HA TECHNOLOGY(Private Limited) in Artifical Intelligence. 

---

**Pinspire — Discover more through visuals.**