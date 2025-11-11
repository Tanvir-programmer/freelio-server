require("dotenv").config({ path: "./.env.local" });
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.warn(
    "⚠️ MONGODB_URI not found in environment variables. Set it in Vercel settings."
  );
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
let jobsCollection;
let isConnected = false;

async function connectToMongoDB() {
  if (isConnected) return;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured. Please set it in environment variables."
    );
  }
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    db = client.db("freelio");
    jobsCollection = db.collection("job");
    isConnected = true;
    console.log("✅ MongoDB: Ping successful. Connected to the database!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

// Health check endpoint
app.get("/", async (req, res) => {
  try {
    if (!uri) {
      return res.status(503).send({
        message: "⚠️ Server is running but MongoDB URI is not configured",
        status: "Not Ready",
      });
    }
    await connectToMongoDB();
    res.send({
      message: "✅ Freelio Server is running and connected to MongoDB!",
      status: "Ready",
    });
  } catch (error) {
    res.status(503).send({
      message: "❌ Server error",
      error: error.message,
      status: "Error",
    });
  }
});

// Status endpoint
app.get("/status", (req, res) => {
  res.send({
    status: "Server is running",
    mongodb_configured: !!uri,
    node_env: process.env.NODE_ENV,
  });
});

// latest jobs
// server.js (New addition)

// Get the latest 6 jobs
app.get("/latestjobs", async (req, res) => {
  try {
    await connectToMongoDB();
    const latestJobs = await jobsCollection
      .find({})
      .sort({ _id: -1 })
      .limit(6)
      .toArray();

    res.send(latestJobs);
  } catch (err) {
    console.error("Error fetching latest jobs:", err);
    res.status(500).send({ message: "Failed to fetch latest jobs" });
  }
});

// Get all jobs
app.get("/alljobs", async (req, res) => {
  try {
    await connectToMongoDB();
    const jobs = await jobsCollection.find().toArray();
    res.send(jobs);
  } catch (err) {
    console.error("Error fetching all jobs:", err);
    res.status(500).send({ message: "Failed to fetch all jobs" });
  }
});

// Get a single job by ID
app.get("/allJobs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await connectToMongoDB();
    const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
    if (!job) {
      return res.status(404).send({ message: "Job not found" });
    }
    res.send(job);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch job" });
  }
});

// Only listen locally, not in production (Vercel)
if (process.env.NODE_ENV !== "production") {
  connectToMongoDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`🚀 Express server listening on port ${port}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}

module.exports = app;
