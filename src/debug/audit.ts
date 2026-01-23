import { log } from "../logging/debug.js";

export function auditRuns(lineRuns: { text: string, face: string }[]) {
  const recon = lineRuns.map(r => r.text).join("");
  const isolates = lineRuns
    .map((r, i) => ({ i, r }))
    .filter(x => [...x.r.text].length === 1 && x.r.text.charCodeAt(0) > 127);
  const switches = lineRuns.reduce((acc, r, i, arr) => i > 0 && arr[i - 1].face !== r.face ? acc + 1 : acc, 0);

  log("layout", "info", "Line audit", {
    recon: recon.length > 80 ? recon.slice(0, 77) + "..." : recon,
    isolates: isolates.map(x => ({
      idx: x.i,
      ch: x.r.text,
      cp: x.r.text.codePointAt(0)!.toString(16),
      face: x.r.face
    })),
    switches
  });
}
