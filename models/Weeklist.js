const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  description: String,
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

const weekListSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  weekNumber: Number,
  tasks: [taskSchema],
  state: {
    type: String,
    enum: ["active", "inactive", "completed"],
    default: "active",
  },
  locked: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const WeekList = mongoose.model("WeekList", weekListSchema);

module.exports = WeekList;
