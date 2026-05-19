import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        neon: {
          cyan: "#22D3EE",
          blue: "#2563EB",
          sky: "#38BDF8",
          steel: "#94A3B8",
        },
        carbon: {
          950: "#050816",
          900: "#08111F",
          800: "#0B1220",
        },
        graphite: {
          950: "#07101E",
          900: "#0B1220",
          800: "#101A2B",
          700: "#1E2D45",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 211, 238, 0.16)",
        showroom: "0 18px 52px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(248, 250, 252, 0.055)",
        blue: "0 12px 32px rgba(37, 99, 235, 0.24)",
        cyan: "0 12px 28px rgba(56, 189, 248, 0.2)",
      },
      backgroundImage: {
        "cyber-grid":
          "linear-gradient(rgba(34,211,238,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.045) 1px, transparent 1px)",
        "ai-scanline":
          "linear-gradient(105deg, transparent 0 20%, rgba(37,99,235,0.12) 20% 20.45%, rgba(34,211,238,0.1) 20.45% 20.9%, transparent 20.9% 100%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
