module.exports = {
  config: {
    name: "rank",
    version: "1.0.0",
    author: "DongDev & ShiPu",
    role: 0,
    description: "Check user rank card with Canvas and GoatBot CommonJS compatibility",
    category: "utility",
    guide: "{pref}rank",
    countDown: 5,
    packages: ["canvas", "axios", "fs-extra"]
  },

  onStart: async function ({ api, event, args, message, usersData, Currencies }) {
    const fs = require("fs-extra");
    const axios = require("axios");
    const { createCanvas } = require("canvas");

    const senderID = event.senderID;
    const user = await usersData.get(senderID);
    const userName = user?.name || "User";
    const userMoney = user?.money || 0;

    // Create Rank Card using Canvas
    const canvas = createCanvas(500, 180);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#1e1e2e";
    ctx.fillRect(0, 0, 500, 180);

    // Accent line
    ctx.fillStyle = "#89b4fa";
    ctx.fillRect(0, 0, 10, 180);

    // Text
    ctx.fillStyle = "#cdd6f4";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`🏆 GOATBOT RANK CARD`, 30, 50);

    ctx.fillStyle = "#a6adc8";
    ctx.font = "18px sans-serif";
    ctx.fillText(`User: ${userName} (UID: ${senderID})`, 30, 95);
    ctx.fillText(`Balance: $${userMoney.toLocaleString()}`, 30, 135);

    const buffer = canvas.toBuffer("image/png");

    return message.reply({
      body: `✨ GoatBot Rank Card for ${userName}\n💰 Balance: $${userMoney}`,
      attachment: buffer
    });
  }
};
