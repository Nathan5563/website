const body = document.querySelector("body");
const toggleButton = document.querySelector("#toggle-theme");
const themeIcon = document.querySelector("#theme-icon");
const aboutImage = document.querySelector(".about-image");

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  body.className = savedTheme;
} else {
  body.className = prefersDark ? "latex-dark-auto" : "latex-light-auto";
}

const savedBtnTheme = localStorage.getItem("btn-theme");
if (savedBtnTheme) {
  toggleButton.className = savedBtnTheme;
} else {
  toggleButton.className = prefersDark ? "btn btn-dark" : "btn btn-light";
}

if (body.className === "latex-light-auto") {
  themeIcon.src = "icons/moon.png";
  themeIcon.alt = "Dark mode";
  aboutImage.style.border = "1px solid var(--color-link-light)";
} else {
  themeIcon.src = "icons/sun.png";
  themeIcon.alt = "Light mode";
  aboutImage.style.border = "1px solid var(--color-link-dark)";
}

toggleButton.addEventListener("click", () => {
  const currentTheme = body.classList.contains("latex-light-auto")
    ? "latex-dark-auto"
    : "latex-light-auto";
  body.className = currentTheme;
  localStorage.setItem("theme", currentTheme);

  if (currentTheme === "latex-light-auto") {
    themeIcon.src = "icons/moon.png";
    themeIcon.alt = "Dark mode";
    aboutImage.style.border = "1px solid var(--color-link-light)";
  } else {
    themeIcon.src = "icons/sun.png";
    themeIcon.alt = "Light mode";
    aboutImage.style.border = "1px solid var(--color-link-dark)";
  }

  const buttonTheme = toggleButton.classList.contains("btn-light")
    ? "btn btn-dark"
    : "btn btn-light";
  toggleButton.className = buttonTheme;
  localStorage.setItem("btn-theme", buttonTheme);
});
