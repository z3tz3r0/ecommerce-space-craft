// models/Product.js

const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please add a product name"],
            trim: true,
        },
        description: {
            type: String,
            required: [true, "Please add a product description"],
        },
        price: {
            type: Number,
            required: [true, "Please add a product price"],
        },
        imageUrl: {
            type: String,
            required: false,
        },
        specs: {
            manufacturer: String,
            crewAmount: Number,
            maxSpeed: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
