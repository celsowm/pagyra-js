GLYPH TODO — Detailed plan to make src/pdf/font/ttf-lite.ts glyph-level correct and SRP-clean
==============================================================================================

Purpose
-------
This document is a long, detailed implementation plan (GLYPH_TODO.md) for improving the TTF "lite" parser at src/pdf/font/ttf-lite.ts so it is:
- Correct at glyph-level (accurate glyph counts, hmtx semantics, robust cmap selection and parsing).
- Robust and safe (bounds checks and fail-fast behaviour).
- SRP-aligned and easy to extend (I/O separation, focused parsers, stable public API).
- Covered by tests verifying correctness and failure modes.

Scope
-----
The work covers:
- Fixing critical bugs in current implementation (maxp usage, hmtx semantics, cmap idDelta signedness/wrap).
- Adding support for cmap format 12 (non-BMP).
- Implementing rigorous bounds checks and explicit errors for corrupt/truncated tables.
- Refactoring into small parsers (TableParser, GlobalMetricsParser, GlyphMetricsParser, CmapParser) with a small orchestrator/facade that exposes a stable API.
- Adding unit tests for all key behaviours and edge cases.
- (Optional) Small performance considerations and lazy metrics support.

High-level Goals
----------------
1. Correctness: ensure glyph widths, LSBs, glyph counts, and Unicode→glyph mapping are correct for all glyphs used in rendering/subsetting.
2. Robustness: fail fast with clear errors for truncated or corrupt tables; no silent incorrect results.
3. Extensibility & SRP: make each module do one thing, and keep a stable external API for the rest of the renderer / embedding pipeline.
4. Tests: provide unit tests using available fonts in assets/ and synthetic data for edge-cases.

Top-level Timeline & Priority
-----------------------------
(Estimated dev time depends on familiarity — adjust per team)

Phase 1 (High priority, must do)
- Implement maxp parsing (numGlyphs).
- Implement correct hmtx semantics and guards.
- Fix idDelta signedness & wrap in cmap format 4.
- Add bounds checks and clear error messages.
- Add unit tests for these behaviours.

Phase 2 (High priority)
- Implement cmap format 12 parser and robust subtable selection (prefer platform=0 format 12/4, then platform=3 encIDs 10/1 with format 12 preferred).
- Add tests for format 12 and subtable selection.

Phase 3 (Medium priority)
- Refactor code into SRP-aligned modules: parseBuffer vs file I/O, GlobalMetricsParser, GlyphMetricsParser, CmapParser, TableParser (leave as-is if adequate).
- Update public API to expose:
  - getGlyphCount(): number
  - getGlyphMetrics(gid: number): GlyphMetrics | null
  - mapCodePoint(cp: number): number
  - metrics object with unitsPerEm, ascender, descender, lineGap, capHeight?, xHeight?

Phase 4 (Medium/Low)
- Tests for selection strategy and corrupted tables.
- Add integration tests: PDF widths array generation correctness (if harness exists).
- Consider lazy getGlyphMetrics implementation and minor performance improvements.
- (Optional) Plan for glyf/CFF parsing and vertical metrics later.

Detailed Task List (actionable steps)
------------------------------------

Phase 1 — Critical fixes
1. Add MAXP tag constant and parse maxp.numGlyphs:
   - Tag: const MAXP = 0x6d617870; // 'maxp'
   - Parse numGlyphs = parser.getUint16(maxpTable, 4)
   - Throw clear error if maxp missing.

2. Read hhea.numberOfHMetrics with spec name:
   - Use offset 34 in hhea for numberOfHMetrics.
   - Clamp numberOfHMetrics to numGlyphs: numberOfHMetrics = Math.min(numberOfHMetricsRaw, numGlyphs).

3. Implement hmtx semantics for all glyphs:
   - Validate hmtx length >= numberOfHMetrics * 4; if not, throw "Truncated hmtx long metrics".
   - Compute longBytes = numberOfHMetrics * 4.
   - lastAdvanceWidth variable: updated while reading first numberOfHMetrics entries.
   - For gid < numberOfHMetrics: read advanceWidth = u16(off), lsb = i16(off + 2).
   - For gid >= numberOfHMetrics: read lsb from longBytes + (gid - numberOfHMetrics)*2, advanceWidth = lastAdvanceWidth.
   - Bounds checks at each read: ensure offsets + size <= hmtxTable.byteLength.
   - Expose these metrics either by pre-filling a Map or via a getGlyphMetrics(gid) function (prefer the latter or both).

