const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const ws = require('ws');
const fs = require('fs');
const User = require('./models/User');
const Message = require('./models/Message');

dotenv.config();

// -------------------- 🔗 MongoDB ----------------------
mongoose.connect(process.env.MONGO_URL, (err) => {
  if (err) throw err;
  console.log("✅ Connected to MongoDB");
});

// -------------------- 🔐 Auth config ------------------
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();
const uploadDir = '/mnt/uploads';

// Ensure persistent disk folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploads from disk
app.use('/uploads', express.static(uploadDir));

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL,
}));

// -------------------- 🔐 Helper ----------------------
function generateToken(user) {
  return jwt.sign(
    { userId: user._id, username: user.username },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if (!token) return reject("no token");
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) return reject("invalid token");
      resolve(userData);
    });
  });
}

// -------------------- 🔐 Auth Routes ------------------
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(409).json({ error: "Username already taken" });

    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({ username, password: hashedPassword });
    const token = generateToken(createdUser);

    res.cookie("token", token, {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    }).status(201).json({ id: createdUser._id, username: createdUser.username });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const foundUser = await User.findOne({ username });
    if (!foundUser) return res.status(404).json({ error: "User not found" });

    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (!passOk) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(foundUser);
    res.cookie("token", token, {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    }).json({ id: foundUser._id, username: foundUser.username });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post('/logout', (req, res) => {
  res.cookie("token", "", {
    sameSite: "none",
    secure: true,
    httpOnly: true,
  }).json("ok");
});

app.get('/profile', async (req, res) => {
  try {
    const userData = await getUserDataFromRequest(req);
    res.json(userData);
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// -------------------- ✅ Existing Routes ----------------
app.get('/test', (req, res) => res.json('test ok'));

app.get('/messages/:userId', async (req, res) => {
  const { userId } = req.params;
  const userData = await getUserDataFromRequest(req);
  const ourUserId = userData.userId;

  const messages = await Message.find({
    sender: { $in: [userId, ourUserId] },
    recipient: { $in: [userId, ourUserId] },
  }).sort({ createdAt: 1 });

  res.json(messages);
});

app.get('/people', async (req, res) => {
  const users = await User.find({}, { '_id': 1, username: 1 });
  res.json(users);
});

app.post("/translate", async (req, res) => {
  try {
    const { text, target } = req.body;
    if (!text || !target) return res.status(400).json({ error: "Text and target language required" });

    const response = await axios.post(
      "https://libretranslate.de/translate",
      { q: text, source: "auto", target, format: "text" },
      { headers: { "Content-Type": "application/json" } }
    );

    res.json({ translatedText: response.data.translatedText });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Translation failed" });
  }
});

// -------------------- ✅ WebSocket --------------------
const server = app.listen(process.env.PORT || 4040, () => {
  console.log("🚀 Server running on port 4040");
});

const wss = new ws.WebSocketServer({ server });

wss.on('connection', (connection, req) => {

  function notifyAboutOnlinePeople() {
    [...wss.clients].forEach(client => {
      client.send(JSON.stringify({
        online: [...wss.clients].map(c => ({ userId: c.userId, username: c.username })),
      }));
    });
  }

  connection.isAlive = true;

  connection.timer = setInterval(() => {
    connection.ping();
    connection.deathTimer = setTimeout(() => {
      connection.isAlive = false;
      clearInterval(connection.timer);
      connection.terminate();
      notifyAboutOnlinePeople();
      console.log('dead');
    }, 1000);
  }, 5000);

  connection.on('pong', () => clearTimeout(connection.deathTimer));

  // Read token from cookie
  const cookies = req.headers.cookie;
  if (cookies) {
    const tokenCookieString = cookies.split(';').find(str => str.trim().startsWith('token='));
    if (tokenCookieString) {
      const token = tokenCookieString.split('=')[1];
      if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
          if (!err) {
            connection.userId = userData.userId;
            connection.username = userData.username;
          }
        });
      }
    }
  }

  connection.on('message', async (message) => {
    const messageData = JSON.parse(message.toString());
    const { recipient, text, file } = messageData;
    let filename = null;

    if (file) {
      const parts = file.name.split('.');
      const ext = parts[parts.length - 1];
      filename = Date.now() + '.' + ext;
      const filePath = `/mnt/uploads/${filename}`;
      const bufferData = Buffer.from(file.data.split(',')[1], 'base64');

      fs.writeFile(filePath, bufferData, (err) => {
        if (err) console.error("Error saving file:", err);
        else console.log("File saved:", filePath);
      });
    }

    if (recipient && (text || file)) {
      const messageDoc = await Message.create({
        sender: connection.userId,
        recipient,
        text,
        file: file ? filename : null,
      });

      [...wss.clients]
        .filter(c => c.userId === recipient)
        .forEach(c => c.send(JSON.stringify({
          text,
          sender: connection.userId,
          recipient,
          file: file ? filename : null,
          _id: messageDoc._id,
        })));
    }
  });

  notifyAboutOnlinePeople();
});
