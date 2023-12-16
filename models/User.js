const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // Define user schema fields: fullname, email, password, age, gender, mobile
  fullname: String,
  email: {
    type: String,
    unique: true,
  },
  password: String,
  age: Number,
  gender: String,
  mobile: String,
});

const User = mongoose.model("User", userSchema);

module.exports = User;
