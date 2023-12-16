const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;
const WeekList = require("./models/Weelist");
const User = require("./models/User");
// Sample user data (for demo purposes)
const users = [];

// Middleware
app.use(bodyParser.json());

// Health API
app.get("/health", (req, res) => {
  const serverName = "Week List Server";
  const currentTime = new Date().toLocaleTimeString();
  const serverStatus = "active"; // You can determine server status based on your logic

  res.json({
    serverName,
    currentTime,
    state: serverStatus,
  });
});

// Route Not Found Middleware
app.use((req, res, next) => {
  res.status(404).send("Route not found");
});

// Signup Route
app.post("/signup", (req, res) => {
  const { fullname, email, password, age, gender, mobile } = req.body;

  // Simple validation - you can add more checks here
  if (!fullname || !email || !password || !age || !gender || !mobile) {
    return res.status(400).json({ message: "Please provide all fields" });
  }

  // Check if user already exists
  const existingUser = users.find((user) => user.email === email);
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Create new user
  const newUser = {
    fullname,
    email,
    password, // You'll want to hash this password before saving it
    age,
    gender,
    mobile,
  };

  users.push(newUser);

  // Generate JWT token for authentication
  const token = jwt.sign({ email: newUser.email }, "your_secret_key");

  res.status(201).json({ token });
});

// Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = users.find((user) => user.email === email);

  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // Generate JWT token for authentication
  const token = jwt.sign({ email: user.email }, "your_secret_key");

  res.json({ token });
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, "your_secret_key", (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.user = user;
    next();
  });
};

// Protected Route (Requires Token)
app.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route" });
});

app.post("/weeklist", authenticateToken, async (req, res) => {
  const { userId, weekNumber, tasks } = req.body;

  try {
    // Logic to check the number of active week lists for the user
    const activeWeekListsCount = await WeekList.countDocuments({ userId });

    if (activeWeekListsCount >= 2) {
      return res
        .status(400)
        .json({ message: "Maximum number of active week lists reached" });
    }

    // Logic to ensure a user can only create a new week list after the previous ones have ended
    const latestWeekList = await WeekList.findOne({ userId }).sort({
      createdAt: -1,
    });

    if (
      latestWeekList &&
      Date.now() - latestWeekList.createdAt < 7 * 24 * 60 * 60 * 1000
    ) {
      return res
        .status(400)
        .json({ message: "Wait until the current week list ends" });
    }

    // Save the new week list to the database
    const newWeekList = await WeekList.create({ userId, weekNumber, tasks });
    res.status(201).json(newWeekList);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.put("/weeklist/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const weekList = await WeekList.findById(id);

    if (!weekList) {
      return res.status(404).json({ message: "Week list not found" });
    }

    const elapsedTime = Date.now() - weekList.createdAt;
    if (elapsedTime > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: "Cannot update after 24 hours" });
    }

    // Perform the update (modify weekList.tasks, etc.)
    // Save the updated week list
    await weekList.save();

    res.status(200).json({ message: "Week list updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.delete("/weeklist/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const weekList = await WeekList.findById(id);

    if (!weekList) {
      return res.status(404).json({ message: "Week list not found" });
    }

    const elapsedTime = Date.now() - weekList.createdAt;
    if (elapsedTime > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: "Cannot delete after 24 hours" });
    }

    // Perform the deletion
    await WeekList.findByIdAndDelete(id);

    res.status(200).json({ message: "Week list deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/weeklist/:id/tasks/:taskId", async (req, res) => {
  const { id, taskId } = req.params;
  const { isCompleted } = req.body;

  try {
    const weekList = await WeekList.findById(id);

    if (!weekList) {
      return res.status(404).json({ message: "Week list not found" });
    }

    const taskToUpdate = weekList.tasks.id(taskId);

    if (!taskToUpdate) {
      return res.status(404).json({ message: "Task not found" });
    }

    taskToUpdate.completed = isCompleted;
    taskToUpdate.completedAt = isCompleted ? new Date() : null;

    await weekList.save();

    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/weeklists", async (req, res) => {
  try {
    const allWeekLists = await WeekList.find();

    const weekListsWithTimeLeft = allWeekLists.map((weekList) => {
      const elapsedTime = Date.now() - weekList.createdAt;
      const timeLeft =
        elapsedTime > 7 * 24 * 60 * 60 * 1000
          ? 0
          : 7 * 24 * 60 * 60 * 1000 - elapsedTime;

      return {
        _id: weekList._id,
        userId: weekList.userId,
        weekNumber: weekList.weekNumber,
        timeLeftToComplete: timeLeft,
      };
    });

    res.status(200).json(weekListsWithTimeLeft);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/weeklist/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const weekList = await WeekList.findById(id);

    if (!weekList) {
      return res.status(404).json({ message: "Week list not found" });
    }

    res.status(200).json(weekList);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/feed", async (req, res) => {
  try {
    const activeWeekLists = await WeekList.find({
      $or: [{ state: "active" }, { state: "completed" }],
    });

    res.status(200).json(activeWeekLists);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
const checkState = async (req, res, next) => {
  const { id } = req.params;

  try {
    const weekList = await WeekList.findById(id);

    if (!weekList) {
      return res.status(404).json({ message: "Week list not found" });
    }

    const elapsedTime = Date.now() - weekList.createdAt;

    if (elapsedTime > 24 * 60 * 60 * 1000 || weekList.state !== "active") {
      return res.status(403).json({ message: "Cannot modify the week list" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
app.post("/weeklist/:id/tasks/:taskId", checkState, async (req, res) => {
  const { id, taskId } = req.params;
  const { isCompleted } = req.body;

  try {
    const weekList = await WeekList.findById(id);

    if (!weekList) {
      return res.status(404).json({ message: "Week list not found" });
    }

    const elapsedTime = Date.now() - weekList.createdAt;

    if (elapsedTime > 24 * 60 * 60 * 1000 || weekList.state !== "active") {
      return res.status(403).json({ message: "Cannot modify the week list" });
    }

    const taskToUpdate = weekList.tasks.id(taskId);

    if (!taskToUpdate) {
      return res.status(404).json({ message: "Task not found" });
    }

    taskToUpdate.completed = isCompleted;
    taskToUpdate.completedAt = isCompleted ? new Date() : null;

    if (isCompleted) {
      weekList.state = "completed";
      weekList.locked = true;
    }

    await weekList.save();

    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
