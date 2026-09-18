// =============================================================
// The weekly report as the Excel workbook the stores used to fill in by hand —
// the same sheets, columns and cross-sheet formulas, built from the report.
//
// Every formula cell also carries its computed result, so a mail client's
// preview (which never recalculates) shows figures rather than blanks, and
// the Summary's results come from generateWeeklySummary — the attachment can
// never disagree with the email body or the screen.
// =============================================================

import ExcelJS from "exceljs";
import {
  aggregatorRows,
  groupSupplierLines,
  invoiceColumnCount,
  labourLineTotals,
  lineAmount,
  lineVat,
  num,
  round2,
  sectionTotals,
  transferTitle,
  VAT_RATE,
  type ReportSection,
  type WeeklyReportLabourLine,
  type WeeklyReportLine,
  type WeeklyReportSnapshot,
} from "./weekly-report";
import { generateWeeklySummary } from "./vm-analytics/weekly-summary";
import { CHANNEL_COLUMNS, type ChannelWeek } from "./weekly-report-channels";
import { addDays, parseISODate, toISODate } from "./utils";

export type WorkbookInput = {
  storeName: string;
  weekStart: string;
  snapshot: WeeklyReportSnapshot;
  lines: WeeklyReportLine[];
  labour: WeeklyReportLabourLine[];
  showMeppershall: boolean;
  platformSales: Array<{ platform: string; sales: number }>;
  channelWeeks: ChannelWeek[];
};

const GBP = '"£"#,##0.00';
const PCT = "0.00%";
const DATE = "dd/mm/yyyy";
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};
const HIGHLIGHT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};

const SHEET = {
  summary: "Weekly Summary",
  channels: "Sale By Channel",
  cogs: "Cost Of Goods",
  walkern: "COGS Walkern",
  fillings: "Samosas Fillings",
  labour: "Labour Cost",
  occupancy: "Occupancy Costs",
  aggregator: "Aggregator Cost",
  expenses: "Weekly Expense Sheet",
} as const;

const ref = (sheet: string, cell: string) => `'${sheet}'!${cell}`;

function excelDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formula(cell: ExcelJS.Cell, expr: string, result: number | string, fmt?: string) {
  cell.value = { formula: expr, result };
  if (fmt) cell.numFmt = fmt;
}

/** ROUND(x,2) as Excel computes it — on 15 significant digits, so 131.025 goes up. */
function excelRound2(n: number): number {
  return Math.round(parseFloat((n * 100).toPrecision(15))) / 100;
}

/**
 * A rounded product as a live formula — unless Excel would round it to a
 * different penny than the app did. round2 misses some exact half-pennies
 * (17.47 x 7.50 = 131.025 stays 131.02), and the sheet must total what the
 * P&L used, so those cells carry the app's figure instead.
 */
function roundedProduct(cell: ExcelJS.Cell, expr: string, raw: number, appValue: number) {
  if (excelRound2(raw) === appValue) formula(cell, `ROUND(${expr},2)`, appValue, GBP);
  else money(cell, appValue);
}

function money(cell: ExcelJS.Cell, value: number | null) {
  cell.value = value;
  cell.numFmt = GBP;
}

function title(ws: ExcelJS.Worksheet, range: string, text: string) {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(":")[0]);
  cell.value = text;
  cell.font = { bold: true, size: 16 };
  cell.alignment = { vertical: "middle" };
}

function weekCommencing(ws: ExcelJS.Worksheet, labelRange: string, dateCell: string, weekStart: string) {
  ws.mergeCells(labelRange);
  const label = ws.getCell(labelRange.split(":")[0]);
  label.value = "Week Commencing:";
  label.font = { bold: true };
  const date = ws.getCell(dateCell);
  date.value = excelDate(weekStart);
  date.numFmt = DATE;
  date.font = { bold: true };
}

function headerRow(ws: ExcelJS.Worksheet, row: number, startCol: number, labels: string[]) {
  labels.forEach((text, i) => {
    const cell = ws.getRow(row).getCell(startCol + i);
    cell.value = text;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin" } };
  });
}

