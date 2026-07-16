import { describe, expect, it } from "vitest";
import { createDeployment, validateDeployment } from "./deployment.mjs";

describe("static-site deployment contract", () => {
	it("creates a portal-compatible v1 record", () => {
		const deployment = createDeployment({
			rootId: "https://iiif.example/site",
			siteUrl: "https://site.example/exhibitions/",
			packageJson: { name: "exhibition-static-site", version: "1.0.0" },
			env: {
				GITHUB_REPOSITORY: "example/site",
				GITHUB_SHA: "6e6cb0ea74e12ff77036c054f77234486b16b007",
				GITHUB_REF_NAME: "main",
				GITHUB_RUN_ID: "123456",
			},
			now: new Date("2026-07-16T12:34:56.000Z"),
		});
		expect(deployment).toMatchObject({
			schemaVersion: 1,
			deployedAt: "2026-07-16T12:34:56.000Z",
			source: { id: "https://iiif.example/site" },
			site: { url: "https://site.example/exhibitions/" },
			revision: { branch: "main" },
			build: { provider: "github-actions" },
			generator: { name: "exhibition-static-site", version: "1.0.0" },
		});
	});

	it("rejects unsafe URLs and invalid revisions", () => {
		expect(() =>
			validateDeployment({
				schemaVersion: 1,
				deployedAt: new Date().toISOString(),
				source: { id: "javascript:alert(1)" },
				generator: { name: "site" },
			}),
		).toThrow("HTTP(S)");
		expect(() =>
			validateDeployment({
				schemaVersion: 1,
				deployedAt: new Date().toISOString(),
				source: { id: "https://iiif.example/site" },
				revision: { id: "nope" },
				generator: { name: "site" },
			}),
		).toThrow("revision");
	});
});
