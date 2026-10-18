import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OverlayAlert({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main data-overlay className="w-full max-w-[480px] p-2">
      <Alert variant="destructive" className="rounded-md bg-card/95 py-3">
        <TriangleAlert />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </Alert>
    </main>
  );
}
