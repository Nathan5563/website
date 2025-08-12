class ResumeManager {
  constructor() {
    this.config = {
      githubOwner: "Nathan5563",
      githubRepo: "Resume",
      texFileName: "main.tex",
      pdfFileName: "main.pdf",
      checkInterval: 3600000, // hourly checks
      cacheExpiry: 3600000, // cache expires after 1 hour
      maxRetries: 3,
    };

    this.currentCommitSha = null;
    this.lastChecked = null;
    this.checkTimer = null;
    this.retryCount = 0;
    this.cacheKey = "resume_cache";

    this.initializeElements();
    this.startAutoUpdate();
  }

  initializeElements() {
    this.elements = {
      loading: document.getElementById("loading"),
      error: document.getElementById("error-message"),
      resumeFrame: document.getElementById("resume-frame"),
      downloadBtn: document.getElementById("download-btn"),
      lastChecked: document.getElementById("last-checked"),
      latestCommit: document.getElementById("latest-commit"),
    };

    if (this.elements.downloadBtn) {
      this.elements.downloadBtn.disabled = true;
      this.elements.downloadBtn.setAttribute("aria-disabled", "true");
      this.elements.downloadBtn.addEventListener("click", () => {
        const pdfUrl = this.elements.downloadBtn.dataset.href;
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = `Nathan_Resume_${
          this.currentCommitSha?.substring(0, 7) || "latest"
        }.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }
  }

  // Cache management methods
  getCachedData() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - data.timestamp > this.config.cacheExpiry) {
        localStorage.removeItem(this.cacheKey);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error reading cache:", error);
      localStorage.removeItem(this.cacheKey);
      return null;
    }
  }

  setCachedData(commitData, pdfUrl = null) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        commit: commitData,
        pdfUrl: pdfUrl,
        lastChecked: new Date().toISOString(),
      };

      localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error("Error writing to cache:", error);
    }
  }

  async startAutoUpdate() {
    // First, try to load from cache
    const cachedData = this.getCachedData();
    if (cachedData) {
      console.log("Loading resume from cache...");

      try {
        this.currentCommitSha = cachedData.commit.sha;
        this.updateCommitInfo(cachedData.commit);
        // Use the cached lastChecked time (when API was last called)
        this.lastChecked = new Date(cachedData.lastChecked);
        this.updateLastCheckedTime();

        if (cachedData.pdfUrl) {
          await this.loadPdfFromUrl(cachedData.pdfUrl);
        }
      } catch (error) {
        console.error("Error loading from cache:", error);
        // If cache fails, proceed with normal check
      }
    }

    // Then check for updates (this will use API)
    await this.checkForUpdates();

    // Set up periodic checks every hour
    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
  }

  async checkForUpdates() {
    try {
      const cachedData = this.getCachedData();
      if (cachedData && this.currentCommitSha === cachedData.commit.sha) {
        return;
      }

      const latestCommit = await this.getLatestCommit();

      if (!latestCommit) {
        throw new Error("Could not fetch latest commit");
      }

      const needsUpdate = this.currentCommitSha !== latestCommit.sha;

      if (needsUpdate) {
        console.log("New commit detected, updating resume...");
        const pdfUrl = await this.updateResume(latestCommit);
        this.setCachedData(latestCommit, pdfUrl);
      } else {
        this.setCachedData(latestCommit, cachedData?.pdfUrl);
      }

      this.updateCommitInfo(latestCommit);
      this.lastChecked = new Date();
      this.updateLastCheckedTime();
      this.retryCount = 0;
    } catch (error) {
      console.error("Error checking for updates:", error);
      this.handleError(error);
    }
  }

  async getLatestCommit() {
    const url = `https://api.github.com/repos/${this.config.githubOwner}/${this.config.githubRepo}/commits/main`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Resume-Auto-Updater",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  async updateResume(commit) {
    try {
      const pdfUrl = await this.getPdfFromRepo(commit.sha);

      if (pdfUrl) {
        await this.loadPdfFromUrl(pdfUrl);
        this.currentCommitSha = commit.sha;
        return pdfUrl;
      } else {
        const compiledPdfUrl = await this.compileLatexToPdf(commit.sha);
        this.currentCommitSha = commit.sha;
        return compiledPdfUrl;
      }
    } catch (error) {
      console.error("Error updating resume:", error);
      throw error;
    }
  }

  async getPdfFromRepo(commitSha) {
    try {
      const url = `https://api.github.com/repos/${this.config.githubOwner}/${this.config.githubRepo}/contents/${this.config.pdfFileName}?ref=${commitSha}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Resume-Auto-Updater",
        },
      });

      if (response.ok) {
        const fileData = await response.json();
        return `https://raw.githubusercontent.com/${this.config.githubOwner}/${this.config.githubRepo}/${commitSha}/${this.config.pdfFileName}`;
      }

      return null;
    } catch (error) {
      console.log("PDF not found in repository, will need to compile");
      return null;
    }
  }

  async compileLatexToPdf(commitSha) {
    return await this.triggerGitHubAction(commitSha);
  }

  async triggerGitHubAction(commitSha) {
    const workflowUrl = `https://api.github.com/repos/${this.config.githubOwner}/${this.config.githubRepo}/actions/workflows/compile-resume.yml/dispatches`;

    try {
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const pdfUrl = await this.getPdfFromRepo(commitSha);
      if (pdfUrl) {
        await this.loadPdfFromUrl(pdfUrl);
        return pdfUrl;
      } else {
        throw new Error("PDF compilation failed or took too long");
      }
    } catch (error) {
      console.error("GitHub Action trigger failed:", error);
      const fallbackUrl = await this.loadFallbackResume();
      return fallbackUrl;
    }
  }

  async loadPdfFromUrl(pdfUrl) {
    return new Promise((resolve, reject) => {
      this.elements.loading.style.display = "none";
      this.elements.error.classList.add("hidden");

      const viewerUrl = this.getPdfViewerUrl(pdfUrl);

      let loadTimeout;

      this.elements.resumeFrame.onload = () => {
        clearTimeout(loadTimeout);
        this.elements.resumeFrame.style.display = "block";
        this.elements.downloadBtn.dataset.href = pdfUrl;
        this.elements.downloadBtn.disabled = false;
        this.elements.downloadBtn.setAttribute("aria-disabled", "false");
        resolve();
      };

      this.elements.resumeFrame.onerror = () => {
        clearTimeout(loadTimeout);
        console.log("Primary viewer failed, trying fallback...");
        this.tryFallbackViewer(pdfUrl, resolve, reject);
      };

      loadTimeout = setTimeout(() => {
        console.log("Viewer timeout, trying fallback...");
        this.tryFallbackViewer(pdfUrl, resolve, reject);
      }, 10000);

      this.elements.resumeFrame.src = viewerUrl;

      this.elements.downloadBtn.href = pdfUrl;
    });
  }

  tryFallbackViewer(pdfUrl, resolve, reject) {
    this.elements.resumeFrame.onload = () => {
      this.elements.resumeFrame.style.display = "block";
      this.elements.downloadBtn.dataset.href = pdfUrl;
      this.elements.downloadBtn.disabled = false;
      this.elements.downloadBtn.setAttribute("aria-disabled", "false");
      resolve();
    };

    this.elements.resumeFrame.onerror = () => {
      this.elements.resumeFrame.src =
        pdfUrl + "#view=FitH&toolbar=1&navpanes=1";
      setTimeout(() => {
        this.elements.resumeFrame.style.display = "block";
        this.elements.downloadBtn.dataset.href = pdfUrl;
        this.elements.downloadBtn.disabled = false;
        this.elements.downloadBtn.setAttribute("aria-disabled", "false");
        resolve();
      }, 1000);
    };

    this.elements.resumeFrame.src = `https://docs.google.com/gview?url=${encodeURIComponent(
      pdfUrl
    )}&embedded=true`;
  }

  getPdfViewerUrl(pdfUrl) {
    if (pdfUrl.includes("raw.githubusercontent.com")) {
      return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
        pdfUrl
      )}`;
    }

    return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
      pdfUrl
    )}`;
  }

  async loadFallbackResume() {
    const fallbackUrl = `https://raw.githubusercontent.com/${this.config.githubOwner}/${this.config.githubRepo}/main/${this.config.pdfFileName}`;

    try {
      await this.loadPdfFromUrl(fallbackUrl);
      return fallbackUrl;
    } catch (error) {
      this.showError(
        "Resume compilation in progress. Please check back in a few minutes."
      );
      return null;
    }
  }

  updateCommitInfo(commit) {
    const shortSha = commit.sha.substring(0, 7);
    const commitMessage = commit.commit.message.split("\n")[0];
    const commitDate = new Date(commit.commit.author.date).toLocaleDateString();

    this.elements.latestCommit.innerHTML = `
            <a href="${commit.html_url}" target="_blank" style="color: #007bff; text-decoration: none;">
                ${shortSha}
            </a> - ${commitMessage} (${commitDate})
        `;
  }

  updateLastCheckedTime() {
    if (this.lastChecked) {
      this.elements.lastChecked.textContent = this.lastChecked.toLocaleString();
    }
  }

  handleError(error) {
    this.retryCount++;

    if (this.retryCount < this.config.maxRetries) {
      setTimeout(() => this.checkForUpdates(), 5000);
    } else {
      this.showError(error.message);
    }
  }

  showError(message) {
    this.elements.loading.style.display = "none";
    this.elements.resumeFrame.style.display = "none";
    this.elements.error.classList.remove("hidden");
    this.elements.error.querySelector("p").textContent = message;
  }

  destroy() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
  }

  clearCache() {
    localStorage.removeItem(this.cacheKey);
    console.log("Cache cleared");
  }
}

let resumeManager;

document.addEventListener("DOMContentLoaded", () => {
  resumeManager = new ResumeManager();
});

window.addEventListener("beforeunload", () => {
  if (resumeManager) {
    resumeManager.destroy();
  }
});

function loadResume() {
  if (resumeManager) {
    resumeManager.checkForUpdates();
  }
}

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
