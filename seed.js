import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Case from './models/Case.js';

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  
  await User.deleteMany({});
  await Case.deleteMany({});

  const user = await User.create({
    name: "Officer Rajesh Kumar",
    email: "rajesh.kumar@lmpc.gov.in",
    passwordHash: "hashedpassword123",
    role: "inspector",
    officerId: "LM-2026-0417"
  });

  await Case.create({
    caseId: "LM-A17F",
    productName: "Premium Wheat Flour 5kg",
    category: "Packaged Food",
    company: "AEC Consumer Goods Pvt Ltd",
    createdBy: user._id,
    images: [],
    extractedFields: {
      mrp: { value: 240, unit: "INR", confidence: 0.95 },
      netQuantity: { value: 5, unit: "kg", confidence: 0.91 },
      manufacturer: { value: "AEC Consumer Goods Pvt Ltd", confidence: 0.88 },
      countryOfOrigin: { value: "India", confidence: 0.82 },
      mfgDate: { value: "08/2026", confidence: 0.85 },
      consumerCare: { value: "care@aecgoods.in", confidence: 0.90 }
    },
    ruleResults: [
      { ruleId: "mrp_present", ruleName: "MRP Declaration", status: "PASS", message: "MRP clearly declared" },
      { ruleId: "net_qty_present", ruleName: "Net Quantity Metric Standard", status: "PASS", message: "Net quantity in standard metric units" }
    ],
    overallStatus: "PASS",
    score: 95
  });

  console.log("Database seeded successfully!");
  process.exit(0);
}

seed();