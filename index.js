// server.js (Vercel-Ready Code Structure)

require("dotenv").config({ path: "./.env.local" });
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
// const port = 3000; // Vercel ignores this

app.use(cors());
app.use(express.json());

// --- MongoDB Setup ---
const uri = process.env.MONGODB_URI;
// ... (omitted static code for brevity)

const client = new MongoClient(uri, {
  /* ... */
});
const db = client.db("freelio");
const jobsCollection = db.collection("job");

let isConnected = false; // Connection state tracker

async function connectToMongoDB() {
  if (isConnected) {
    return; // Reuse existing connection
  }
  if (!uri) {
    console.error("MongoDB URI is missing.");
    throw new Error("MongoDB URI is not configured.");
  }
  try {
    await client.connect();
    isConnected = true;
    console.log("✅ MongoDB: Connection established.");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error; // Throw error to halt route handler
  }
}

// Middleware to ensure connection before handling routes
app.use(async (req, res, next) => {
  try {
    await connectToMongoDB();
    next();
  } catch (error) {
    res
      .status(503)
      .send({ message: "Service Unavailable: Database connection failed." });
  }
});

// ... (Your /latestjobs, /alljobs, /allJobs/:id routes go here, UNCHANGED)

// --- CRITICAL VERCEL EXPORT ---
// Export the Express app as the handler for the serverless function
module.exports = app;
