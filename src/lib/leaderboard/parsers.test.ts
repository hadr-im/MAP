import { describe, expect, it } from "vitest";
import { TAB_SPECS, columnLetter, parseActivityTab, parseAmount, parseDepartments, signupColumns } from "./parsers";

describe("OGX Approvals", () => {
  const rows = [
    ["Member", "Department", "EP", "Approved on"],
    ["Unassigned", "GTA", "Rayen Ben Ammar", "2026-11-15"],
    ["Amna Riahi", "GTA", "Zayd Zormati", "2026-11-14"],
    ["aymen zouaoui", "GTA", "Khawla Ourahou", 46335],
    ["Youssef touili", "GTA", "No date", ""],
    ["", "", "", ""],
    ["Updated 2026-11-15 21:15", "", "", ""],
  ];

  it("counts assigned, dated rows and skips Unassigned and the footer", () => {
    const r = parseActivityTab(rows, TAB_SPECS.ogxApprovals);
    expect(r.records.map((x) => [x.rawName, x.date, x.amount, x.row])).toEqual([
      ["Amna Riahi", "2026-11-14", 1, 3],
      ["aymen zouaoui", "2026-11-09", 1, 4],
    ]);
    expect(r.unassigned).toBe(1);
    expect(r.updatedAt).toBe("2026-11-15 21:15");
    expect(r.warnings.join(" ")).toMatch(/1 row\(s\) have a member but no readable date/);
  });
});

describe("IGV Approvals", () => {
  it("uses Ep Buddy as the member, reads dd/mm dates, skips rejected statuses", () => {
    const r = parseActivityTab(
      [
        ["Ep Buddy", "Full Name", "Status", "Approval Date"],
        ["Chahd souilmi", "hichem BELLIFA", "Approved", "21/03/2026"],
        ["Omar Hamdi", "x", "Break approval", "03/04/2026"],
      ],
      TAB_SPECS.igvApprovals,
    );
    expect(r.records).toEqual([{ source: "igvApprovals", metric: "approvals", rawName: "Chahd souilmi", date: "2026-03-21", amount: 1, row: 2 }]);
  });
});

describe("Opens", () => {
  it("adds up Number of Openings (blank = 1)", () => {
    const r = parseActivityTab(
      [
        ["Member Name", "Customer Name", "Product", "Closing Date", "Number of Openings"],
        ["Fares Guen", "ACME", "GTa", "2026-10-01", 3],
        ["Fares Guen", "Beta", "GTe", "2026-10-02", ""],
      ],
      TAB_SPECS.igtOpens,
    );
    expect(r.records.map((x) => x.amount)).toEqual([3, 1]);
  });
});

describe("OC Revenus", () => {
  it("parses amounts written in different ways and skips non-numbers", () => {
    const r = parseActivityTab(
      [
        ["Member Name", "Customer Name", "Closing Date", "Amount"],
        ["Emna Riahi", "A", "2026-10-01", "1 500,5 DT"],
        ["Emna Riahi", "B", "2026-10-02", 700],
        ["Emna Riahi", "C", "2026-10-03", "soon"],
      ],
      TAB_SPECS.ocRevenue,
    );
    expect(r.records.map((x) => x.amount)).toEqual([1500.5, 700]);
    expect(r.warnings).toHaveLength(1);
  });

  it("parseAmount handles common formats", () => {
    expect(parseAmount("2000")).toBe(2000);
    expect(parseAmount("1,500")).toBe(1500);
    expect(parseAmount("12,5")).toBe(12.5);
    expect(parseAmount("3 000 TND")).toBe(3000);
    expect(parseAmount("")).toBeNull();
  });
});

describe("Referrals", () => {
  const header = ["Horodateur", "Lead Name", "Email", "Phone Number", "University", "Field of study", "Year of study", "Product Interested in", "Member Name", "Department"];

  it("doesn't count anything until the approved column exists", () => {
    const r = parseActivityTab([header, ["15/11/2026 10:00:00", "Lead", "", "", "", "", "", "", "Doua Mani", "TM"]], TAB_SPECS.referrals);
    expect(r.records).toEqual([]);
    expect(r.warnings[0]).toMatch(/approved/);
  });

  it("counts only referrals marked yes", () => {
    const r = parseActivityTab(
      [
        [...header, "Approved"],
        ["15/11/2026 10:00:00", "Lead A", "", "", "", "", "", "", "Doua Mani", "TM", "Yes"],
        ["15/11/2026 11:00:00", "Lead B", "", "", "", "", "", "", "Doua Mani", "TM", "no"],
        ["15/11/2026 12:00:00", "Lead C", "", "", "", "", "", "", "Doua Mani", "TM", ""],
      ],
      TAB_SPECS.referrals,
    );
    expect(r.records.map((x) => x.rawName)).toEqual(["Doua Mani"]);
  });
});

describe("Signups", () => {
  it("takes the first filled of the three Member Name columns", () => {
    const r = parseActivityTab(
      [
        ["Submitted at", "🙋Member Name", "🙋Member Name", "🙋Member Name"],
        ["2026-01-26 9:20:21", "", "", "Malek Elfahem"],
        ["2026-01-26 9:22:22", "Hiba Allah Aleya", "", ""],
        ["2026-01-26 9:23:37", "", "", ""],
      ],
      TAB_SPECS.signups,
    );
    expect(r.records.map((x) => x.rawName)).toEqual(["Malek Elfahem", "Hiba Allah Aleya"]);
  });

  it("downloads only the date and member columns", () => {
    const header = ["EXPA ID", "Submission ID", "Respondent ID", "Submitted at", "[FN] First Name", "[LN] Last Name", "[E] Email", "[PN] Phone Number", "[UN] University Name", "🌍 Type", "📢 Referral", "🙋Member Name", "🙋Member Name", "🙋Member Name"];
    expect(signupColumns(header).columns.map(columnLetter)).toEqual(["D", "L", "M", "N"]);
  });
});

describe("Departments", () => {
  it("reads name, department and OC flag in any case", () => {
    const { members } = parseDepartments([
      ["Ahmed Attia", "IGV", "yes"],
      ["Med Amine Touati", "PM", "Yes"],
      ["Issa Elj", "MKT", "no"],
      ["", "", ""],
    ]);
    expect(members).toEqual([
      { name: "Ahmed Attia", department: "IGV", isOC: true },
      { name: "Med Amine Touati", department: "PM", isOC: true },
      { name: "Issa Elj", department: "MKT", isOC: false },
    ]);
  });
});
