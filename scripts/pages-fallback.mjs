import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createDeployment, readSiteContract } from "./deployment.mjs";

const output = "dist/client";
const iiifOutput = `${output}/iiif`;
await mkdir(output, { recursive: true });
await cp(".iiif/build", iiifOutput, { recursive: true, force: true });
await copyFile(`${output}/index.html`, `${output}/404.html`);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const contract = await readSiteContract(iiifOutput);
const deployment = createDeployment({ ...contract, packageJson });

await writeFile(
	`${output}/deploy.json`,
	`${JSON.stringify(deployment, null, 2)}\n`,
);
