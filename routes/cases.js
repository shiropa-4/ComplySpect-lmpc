import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import Case from '../models/Case.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { getMockAiResponse } from '../utils/mockData.js';
import { protect, authorize } from '../middleware/auth.js'; // Import middleware

const router = express.Router();

// 1. Mobile App Scan Endpoint (Inspector Protected - AI Extracts Metadata & Rules)
router.post('/inspect', protect, async (req, res) => {
  try {
    const { images, location } = req.body;

    // Only images are strictly required from the mobile client
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    const caseId = `LM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    let aiData;
    const useMock = process.env.USE_MOCK === 'true';

    if (useMock) {
      aiData = getMockAiResponse(); // Returns mock metadata + compliance extractions
    } else {
      try {
        // Send raw base64 images to Python FastAPI OCR / VLM engine
        const pythonRes = await axios.post(`${process.env.PYTHON_AI_URL}/extract`, {
          images
        }, { timeout: 20000 });

        aiData = pythonRes.data;
      } catch (err) {
        console.error("Python AI engine offline/error. Falling back to mock data.", err.message);
        aiData = getMockAiResponse();
      }
    }

    // Instantiate and populate Case document directly from AI extractions
    const caseDoc = new Case({
      caseId,
      productName: aiData.productName || 'Unlabeled Packaged Item',
      category: aiData.category || 'General Goods',
      company: aiData.company || 'Unknown Manufacturer',
      createdBy: req.user._id, // Set automatically from JWT user
      images,
      location: location || 'Kolkata, WB',
      extractedFields: aiData.extractedFields || {},
      ruleResults: aiData.ruleResults || [],
      overallStatus: aiData.overallStatus || 'INCOMPLETE',
      score: aiData.score || 0,
      faults: (aiData.ruleResults || [])
        .filter((r) => r.status === 'FAIL')
        .map((r) => r.ruleId)
    });

    await caseDoc.save();
    return res.status(201).json(caseDoc);

  } catch (err) {
    console.error('Inspection Route Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// 2. Web Dashboard Fetch & Filter Endpoint (Protected)
router.get('/', protect, async (req, res) => {
  try {
    const { scoreMin, scoreMax, category, company, fault, status, period, limit = 20, page = 1 } = req.query;

    const query = {};

    if (scoreMin !== undefined || scoreMax !== undefined) {
      query.score = {
        $gte: Number(scoreMin ?? 0),
        $lte: Number(scoreMax ?? 100)
      };
    }

    if (category) query.category = category;
    if (company) query.company = company;
    if (fault) query.faults = fault;
    if (status) query.overallStatus = status;

    if (period === 'monthly') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: startOfMonth };
    }

    const cases = await Case.find(query)
      .populate({ path: 'createdBy', select: 'name officerId', strictPopulate: false })
      .sort({ createdAt: -1 })
      .skip((Math.max(1, Number(page)) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Case.countDocuments(query);

    return res.json({ total, page: Number(page), cases });
  } catch (err) {
    console.error('GET /api/cases Error:', err);
    return res.status(500).json({ error: 'Failed to fetch cases', details: err.message });
  }
});

// 3. Fetch Single Case Detail (Protected)
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    let caseDoc;
    if (mongoose.Types.ObjectId.isValid(id)) {
      caseDoc = await Case.findById(id).populate({ path: 'createdBy', select: 'name officerId', strictPopulate: false });
    } else {
      caseDoc = await Case.findOne({ caseId: id }).populate({ path: 'createdBy', select: 'name officerId', strictPopulate: false });
    }

    if (!caseDoc) return res.status(404).json({ error: 'Case not found' });
    return res.json(caseDoc);
  } catch (err) {
    console.error('GET /api/cases/:id Error:', err);
    return res.status(500).json({ error: 'Failed to fetch case detail', details: err.message });
  }
});

// 4. Officer Review & Override Endpoint (Officer/Admin Protected)
router.patch('/:id/review', protect, authorize('officer', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewAction, reviewReason } = req.body;

    let caseDoc;
    if (mongoose.Types.ObjectId.isValid(id)) {
      caseDoc = await Case.findById(id);
    } else {
      caseDoc = await Case.findOne({ caseId: id });
    }

    if (!caseDoc) return res.status(404).json({ error: 'Case not found' });

    caseDoc.reviewAction = reviewAction;
    caseDoc.reviewReason = reviewReason;
    caseDoc.reviewedBy = req.user._id; // Set automatically from JWT officer user

    if (reviewAction === 'overridden') {
      caseDoc.overallStatus = 'PASS';
      caseDoc.score = 100;
    } else if (reviewAction === 'confirmed') {
      caseDoc.overallStatus = 'FAIL';
    }

    await caseDoc.save();

    await AuditLog.create({
      actorId: req.user._id,
      action: `CASE_REVIEW_${reviewAction.toUpperCase()}`,
      targetType: 'case',
      targetId: caseDoc._id,
      reason: reviewReason
    });

    return res.json(caseDoc);
  } catch (err) {
    console.error('PATCH /api/cases/:id/review Error:', err);
    return res.status(500).json({ error: 'Review action failed', details: err.message });
  }
});

export default router;