import {
	LeedsFullPageExhibition,
	LeedsScrollExhibition,
	LeedsSlideshowExhibition,
} from "exhibition-viewer/leeds";
import { type IIIFManifest, viewerType } from "#/lib/iiif";

export function ExhibitionViewer({
	manifest,
	language,
}: {
	manifest: IIIFManifest;
	language: string;
}) {
	const type = viewerType(manifest.behavior);
	if (type === "scroll")
		return (
			<div className="viewer viewer-scroll exhibition-viewer">
				<LeedsScrollExhibition
					manifest={manifest as never}
					language={language}
					viewObjectLinks={[]}
				/>
			</div>
		);
	if (type === "slideshow")
		return (
			<div className="viewer viewer-slideshow exhibition-viewer">
				<LeedsSlideshowExhibition
					manifest={manifest as never}
					language={language}
					viewObjectLinks={[]}
				/>
			</div>
		);
	return (
		<div className="viewer viewer-fullpage">
			<LeedsFullPageExhibition
				manifest={manifest as never}
				language={language}
				viewObjectLinks={[]}
			/>
		</div>
	);
}