function widths(ws: ExcelJS.Worksheet, cols: Record<string, number>) {
  for (const [col, width] of Object.entries(cols)) ws.getColumn(col).width = width;
}

function colLetter(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function linesOf(lines: WeeklyReportLine[], section: ReportSection) {
  return lines
    .filter((l) => l.section === section)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** A plain Item | Amount list with a SUM total. Returns the total's cell. */
function amountList(
  ws: ExcelJS.Worksheet,
  startRow: number,
  labelHeading: string,
  lines: WeeklyReportLine[],
): string {
  headerRow(ws, startRow, 1, [labelHeading, "Amount", "Note"]);
  let r = startRow + 1;
  for (const line of lines) {
    ws.getCell(`A${r}`).value = line.label;
    money(ws.getCell(`B${r}`), lineAmount(line));
    ws.getCell(`C${r}`).value = line.note ?? null;
    r++;
  }
  const first = startRow + 1;
  const last = Math.max(first, r - 1);
  const totalRow = Math.max(r, first + 1);
  ws.getCell(`A${totalRow}`).value = "Total";
  ws.getCell(`A${totalRow}`).font = { bold: true };
  const total = round2(lines.reduce((t, l) => t + lineAmount(l), 0));
  formula(ws.getCell(`B${totalRow}`), `SUM(B${first}:B${last})`, total, GBP);
  ws.getCell(`B${totalRow}`).font = { bold: true };
  return `B${totalRow}`;
}

// ---------------- sheets ----------------

function costOfGoodsSheet(wb: ExcelJS.Workbook, input: WorkbookInput): string {
  const ws = wb.addWorksheet(SHEET.cogs);
  title(ws, "A1:E2", "COST OF GOODS");
  weekCommencing(ws, "A4:B4", "C4", input.weekStart);

  const groups = groupSupplierLines(linesOf(input.lines, "cogs_supplier"));
  const invoices = invoiceColumnCount(groups);
  const totalCol = colLetter(invoices + 2);
  const lastInvoiceCol = colLetter(invoices + 1);
  headerRow(ws, 6, 1, [
    "Supplier",
    ...Array.from({ length: invoices }, (_, i) => `Invoice ${i + 1}`),
    "Total",
  ]);

  let r = 8;
  for (const g of groups) {
    ws.getCell(`A${r}`).value = g.label;
    ws.getCell(`A${r}`).font = { bold: true };
    g.invoices.slice(0, invoices).forEach((inv, i) => money(ws.getRow(r).getCell(i + 2), lineAmount(inv)));
    // Beyond the widest column the screen shows, fold the rest into the last
    // invoice cell so the row still totals what was entered.
    if (g.invoices.length > invoices) {
      const overflow = g.invoices.slice(invoices - 1).reduce((t, l) => t + lineAmount(l), 0);
      money(ws.getRow(r).getCell(invoices + 1), round2(overflow));
    }
    formula(ws.getCell(`${totalCol}${r}`), `SUM(B${r}:${lastInvoiceCol}${r})`, g.total, GBP);
    r++;
  }

  const totalRow = Math.max(r, 9);
  ws.getCell(`A${totalRow}`).value = "Totals";
  ws.getCell(`A${totalRow}`).font = { bold: true };
  formula(
    ws.getCell(`${totalCol}${totalRow}`),
    `SUM(${totalCol}8:${totalCol}${Math.max(8, totalRow - 1)})`,
    round2(groups.reduce((t, g) => t + g.total, 0)),
    GBP,
  );
  ws.getCell(`${totalCol}${totalRow}`).font = { bold: true };

  widths(ws, { A: 24 });
  for (let c = 2; c <= invoices + 2; c++) ws.getColumn(c).width = 13;
  return ref(SHEET.cogs, `${totalCol}${totalRow}`);
}

function walkernSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = wb.addWorksheet(SHEET.walkern);
  ws.getCell("A1").value = "Products sent to Walkern";
  ws.getCell("A1").font = { bold: true };
  amountList(ws, 2, "Item", linesOf(input.lines, "cogs_walkern"));
  widths(ws, { A: 28, B: 14, C: 24 });
}

function transferSheet(wb: ExcelJS.Workbook, input: WorkbookInput): string {
  const name = transferTitle(input.storeName);
  const ws = wb.addWorksheet(name);
  ws.getCell("A1").value = name;
  ws.getCell("A1").font = { bold: true };
  const total = amountList(ws, 2, "Item", linesOf(input.lines, "cogs_hitchin"));
  widths(ws, { A: 28, B: 14, C: 24 });
  return ref(name, total);
}

/**
 * One qty x rate block (rice bowls, samosas, spring rolls). The line's stored
 * amount is what the P&L used, so it stays a value whenever it is not exactly
 * the product — a rate edited after the line was saved must not restate it.
 */
function qtyRateBlock(
  ws: ExcelJS.Worksheet,
  col: number,
  startRow: number,
  heading: string,
  labelHeading: string,
  lines: WeeklyReportLine[],
): { totalCell: string; endRow: number } {
  const [L, Q, R, A] = [0, 1, 2, 3].map((i) => colLetter(col + i));
  ws.getCell(`${L}${startRow}`).value = heading;
  ws.getCell(`${L}${startRow}`).font = { bold: true };
  headerRow(ws, startRow + 1, col, [labelHeading, "No of units", "Rate", "In pounds"]);
  let r = startRow + 2;
  for (const line of lines) {
    ws.getCell(`${L}${r}`).value = line.label;
    ws.getCell(`${Q}${r}`).value = num(line.qty);
    money(ws.getCell(`${R}${r}`), num(line.unit_rate));
    roundedProduct(ws.getCell(`${A}${r}`), `${Q}${r}*${R}${r}`, num(line.qty) * num(line.unit_rate), lineAmount(line));
    r++;
  }
  const first = startRow + 2;
  const totalRow = Math.max(r, first + 1);
  ws.getCell(`${L}${totalRow}`).value = "Total";
  ws.getCell(`${L}${totalRow}`).font = { bold: true };
  formula(
    ws.getCell(`${A}${totalRow}`),
    `SUM(${A}${first}:${A}${Math.max(first, totalRow - 1)})`,
    round2(lines.reduce((t, l) => t + lineAmount(l), 0)),
    GBP,
  );
  ws.getCell(`${A}${totalRow}`).font = { bold: true };
  return { totalCell: `${A}${totalRow}`, endRow: totalRow };
}

function fillingsSheet(wb: ExcelJS.Workbook, input: WorkbookInput): string {
  const ws = wb.addWorksheet(SHEET.fillings);

  const rice = qtyRateBlock(ws, 1, 1, "Rice Bowls", "Day", linesOf(input.lines, "rice_bowls"));

  const fillingLines = linesOf(input.lines, "fillings");
  ws.getCell("F1").value = "Fillings";
  ws.getCell("F1").font = { bold: true };
  headerRow(ws, 2, 6, ["Site", "Amount"]);
  let r = 3;
  for (const line of fillingLines) {
    ws.getCell(`F${r}`).value = line.label;
    money(ws.getCell(`G${r}`), lineAmount(line));
    r++;
  }
  const fillingsTotalRow = Math.max(r, 4);
  ws.getCell(`F${fillingsTotalRow}`).value = "Total";
  ws.getCell(`F${fillingsTotalRow}`).font = { bold: true };
  formula(
    ws.getCell(`G${fillingsTotalRow}`),
    `SUM(G3:G${Math.max(3, fillingsTotalRow - 1)})`,
    round2(fillingLines.reduce((t, l) => t + lineAmount(l), 0)),
    GBP,
  );
  ws.getCell(`G${fillingsTotalRow}`).font = { bold: true };

  const samosas = qtyRateBlock(ws, 9, 1, "Samosas", "Site", linesOf(input.lines, "samosas"));
  const springRolls = qtyRateBlock(
    ws,
    9,
    samosas.endRow + 2,
    "Spring Rolls",
    "Day",
    linesOf(input.lines, "spring_rolls"),
  );

  const grandRow = Math.max(rice.endRow, fillingsTotalRow, springRolls.endRow) + 2;
  ws.getCell(`A${grandRow}`).value = "TOTAL";
  ws.getCell(`A${grandRow}`).font = { bold: true };
  const totals = sectionTotals(input.lines);
  formula(
    ws.getCell(`B${grandRow}`),
    `${rice.totalCell}+G${fillingsTotalRow}+${samosas.totalCell}+${springRolls.totalCell}`,
    round2(totals.rice_bowls + totals.fillings + totals.samosas + totals.spring_rolls),
    GBP,
  );
  ws.getCell(`B${grandRow}`).font = { bold: true };

  widths(ws, { A: 14, B: 12, C: 10, D: 12, E: 3, F: 16, G: 12, H: 3, I: 18, J: 12, K: 10, L: 12 });
  return ref(SHEET.fillings, `B${grandRow}`);
}

function labourSheet(wb: ExcelJS.Workbook, input: WorkbookInput): string {
  const ws = wb.addWorksheet(SHEET.labour);
  title(ws, "A1:F2", "Labour Costs");
  weekCommencing(ws, "A4:B4", "C4", input.weekStart);
  headerRow(ws, 7, 1, [
    "Name",
    "Hours worked",
    "NI Hours worked",
    "NI Pay",
    "NI Total",
    "Cash Hours",
    "Cash Pay",
    "Cash Total",
    "Deliveries",
    "Delivery Pay",
    "Total Pay",
    "Cash pay",
  ]);

  const suffix = { employee: "", adhoc: "", cover_driver: " (Cover)", manager: " (Manager)" } as const;
  const lines = [...input.labour].sort((a, b) => a.sort_order - b.sort_order);
  let r = 8;
  for (const l of lines) {
    const t = labourLineTotals(l);
    ws.getCell(`A${r}`).value = `${l.person_name}${suffix[l.source]}`;
    formula(ws.getCell(`B${r}`), `C${r}+F${r}`, t.hours);
    ws.getCell(`C${r}`).value = num(l.ni_hours);
    money(ws.getCell(`D${r}`), num(l.ni_rate));
    roundedProduct(ws.getCell(`E${r}`), `C${r}*D${r}`, num(l.ni_hours) * num(l.ni_rate), t.ni_total);
    ws.getCell(`F${r}`).value = num(l.cash_hours);
    money(ws.getCell(`G${r}`), num(l.cash_rate));
    roundedProduct(ws.getCell(`H${r}`), `F${r}*G${r}`, num(l.cash_hours) * num(l.cash_rate), t.cash_total);
    ws.getCell(`I${r}`).value = l.deliveries ?? 0;
    money(ws.getCell(`J${r}`), t.delivery_pay);
    formula(ws.getCell(`K${r}`), `E${r}+H${r}+J${r}`, t.total_pay, GBP);
    formula(ws.getCell(`L${r}`), `H${r}+J${r}`, round2(t.cash_total + t.delivery_pay), GBP);
    r++;
  }

  const totalRow = Math.max(r, 9);
  const last = Math.max(8, totalRow - 1);
  ws.getCell(`A${totalRow}`).value = "Total";
  const sum = (pick: (t: ReturnType<typeof labourLineTotals>, l: WeeklyReportLabourLine) => number) =>
    round2(lines.reduce((acc, l) => acc + pick(labourLineTotals(l), l), 0));
  const totals: Array<[string, number, string | undefined]> = [
    ["B", sum((t) => t.hours), undefined],
    ["C", sum((_, l) => num(l.ni_hours)), undefined],
    ["E", sum((t) => t.ni_total), GBP],
    ["F", sum((_, l) => num(l.cash_hours)), undefined],
    ["H", sum((t) => t.cash_total), GBP],
    ["I", sum((_, l) => l.deliveries ?? 0), undefined],
    ["J", sum((t) => t.delivery_pay), GBP],
    ["K", sum((t) => t.total_pay), GBP],
    ["L", sum((t) => t.cash_total + t.delivery_pay), GBP],
  ];
  for (const [col, result, fmt] of totals) {
    formula(ws.getCell(`${col}${totalRow}`), `SUM(${col}8:${col}${last})`, result, fmt);
  }
  ws.getRow(totalRow).font = { bold: true };

  widths(ws, { A: 26, B: 13, C: 15, D: 10, E: 12, F: 11, G: 10, H: 12, I: 11, J: 12, K: 12, L: 12 });
  return ref(SHEET.labour, `K${totalRow}`);
}

function occupancySheet(wb: ExcelJS.Workbook, input: WorkbookInput): string {
  const ws = wb.addWorksheet(SHEET.occupancy);
  title(ws, "A1:H2", "Fixed Costs");
  weekCommencing(ws, "A4:B4", "C4", input.weekStart);
  ws.getCell("A8").value = "Occupancy Costs";
  ws.getCell("A8").font = { bold: true };

  const lines = linesOf(input.lines, "occupancy");
  let r = 10;
  for (const line of lines) {
    ws.getCell(`A${r}`).value = line.label;
    money(ws.getCell(`B${r}`), lineAmount(line));
    r++;
  }
  const totalRow = Math.max(r, 11) + 2;
  ws.getCell(`A${totalRow}`).value = "Total";
  ws.getCell(`A${totalRow}`).font = { bold: true };
  // Every line — the old sheet's SUM(B11:…) skipped the first cost.
  formula(
    ws.getCell(`B${totalRow}`),
    `SUM(B10:B${Math.max(10, r - 1)})`,
    round2(lines.reduce((t, l) => t + lineAmount(l), 0)),
    GBP,
  );
  ws.getCell(`B${totalRow}`).font = { bold: true };
  widths(ws, { A: 22, B: 13 });
  return ref(SHEET.occupancy, `B${totalRow}`);
}

function aggregatorSheet(wb: ExcelJS.Workbook, input: WorkbookInput): string {
  const ws = wb.addWorksheet(SHEET.aggregator);
  ws.getCell("A1").value = "Aggregator Cost";
  ws.getCell("A1").font = { bold: true };
  headerRow(ws, 2, 1, ["Platform", "Sales", "Commission", "Income", "% of Sales"]);

  const sales = new Map(input.platformSales.map((p) => [p.platform, p.sales]));
  const rows = aggregatorRows(input.lines, sales);
  rows.forEach((row, i) => {
    const r = 3 + i;
    ws.getCell(`A${r}`).value = row.platform;
    ws.getCell(`A${r}`).font = { bold: true };
    money(ws.getCell(`B${r}`), row.sales);
    money(ws.getCell(`C${r}`), row.commission);
    formula(ws.getCell(`D${r}`), `B${r}-C${r}`, row.income, GBP);
    formula(ws.getCell(`E${r}`), `IF(B${r}=0,0,C${r}/B${r})`, row.commission_pct, PCT);
  });

  const totalRow = 3 + rows.length + 1;
  const last = 2 + rows.length;
  const t = (pick: (r: (typeof rows)[number]) => number) => round2(rows.reduce((a, r) => a + pick(r), 0));
  ws.getCell(`A${totalRow}`).value = "Total Cost";
  formula(ws.getCell(`B${totalRow}`), `SUM(B3:B${last})`, t((r) => r.sales), GBP);
  formula(ws.getCell(`C${totalRow}`), `SUM(C3:C${last})`, t((r) => r.commission), GBP);
  formula(ws.getCell(`D${totalRow}`), `SUM(D3:D${last})`, t((r) => r.income), GBP);
  const totalSales = t((r) => r.sales);
  formula(
    ws.getCell(`E${totalRow}`),
    `IF(B${totalRow}=0,0,C${totalRow}/B${totalRow})`,
    totalSales > 0 ? t((r) => r.commission) / totalSales : 0,
    PCT,
  );
  ws.getRow(totalRow).font = { bold: true };
  widths(ws, { A: 16, B: 13, C: 14, D: 13, E: 12 });
  return ref(SHEET.aggregator, `C${totalRow}`);
}

function expenseSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = wb.addWorksheet(SHEET.expenses);
  title(ws, "A1:I2", "Expense Sheet");
  weekCommencing(ws, "A6:B6", "D6", input.weekStart);
  headerRow(ws, 8, 1, ["Date", "Place", "Pay Method", "Amount", "VAT"]);

  const lines = linesOf(input.lines, "expense");
  let r = 9;
  for (const line of lines) {
    if (line.entry_date) {
      ws.getCell(`A${r}`).value = excelDate(line.entry_date);
      ws.getCell(`A${r}`).numFmt = DATE;
    }
    ws.getCell(`B${r}`).value = line.label;
    ws.getCell(`C${r}`).value = line.note ?? null;
    money(ws.getCell(`D${r}`), lineAmount(line));
    const vat = lineVat(line);
    if (line.vat_amount != null && line.vat_amount !== "") money(ws.getCell(`E${r}`), vat);
    else roundedProduct(ws.getCell(`E${r}`), `D${r}*${VAT_RATE}`, lineAmount(line) * VAT_RATE, vat);
    r++;
  }
  const totalRow = Math.max(r, 10) + 1;
  const last = Math.max(9, r - 1);
  ws.getCell(`A${totalRow}`).value = "Total";
  formula(
    ws.getCell(`D${totalRow}`),
    `SUM(D9:D${last})`,
    round2(lines.reduce((t, l) => t + lineAmount(l), 0)),
    GBP,
  );
  formula(
    ws.getCell(`E${totalRow}`),
    `SUM(E9:E${last})`,
    round2(lines.reduce((t, l) => t + lineVat(l), 0)),
    GBP,
  );
  ws.getRow(totalRow).font = { bold: true };
  widths(ws, { A: 12, B: 24, C: 14, D: 12, E: 11 });
}

function channelsSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = wb.addWorksheet(SHEET.channels, { views: [{ state: "frozen", ySplit: 2 }] });
  ws.mergeCells("A1:R1");
  ws.getCell("A1").value = input.storeName.replace(/peckers/i, "").trim().toUpperCase();
  ws.getCell("A1").font = { bold: true, size: 14 };
  headerRow(ws, 2, 1, [
    "Week",
    ...CHANNEL_COLUMNS.map((c) => c.vm),
    "Last year sales",
    "Total sales",
    "YOY",
    "Instore sales",
    "Aggregators (excluding own)",
    "Deliveries",
    "Percentage instore",
    "Percentage deliveries",
    "Takeaway and click and collect",
  ]);

  const rowOf = new Map<string, number>();
  const totalOf = new Map<string, number>();
  input.channelWeeks.forEach((w, i) => {
    rowOf.set(w.week_start, 3 + i);
    totalOf.set(w.week_start, round2(w.sales.reduce<number>((t, v) => t + (v ?? 0), 0)));
  });

  for (const w of input.channelWeeks) {
    const r = rowOf.get(w.week_start)!;
    const [cc, dr, je, ki, od, ue, te, tt] = w.sales.map((v) => v ?? 0);
    const total = totalOf.get(w.week_start)!;

    ws.getCell(`A${r}`).value = excelDate(w.week_start);
    ws.getCell(`A${r}`).numFmt = DATE;
    w.sales.forEach((v, i) => money(ws.getRow(r).getCell(i + 2), v));

    // Last year = the same week 52 weeks back, exactly as the typed sheet did.
    const lastYearWeek = toISODate(addDays(parseISODate(w.week_start), -364));
    const lastYearRow = rowOf.get(lastYearWeek);
    let lastYear: number | null = w.typed_last_year;
    if (lastYear != null) money(ws.getCell(`J${r}`), lastYear);
    else if (lastYearRow) {
      lastYear = totalOf.get(lastYearWeek)!;
      formula(ws.getCell(`J${r}`), `K${lastYearRow}`, lastYear, GBP);
    }

    formula(ws.getCell(`K${r}`), `SUM(B${r}:I${r})`, total, GBP);
    if (lastYear) {
      formula(ws.getCell(`L${r}`), `IF(J${r}=0,"",(K${r}-J${r})/J${r})`, (total - lastYear) / lastYear, PCT);
    }
    const instore = round2(cc + ki + te + tt);
    const aggregators = round2(dr + je + ue);
    formula(ws.getCell(`M${r}`), `B${r}+E${r}+H${r}+I${r}`, instore, GBP);
    formula(ws.getCell(`N${r}`), `C${r}+D${r}+G${r}`, aggregators, GBP);
    formula(ws.getCell(`O${r}`), `N${r}+F${r}`, round2(aggregators + od), GBP);
    formula(ws.getCell(`P${r}`), `IF(K${r}=0,0,M${r}/K${r})`, total ? instore / total : 0, PCT);
    formula(ws.getCell(`Q${r}`), `IF(K${r}=0,0,O${r}/K${r})`, total ? (aggregators + od) / total : 0, PCT);
    formula(ws.getCell(`R${r}`), `B${r}+I${r}`, round2(cc + tt), GBP);

    if (w.week_start === input.weekStart) {
      for (let c = 1; c <= 18; c++) ws.getRow(r).getCell(c).fill = HIGHLIGHT_FILL;
    }
  }

  ws.getColumn(1).width = 12;
  for (let c = 2; c <= 18; c++) ws.getColumn(c).width = c >= 13 ? 18 : 14;
}

