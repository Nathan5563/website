const body = document.querySelector("body");
const toggleButton = document.querySelector("#toggle-theme");
const themeIcon = document.querySelector("#theme-icon");

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

function updateTheme(theme) {
  if (theme === "latex-light-auto") {
    if (themeIcon) {
      themeIcon.src = "../../../../icons/moon.png";
      themeIcon.alt = "Dark mode";
    }
  } else {
    if (themeIcon) {
      themeIcon.src = "../../../../icons/sun.png";
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

// Collapsible sections functionality
document.addEventListener("DOMContentLoaded", () => {
  const subtitles = document.querySelectorAll(".blog-subtitle");
  
  // Load saved collapsed states
  const savedCollapsedStates = JSON.parse(localStorage.getItem("collapsedSections") || "{}");
  
  // Apply saved states on page load
  subtitles.forEach(subtitle => {
    const sectionName = subtitle.getAttribute("data-section");
    const content = document.getElementById(`${sectionName}-content`);
    
    if (content && savedCollapsedStates[sectionName]) {
      content.classList.add("collapsed");
      content.style.maxHeight = "0";
      subtitle.classList.add("collapsed");
    }
  });
  
  subtitles.forEach(subtitle => {
    subtitle.addEventListener("click", () => {
      const sectionName = subtitle.getAttribute("data-section");
      const content = document.getElementById(`${sectionName}-content`);
      
      if (content) {
        const isCollapsed = content.classList.contains("collapsed");
        
        if (isCollapsed) {
          // Expand
          content.classList.remove("collapsed");
          content.style.maxHeight = "none";
          const height = content.scrollHeight;
          content.style.maxHeight = "0";
          // Force reflow
          content.offsetHeight;
          content.style.maxHeight = height + "px";
          subtitle.classList.remove("collapsed");
          
          // Save expanded state
          const collapsedStates = JSON.parse(localStorage.getItem("collapsedSections") || "{}");
          delete collapsedStates[sectionName];
          localStorage.setItem("collapsedSections", JSON.stringify(collapsedStates));
          
          // Remove max-height after transition
          setTimeout(() => {
            if (!content.classList.contains("collapsed")) {
              content.style.maxHeight = "none";
            }
          }, 200);
        } else {
          // Collapse
          content.style.maxHeight = content.scrollHeight + "px";
          // Force reflow
          content.offsetHeight;
          content.style.maxHeight = "0";
          content.classList.add("collapsed");
          subtitle.classList.add("collapsed");
          
          // Save collapsed state
          const collapsedStates = JSON.parse(localStorage.getItem("collapsedSections") || "{}");
          collapsedStates[sectionName] = true;
          localStorage.setItem("collapsedSections", JSON.stringify(collapsedStates));
        }
      }
    });
  });
});
