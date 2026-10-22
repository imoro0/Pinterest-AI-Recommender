const API_BASE_URL = "http://127.0.0.1:8000";

const FEED_LIMIT = 90;
const RECOMMENDATION_LIMIT = 12;

// DOM ELEMENTS
const imageGrid = document.querySelector("#imageGrid");
const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const categoryList = document.querySelector("#categoryList");

const feedTitle = document.querySelector("#feedTitle");
const feedSubtitle = document.querySelector("#feedSubtitle");
const resultCount = document.querySelector("#resultCount");
const emptyState = document.querySelector("#emptyState");

const homeBtn = document.querySelector("#homeBtn");
const exploreBtn = document.querySelector("#exploreBtn");
const historyBtn = document.querySelector("#historyBtn");
const resetBtn = document.querySelector("#resetBtn");

const imageDialog = document.querySelector("#imageDialog");
const dialogImage = document.querySelector("#dialogImage");
const dialogCategory = document.querySelector("#dialogCategory");
const dialogTitle = document.querySelector("#dialogTitle");
const dialogDescription = document.querySelector("#dialogDescription");
const closeDialog = document.querySelector("#closeDialog");

// APPLICATION STATE
let allImages = [];
let searchResults = null;

let selectedCategory = "All";
let currentQuery = "";
let showingHistory = false;

let recommendationRequestId = 0;

// VISITOR ID
function getOrCreateVisitorId() {
    let visitorId = localStorage.getItem("pinspire_visitor_id");

    if (!visitorId) {
        visitorId =
            "visitor_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substring(2, 10);

        localStorage.setItem("pinspire_visitor_id", visitorId);
    }

    return visitorId;
}

const visitorId = getOrCreateVisitorId();

// HISTORY
function getHistory() {
    try {
        const history = JSON.parse(
            localStorage.getItem("pinspire_history") || "[]"
        );

        return Array.isArray(history) ? history : [];
    } catch (error) {
        console.error("History loading error:", error);
        return [];
    }
}

function saveToHistory(image) {
    if (!image || !image.image_id) {
        return;
    }

    const history = getHistory();

    const updatedHistory = history.filter(
        item => String(item.image_id) !== String(image.image_id)
    );

    updatedHistory.unshift({
        ...image,
        viewed_at: new Date().toISOString()
    });

    localStorage.setItem(
        "pinspire_history",
        JSON.stringify(updatedHistory.slice(0, 100))
    );
}

// IMAGE URL
function getImageUrl(image) {
    if (!image || !image.image_url) {
        return "";
    }

    const imageUrl = image.image_url;

    if (
        imageUrl.startsWith("http://") ||
        imageUrl.startsWith("https://")
    ) {
        return imageUrl;
    }

    return `${API_BASE_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

// TRACK IMAGE CLICK
async function trackImageClick(image) {
    if (!image || !image.image_id) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/click`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                visitor_id: visitorId,
                image_id: image.image_id
            })
        });

        if (!response.ok) {
            console.error("Click tracking failed:", response.status);
        }
    } catch (error) {
        console.error("Click tracking error:", error);
    }
}

// LOADING AND HEADING
function setLoading(message = "Loading images...") {
    if (feedSubtitle) {
        feedSubtitle.textContent = message;
    }

    if (resultCount) {
        resultCount.textContent = "Loading...";
    }
}

function updateHeading() {
    if (!feedTitle || !feedSubtitle) {
        return;
    }

    if (showingHistory) {
        feedTitle.textContent = "Recently Viewed";
        feedSubtitle.textContent =
            "Images you have opened recently.";
        return;
    }

    if (currentQuery.trim()) {
        feedTitle.textContent = `Search results for "${currentQuery}"`;

        feedSubtitle.textContent =
            selectedCategory === "All"
                ? "Images matching your search."
                : `Images matching your search in ${selectedCategory}.`;

        return;
    }

    if (selectedCategory !== "All") {
        feedTitle.textContent = selectedCategory;
        feedSubtitle.textContent =
            `Explore images in the ${selectedCategory} category.`;
        return;
    }

    feedTitle.textContent = "Your Personalized Feed";
    feedSubtitle.textContent =
        "Discover images selected for your interests.";
}