4. Fix cmap format 4 idDelta signedness and wrap:
   - Read idDelta = table.getInt16(idDeltaOffset + i*2, false)
   - When idRangeOffset === 0: glyphId = (code + idDelta) & 0xFFFF
   - Otherwise, when reading a glyphId (from glyphIndexArray) and it's non-zero, apply glyphId = (glyphId + idDelta) & 0xFFFF
   - Use getUint16 only when reading raw glyphIndexArray words; then apply signed delta and wrap.

5. Add bounds checks everywhere:
   - For table header reads, subtable offsets, array lengths.
   - Throw descriptive errors such as "Truncated cmap format 4 endCode array" or "Invalid subtable offset".

6. Add unit tests:
   - Use assets/fonts/* (DejaVuSans, NotoSans, Roboto...).
   - Verify getGlyphCount() equals maxp.numGlyphs.
   - Verify hmtx behaviour for a font where numberOfHMetrics < numGlyphs (create or pick such a font).
   - Test truncated hmtx triggers error.
   - Test negative idDelta logic (use synthetic cmap data or find a font demonstrating this).

Phase 2 — cmap format 12 and subtable selection
1. Implement detection for format 12:
   - Read format = table.getUint16(offset, false)
   - If format === 12:
     - Read length = table.getUint32(offset + 4, false)
     - language = table.getUint32(offset + 8, false)
     - nGroups = table.getUint32(offset + 12, false)
     - Groups at offset + 16, each 12 bytes: startCharCode(u32), endCharCode(u32), startGlyphID(u32)
     - Map codepoint ranges to glyph IDs. Use bounds checks: ensure offset + 16 + nGroups*12 <= tableLength.

2. Subtable selection algorithm (prefer best unicode coverage):
   - Build a list of subtables from cmap header (platformId, encodingId, subtableStart).
   - Selection preference:
     1. Platform 0 (Unicode): prefer format 12, then 4.
     2. Platform 3 (Microsoft), encIDs preference [10, 1], and prefer format 12 then 4.
     3. Otherwise, fall back to any format 4 available.
   - Implement a small helper: selectBestCmapSubtable(subtables) -> subtableStart or null.
   - If no suitable cmap is found, decide policy: either throw or return an "empty" cmap that maps nothing. Document choice. For rendering, mapping nothing leads to many missing glyphs; throwing may be better to detect unsupported fonts early.

3. Populate unicodeMap for format 12 and format 4 (format 4 remains as parsing from Phase 1 but with idDelta fix).
   - Ensure format 12 mappings override conflicting format 4 mappings if both are present and format 12 chosen.
   - Consider storing both and exposing resolution via mapCodePoint that returns glyphId | 0.

4. Tests:
   - Use a font with format 12 (if available) or synthetic data to verify non-BMP mapping (emoji code points).
   - Test that when both 12 and 4 exist, the parser picks 12 and maps non-BMP correctly.
   - Test truncated format 12 detection.

Phase 3 — SRP refactor and API stabilization
1. Split I/O from parsing:
   - Introduce parseTtfBuffer(buffer: ArrayBuffer): TtfFont
   - Keep parseTtfFont(filePath: string) as a small wrapper (reads file and calls parseTtfBuffer). This allows future unit testing with buffers only.

2. Keep or refine TableParser:
   - The existing TtfTableParser is fine: constructors accept ArrayBuffer, expose getTable(tag): DataView | null and small read helpers.
   - Ensure read helpers centralize big-endian reads and bounds checks where possible.

3. Introduce focused parsers:
   - GlobalMetricsParser
     - Responsibility: parse head, hhea (ascender, descender, lineGap, numberOfHMetrics), OS/2 (capHeight, xHeight).
     - Return TtfMetrics type.
   - GlyphMetricsParser
     - Responsibility: parse maxp and hmtx, implement hmtx semantics and expose:
       - getGlyphCount(): number
       - getGlyphMetrics(gid: number): GlyphMetrics | null
     - Optionally: produce an array of widths for PDF width arrays when asked.
   - CmapParser
     - Responsibility: select best subtable & parse supported formats (4 and 12).
     - Expose:
       - getGlyphId(codePoint: number): number (0 if missing)
       - hasCodePoint(codePoint: number): boolean
   - Orchestrator / Facade
     - parseTtfBuffer builds TableParser, calls above parsers, and returns TtfFontMetrics wrapper object that exposes the stable API (getGlyphCount, getGlyphMetrics, mapCodePoint, metrics).

4. Public API shape (stable)
   - TtfFont object:
     - metrics: { unitsPerEm, ascender, descender, lineGap, capHeight?, xHeight? }
     - getGlyphCount(): number
     - getGlyphMetrics(gid: number): GlyphMetrics | null
       - GlyphMetrics: { advanceWidth: number; leftSideBearing: number }
     - mapCodePoint(cp: number): number
   - Document this API in comments and update src/types/fonts.ts if needed.

5. Tests:
   - Unit tests verifying behavior after refactor (use same tests from earlier phases).
   - API contract tests to ensure consumers (text renderer, embedder) are unaffected.

Phase 4 — Additional improvements and future work
1. Lazy metrics:
   - Optionally switch to lazy getGlyphMetrics that reads directly from hmtx DataView on demand instead of pre-filling the Map to lower startup memory/CPU. Keep API unchanged.

2. Vertical metrics (vhea + vmtx):
   - If vertical writing or CJK vertical is required later, add vhea/vmtx parsing with similar semantics.

3. Outline parsing:
   - Add glyf/loca or CFF support in a separate module (out of scope here).
   - Keep facade stable so outline parsers can plug into glyph-level API later.

4. Subsetting & embedding:
   - After the metrics/cmap layer is correct and stable, embedder can build width arrays and ToUnicode maps reliably.
   - Consider adding a small helper that builds a PDF width array for a set of glyph IDs.

Edge cases and gotchas to be careful about
----------------------------------------
- numberOfHMetrics > numGlyphs: clamp to numGlyphs.
- hmtx shorter than numberOfHMetrics * 4: treat as corrupt; throw early.
- idDelta negative and wrap: always mask with & 0xFFFF after addition.
- glyphIndexArray references must be validated for bounds; ensure computed glyphIndexOffset is within cmap table.
- format 12 fields use 32-bit reads for length/language/nGroups; ensure offsets are correct in subtable code.
- Subtable offsets are relative to the cmap table start; ensure you add correct base offset.
- For very large fonts (many glyphs), memory usage for a full Map of glyph metrics may be high — consider lazy reads.
- If both format 4 and 12 exist, ensure you choose format 12 for non-BMP codepoints; selecting an inferior subtable causes missing or wrong glyphs.

Concrete TypeScript snippets (copy-ready)
----------------------------------------
(These are minimal examples you can copy/paste; adapt variable names to the file context.)

1) MAXP read and numGlyphs:
```ts
const MAXP = 0x6d617870; // 'maxp'
const maxpTable = parser.getTable(MAXP);
if (!maxpTable) throw new Error('Missing maxp table');
const numGlyphs = parser.getUint16(maxpTable, 4);
```

2) numberOfHMetrics, guards:
```ts
const numberOfHMetricsRaw = parser.getUint16(hheaTable, 34); // spec name: numberOfHMetrics
const numberOfHMetrics = Math.min(numberOfHMetricsRaw, numGlyphs);
const longBytes = numberOfHMetrics * 4;
if (hmtxTable.byteLength < longBytes) throw new Error('Truncated hmtx long metrics');
```

3) hmtx full-safe loop:
```ts
let lastAdvanceWidth = 0;
const hmtxLen = hmtxTable.byteLength;
for (let gid = 0; gid < numGlyphs; gid++) {
  if (gid < numberOfHMetrics) {
    const off = gid * 4;
    if (off + 4 > hmtxLen) throw new Error('Truncated hmtx entry');
    const advanceWidth = parser.getUint16(hmtxTable, off);
    const leftSideBearing = parser.getInt16(hmtxTable, off + 2);
    glyphMetrics.set(gid, { advanceWidth, leftSideBearing });
    lastAdvanceWidth = advanceWidth;
  } else {
    const lsbOff = longBytes + (gid - numberOfHMetrics) * 2;
    if (lsbOff + 2 > hmtxLen) throw new Error('Truncated hmtx LSB array');
    const leftSideBearing = parser.getInt16(hmtxTable, lsbOff);
    glyphMetrics.set(gid, { advanceWidth: lastAdvanceWidth, leftSideBearing });
  }
}
```

4) cmap format 4 idDelta fix + wrap:
```ts
const idDelta = parser.getInt16(table, idDeltaOffset + i * 2);
...
if (idRangeOffset === 0) {
  glyphId = (code + idDelta) & 0xFFFF;
} else {
  const glyphIndexOffset = idRangeOffsetOffset + i * 2 + idRangeOffset + (code - startCode) * 2;
  if (glyphIndexOffset + 2 > table.byteLength) throw new Error('Truncated cmap glyphIndexArray');
  glyphId = table.getUint16(glyphIndexOffset, false);
  if (glyphId !== 0) {
    glyphId = (glyphId + idDelta) & 0xFFFF;
  }
}
```

5) cmap format 12 parsing skeleton:
```ts
const format = table.getUint16(offset, false);
if (format === 12) {
  const nGroups = table.getUint32(offset + 12, false);
  let p = offset + 16;
  if (p + nGroups * 12 > table.byteLength) throw new Error('Truncated cmap format 12 groups');
  for (let g = 0; g < nGroups; g++, p += 12) {
    const startCode = table.getUint32(p, false);
    const endCode = table.getUint32(p + 4, false);
    const startGID = table.getUint32(p + 8, false);
    for (let cp = startCode; cp <= endCode; cp++) {
      unicodeMap.set(cp, startGID + (cp - startCode));
    }
  }
}
```

Testing matrix (detailed)
-------------------------
Add tests for:

- maxp correctness:
  - Compare getGlyphCount() with parser reading maxp.numGlyphs directly.
- hmtx correctness and truncated data:
  - Font with numberOfHMetrics < numGlyphs: ensure widths for gid >= numberOfHMetrics equal last long metric.
  - Truncated hmtx: create a corrupted bytes buffer to ensure parser throws the right error.
- cmap format 4:
  - Negative idDelta: synthetic cmap with idDelta negative; assert wrapped glyph ID.
  - Truncated arrays: fail-fast behaviour.
- cmap format 12:
  - Non-BMP mapping (emoji or synthetic): verify code point → glyph ID mapping.
  - Adjacent groups behavior: ensure ranges are mapped correctly and don't overlap incorrectly.
- Subtable selection:
  - Create a cmap with both 12 and 4 (or mock data) to ensure selection logic picks 12 for Unicode platform/desired encoding.
- Integration:
  - Generate a small PDF width array (if embedding code exists) and assert widths correspond to glyph metrics returned by parser.

Acceptance criteria
-------------------
- All high-priority TypeScript changes compiled successfully (tsc).
- Unit tests added and passing in dev environment (preferably run via npm test).
- No consumer code (text renderer or embedder) needs changes beyond switching to the new stable API.
- Clear and descriptive errors for truncated/malformed tables.
- PR contains: code changes, tests, GLYPH_TODO.md, and a short README entry describing the new stable API.

Suggested PR layout
-------------------
- src/pdf/font/ttf-lite.ts (or refactor into src/pdf/font/ttf-* modules)
- tests/pdf-font/ttf-lite.spec.ts (unit tests)
- GLYPH_TODO.md (this document)
- If refactoring: new files:
  - src/pdf/font/ttf-table-parser.ts
  - src/pdf/font/ttf-global-metrics.ts
  - src/pdf/font/ttf-glyph-metrics.ts
  - src/pdf/font/ttf-cmap.ts

Rollback plan
-------------
- Implement changes on a feature branch. If anything causes regressions in integration tests, revert the feature branch and open a follow-up investigation task.
- Keep old behaviour accessible via a small compatibility function if absolutely necessary, but prefer correctness.

Estimated effort
----------------
- Phase 1 (fixes + tests): 4–8 hours (one developer familiar with codebase).
- Phase 2 (format 12 + tests): 3–6 hours.
- Phase 3 (SRP refactor + API stabilization + tests): 4–12 hours depending on depth of refactor and test coverage.
- Total: ~1–3 working days depending on testing, review, and CI time.

Notes for implementer
---------------------
- Reuse the existing TtfTableParser utilities in the repo — they handle big-endian reads.
- Keep all reads big-endian and centralize getUint16/getInt16/getUint32 usage to minimize mistakes.
- Improve code comments referencing OpenType spec offsets and field names (use spec names: numberOfHMetrics).
- Use descriptive error messages to make debugging font issues easy.
- Add inline TODOs where future features (CFF/glyf) should plug in.

Changelog / Versioning
----------------------
- Bump minor version for parser changes and new tests.
- Note in CHANGELOG.md (or PR description) that glyph-level semantics changed and improved; downstream consumers relying on the previous (buggy) behaviour may see different widths for some glyphs — this is correct behaviour.

Contact & ownership
-------------------
- Author: whoever implements (add name)
- Reviewer: a peer familiar with text rendering and font metrics
- QA: run test suite and exercise a few PDFs with diverse languages (Latin, Arabic, CJK, emoji).

End of GLYPH_TODO.md
