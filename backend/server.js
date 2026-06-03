const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('WorkFlow360 backend is running!');
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`✅ Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.log('❌ MongoDB connection failed');
    console.log('📌 Reason:', err.message);
  });

// Global error handler — catches any unhandled errors
app.use((err, req, res, next) => {
  console.log('❌ Unexpected error:', err.message);
  res.status(500).json({
    message: 'Internal server error',
    error: err.message        // exact problem will show here
  });
});