// CREATE IMAGE CARD
function createImageCard(image, recommendation = false) {
    const card = document.createElement("article");

    card.className = recommendation
        ? "image-card recommendation-card"
        : "image-card";

    const imageContainer = document.createElement("div");
    imageContainer.className = "image-card-image";

    const img = document.createElement("img");

    img.src = getImageUrl(image);
    img.alt = image.label || image.filename || "Pinspire image";

    // Performance optimizations
    img.loading = "lazy";
    img.decoding = "async";

    // Prevent broken images from repeatedly causing visual issues
    img.addEventListener("error", () => {
        card.classList.add("image-load-error");
        imageContainer.classList.add("image-load-error");
    }, { once: true });

    imageContainer.appendChild(img);

    const info = document.createElement("div");
    info.className = "image-card-info";

    const title = document.createElement("h3");

    title.textContent =
        image.label ||
        (image.filename
            ? image.filename
                .replace(/\.[^/.]+$/, "")
                .replace(/[_-]/g, " ")
            : "Untitled image");

    const category = document.createElement("p");
    category.className = "image-card-category";
    category.textContent = image.category || "Uncategorized";

    info.append(title, category);
    card.append(imageContainer, info);

    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${title.textContent}`);

    function openCard() {
        openImageDetails(image);
    }

    card.addEventListener("click", openCard);

    card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCard();
        }
    });

    return card;
}
// RENDER IMAGES
function renderImages(images) {
    if (!imageGrid) {
        return;
    }

    imageGrid.replaceChildren();

    const validImages = Array.isArray(images) ? images : [];

    validImages.forEach(image => {
        imageGrid.appendChild(createImageCard(image));
    });

    if (resultCount) {
        resultCount.textContent =
            `${validImages.length} image${validImages.length === 1 ? "" : "s"}`;
    }

    if (emptyState) {
        emptyState.hidden = validImages.length > 0;
    }

    imageGrid.hidden = validImages.length === 0;
}

// RENDER CATEGORIES
function renderCategories() {
    if (!categoryList) {
        return;
    }

    categoryList.replaceChildren();

    const categories = [
        ...new Set(
            allImages
                .map(image => image.category)
                .filter(Boolean)
                .filter(category => category !== "All")
        )
    ].sort((a, b) => a.localeCompare(b));

    const allCategories = ["All", ...categories];

    allCategories.forEach(category => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "category-chip";
        button.dataset.category = category;
        button.textContent = category;

        const isActive = category === selectedCategory;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));

        categoryList.appendChild(button);
    });
}

// UPDATE ACTIVE CATEGORY
function updateActiveCategory() {
    if (!categoryList) {
        return;
    }

    categoryList.querySelectorAll(".category-chip").forEach(button => {
        const isActive =
            button.dataset.category === selectedCategory;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

// FILTER IMAGES
function filterImages() {
    const sourceImages = searchResults ?? allImages;
    const query = currentQuery.trim().toLowerCase();

    const filteredImages = sourceImages.filter(image => {
        const matchesCategory =
            selectedCategory === "All" ||
            image.category === selectedCategory;

        const searchableText = [
            image.filename,
            image.label,
            image.category
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchesQuery =
            !query || searchableText.includes(query);

        return matchesCategory && matchesQuery;
    });

    updateHeading();
    renderImages(filteredImages);
}

// SEARCH IMAGES
async function searchImages() {
    currentQuery = searchInput
        ? searchInput.value.trim()
        : currentQuery;

    showingHistory = false;

    if (!currentQuery && selectedCategory === "All") {
        searchResults = null;
        filterImages();
        return;
    }

    setLoading("Searching images...");

    const params = new URLSearchParams({
        q: currentQuery,
        category: selectedCategory || "All",
        limit: String(FEED_LIMIT)
    });

    try {
        const response = await fetch(
            `${API_BASE_URL}/search?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();

        searchResults = Array.isArray(data.images)
            ? data.images
            : [];

        updateHeading();
        renderImages(searchResults);

        console.log("Search results:", data.total_returned);
    } catch (error) {
        console.error("Search error:", error);

        searchResults = [];

        updateHeading();
        renderImages([]);

        if (feedSubtitle) {
            feedSubtitle.textContent =
                "Search failed. Please check that the backend is running.";
        }
    }
}

// SELECT CATEGORY
function selectCategory(category) {
    selectedCategory = category;
    showingHistory = false;

    updateActiveCategory();

    if (searchInput) {
        searchInput.value = currentQuery;
    }

    if (currentQuery.trim() || selectedCategory !== "All") {
        searchImages();
    } else {
        searchResults = null;
        filterImages();
    }
}

