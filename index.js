require("dotenv").config();
const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const jwt = require("jsonwebtoken");
const cors = require("cors");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// function createToken(user) {
//   const token = jwt.sign(
//     {
//       email: user.email,
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: "7d" }
//   );
//   return token;
// }

// function verifyToken(req, res, next) {
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     const verify = jwt.verify(token, process.env.JWT_SECRET);
//     if (!verify?.email) {
//       return res.status(403).send("You are not authorized");
//     }
//     req.user = verify.email;
//     next();
//   } catch (error) {
//     return res.status(401).send("Unauthorized");
//   }
// }

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const toritorkaiDB = client.db("Toritorkari_DB");
    const productCollection = toritorkaiDB.collection("productCollection");
    const userCollection = toritorkaiDB.collection("userCollection");

    // product
    app.get("/product", async (req, res) => {
      const productData = await productCollection.find().toArray();
      res.send(productData);
    });

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const productData = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      res.json(productData);
    });

    app.post("/product", async (req, res) => {
      const productData = req.body;
      const result = await productCollection.insertOne(productData);
      res.send(result);
    });

    app.patch("/product/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        delete updatedData._id;

        const result = await productCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send("Product not found");
        }

        res.json({ message: "Product updated successfully" });
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // user
    app.get("/user", async (req, res) => {
      const userData = await userCollection.find().toArray();
      res.send(userData);
    });
    app.post("/user", async (req, res) => {
      const user = req.body;

      const token = createToken(user);
      const isUserExist = await userCollection.findOne({ email: user?.email });
      if (isUserExist?._id) {
        return res.send({
          status: "success",
          message: "Login success",
          token,
        });
      }
      await userCollection.insertOne(user);
      return res.send({ token });
    });

    app.get("/user/get/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const result = await userCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    app.patch("/user/:email", async (req, res) => {
      const email = req.params.email;
      const userData = req.body;
      const result = await userCollection.updateOne(
        { email },
        { $set: userData },
        { upsert: true }
      );
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Toritorkari server is connected.");
});

app.listen(port, () => {
  console.log(`App is listening on port: ${port}`);
});
