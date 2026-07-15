import { Workbook } from "@oai/artifact-tool";
const workbook = Workbook.create();
console.log(workbook.help("fx.*", { search: "SLOPE|INTERCEPT|RSQ|STEYX|DEVSQ|T.DIST.2T|T.INV.2T", include: "index,examples,notes", maxChars: 10000 }).ndjson);
