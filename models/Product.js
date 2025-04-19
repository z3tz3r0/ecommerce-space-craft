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
        category: {
            type: String,
            required: true,
            enum: [
                "Fighter",
                "Freighter",
                "Shuttle",
                "Speeder",
                "Cruiser",
                "Capital Ship",
            ],
        },
        stockQuantity: {
            type: Number,
            required: true,
            default: 0,
        },
        isActive: {
            type: Boolean,
            required: true,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
