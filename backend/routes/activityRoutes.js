const express = require('express');
const axios = require("axios");
const router = express.Router();
const Activity = require('../models/Activity');

// POST - Save Data
router.post('/add', async (req, res) => {
  try {
    const newActivity = new Activity(req.body);
    await newActivity.save();
    res.status(201).json(newActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Fetch All Data
router.get('/', async (req, res) => {
  try {
    const data = await Activity.find();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Placement Score (🔥 AI INTEGRATED)
router.get('/score', async (req, res) => {
  try {
    const activities = await Activity.find();

    if (activities.length === 0) {
      return res.json({ score: 0, level: "Not Started", breakdown: {} });
    }

    const days = activities.length;

    const totals = activities.reduce((acc, d) => ({
      coding: acc.coding + (d.coding || 0),
      aptitude: acc.aptitude + (d.aptitude || 0),
      interviews: acc.interviews + (d.interviews || 0),
      studyHours: acc.studyHours + (d.studyHours || 0),
    }), { coding: 0, aptitude: 0, interviews: 0, studyHours: 0 });

    const avg = {
      coding: totals.coding / days,
      aptitude: totals.aptitude / days,
      interviews: totals.interviews / days,
      studyHours: totals.studyHours / days,
    };

    // 🔥 AI CALL
    const aiResponse = await axios.post("http://localhost:8000/predict", {
      coding: avg.coding,
      aptitude: avg.aptitude,
      interviews: avg.interviews,
      studyHours: avg.studyHours
    });

    const score = Math.round(aiResponse.data.score);

    // Level logic
    const level =
      score >= 80 ? "Placement Ready 🎉" :
      score >= 60 ? "Almost There 💪" :
      score >= 40 ? "Keep Going 📈" :
      "Just Started 🌱";

    res.json({ score, level, breakdown: avg, totals, days });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE activity
router.delete('/:id', async (req, res) => {
  try {
    await Activity.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;