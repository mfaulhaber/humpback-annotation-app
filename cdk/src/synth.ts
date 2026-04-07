import { buildStaticViewerApp } from "./app.js";

const assembly = buildStaticViewerApp().synth();

console.log(
  `Synthesized ${assembly.stacks.length} stack(s) to ${assembly.directory}.`,
);
