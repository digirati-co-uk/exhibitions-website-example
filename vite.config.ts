import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	base: process.env.SITE_BASE_PATH || "/",
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart({
			prerender: {
				enabled: true,
				autoSubfolderIndex: true,
				crawlLinks: true,
				concurrency: 1,
				failOnError: true,
			},
		}),
		viteReact(),
	],
});

export default config;
