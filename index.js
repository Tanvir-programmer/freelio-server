const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = 3000;

const uri =
  "mongodb+srv://freelio:QShKSGgzTww3kljJ@cluster0.hfwfyl0.mongodb.net/?appName=Cluster0";

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