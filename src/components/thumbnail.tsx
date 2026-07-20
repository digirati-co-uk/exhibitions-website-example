import { useState } from "react";
import {
	useExternalManifest,
	useThumbnail,
	VaultProvider,
} from "react-iiif-vault";
import type { SiteIndexEntry } from "#/lib/site-data";

function ResolvedManifestThumbnail({ id }: { id: string }) {
	const [failed, setFailed] = useState(false);
	const thumbnail = useThumbnail(
		{ width: 640, height: 400, allowUnsafe: true },
		true,
		{ manifestId: id },
	);
	return thumbnail && !failed ? (
		<img src={thumbnail.id} alt="" onError={() => setFailed(true)} />
	) : (
		<span className="card-thumbnail-placeholder">Manifest</span>
	);
}

function LoadedManifestThumbnail({ id }: { id: string }) {
	const { manifest } = useExternalManifest({ id, type: "Manifest" });
	return manifest ? (
		<ResolvedManifestThumbnail id={manifest.id} />
	) : (
		<span className="card-thumbnail-placeholder">Manifest</span>
	);
}

export function ManifestThumbnail({ manifest }: { manifest: SiteIndexEntry }) {
	const snippet = manifest.thumbnail?.[0]?.id;
	const [loadManifest, setLoadManifest] = useState(!snippet);
	return (
		<VaultProvider useGlobal>
			{snippet && !loadManifest ? (
				<img
					src={snippet}
					alt=""
					loading="lazy"
					onError={() => setLoadManifest(true)}
				/>
			) : (
				<LoadedManifestThumbnail id={manifest.id} />
			)}
		</VaultProvider>
	);
}