function summarySheet(
  ws: ExcelJS.Worksheet,
  input: WorkbookInput,
  refs: { cogs: string; transfer: string; fillings: string; labour: string; occupancy: string; aggregator: string },
) {
  const { snapshot } = input;
  const inputs = snapshot.inputs;
  const summary = generateWeeklySummary(
    { gross_sales: snapshot.gross_sales, net_sales: snapshot.net_sales },
    inputs,
  );
  const metric = (entity: string) => summary.metrics.find((m) => m.entity === entity)!;
  const hasTransferLines = input.lines.some((l) => l.section === "cogs_hitchin");

  title(ws, "A1:H2", `${input.storeName} Weekly P&L Summary`);
  weekCommencing(ws, "A4:B4", "C4", input.weekStart);
  ["Actual", "Budget", "Variance"].forEach((h, i) => {
    const cell = ws.getRow(6).getCell(2 + i);
    cell.value = h;
    cell.font = { bold: true };
  });

  const label = (r: number, text: string) => {
    ws.getCell(`A${r}`).value = text;
    ws.getCell(`A${r}`).font = { bold: true };
  };

  let r = 8;
  const GROSS = r;
  label(r, "Gross Sales");
  money(ws.getCell(`B${r++}`), snapshot.gross_sales);
  const NET = r;
  label(r, "Net Sales");
  money(ws.getCell(`B${r++}`), snapshot.net_sales);
  const COGS = r;
  label(r, "COGS");
  formula(ws.getCell(`B${r++}`), refs.cogs, num(inputs.cogs), GBP);
  const TRANSFER = r;
  label(r, transferTitle(input.storeName));
  if (hasTransferLines) formula(ws.getCell(`B${r++}`), refs.transfer, num(inputs.cogs_hitchin), GBP);
  else money(ws.getCell(`B${r++}`), num(inputs.cogs_hitchin));
  const FILLINGS = r;
  label(r, "Fillings and Samosas");
  formula(ws.getCell(`B${r++}`), refs.fillings, num(inputs.fillings_and_samosas), GBP);
  let meppershallTerm = "";
  if (input.showMeppershall) {
    label(r, "Meppershall");
    money(ws.getCell(`B${r}`), num(inputs.meppershall));
    meppershallTerm = `+B${r}`;
    r++;
  }

  const gm = metric("Gross Margin");
  const GM = r;
  label(r, "Gross Margin");
  formula(ws.getCell(`B${GM}`), `B${NET}-B${COGS}+B${TRANSFER}+B${FILLINGS}${meppershallTerm}`, gm.actual ?? 0, GBP);
  formula(ws.getCell(`C${GM}`), `C${GM + 1}*B${NET}`, gm.budget ?? 0, GBP);
  formula(ws.getCell(`D${GM}`), `B${GM}-C${GM}`, gm.variance ?? 0, GBP);
  formula(ws.getCell(`B${GM + 1}`), `IF(B${NET}=0,0,B${GM}/B${NET})`, gm.actual_pct ?? 0, PCT);
  ws.getCell(`C${GM + 1}`).value = num(inputs.gross_margin_budget_pct);
  ws.getCell(`C${GM + 1}`).numFmt = PCT;
  formula(ws.getCell(`D${GM + 1}`), `B${GM + 1}-C${GM + 1}`, gm.variance_pct ?? 0, PCT);
  r = GM + 3;

  const PACKAGING = r;
  label(r, "Packaging Costs");
  money(ws.getCell(`B${r++}`), num(inputs.packaging_costs));
  label(r, "Marketing");
  money(ws.getCell(`B${r++}`), num(inputs.marketing));
  r++;

  const labour = metric("Labour");
  const LAB = r;
  label(r, "Labour");
  formula(ws.getCell(`B${LAB}`), refs.labour, labour.actual ?? 0, GBP);
  formula(ws.getCell(`C${LAB}`), `C${LAB + 1}*B${NET}`, labour.budget ?? 0, GBP);
  formula(ws.getCell(`D${LAB}`), `C${LAB}-B${LAB}`, labour.variance ?? 0, GBP);
  formula(ws.getCell(`B${LAB + 1}`), `IF(B${NET}=0,0,B${LAB}/B${NET})`, labour.actual_pct ?? 0, PCT);
  ws.getCell(`C${LAB + 1}`).value = num(inputs.labour_budget_pct);
  ws.getCell(`C${LAB + 1}`).numFmt = PCT;
  formula(ws.getCell(`D${LAB + 1}`), `C${LAB + 1}-B${LAB + 1}`, labour.variance_pct ?? 0, PCT);
  r = LAB + 3;

  const occ = metric("Occupancy Costs");
  const OCC = r;
  label(r, "Occupancy Costs");
  formula(ws.getCell(`B${OCC}`), refs.occupancy, occ.actual ?? 0, GBP);
  formula(ws.getCell(`B${OCC + 1}`), `IF(B${NET}=0,0,B${OCC}/B${NET})`, occ.actual_pct ?? 0, PCT);
  r = OCC + 3;

  const sc = metric("Store Contribution");
  const SC = r;
  label(r, "Store Contribution");
  formula(ws.getCell(`B${SC}`), `B${GM}-B${LAB}-B${OCC}-B${PACKAGING}`, sc.actual ?? 0, GBP);
  formula(ws.getCell(`B${SC + 1}`), `IF(B${NET}=0,0,B${SC}/B${NET})`, sc.actual_pct ?? 0, PCT);
  r = SC + 3;

  const AGG = r;
  label(r, "Aggregator Costs");
  formula(ws.getCell(`B${AGG}`), refs.aggregator, num(inputs.aggregator_costs), GBP);
  r = AGG + 2;

  const nm = metric("Net Margin");
  label(r, "Net Margin");
  formula(ws.getCell(`B${r}`), `B${SC}-B${AGG}`, nm.actual ?? 0, GBP);
  // On GROSS sales, as the workbook and the screen both measure it.
  formula(ws.getCell(`B${r + 1}`), `IF(B${GROSS}=0,0,B${r}/B${GROSS})`, nm.actual_pct ?? 0, PCT);

  widths(ws, { A: 24, B: 16, C: 16, D: 16 });
}

// ---------------- entry point ----------------

export async function buildWeeklyReportWorkbook(input: WorkbookInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Peckers";
  wb.created = new Date();

  // Summary first so it opens on it; its formulas point at sheets added after.
  const summary = wb.addWorksheet(SHEET.summary);
  channelsSheet(wb, input);
  const cogs = costOfGoodsSheet(wb, input);
  walkernSheet(wb, input);
  const fillings = fillingsSheet(wb, input);
  const labour = labourSheet(wb, input);
  const occupancy = occupancySheet(wb, input);
  const aggregator = aggregatorSheet(wb, input);
  expenseSheet(wb, input);
  const transfer = transferSheet(wb, input);

  summarySheet(summary, input, { cogs, transfer, fillings, labour, occupancy, aggregator });

  // Excel recalculates on open, so an edit to any sheet flows to the Summary.
  wb.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function workbookFileName(storeName: string, weekStart: string): string {
  const store = storeName.replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/\s+/g, "-");
  return `Weekly-Report-${store}-${weekStart}.xlsx`;
}
