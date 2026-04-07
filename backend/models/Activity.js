const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  coding: Number,
  aptitude: Number,
  interviews: Number,
  studyHours: Number,
  date: String,       
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Activity', activitySchema);