// CREATE SIMILAR IMAGES SECTION
function getOrCreateRecommendationsSection() {
    let section = document.getElementById("similarImagesSection");

    if (section) {
        return section;
    }

    section = document.createElement("section");
    section.id = "similarImagesSection";
    section.className = "similar-images-section";

    const heading = document.createElement("h2");
    heading.textContent = "Similar Images";

    const description = document.createElement("p");
    description.className = "similar-images-description";
    description.textContent = "More images you might like.";

    const grid = document.createElement("div");
    grid.id = "similarImagesGrid";
    grid.className = "similar-images-grid";

    section.append(heading, description, grid);

    // FIXED: dialogInfo is now declared correctly.
    const dialogInfo = dialogDescription
        ? dialogDescription.closest(".dialog-info")
        : null;

    if (dialogInfo) {
        dialogInfo.insertAdjacentElement("afterend", section);
    } else if (imageDialog) {
        imageDialog.appendChild(section);
    }

    return section;
}

// LOAD SIMILAR IMAGE RECOMMENDATIONS
async function loadRecommendations(image) {
    if (!image || !image.image_id) {
        return;
    }

    const requestId = ++recommendationRequestId;

    const section = getOrCreateRecommendationsSection();
    const grid = section.querySelector("#similarImagesGrid");

    if (!grid) {
        return;
    }

    grid.replaceChildren();

    const loadingMessage = document.createElement("p");
    loadingMessage.textContent = "Finding similar images...";
    grid.appendChild(loadingMessage);

    try {
        const response = await fetch(
            `${API_BASE_URL}/recommend/${encodeURIComponent(image.image_id)}?limit=${RECOMMENDATION_LIMIT}`
        );

        if (!response.ok) {
            throw new Error(
                `Recommendation request failed: ${response.status}`
            );
        }

        const data = await response.json();

        if (requestId !== recommendationRequestId) {
            return;
        }

        const recommendations = Array.isArray(data.images)
            ? data.images
            : [];

        grid.replaceChildren();

        if (recommendations.length === 0) {
            const message = document.createElement("p");
            message.textContent = "No similar images found yet.";
            grid.appendChild(message);
            return;
        }

        recommendations.forEach(recommendedImage => {
            grid.appendChild(
                createImageCard(recommendedImage, true)
            );
        });

        console.log("Similar images loaded:", recommendations.length);
    } catch (error) {
        if (requestId !== recommendationRequestId) {
            return;
        }

        console.error("Recommendation error:", error);

        grid.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            "Could not load similar images. Please try again.";

        grid.appendChild(message);
    }
}

// OPEN IMAGE DETAILS
function openImageDetails(image) {
    if (!image || !imageDialog) {
        return;
    }

    if (dialogImage) {
        dialogImage.src = getImageUrl(image);
        dialogImage.alt =
            image.label || image.filename || "Selected image";
    }

    if (dialogCategory) {
        dialogCategory.textContent =
            image.category || "Uncategorized";
    }

    if (dialogTitle) {
        dialogTitle.textContent =
            image.label ||
            (image.filename
                ? image.filename
                    .replace(/\.[^/.]+$/, "")
                    .replace(/[_-]/g, " ")
                : "Image details");
    }

    if (dialogDescription) {
        dialogDescription.textContent =
            image.filename || "Explore similar images below.";
    }

    const section = getOrCreateRecommendationsSection();
    const recommendationGrid =
        section.querySelector("#similarImagesGrid");

    if (recommendationGrid) {
        recommendationGrid.replaceChildren();
    }

    if (typeof imageDialog.showModal === "function") {
        if (!imageDialog.open) {
            imageDialog.showModal();
        }
    } else {
        imageDialog.setAttribute("open", "");
    }

    saveToHistory(image);
    trackImageClick(image);
    loadRecommendations(image);
}

// CLOSE IMAGE DETAILS
if (closeDialog && imageDialog) {
    closeDialog.addEventListener("click", () => {
        imageDialog.close();
    });
}

if (imageDialog) {
    imageDialog.addEventListener("click", event => {
        if (event.target === imageDialog) {
            imageDialog.close();
        }
    });
}

