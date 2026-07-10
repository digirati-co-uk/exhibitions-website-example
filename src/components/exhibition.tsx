import {
	DelftExhibition,
	DelftPresentation,
	ScrollExhibition,
} from "exhibition-viewer/library";
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
				<ScrollExhibition
					manifest={manifest as never}
					language={language}
					viewObjectLinks={[]}
				/>
			</div>
		);
	if (type === "slideshow")
		return (
			<div className="viewer viewer-slideshow exhibition-viewer">
				<DelftPresentation
					manifest={manifest as never}
					language={language}
					viewObjectLinks={[]}
				/>
			</div>
		);
	return (
		<div className="viewer viewer-fullpage">
			<DelftExhibition
				manifest={manifest as never}
				language={language}
				viewObjectLinks={[]}
			/>
		</div>
	);
}
