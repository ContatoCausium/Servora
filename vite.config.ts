// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Pre-bundle up front so late dependency discovery can't reload mid-session
    // and leave two React copies in the page.
    optimizeDeps: {
      include: [
        "i18next",
        "react-i18next",
        "recharts",
        "sonner",
        "cmdk",
        "lucide-react",
        "@radix-ui/react-label",
        "@radix-ui/react-slot",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-popover",
        "@radix-ui/react-dialog",
        "@radix-ui/react-tooltip",
      ],
    },
  },
});
