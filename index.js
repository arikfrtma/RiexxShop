require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Middleware untuk parsing JSON
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Route
app.use('/api', require('./api/payment'));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});