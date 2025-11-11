require("dotenv").config({ path: "./.env.local" });
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error(
    "❌ MONGODB_URI not found in environment variables. Check your .env file!"
  );
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB: Ping successful. Connected to the database!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

const db = client.db("freelio");
const jobsCollection = db.collection("job");

// latest jobs
// server.js (New addition)

// Get the latest 6 jobs
app.get("/latestjobs", async (req, res) => {
  try {
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
  const jobs = await jobsCollection.find().toArray();
  res.send(jobs);
});

// Get a single job by ID
app.get("/allJobs/:id", async (req, res) => {
  const { id } = req.params;
  try {
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

connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Express server listening on port ${port}`);
  });
});
