import { describe, expect, test } from "bun:test";
import { carriesInputs, shareLinks, shareTitle, shareUrlFrom } from "@/lib/share";

describe("share helpers", () => {
  const url = "https://sumly.cc/finance/loan-mortgage-calculator?amount=350000&rate=6.25";
  const title = shareTitle("Loan & Mortgage Calculator");

  test("title names the tool and the site", () => {
    expect(title).toBe("Loan & Mortgage Calculator on Sumly");
  });

  test("the shared URL drops the #fragment but keeps the query", () => {
    expect(shareUrlFrom(`${url}#how`)).toBe(url);
    expect(shareUrlFrom("https://sumly.cc/math/percentage-calculator")).toBe("https://sumly.cc/math/percentage-calculator");
  });

  test("every network link carries the encoded URL and title", () => {
    const l = shareLinks({ url, title });
    const u = encodeURIComponent(url);
    expect(l.x.startsWith("https://twitter.com/intent/tweet?")).toBe(true);
    expect(l.x).toContain(`url=${u}`);
    expect(l.x).toContain(`text=${encodeURIComponent(title)}`);
    expect(l.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`);
    expect(l.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${u}`);
    expect(decodeURIComponent(l.whatsapp.split("text=")[1])).toBe(`${title} ${url}`);
    expect(l.email.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(l.email.split("body=")[1])).toBe(`${title}\n${url}`);
  });

  test("an ampersand or space in the title cannot break out of its parameter", () => {
    const l = shareLinks({ url: "https://sumly.cc/x", title: "A & B C" });
    expect(l.x).toContain("text=A%20%26%20B%20C");
    expect(new URL(l.x).searchParams.get("text")).toBe("A & B C");
    expect(new URL(l.linkedin).searchParams.get("url")).toBe("https://sumly.cc/x");
  });

  test("carriesInputs is true only when the link has a query string", () => {
    expect(carriesInputs(url)).toBe(true);
    expect(carriesInputs("https://sumly.cc/finance/loan-mortgage-calculator")).toBe(false);
    expect(carriesInputs("not a url")).toBe(false);
  });
});
