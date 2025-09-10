const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

// ✅ Call the function
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
