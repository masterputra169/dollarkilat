"use client";

import { Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

// Tiny client island just for the reload action. Lets the parent
// /offline page stay a Server Component (faster, smaller chunk for a
// page that, by definition, loads under degraded network conditions).
export function ReloadButton() {
  return (
    <Button
      variant="primary"
      leftIcon={<Wifi className="size-4" />}
      onClick={() => {
        if (typeof window !== "undefined") window.location.reload();
      }}
    >
      Coba lagi
    </Button>
  );
}
