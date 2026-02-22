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
// Accept job route - MUST match frontend exactly
// Accept job route - Updated to match frontend body request
app.post("/acceptJob", async (req, res) => {
  try {
    const { jobId, userEmail } = req.body; // Extract from body, not params

    if (!ObjectId.isValid(jobId) || !userEmail) {
      return res
        .status(400)
        .json({ message: "Valid Job ID and email are required" });
    }

    // 1. Check if job exists in the main collection
    const originalJob = await jobsCollection.findOne({
      _id: new ObjectId(jobId),
    });
    if (!originalJob) {
      return res.status(404).json({ message: "Job not found" });
    }

    // 2. Prevent users from accepting their own jobs
    if (originalJob.email === userEmail) {
      return res
        .status(400)
        .json({ message: "You cannot accept your own job!" });
    }

    // 3. Check if already accepted by this user
    const existing = await acceptedJobsCollection.findOne({
      jobId: new ObjectId(jobId),
      userEmail: userEmail,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "You have already accepted this job" });
    }

    // 4. Create accepted job record
    const acceptedJob = {
      jobId: new ObjectId(jobId),
      userEmail: userEmail,
      title: originalJob.title,
      category: originalJob.category,
      summary: originalJob.summary,
      postedBy: originalJob.postedBy,
      coverImage: originalJob.coverImage || "",
      acceptedAt: new Date(),
      status: "In Progress",
    };

    await acceptedJobsCollection.insertOne(acceptedJob);
    res.json({ message: "✅ Job accepted successfully!" });
  } catch (err) {
    console.error("Accept job error:", err);
    res.status(500).json({ message: "Failed to accept job" });
  }
});

// Helper wrapper to ensure DB connected for each route
async function ensureDb(req, res, next) {
  try {
    await connectToMongoDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).send({ message: "Database connection failed" });
  }
}

// Use ensureDb as middleware for all routes
app.use(ensureDb);

// GET /allJobs - fetch all jobs
app.get("/allJobs", async (req, res) => {
  try {
    const jobs = await jobsCollection.find().toArray();
    res.send(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch jobs" });
  }
});

// GET /allJobs/:id - fetch single job
app.get("/allJobs/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid job ID" });
    const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
    if (!job) return res.status(404).send({ message: "Job not found" });
    res.send(job);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch job" });
  }
});

// POST /postJob - create new job
app.post("/postJob", async (req, res) => {
  try {
    const body = req.body || {};
    const job = {
      title: body.title || "",
      category: body.category || "Others",
      summary: body.summary || "",
      coverImage: body.coverImage || body.cover || "",
      postedBy: body.postedBy || body.postedBy || "",
      email: body.email || "",
      postedAt: body.postedAt ? new Date(body.postedAt) : new Date(),
      // keep any additional fields
      ...body,
    };

    // remove duplicated fields if present in ...body
    delete job.cover; // normalize

    const result = await jobsCollection.insertOne(job);
    res.status(201).send({ insertedId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to add job." });
  }
});

// PUT /updateJob/:id - update a job (only fields provided will be set)
app.put("/updateJob/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid job ID" });

    const body = req.body || {};
    const updatedFields = {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.coverImage !== undefined && { coverImage: body.coverImage }),
      ...(body.postedAt !== undefined && { postedAt: new Date(body.postedAt) }),
    };

    if (Object.keys(updatedFields).length === 0) {
      return res.status(400).send({ message: "No valid fields to update" });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedFields };
    const result = await jobsCollection.updateOne(filter, updateDoc);
    res.send({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to update job" });
  }
});

// DELETE /deleteJob/:id - delete a job
app.delete("/deleteJob/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid job ID" });
    const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      return res.status(404).send({ message: "Job not found" });
    res.send({ message: "Job deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to delete job" });
  }
});

// GET /accepted-jobs?email=user@example.com
app.get("/accepted-jobs", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send({ message: "Email is required" });

    const jobs = await acceptedJobsCollection
      .find({ userEmail: email })
      .toArray();

    // Convert _id to string for frontend
    const jobsWithId = jobs.map((job) => ({ ...job, _id: job._id.toString() }));

    res.send(jobsWithId);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch accepted jobs" });
  }
});
// PATCH /accepted-job-done/:id
app.patch("/accepted-job-done/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid job ID" });

    const result = await acceptedJobsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });

    if (result.deletedCount === 0)
      return res.status(404).send({ message: "Job not found" });

    res.send({ message: "Job marked as DONE and removed" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to mark job as DONE" });
  }
});
// PATCH /accepted-job/:id
app.patch("/accepted-job/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid job ID" });

    const result = await acceptedJobsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });

    if (result.deletedCount === 0)
      return res.status(404).send({ message: "Job not found" });

    res.send({ message: "Job cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to cancel job" });
  }
});

// GET /latestjobs - latest N jobs (default 6)
app.get("/latestjobs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const jobs = await jobsCollection
      .find()
      .sort({ postedAt: -1 })
      .limit(limit)
      .toArray();
    res.send(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch latest jobs" });
  }
});

// Accepted jobs - cancel / mark done (examples keep using userEmail for safety)
app.patch("/accepted-job/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { email } = req.body || {};
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid ID" });

    const result = await acceptedJobsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });
    if (result.deletedCount === 0)
      return res
        .status(404)
        .send({ message: "Accepted job not found or cannot be deleted" });
    res.send({ message: "Job cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to cancel job" });
  }
});

app.patch("/accepted-job-done/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { email } = req.body || {};
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid ID" });

    const result = await acceptedJobsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });
    if (result.deletedCount === 0)
      return res
        .status(404)
        .send({ message: "Accepted job not found or cannot be updated" });
    res.send({ message: "Job marked as DONE successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to mark job as done" });
  }
});

app.delete("/accepted-job/:id", async (req, res) => {
  try {
    const jobObjectId = req.params.id;
    const { email } = req.body || {};
    if (!ObjectId.isValid(jobObjectId))
      return res.status(400).send({ message: "Invalid ID" });

    const result = await acceptedJobsCollection.deleteOne({
      jobId: new ObjectId(jobObjectId),
      userEmail: email,
    });
    if (result.deletedCount === 0)
      return res.status(404).send({ message: "Accepted job not found" });
    res.send({ message: "Accepted job deleted permanently" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to delete accepted job" });
  }
});

// Start server after connecting to DB to avoid race conditions
connectToMongoDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
