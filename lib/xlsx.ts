// Minimal .xlsx writer — one sheet, no dependencies. A real workbook rather than a
// CSV because Excel opens a BOM-less CSV as Windows-1252 and mangles "–" and "£".

export type XlsxFormat = "text" | "wrap" | "int" | "decimal" | "gbp";
export type XlsxCell = string | number | null | undefined;

export interface XlsxColumn {
  header: string;
  width: number;
  format?: XlsxFormat;
  /** Adds a SUM formula for this column to the totals row. */
  sum?: boolean;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
  /** Fixed height (points) for data rows — needed for wrapped cells to show every line. */
  rowHeight?: number;
  /** When set, a bold totals row is appended with this label in column A. */
  totalLabel?: string;
  /** Columns kept visible while scrolling sideways. */
  freezeColumns?: number;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// cellXfs order in styles.xml: plain formats, then the header, then bold copies for totals.
const FORMATS: XlsxFormat[] = ["text", "wrap", "int", "decimal", "gbp"];
const HEADER_STYLE = FORMATS.length;
const styleOf = (format: XlsxFormat = "text", bold = false) =>
  FORMATS.indexOf(format) + (bold ? FORMATS.length + 1 : 0);

function escapeXml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function cellXml(ref: string, value: XlsxCell, style: number): string {
  if (value == null || value === "") return style ? `<c r="${ref}" s="${style}"/>` : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    String(value),
  )}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const { columns, rows } = sheet;
  const freeze = sheet.freezeColumns ?? 0;
  const topLeft = `${colName(freeze)}2`;
  const pane = `<pane ${freeze ? `xSplit="${freeze}" ` : ""}ySplit="1" topLeftCell="${topLeft}" activePane="${
    freeze ? "bottomRight" : "bottomLeft"
  }" state="frozen"/>`;

  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join("");

  const header = `<row r="1" ht="32" customHeight="1">${columns
    .map((c, i) => cellXml(`${colName(i)}1`, c.header, HEADER_STYLE))
    .join("")}</row>`;

  const height = sheet.rowHeight ? ` ht="${sheet.rowHeight}" customHeight="1"` : "";
  const body = rows
    .map((row, r) => {
      const rowNum = r + 2;
      const cells = columns
        .map((c, i) => cellXml(`${colName(i)}${rowNum}`, row[i], styleOf(c.format)))
        .join("");
      return `<row r="${rowNum}"${height}>${cells}</row>`;
    })
    .join("");

  let totals = "";
  if (sheet.totalLabel != null) {
    const rowNum = rows.length + 2;
    const cells = columns
      .map((c, i) => {
        const ref = `${colName(i)}${rowNum}`;
        const style = styleOf(c.format, true);
        if (i === 0) return cellXml(ref, sheet.totalLabel, style);
        if (!c.sum || rows.length === 0) return cellXml(ref, null, style);
        const col = colName(i);
        return `<c r="${ref}" s="${style}"><f>SUM(${col}2:${col}${rowNum - 1})</f></c>`;
      })
      .join("");
    totals = `<row r="${rowNum}" ht="20" customHeight="1">${cells}</row>`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${header}${body}${totals}</sheetData>` +
    `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
    `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    `</worksheet>`
  );
}

function stylesXml(): string {
  const numFmt: Record<XlsxFormat, number> = { text: 0, wrap: 0, int: 1, decimal: 2, gbp: 164 };
  const xf = (format: XlsxFormat, bold: boolean) => {
    const wrap = format === "wrap";
    const align = wrap ? `<alignment vertical="top" wrapText="1"/>` : `<alignment vertical="top"/>`;
    return `<xf numFmtId="${numFmt[format]}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1">${align}</xf>`;
  };
  const header = `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`;
  const cellXfs = [
    ...FORMATS.map((f) => xf(f, false)),
    header,
    ...FORMATS.map((f) => xf(f, true)),
  ];
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;£&quot;#,##0.00"/></numFmts>` +
    `<fonts count="2">` +
    `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
    `<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
    `</fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left/><right/><top/><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${cellXfs.length}">${cellXfs.join("")}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`
  );
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Sheet1";
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Uncompressed ("stored") zip — the sheet is a few KB, so deflate isn't worth a dependency.
function zip(files: { name: string; data: string }[]): Blob {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.name);
    const data = enc.encode(file.data);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    entry.set(name, 46);

    parts.push(local, data);
    central.push(entry);
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((sum, e) => sum + e.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: XLSX_MIME });
}

export function buildXlsx(sheet: XlsxSheet): Blob {
  const ns = "http://schemas.openxmlformats.org";
  return zip([
    {
      name: "[Content_Types].xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="${ns}/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${escapeXml(safeSheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets>` +
        `<calcPr fullCalcOnLoad="1"/>` +
        `</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(sheet) },
    { name: "xl/styles.xml", data: stylesXml() },
  ]);
}

export function downloadXlsx(filename: string, sheet: XlsxSheet) {
  const url = URL.createObjectURL(buildXlsx(sheet));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
