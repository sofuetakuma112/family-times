import { env } from "@family-times-new/env/web";

interface MapViewProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export default function MapView({ latitude, longitude, className }: MapViewProps) {
  const mapboxToken = env.VITE_MAPBOX_TOKEN;

  if (mapboxToken) {
    // Mapbox static image API
    const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+ff0000(${longitude},${latitude})/${longitude},${latitude},14,0/300x200@2x?access_token=${mapboxToken}`;
    return (
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <img
          src={mapUrl}
          alt={`Map: ${latitude}, ${longitude}`}
          className="rounded-md"
          width={300}
          height={200}
        />
      </a>
    );
  }

  // Fallback: OpenStreetMap link with static preview
  return (
    <a
      href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm hover:bg-accent ${className || ""}`}
    >
      <span>
        {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </span>
      <span className="text-xs text-muted-foreground">Open Map</span>
    </a>
  );
}
