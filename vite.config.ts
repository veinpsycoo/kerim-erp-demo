import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/kerim-erp-demo/",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"], environment: "node", pool: "threads" },
});
