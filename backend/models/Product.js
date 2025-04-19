// models/Product.js

const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please add a product name"],
            trim: true,
            minLength: [3, "Product name must be at least 3 characters long."],
            maxLength: [100, "Product name cannot exceed 100 characters."],
        },
        description: {
            type: String,
            required: [true, "Please add a product description"],
        },
        price: {
            type: Number,
            required: [true, "Please add a product price"],
            min: [0, "Price cannot be lower than 0"],
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
            enum: {
                values: [
                    "Fighter",
                    "Freighter",
                    "Shuttle",
                    "Speeder",
                    "Cruiser",
                    "Capital Ship",
                ],
                message: "Invalid category {VALUE} is not supported.",
            },
        },
        stockQuantity: {
            type: Number,
            required: [true, "Stock quantity must be provided."],
            min: [0, "Stock quantity cannot be less than 0."],
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
