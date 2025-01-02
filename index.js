const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const api = require('./src/App');
const { errorLog, warnLog } = require("./src/logger");
const initializeDatabase = require('./src/Database');
const videoConversion = require('./src/ffmpeg');
require('dotenv').config();

const { PORT = 8081 } = process.env;
const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors('*'));
app.use(cookieParser());

async function runServer() {
    try {
      await initializeDatabase();  // Check if database initialization is blocking
  
      await videoConversion.init();  // Check if video conversion is blocking
      
      server.listen(PORT, () => {
        api(app);  // Initialize API routes
        app.get('/', (req, res) => {
            res.send('Server is up and running');
          });
        console.log(`The server is Running on port ${PORT}`, 'server');
        warnLog(`The server is running on port ${PORT}`, 'server');
      });
  
      // Add error listener for server
      server.on('error', (err) => {
        errorLog(`Server error: ${err.message}`, 'server');
      });
  
      server.on('dropRequest', (e) => console.log('Request dropped:', e));
      server.on('close', () => console.log('HTTP Server stopped'));
    } catch (error) {
      // Log any error that occurs during the startup process
      errorLog(`Server startup error: ${error.message}`, 'server-startup-error');
    }
  }
  
  runServer();
  

module.exports = app;
