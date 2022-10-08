import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT;
const SECRET = process.env.SECRET!;

function getToken(id: number) {
  return jwt.sign({ id }, SECRET, { expiresIn: "2h" });
}

async function getCurrentUser(token: string) {
  const decodedData = jwt.verify(token, SECRET);
  const user = await prisma.user.findUnique({
    where: {
      // @ts-ignore
      id: Number(decodedData.id),
    },
    include: {
      posts: true,
    },
  });
  return user;
}

app.get("/posts", async (req, res) => {
    const posts = await prisma.post.findMany({
        include: {user: true, comments: true, _count: {select: {upvotes: true}}}
    })
    res.send(posts)
})

app.post("/register", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            email: req.body.email,
          },
          {
            nickname: req.body.nickname,
          },
        ],
      },
    });
    if (users.length > 0) {
      res.status(400).send({ message: "User already exists" });
    } else {
      const user = await prisma.user.create({
        data: {
          name: req.body.name,
          email: req.body.email,
          nickname: req.body.nickname,
          password: bcrypt.hashSync(req.body.password, 10),
        },
        include: {
          posts: true,
          comments: true,
          _count: { select: { upvotes: true } },
        },
      });
      const token = getToken(user.id);
      res.send({ user, token });
    }
  } catch (error) {
    // @ts-ignore
    res.status(451).send({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          email: req.body.login,
        },
        {
          nickname: req.body.login,
        },
      ],
    },
    include: {
      posts: true,
      comments: true,
      _count: { select: { upvotes: true } },
    },
  });
    const user = users[0];
    if (user && bcrypt.compareSync(req.body.password, user.password)) {
      const token = getToken(user.id);
      res.send({ user, token });
    } else {
        res.status(400).send({ message: "Invalid credentials. Email or password is incorrect!" });
    }
});

app.get("/validate", async (req, res) => {
    try {
        if(req.headers.authorization){
            const user = await getCurrentUser(req.headers.authorization);
            // @ts-ignore
            const token = getToken(user.id);
            res.send({ user, token });
        } else {
            res.status(401).send({ message: "Unauthorized" });
        }
    } catch (error) {
        // @ts-ignore
        res.status(401).send({ error: error.message });
    }
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
})
