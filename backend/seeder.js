const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const Product = require("./models/Product");
const products = require("./data/product");

dotenv.config();
connectDB();

const importData = async () => {
    try {
        await Product.deleteMany();
        console.log("Existing product data destroyed...");

        await Product.insertMany(products);
        console.log("Randomized data imported successfully");

        process.exit();
    } catch (error) {
        console.error(`Error during data import: ${error.message}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await Product.deleteMany();
        console.log("All product data destroyed");
        process.exit();
    } catch (error) {
        console.error(`Error during data destruction: ${error.message}`);
        process.exit(1);
    }
};

if (process.argv[2] === "-d") {
    destroyData();
} else {
    importData();
}
