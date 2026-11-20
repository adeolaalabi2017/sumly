import { describe, expect, test } from "bun:test";
import { TOOL_CONTENT } from "@/lib/registry/tool-content";
import { CONCRETE_KG_PER_M3, bestTins, concreteBags, paintLitres, slabVolume, wallArea } from "@/lib/construction";
import { daysBetween, diffYMD } from "@/lib/datetime";

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

describe("more worked-example steps match the maths", () => {
  test("budget, grade, invoice", () => {
    const e = "budget-expense-calculator";
    expect(result(e, "Needs share")).toBe(((2390 / 4200) * 100).toFixed(1) + "%");
    expect(result(e, "Wants share")).toBe(((590 / 4200) * 100).toFixed(1) + "%");
    expect(result(e, "Savings share")).toBe(((700 / 4200) * 100).toFixed(1) + "%");
    expect(result(e, "Unallocated")).toBe(usd(4200 - 2390 - 590 - 700));
    expect(result(e, "Needs above the 50% line")).toBe(usd(2390 - 0.5 * 4200));
    expect(result(e, "Savings short of 20%")).toBe(usd(0.2 * 4200 - 700));
    const g = "grade-calculator";
    const earned = 82 * 0.6;
    expect(result(g, "Points already earned")).toBe(earned.toFixed(1));
    expect(result(g, "Score needed on the final")).toBe(((85 - earned) / 0.4).toFixed(1) + "%");
    expect(result(g, "Best case, 100% on the final")).toBe((earned + 40).toFixed(1) + "%");
    expect(result(g, "Score needed for a 90% course grade")).toContain(String(Math.round((90 - earned) / 0.4)) + "%");
    const sub = 1800 + 6 * 180 + 2 * 240;
    expect(result("invoice-generator", "Subtotal")).toBe(usd(sub));
    expect(result("invoice-generator", "Tax at 8.5%")).toBe(usd(sub * 0.085, 2));
    expect(result("invoice-generator", "Total due")).toBe(usd(sub * 1.085, 2));
  });

  test("age, paint, concrete use the real library functions", () => {
    const b = new Date(1995, 5, 15), a = new Date(2026, 9, 31);
    const span = diffYMD(b, a);
    expect(result("age-calculator", "Whole years")).toBe(`${span.y} years`);
    expect(result("age-calculator", "Whole months")).toBe(`${span.m} months`);
    expect(result("age-calculator", "Remaining days")).toBe(`${span.d} days`);
    expect(result("age-calculator", "Total days lived")).toBe(`${daysBetween(b, a).toLocaleString("en-US")} days`);
    expect(result("age-calculator", "Day of the week born")).toBe(b.toLocaleDateString("en-US", { weekday: "long" }));
    expect(result("age-calculator", "Next birthday")).toBe(`${daysBetween(a, new Date(2027, 5, 15))} days away`);

    const area = wallArea(4, 3.5, 2.4, 1.9 + 1.5);
    expect(result("paint-calculator", "Take off a door and a window")).toBe(`${area.toFixed(1)} m²`);
    const litres = paintLitres(area, 2, 10);
    expect(result("paint-calculator", "Paint needed")).toBe(`${litres.toFixed(2)} L`);
    const tins = bestTins(litres, [5, 2.5, 1])!;
    expect(tins.counts).toEqual([1, 1, 0]);
    expect(result("paint-calculator", "Tins to buy")).toContain(`(${tins.total} L)`);

    const vol = slabVolume(3, 3, 0.1);
    expect(result("concrete-calculator", "Slab volume")).toBe(`${vol.toFixed(1)} m³`);
    expect(result("concrete-calculator", "Weight of concrete")).toBe(
      `${Math.round(vol * 1.1 * CONCRETE_KG_PER_M3).toLocaleString("en-US")} kg`
    );
    expect(result("concrete-calculator", "25 kg bags")).toBe(`${concreteBags(vol, 25, 10)} bags`);
  });

  test("unit converter figures", () => {
    const u = "unit-converter";
    expect(result(u, "Feet")).toBe(`${(1 / 0.3048).toFixed(5)} ft`);
    expect(result(u, "Yards")).toBe(`${(1 / 0.9144).toFixed(5)} yd`);
    expect(result(u, "Miles")).toBe(`${(1 / 1609.344).toFixed(9)} mi`);
    expect(result(u, "1 GB in GiB")).toBe(`${(1e9 / 2 ** 30).toFixed(6)} GiB`);
    expect(result(u, "A '1 TB' drive in GiB")).toBe(`${Math.round(1e12 / 2 ** 30)} GiB`);
  });
});
