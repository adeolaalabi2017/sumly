"use client";

import * as React from "react";
import { Link2, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { carriesInputs, shareLinks, shareTitle, shareUrlFrom } from "@/lib/share";

/**
 * One Share menu for every tool page. It reads the address when it opens, so the link
 * includes whatever inputs the tool has put in the query string, and falls back to the
 * plain tool link for tools that don't keep their state there.
 */
export function ToolShareMenu({ toolName }: { toolName: string }) {
  const { toast } = useToast();
  const [url, setUrl] = React.useState("");
  const [canNativeShare, setCanNativeShare] = React.useState(false);
  const title = shareTitle(toolName);

  const onOpenChange = (open: boolean) => {
    if (!open) return;
    setUrl(shareUrlFrom(window.location.href));
    setCanNativeShare(typeof navigator.share === "function");
  };

  const copyLink = async () => {
    const link = shareUrlFrom(window.location.href);
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Link copied",
        description: carriesInputs(link)
          ? "Anyone who opens it sees your current inputs."
          : "Paste it anywhere you like.",
      });
    } catch {
      toast({
        title: "Couldn't copy the link",
        description: "Copy the address from your browser's address bar instead.",
        variant: "destructive",
      });
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: title, url: shareUrlFrom(window.location.href) });
    } catch {
      // Dismissing the share sheet rejects with AbortError; nothing to report.
    }
  };

  const links = shareLinks({ url: url || shareUrlFrom("https://sumly.cc"), title });
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Share this tool</DropdownMenuLabel>
        <DropdownMenuItem onSelect={copyLink}>
          <Link2 className="h-4 w-4" aria-hidden />
          Copy link
        </DropdownMenuItem>
        {canNativeShare && (
          <DropdownMenuItem onSelect={nativeShare}>
            <Share2 className="h-4 w-4" aria-hidden />
            Share…
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={links.x} {...external}>Post on X</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.linkedin} {...external}>Share on LinkedIn</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.facebook} {...external}>Share on Facebook</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.whatsapp} {...external}>Send on WhatsApp</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.email}>
            <Mail className="h-4 w-4" aria-hidden />
            Email
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
