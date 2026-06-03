const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
connectDB();

// Routes
const authRoutes = require('./routes/authRoutes');
const submissionRoutes = require('./routes/submissionRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('WorkFlow360 backend is running!');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unexpected error:', err);

  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});