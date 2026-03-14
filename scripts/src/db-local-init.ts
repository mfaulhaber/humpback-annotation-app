const endpoint = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
const catalogTable = process.env.CATALOG_TABLE ?? "Catalog";
const labelsTable = process.env.LABELS_TABLE ?? "Labels";

console.log("Local DynamoDB initialization is not implemented yet.");
console.log(`Expected endpoint: ${endpoint}`);
console.log(`Planned tables: ${catalogTable}, ${labelsTable}`);
console.log(
  "Next step: create Catalog and Labels tables with the planned indexes from the design docs.",
);
