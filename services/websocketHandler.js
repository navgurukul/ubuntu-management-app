// services/websocketHandler.js
const WebSocket = require("ws");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const os = require("os");
const { getMacAddress } = require("../utils/system");
const { WEBSOCKET_URL } = require("../config/constants");

class WebSocketHandler {
  constructor() {
    this.ws = null;
    this.channelNames = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 1000; // Set high for persistent reconnection
    this.baseReconnectDelay = 5000; // Start with 5 seconds
    this.maxReconnectDelay = 300000; // Max 5 minutes
    this.pingInterval = null;
    this.pongTimeout = null;
  }

  initialize(channelNames) {
    this.channelNames = channelNames;
    this.connect();
    this.setupInternetConnectionMonitoring();
  }

  connect() {
    try {
      console.log(
        `Attempting to connect to WebSocket server with channels: ${this.channelNames}`
      );

      this.ws = new WebSocket(WEBSOCKET_URL);

      this.ws.on("open", () => this.handleOpen());
      this.ws.on("message", (data) => this.handleMessage(data));
      this.ws.on("close", (event) => this.handleClose(event));
      this.ws.on("error", (error) => this.handleError(error));
      this.ws.on("pong", () => this.handlePong());
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      this.scheduleReconnect();
    }
  }

  handleOpen() {
    console.log("[Client] Connected to WebSocket server.");
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Send subscription message
    const message = JSON.stringify({
      type: "subscribe",
      channels: this.channelNames,
    });
    console.log("Sending subscription message:", message);
    this.ws.send(message);

    // Setup ping-pong for connection monitoring
    this.setupPingPong();
  }

  async handleMessage(data) {
    const dataObj = JSON.parse(data);
    const commands = dataObj.commands;
    const macAddress = getMacAddress();

    if (!Array.isArray(commands)) {
      console.error("Received commands is not an array:", commands);
      this.sendResponse({
        success: false,
        mac: macAddress,
        error: "Commands is not an array",
      });
      return;
    }

    try {
      for (const command of commands) {
        await this.executeCommand(command);
      }

      this.sendResponse({
        success: true,
        mac: macAddress,
      });
    } catch (error) {
      console.error("Error executing commands:", error);
      this.sendResponse({
        success: false,
        mac: macAddress,
        error: error.message,
      });
    }
  }

  handleClose(event) {
    console.log(
      `[Client] Connection closed. Code: ${event.code}, Reason: ${event.reason}`
    );
    this.isConnected = false;
    this.clearPingPong();
    this.scheduleReconnect();
  }

  handleError(error) {
    console.error("[Client] WebSocket error:", error.message);
    this.isConnected = false;
    this.clearPingPong();
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(
        "Max reconnection attempts reached. Stopping reconnection attempts."
      );
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseReconnectDelay *
        Math.pow(1.5, this.reconnectAttempts) *
        (1 + Math.random() * 0.1),
      this.maxReconnectDelay
    );

    console.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${
        delay / 1000
      } seconds`
    );

    setTimeout(() => {
      if (!this.isConnected) {
        this.reconnectAttempts++;
        this.connect();
      }
    }, delay);
  }

  setupInternetConnectionMonitoring() {
    // Check internet connectivity every 30 seconds
    setInterval(() => {
      this.checkInternetConnection();
    }, 30000);
  }

  async checkInternetConnection() {
    try {
      const response = await fetch("https://rms.thesama.in/ping", {
        method: "HEAD",
        timeout: 5000,
      });

      if (response.ok && !this.isConnected) {
        console.log("Internet connection restored. Attempting to reconnect...");
        this.connect();
      }
    } catch (error) {
      console.log("Internet connection check failed:", error.message);
      if (this.isConnected) {
        this.ws?.terminate();
        this.isConnected = false;
      }
    }
  }

  setupPingPong() {
    // Clear any existing intervals
    this.clearPingPong();

    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();

        // Set pong timeout
        this.pongTimeout = setTimeout(() => {
          console.log("Pong timeout - connection appears to be dead");
          this.ws.terminate();
        }, 5000); // Wait 5 seconds for pong before terminating
      }
    }, 30000);
  }

  handlePong() {
    // Clear pong timeout since we received the response
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  clearPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  sendResponse(response) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    } else {
      console.error("Cannot send response - WebSocket is not connected");
    }
  }

  async executeCommand(command) {
    // Your existing executeCommand implementation
    // ... (keep the same implementation as before)
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      channels: this.channelNames,
    };
  }
}

module.exports = WebSocketHandler;
