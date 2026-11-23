/**
 * Share links for a tool page. No third-party scripts or SDKs: each network is a plain
 * link to its public share URL, so the page loads nothing extra and sends nothing
 * until the visitor picks a network.
 */

export interface ShareTarget {
  url: string;
  /** Short line shown with the link, e.g. "Loan & Mortgage Calculator on Sumly". */
  title: string;
}

export interface ShareLinks {
  x: string;
  linkedin: string;
  facebook: string;
  whatsapp: string;
  email: string;
}

/** The link to share: the current address without the #fragment. */
export function shareUrlFrom(href: string): string {
  try {
    const u = new URL(href);
    u.hash = "";
    return u.toString();
  } catch {
    return href;
  }
}

export const shareTitle = (toolName: string) => `${toolName} on Sumly`;

export function shareLinks({ url, title }: ShareTarget): ShareLinks {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    email: `mailto:?subject=${t}&body=${encodeURIComponent(`${title}\n${url}`)}`,
  };
}

/** True when the link carries the visitor's inputs (tools keep them in the query string). */
export const carriesInputs = (url: string): boolean => {
  try {
    return new URL(url).search.length > 1;
  } catch {
    return false;
  }
};
