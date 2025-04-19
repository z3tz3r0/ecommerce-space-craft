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

// Middleware BEFORE routes
app.use(cors());
app.use(express.json());

// testing route
app.get("/", (req, res) => {
    res.send("Spacekrub API Running");
});

// Mount Routers
app.use("/api/products", productRoutes);

// Define the port
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
