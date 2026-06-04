import { defineConfig } from "vite";
import { existsSync, readdirSync } from "node:fs";

function blogPostInputs() {
  if (!existsSync("blog")) return {};

  return Object.fromEntries(
    readdirSync("blog", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(`blog/${entry.name}/index.html`))
      .map((entry) => [
        `blog-${entry.name.replace(/[^a-z0-9]+/gi, "-")}`,
        `blog/${entry.name}/index.html`
      ])
  );
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: "index.html",
        notFound: "404.html",
        projects: "projects/index.html",
        quark: "projects/quark/index.html",
        gallery: "gallery/index.html",
        blog: "blog/index.html",
        ...blogPostInputs()
      }
    }
  }
});
