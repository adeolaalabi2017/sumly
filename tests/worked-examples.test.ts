import { describe, expect, test } from "bun:test";
import { TOOL_CONTENT } from "@/lib/registry/tool-content";

const result = (slug: string, label: string): string => {
  const step = TOOL_CONTENT[slug].steps?.find((s) => s.label === label);
  if (!step) throw new Error(`${slug}: no step "${label}"`);
  return step.result;
};
const usd = (n: number, d = 0) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

describe("worked-example steps match the maths", () => {
  test("loan: payment, total interest, extra-payment saving", () => {
    const P = 350000, r = 0.0625 / 12, n = 360;
    const M = (P * r) / (1 - Math.pow(1 + r, -n));
    expect(result("loan-mortgage-calculator", "Monthly payment")).toBe(usd(M, 2));
    expect(result("loan-mortgage-calculator", "Total paid")).toBe(usd(Math.round(M * n)));
    expect(result("loan-mortgage-calculator", "Total interest")).toBe(usd(Math.round(M * n - P)));
    let b = P, months = 0, interest = 0;
    while (b > 0.005) {
      const i = b * r;
      interest += i;
      b = b + i - Math.min(M + 200, b + i);
      months++;
    }
    expect(months).toBe(287);
    expect(result("loan-mortgage-calculator", "Add $200 a month")).toBe(usd(Math.round(M * n - P - interest)) + " saved");
  });

  test("compound interest: final balance and interest", () => {
    const mr = Math.pow(1 + 0.07 / 12, 1) - 1;
    let bal = 10000;
    for (let i = 0; i < 240; i++) bal = bal * (1 + mr) + 300;
    expect(result("compound-interest-calculator", "Final balance")).toBe(usd(Math.round(bal)));
    expect(result("compound-interest-calculator", "Interest earned")).toBe(usd(Math.round(bal - 82000)));
  });

  test("profit margin, break-even, ROI, ROAS, CAC, LTV, P&L, percentage", () => {
    expect(result("profit-margin-calculator", "Gross margin")).toBe("40.0%");
    expect(result("profit-margin-calculator", "Markup")).toBe((((45000 - 27000) / 27000) * 100).toFixed(1) + "%");
    expect(result("break-even-calculator", "Break-even revenue")).toBe(usd((12000 / 18) * 45));
    expect(result("break-even-calculator", "Margin of safety")).toBe((((800 - 12000 / 18) / 800) * 100).toFixed(1) + "%");
    expect(result("marketing-roi-calculator", "ROI")).toBe(`${((60000 * 0.6 - 12000) / 12000) * 100}%`);
    expect(result("roas-calculator", "Break-even ROAS")).toBe((1 / 0.55).toFixed(2) + "x");
    expect(result("roas-calculator", "Profit after ad spend")).toBe(usd(45000 * 0.55 - 9000));
    expect(result("cac-calculator", "CAC")).toBe(usd(48000 / 120));
    expect(result("cac-calculator", "Payback period")).toBe((400 / 90).toFixed(1) + " months");
    expect(result("ltv-calculator", "Lifetime value")).toBe(usd(Math.round(85 * 6 * 0.65 * (1 / 0.15))));
    const pbt = 250000 - 90000 - 95000 - 12000;
    expect(result("profit-loss-calculator", "Net profit")).toBe(usd(pbt * (1 - 0.21)));
    expect(result("percentage-calculator", "Change from $80 to $100")).toBe("+25%");
    expect(result("percentage-calculator", "Change back from $100 to $80")).toBe("−20%");
  });

  test("every step has a label, working and result", () => {
    for (const [slug, c] of Object.entries(TOOL_CONTENT)) {
      for (const s of c.steps ?? []) {
        expect(s.label.length, slug).toBeGreaterThan(0);
        expect(s.working.length, slug).toBeGreaterThan(0);
        expect(s.result.length, slug).toBeGreaterThan(0);
      }
    }
  });
});
