/**
 * Build ToUnicode CMap text from explicit gid->unicode mappings.
 * Entries should be pre-sorted by gid for best compression but ordering is not required.
 */
export function createToUnicodeCMapText(entries: { gid: number; unicode: number }[]): string {
  if (!entries || entries.length === 0) {
    return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
  }

  const es = entries.slice().sort((a, b) => a.gid - b.gid);

  const uniToUtf16Hex = (cp: number): string => {
    if (cp <= 0xffff) {
      return cp.toString(16).padStart(4, "0").toUpperCase();
    }
    const v = cp - 0x10000;
    const hi = 0xd800 + (v >> 10);
    const lo = 0xdc00 + (v & 0x3ff);
    return hi.toString(16).padStart(4, "0").toUpperCase() + lo.toString(16).padStart(4, "0").toUpperCase();
  };

  // Build mapping directives (group consecutive linear runs into ranges)
  type Mapping = { type: "range"; startG: number; endG: number; startU: number } | { type: "char"; gid: number; unicode: number };
  const mappings: Mapping[] = [];
  let i = 0;
  while (i < es.length) {
    const start = es[i];
    let j = i + 1;
    while (
      j < es.length &&
      es[j].gid === es[j - 1].gid + 1 &&
      es[j].unicode === es[j - 1].unicode + 1
    ) {
      j++;
    }
    const runLen = j - i;
    if (runLen >= 2) {
      mappings.push({ type: "range", startG: start.gid, endG: es[j - 1].gid, startU: start.unicode });
      i = j;
    } else {
      mappings.push({ type: "char", gid: start.gid, unicode: start.unicode });
      i++;
    }
  }

  const lines: string[] = [];
  lines.push("/CIDInit /ProcSet findresource begin");
  lines.push("12 dict begin");
  lines.push("begincmap");
  lines.push("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def");
  lines.push("/CMapName /Adobe-Identity-UCS def");
  lines.push("/CMapType 2 def");
  lines.push("1 begincodespacerange");
  lines.push("<0000> <FFFF>");
  lines.push("endcodespacerange");

  const CHUNK = 100;
  let p = 0;
  while (p < mappings.length) {
    const currentType = mappings[p].type;
    const group: Mapping[] = [];
    while (p < mappings.length && mappings[p].type === currentType && group.length < CHUNK) {
      group.push(mappings[p]);
      p++;
    }

    if (currentType === "char") {
      lines.push(`${group.length} beginbfchar`);
      for (const m of group as { type: "char"; gid: number; unicode: number }[]) {
        const cid = m.gid.toString(16).padStart(4, "0").toUpperCase();
        const uniHex = uniToUtf16Hex(m.unicode);
        lines.push(`<${cid}> <${uniHex}>`);
      }
      lines.push("endbfchar");
    } else {
      lines.push(`${group.length} beginbfrange`);
      for (const m of group as { type: "range"; startG: number; endG: number; startU: number }[]) {
        const startCid = m.startG.toString(16).padStart(4, "0").toUpperCase();
        const endCid = m.endG.toString(16).padStart(4, "0").toUpperCase();
        const startUniHex = uniToUtf16Hex(m.startU);
        lines.push(`<${startCid}> <${endCid}> <${startUniHex}>`);
      }
      lines.push("endbfrange");
    }
  }

  lines.push("endcmap");
  lines.push("CMapName currentdict /CMap defineresource pop");
  lines.push("end");
  lines.push("end");

  return lines.join("\n");
}
