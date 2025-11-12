require("dotenv").config({ path: "./.env" });
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
let client;
let db;
let jobsCollection;
let acceptedJobsCollection;
let isConnected = false;

async function connectToMongoDB() {
  if (isConnected) return;
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  db = client.db("freelio");
  jobsCollection = db.collection("job");
  acceptedJobsCollection = db.collection("acceptedJobs");
  isConnected = true;
  console.log("✅ MongoDB Connected!");
}

// Get all jobs
app.get("/allJobs", async (req, res) => {
  try {
    await connectToMongoDB();
    const jobs = await jobsCollection.find().toArray();
    res.send(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch jobs" });
  }
});

// Get single job by ID
app.get("/allJobs/:id", async (req, res) => {
  try {
    await connectToMongoDB();
    const job = await jobsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!job) return res.status(404).send({ message: "Job not found" });
    res.send(job);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch job" });
  }
});

// Post new job
app.post("/postJob", async (req, res) => {
  try {
    await connectToMongoDB();
    const job = {
      ...req.body,
      coverImage: req.body.cover || "", // map frontend 'cover' to 'coverImage'
    };
    const result = await jobsCollection.insertOne(job);
    res.status(201).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to add job." });
  }
});

// Accept a job
// Server (Node.js/Express)
app.post("/acceptJob", async (req, res) => {
  try {
    await connectToMongoDB();
    const { jobId: jobIdString, userEmail, userName } = req.body; // Rename the incoming string ID // Convert the incoming string ID to an ObjectId
    const jobObjectId = new ObjectId(jobIdString); // 1. Find the job in the main job collection using ObjectId

    const job = await jobsCollection.findOne({ _id: jobObjectId });
    if (!job) return res.status(404).send({ message: "Job not found" }); // 2. Check if already accepted using the original job's _id (ObjectId)

    const alreadyAccepted = await acceptedJobsCollection.findOne({
      jobId: jobObjectId, // Check against the ObjectId
      userEmail,
    });
    if (alreadyAccepted)
      return res.status(400).send({ message: "Job already accepted" }); // 3. Insert the new accepted job record, storing the jobId as an ObjectId

    await acceptedJobsCollection.insertOne({
      jobId: jobObjectId, // Store as ObjectId for consistency
      title: job.title,
      category: job.category,
      summary: job.summary,
      cover: job.cover,
      postedBy: job.postedBy,
      userEmail,
      userName,
      acceptedAt: new Date(),
    });

    res.status(201).send({ message: "Job accepted successfully" });
  } catch (err) {
    console.error("Error accepting job:", err); // Handle potential invalid ObjectId format error here
    if (err.message && err.message.includes("ObjectId")) {
      return res.status(400).send({ message: "Invalid job ID format." });
    }
    res.status(500).send({ message: "Failed to accept job" });
  }
});

app.get("/latestjobs", async (req, res) => {
  try {
    await connectToMongoDB();
    const jobs = await jobsCollection
      .find()
      .sort({ postedAt: -1 }) // newest first
      .limit(6)
      .toArray();
    res.send(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch latest jobs" });
  }
});
// Cancel accepted job (already exists in your code)
app.patch("/accepted-job/:id", async (req, res) => {
  try {
    await connectToMongoDB();
    const { id } = req.params;
    const { email } = req.body;

    const result = await acceptedJobsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Job not found or cannot be deleted" });
    }

    res.send({ message: "Job cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to cancel job" });
  }
});

// Mark accepted job as DONE
app.patch("/accepted-job-done/:id", async (req, res) => {
  try {
    await connectToMongoDB();
    const { id } = req.params;
    const { email } = req.body;

    // Option 1: Delete after DONE (like CANCEL) or Option 2: Add a status field
    const result = await acceptedJobsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Job not found or cannot be marked as done" });
    }

    res.send({ message: "Job marked as DONE successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to mark job as done" });
  }
});

app.delete("/accepted-job/:id", async (req, res) => {
  try {
    await connectToMongoDB();
    const jobObjectId = new ObjectId(req.params.id);
    const { email } = req.body;

    const result = await acceptedJobsCollection.deleteOne({
      jobId: jobObjectId,
      userEmail: email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Accepted job not found" });
    }

    res.send({ message: "Accepted job deleted permanently" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to delete accepted job" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
