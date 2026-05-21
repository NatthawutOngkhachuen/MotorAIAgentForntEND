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
          950: "#FFFFFF",
          900: "#F8FAFC",
          800: "#F1F5F9",
        },
        graphite: {
          950: "#FFFFFF",
          900: "#F8FAFC",
          800: "#F1F5F9",
          700: "#E2E8F0",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 211, 238, 0.16)",
        showroom: "0 18px 52px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
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
