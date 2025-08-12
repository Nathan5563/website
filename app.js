const body = document.querySelector("body");
const toggleButton = document.querySelector("#toggle-theme");
const themeIcon = document.querySelector("#theme-icon");
const aboutImage = document.querySelector(".about-image");
const profileImage = document.querySelector(".profile-image");

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

function updateTheme(theme) {
  if (theme === "latex-light-auto") {
    if (themeIcon) {
      themeIcon.src = "icons/moon.png";
      themeIcon.alt = "Dark mode";
    }
    if (aboutImage) {
      aboutImage.style.border = "2px solid var(--color-link-light)";
    }
    if (profileImage) {
      profileImage.style.border = "2px solid var(--color-link-light)";
    }
  } else {
    if (themeIcon) {
      themeIcon.src = "icons/sun.png";
      themeIcon.alt = "Light mode";
    }
    if (aboutImage) {
      aboutImage.style.border = "2px solid var(--color-link-dark)";
    }
    if (profileImage) {
      profileImage.style.border = "2px solid var(--color-link-dark)";
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
