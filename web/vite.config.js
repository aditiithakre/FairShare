import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the repo name for GitHub Pages (aditiithakre.github.io/FairShare/)
export default defineConfig({
  plugins: [react()],
  base: process.env.DEPLOY_BASE || "/FairShare/",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Firebase is most of the weight and changes rarely - keep it in its
        // own chunk so an app edit doesn't invalidate it in everyone's cache
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
