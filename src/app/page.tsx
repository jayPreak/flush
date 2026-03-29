"use client";

import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted">
      <div className="text-center">
        <div className="text-4xl mb-2">🚽</div>
        <p className="text-muted-foreground text-sm">Loading Flush...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="relative flex-1">
      <Map />
    </main>
  );
}
