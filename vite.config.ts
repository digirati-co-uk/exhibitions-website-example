import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import iiifPlugin from "iiif-hss/vite-plugin";
import { defineConfig } from "vite";
import contentStore from "./iiif-config/stores/content.json";
import { findRouteService, sameResource } from "./src/lib/iiif";

const base = process.env.SITE_BASE_PATH || "/";
const publicSiteUrl = process.env.VITE_SITE_URL;

const config = defineConfig(async ({ command }) => {
	let serverUrl: string | undefined;
	if (command === "build") {
		const infoUrl = `${contentStore.url.replace(/\/+$/, "")}/info`;
		const response = await fetch(infoUrl);
		if (!response.ok)
			throw new Error(`Unable to load static-site info (${response.status})`);
		const routeService = findRouteService(await response.json());
		if (!routeService)
			throw new Error("Static-site info is missing its route service");
		serverUrl = publicSiteUrl
			? new URL(base, `${publicSiteUrl.replace(/\/+$/, "")}/`).toString()
			: routeService.id;
		if (!sameResource(serverUrl, routeService.id))
			throw new Error(
				"SITE_BASE_PATH/VITE_SITE_URL do not match the route service target",
			);
	}

	return {
		base,
		resolve: { tsconfigPaths: true },
		plugins: [
			devtools(),
			tailwindcss(),
			iiifPlugin({ copyBuildToOutDir: false, serverUrl }),
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
	};
});

export default config;