// SHOW RECENTLY VIEWED IMAGES
function showHistory() {
    showingHistory = true;

    currentQuery = "";
    searchResults = null;
    selectedCategory = "All";

    if (searchInput) {
        searchInput.value = "";
    }

    updateActiveCategory();

    const history = getHistory();

    updateHeading();
    renderImages(history);

    if (feedSubtitle) {
        feedSubtitle.textContent = history.length
            ? "Your recently opened images are shown here."
            : "You have not opened any images yet.";
    }

    if (resultCount) {
        resultCount.textContent =
            `${history.length} recently viewed`;
    }

    homeBtn?.classList.remove("active");
    exploreBtn?.classList.remove("active");
    historyBtn?.classList.add("active");
}

// LOAD PERSONALIZED FEED
async function loadImages() {
    setLoading("Loading your personalized feed...");

    try {
        let response = await fetch(
            `${API_BASE_URL}/feed/${encodeURIComponent(visitorId)}?limit=${FEED_LIMIT}`
        );

        if (!response.ok) {
            console.warn(
                "Personalized feed failed; trying general images."
            );

            response = await fetch(
                `${API_BASE_URL}/images?limit=${FEED_LIMIT}`
            );
        }

        if (!response.ok) {
            throw new Error(`Image loading failed: ${response.status}`);
        }

        const data = await response.json();

        allImages = Array.isArray(data.images)
            ? data.images
            : [];

        searchResults = null;
        currentQuery = "";
        selectedCategory = "All";
        showingHistory = false;

        if (searchInput) {
            searchInput.value = "";
        }

        renderCategories();
        updateActiveCategory();
        updateHeading();
        filterImages();

        console.log("Feed images loaded:", allImages.length);
    } catch (error) {
        console.error("Feed loading error:", error);

        allImages = [];
        searchResults = [];

        renderImages([]);

        if (feedSubtitle) {
            feedSubtitle.textContent =
                "Could not load images. Make sure the backend is running.";
        }
    }
}

// SEARCH FORM EVENT
if (searchForm) {
    searchForm.addEventListener("submit", event => {
        event.preventDefault();

        currentQuery = searchInput
            ? searchInput.value.trim()
            : "";

        searchImages();
    });
}

// CATEGORY CLICK EVENT
if (categoryList) {
    categoryList.addEventListener("click", event => {
        const button = event.target.closest(".category-chip");

        if (!button) {
            return;
        }

        selectCategory(button.dataset.category || "All");
    });
}

// HOME BUTTON
if (homeBtn) {
    homeBtn.addEventListener("click", () => {
        currentQuery = "";
        searchResults = null;
        showingHistory = false;
        selectedCategory = "All";

        if (searchInput) {
            searchInput.value = "";
        }

        homeBtn.classList.add("active");
        exploreBtn?.classList.remove("active");
        historyBtn?.classList.remove("active");

        renderCategories();
        updateActiveCategory();

        loadImages();
    });
}

// EXPLORE BUTTON
if (exploreBtn) {
    exploreBtn.addEventListener("click", async () => {
        currentQuery = "";
        searchResults = null;
        showingHistory = false;
        selectedCategory = "All";

        if (searchInput) {
            searchInput.value = "";
        }

        homeBtn?.classList.remove("active");
        exploreBtn.classList.add("active");
        historyBtn?.classList.remove("active");

        try {
            setLoading("Exploring images...");

            const response = await fetch(
                `${API_BASE_URL}/images?limit=${FEED_LIMIT}`
            );

            if (!response.ok) {
                throw new Error(
                    `Explore request failed: ${response.status}`
                );
            }

            const data = await response.json();

            allImages = Array.isArray(data.images)
                ? data.images
                : [];

            renderCategories();
            updateActiveCategory();
            updateHeading();
            filterImages();
        } catch (error) {
            console.error("Explore loading error:", error);

            if (feedSubtitle) {
                feedSubtitle.textContent =
                    "Could not load Explore images. Check the backend.";
            }
        }
    });
}

// HISTORY BUTTON
if (historyBtn) {
    historyBtn.addEventListener("click", () => {
        homeBtn?.classList.remove("active");
        exploreBtn?.classList.remove("active");
        historyBtn.classList.add("active");

        showHistory();
    });
}

// RESET BUTTON
if (resetBtn) {
    resetBtn.addEventListener("click", () => {
        currentQuery = "";
        searchResults = null;
        showingHistory = false;
        selectedCategory = "All";

        if (searchInput) {
            searchInput.value = "";
        }

        homeBtn?.classList.add("active");
        exploreBtn?.classList.remove("active");
        historyBtn?.classList.remove("active");

        renderCategories();
        updateActiveCategory();

        loadImages();
    });
}

// START PINSP​​IRE
loadImages();