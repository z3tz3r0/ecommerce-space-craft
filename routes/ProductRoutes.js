const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// @desc Fetch all products
// @route GET /api/products
// @access Public
router.get("/", async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

// @desc Fetch single product by ID
// @route GET /api/products/:id
// @access Public
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: "SpaceCraft doesn't existed " });
        }
    } catch (error) {
        console.error(`Error fetching product by ID: ${error.message}`);

        if (error.kind === "ObjectId") {
            return res
                .status(404)
                .json({ message: "Product not found (invalid ID format)" });
        }
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;
