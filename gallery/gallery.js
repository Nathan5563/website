const body = document.querySelector("body");
const toggleButton = document.querySelector("#toggle-theme");
const themeIcon = document.querySelector("#theme-icon");

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

function updateTheme(theme) {
  if (theme === "latex-light-auto") {
    if (themeIcon) {
      themeIcon.src = "../icons/moon.png";
      themeIcon.alt = "Dark mode";
    }
  } else {
    if (themeIcon) {
      themeIcon.src = "../icons/sun.png";
      themeIcon.alt = "Light mode";
    }
  }
}

const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  body.className = savedTheme;
} else {
  body.className = prefersDark ? "latex-dark-auto" : "latex-light-auto";
}

const savedBtnTheme = localStorage.getItem("btn-theme");
if (savedBtnTheme) {
  if (toggleButton) {
    toggleButton.className = savedBtnTheme;
  }
} else {
  if (toggleButton) {
    toggleButton.className = prefersDark ? "btn btn-dark" : "btn btn-light";
  }
}

updateTheme(body.className);

if (toggleButton) {
  toggleButton.addEventListener("click", () => {
    const currentTheme = body.classList.contains("latex-light-auto")
      ? "latex-dark-auto"
      : "latex-light-auto";
    body.className = currentTheme;
    localStorage.setItem("theme", currentTheme);

    updateTheme(currentTheme);

    const buttonTheme = toggleButton.classList.contains("btn-light")
      ? "btn btn-dark"
      : "btn btn-light";
    toggleButton.className = buttonTheme;
    localStorage.setItem("btn-theme", buttonTheme);
  });
}

// Gallery lightbox functionality
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose = document.querySelector(".lightbox-close");

// Add click event to all photo items
document.querySelectorAll(".photo-item").forEach(item => {
  item.addEventListener("click", () => {
    const img = item.querySelector("img");
    const location = item.querySelector(".location-tag")?.textContent || "";
    
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = location ? `${img.alt} - ${location}` : img.alt || "";
    lightbox.style.display = "block";
    
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";
  });
});

// Close lightbox when clicking the close button
lightboxClose.addEventListener("click", closeLightbox);

// Close lightbox when clicking outside the image
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

// Close lightbox with escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lightbox.style.display === "block") {
    closeLightbox();
  }
});

function closeLightbox() {
  lightbox.style.display = "none";
  document.body.style.overflow = "auto";
}
