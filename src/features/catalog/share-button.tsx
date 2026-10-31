"use client";

import { Check, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "copied" | "failed";

/** Native share sheet when available (mostly mobile); clipboard copy otherwise. */
export function ShareButton({ name }: { name: string }) {
  const t = useTranslations("Product");
  const [status, setStatus] = useState<Status>("idle");

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: name, text: t("shareText", { name }), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch (error) {
      // Closing the native share sheet is not an error worth reporting.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={share}>
        {status === "copied" ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Share2 className="size-4" aria-hidden="true" />
        )}
        {t("share")}
      </Button>
      <span role="status" className="text-xs text-muted">
        {status === "copied" ? t("shareCopied") : status === "failed" ? t("shareFailed") : ""}
      </span>
    </div>
  );
}
