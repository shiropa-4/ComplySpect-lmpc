export const getMockAiResponse = (category) => {
  return {
    extractedFields: {
      mrp: { value: 250, unit: "INR", confidence: 0.92 },
      netQuantity: { value: 500, unit: "g", confidence: 0.88 },
      manufacturer: { value: "AEC Packaged Goods Ltd", confidence: 0.84 },
      countryOfOrigin: { value: "India", confidence: 0.81 },
      mfgDate: { value: "08/2026", confidence: 0.85 },
      consumerCare: { value: "care@aecgoods.in", confidence: 0.90 }
    },
    ruleResults: [
      { ruleId: "mrp_present", ruleName: "MRP Declaration", status: "PASS", message: "MRP clearly declared in standard format" },
      { ruleId: "net_qty_present", ruleName: "Net Quantity Metric Standard", status: "PASS", message: "Net quantity detected in standard metric units" },
      { ruleId: "mfg_date_present", ruleName: "Manufacturing Date", status: "PASS", message: "Manufacturing date clearly printed" },
      { ruleId: "consumer_care_present", ruleName: "Consumer Care Contact", status: "PASS", message: "Consumer care email/phone found" }
    ],
    overallStatus: "PASS",
    score: 95
  };
};