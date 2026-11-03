import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Renders a complaint photo from the private storage bucket via a short-lived signed URL. */
export function ComplaintPhoto({ path, className }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("complaint-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setSrc(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!src) return null;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt="Complaint photo" className={className} loading="lazy" />
    </a>
  );
}
