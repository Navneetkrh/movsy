const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity. You should restrict this in production.
  },
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('videoEvent', (data) => {
    io.emit('videoEvent', data); // Broadcast the video event to all connected clients
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});