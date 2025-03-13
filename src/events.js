/*************************************
 * events.js - Main server script
 *************************************/
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

/* =====================================
   1) In-Memory User Array for Auth
   ===================================== */
const users = [
  // A couple of example users:
  { username: 'alice', password: 'alice123' },
  { username: 'bob', password: 'bob123' }
];

// Secret for JWT signing (use environment variables in production!)
const JWT_SECRET = 'my_jwt_secret';

/* =====================================
   2) Load/Save Events to events.json
   ===================================== */
const eventsFilePath = path.join(__dirname, '../data/events.json');

function loadEvents() {
  try {
    const data = fs.readFileSync(eventsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If file not found or invalid, return empty array
    return [];
  }
}

function saveEvents(events) {
  fs.writeFileSync(eventsFilePath, JSON.stringify(events, null, 2), 'utf8');
}

/* =====================================
   3) Express App Setup
   ===================================== */
const app = express();
app.use(bodyParser.json());

// Auth middleware to verify JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // store user info in req.user
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

/* =====================================
   4) Routes
   ===================================== */

// Register a new user
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  // Check if user already exists
  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  // Add new user to array
  users.push({ username, password });
  return res.status(201).json({ message: 'User registered successfully' });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Check user in array
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  // Sign a JWT
  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  return res.json({ token });
});

// Create an event
app.post('/api/events', authMiddleware, (req, res) => {
  const { name, description, date, category, reminderTime } = req.body;
  if (!name || !date || !category) {
    return res.status(400).json({ message: 'Missing required fields: name, date, category' });
  }

  const events = loadEvents();

  const newEvent = {
    id: Date.now(), // quick unique ID
    user: req.user.username,
    name,
    description: description || '',
    date: new Date(date).toISOString(),
    category,
    reminder: {
      set: !!reminderTime,
      reminderTime: reminderTime ? new Date(reminderTime).toISOString() : null,
      notified: false
    }
  };

  events.push(newEvent);
  saveEvents(events);
  return res.status(201).json(newEvent);
});

// View events (with optional sorting by date, category, or reminder)
app.get('/api/events', authMiddleware, (req, res) => {
  const { sortBy } = req.query;
  let events = loadEvents();

  // Filter only events created by the current user
  events = events.filter(e => e.user === req.user.username);

  // Sort logic
  if (sortBy === 'date') {
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (sortBy === 'category') {
    events.sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return 0;
    });
  } else if (sortBy === 'reminder') {
    // Sort by whether a reminder is set (false -> true)
    events.sort((a, b) => (a.reminder.set === b.reminder.set ? 0 : a.reminder.set ? 1 : -1));
  } else {
    // Default: sort by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  return res.json(events);
});

/* =====================================
   5) Reminder System with node-cron
   ===================================== */
cron.schedule('* * * * *', () => {
  let events = loadEvents();
  const now = new Date();

  let updated = false;
  events.forEach(event => {
    if (
      event.reminder.set &&
      !event.reminder.notified &&
      event.reminder.reminderTime &&
      new Date(event.reminder.reminderTime) <= now
    ) {
      // "Send" a notification (for demo, just log)
      console.log(`Reminder: Event "${event.name}" (User: ${event.user}) is coming up at ${event.date}`);
      event.reminder.notified = true;
      updated = true;
    }
  });

  // Save updated events if any were changed
  if (updated) {
    saveEvents(events);
  }
});

/* =====================================
   6) Start Server
   ===================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // for testing
