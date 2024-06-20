require("dotenv").config();
const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcrypt");
const admin = require("firebase-admin");

app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

function createToken(user) {
  const token = jwt.sign(
    {
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  return token;
}

function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const verify = jwt.verify(token, process.env.JWT_SECRET);
    if (!verify?.email) {
      return res.status(403).send("You are not authorized");
    }
    req.email = verify.email; // Ensure the email is attached to the request object
    next();
  } catch (error) {
    return res.status(401).send("Unauthorized");
  }
}

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

    const verifyAdmin = async (req, res, next) => {
      const email = req.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({
          error: true,
          message: "You are not authorized as admin",
        });
      }
      next();
    };

    // User Routes
    app.get("/user", async (req, res) => {
      const userData = await userCollection.find().toArray();
      res.json(userData);
    });

    app.post("/user", async (req, res) => {
      const user = req.body;
      try {
        const isUserExist = await userCollection.findOne({ email: user.email });
        if (isUserExist) {
          const token = createToken(user);
          return res.json({
            status: "success",
            message: "Login success",
            token,
          });
        }
        // Ensure a role is set, default to "user"
        user.role = user.role || "user";
        await userCollection.insertOne(user);
        const token = createToken(user);
        res.json({
          status: "success",
          message: "User registered successfully",
          token,
        });
      } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/user/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await userCollection.findOne({ _id: new ObjectId(id) });
        res.json(result);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const userData = req.body;
      // Prevent changing role to anything other than "user" or "admin"
      if (userData.role && !["user", "admin"].includes(userData.role)) {
        return res.status(400).send("Invalid role");
      }
      try {
        const result = await userCollection.updateOne(
          { email },
          { $set: userData },
          { upsert: true }
        );
        res.json({ message: "User updated successfully" });
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // app.patch("/user/:email", verifyToken, async (req, res) => {
    //   const email = req.params.email;
    //   const {
    //     name,
    //     oldPassword,
    //     newPassword,
    //     confirmPassword,
    //     photoURL,
    //     role,
    //   } = req.body;
    //   let userData = {};

    //   try {
    //     // Fetch current user details
    //     const user = await userCollection.findOne({ email });

    //     if (!user) {
    //       return res.status(404).json({ error: "User not found" });
    //     }

    //     // Prevent changing role to anything other than "user" or "admin"
    //     if (role && !["user", "admin"].includes(role)) {
    //       return res.status(400).send("Invalid role");
    //     }

    //     // Check if the old password matches
    //     if (oldPassword && newPassword && confirmPassword) {
    //       const isMatch = await bcrypt.compare(oldPassword, user.password);
    //       if (!isMatch) {
    //         return res.status(400).json({ error: "Old password is incorrect" });
    //       }

    //       // Check if the new password matches the confirmation
    //       if (newPassword !== confirmPassword) {
    //         return res
    //           .status(400)
    //           .json({ error: "New passwords do not match" });
    //       }

    //       // Hash the new password
    //       const hashedPassword = await bcrypt.hash(newPassword, 10);
    //       userData.password = hashedPassword;
    //     }

    //     // Update other fields if provided
    //     if (name) userData.name = name;
    //     if (photoURL) userData.photoURL = photoURL;
    //     if (role) userData.role = role;

    //     // Update user in the database
    //     const result = await userCollection.updateOne(
    //       { email },
    //       { $set: userData },
    //       { upsert: true }
    //     );

    //     if (result.modifiedCount === 0) {
    //       return res.status(404).send("User not found");
    //     }

    //     res.json({ message: "User updated successfully" });
    //   } catch (error) {
    //     console.error("Error updating user:", error);
    //     res.status(500).json({ error: "Internal Server Error" });
    //   }
    // });

    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await userCollection.findOne({ email });
        if (!user || user.role !== "admin") {
          res.json({ isAdmin: false });
        } else {
          res.json({ isAdmin: true });
        }
      } catch (error) {
        console.error("Error fetching admin status:", error);
        res.status(500).json({ error: "Failed to fetch admin status" });
      }
    });

    app.patch("/user/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Endpoint to delete a user by UID from both MongoDB and Firebase
    app.delete("/user/:uid", verifyToken, async (req, res) => {
      const uid = req.params.uid;

      try {
        // Delete user from MongoDB by the UID field
        const deleteResult = await userCollection.deleteOne({ uid: uid });

        if (deleteResult.deletedCount === 0) {
          return res.status(404).json({ error: "User not found in MongoDB" });
        }

        // Delete user from Firebase
        await admin.auth().deleteUser(uid);

        res.json({
          message: "User deleted successfully from both MongoDB and Firebase",
        });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Product Routes
    app.get("/product", async (req, res) => {
      const productData = await productCollection.find().toArray();
      res.json(productData);
    });

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const productData = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      res.json(productData);
    });

    app.post("/product", verifyToken, verifyAdmin, async (req, res) => {
      const productData = req.body;
      try {
        const result = await productCollection.insertOne(productData);
        res.json(result.ops[0]);
      } catch (error) {
        console.error("Error inserting product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch("/product/:id", verifyToken, verifyAdmin, async (req, res) => {
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

    app.delete("/product/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await productCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.json({ message: "Product deleted successfully" });
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  } finally {
    // Ensuring proper cleanup if necessary
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Toritorkari server is connected.");
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`App is listening on port: ${port}`);
});
