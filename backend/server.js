const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const productRoutes = require("./routes/ProductRoutes.js");

// Load environment variable from .env file
dotenv.config();

// Connect to Database
connectDB();

// Initialize express app
const app = express();

// ---- Middleware BEFORE routes ----
// using cors to specify
const whiteList = [
  "http://localhost:5173",
  "https://ecommerce-space-craft.vercel.app",
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || whiteList.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error("Not allowed"));
    }
  },
};
app.use(cors(corsOptions));

app.use(express.json());

// ---- Testing Route ----
app.get("/", (req, res) => {
  res.send("Spacekrub API Running");
});

// ---- Routes ----
// Mount Routers
app.use("/api/products", productRoutes);
// Define the port
const PORT = process.env.PORT || 3000;

// ---- Start the server ----
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
