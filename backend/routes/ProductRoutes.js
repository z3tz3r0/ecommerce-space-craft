const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// @desc    Fetch single product by ID
// @route   GET /api/products/:id
// @access  Public
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

// @desc    Create new product
// @route   POST /api/products/
// @access  Public (will be Admin only later)
router.post("/", async (req, res) => {
  console.log("DEBUG: Hit POST /api/products route handler");
  console.log("DEBUG: Request body:", req.body);
  try {
    const {
      name,
      description,
      price,
      imageUrl,
      specs,
      category,
      stockQuantity,
      isActive,
    } = req.body;

    if (!name || !description || !price || !category) {
      return res.status(400).json({
        message: "Missing required field: name, description, price, category",
      });
    }

    const newProduct = await Product.create({
      name,
      description,
      price,
      imageUrl,
      specs,
      category,
      stockQuantity,
      isActive,
    });
    console.log("DEBUG: Product created successfully: ", newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error(`Error creating product: ${error.message}`);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res
        .status(400)
        .json({ message: "Validation Failed: ", errors: messages });
    }

    res.status(500).json({
      message: "Server Error during product creation",
    });
  }
});

// @desc    Update existing product by id
// @route   PUT /api/products/:id
// @access  Public (should be Admin only later)
router.put("/:id", async (req, res) => {
  const {
    name,
    description,
    price,
    imageUrl,
    specs,
    category,
    stockQuantity,
    isActive,
  } = req.body;

  try {
    const updateProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        imageUrl,
        specs,
        category,
        stockQuantity,
        isActive,
      },
      { new: true, runValidators: true }
    );
    if (updateProduct) {
      res.json(updateProduct);
    } else {
      res.status(404).json({
        message: "Product not found",
      });
    }
  } catch (error) {
    console.error(
      `Error updating product by ID ${req.params.id}: ${error.message}`
    );

    if (error.name === "ValidationError") {
      const message = Object.values(error.error).map((val) => val.message);
      return res
        .status(400)
        .json({ message: "Validation Failed", error: message });
    }

    if (error.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "Product not found (Invalid ID format)" });
    }
    return res
      .status(500)
      .json({ message: `Server Error during product update` });
  }
});

// @desc    Delete existing product by id
// @route   DELETE /api/product/:id
// @access  Public (should be Admin only later)
router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (deletedProduct) {
      return res.status(204).json({
        message: "Item deleted",
        deletedProduct,
      });
    }
    return res.status(404).json({ message: `Product not found` });
  } catch (error) {
    console.error(`Error deleting product by ID: ${error.message}`);
    if (error.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "Product not found (invalid ID format)" });
    }
    res.status(500).json({ message: "Server Error during product deletion" });
  }
});

module.exports = router;
