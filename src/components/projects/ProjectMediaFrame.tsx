import type { Project } from "@/lib/types";

export function ProjectMediaFrame({ project }: { project: Project }) {
  if (!project.media) return null;

  const { poster, video, placeholder } = project.media;

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-edge bg-surface">
      {video ? (
        <video
          controls
          preload="none"
          playsInline
          poster={poster}
          className="h-full w-full object-cover"
        >
          <source src={video} />
          Your browser does not support the video element.
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- posters are inline SVG placeholders; next/image would require dangerouslyAllowSVG. Revisit when real raster screenshots land.
        <img
          src={poster}
          alt={`${project.title} — demo screenshot`}
          width={1280}
          height={720}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}

      {placeholder && !video && (
        <div className="absolute bottom-3 right-3">
          <span className="rounded border border-edge bg-void/80 px-2 py-1 font-mono text-xs text-ink-dim backdrop-blur-sm">
            Demo video coming soon
          </span>
        </div>
      )}
    </div>
  );
}
