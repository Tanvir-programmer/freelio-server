// 1. Load environment variables first
require("dotenv").config(); // Reads .env and adds variables to process.env

const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = 3000;

// 2. Read the URI from the environment variables (process.env)
const uri = process.env.MONGODB_URI;

// Check if URI is loaded (a good practice)
if (!uri) {
  console.error("❌ MONGODB_URI not found in environment variables. Check your .env file!");
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
    console.log(
      "✅ MongoDB: Ping successful. Connected to the database!"
    );
    
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1); 
  }
}

app.get("/", (req, res) => {
  res.send("Hello World! Server is running.");
});

connectToMongoDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 Express server listening on port ${port}`);
    });
  });