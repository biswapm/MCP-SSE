import express, { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import dotenv from "dotenv";
// Load environment variables from .env file
dotenv.config();

const server = new McpServer({
  name: "sample-sseserver",
  version: "1.0.0"
});

// Get API key from environment variables
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3001;

// Authentication middleware
const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!API_KEY || !apiKey || apiKey !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    
    next();
  };

// echo tool
// this is a simple tool that just echoes the message back
server.tool(
    "echo",
    { message: z.string() },
    async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message}` }]
    })
  );
  // calculate-bmi tool
  // this is a simple tool that calculates the BMI based on weight and height
  // it uses the formula: weight / (height * height)
  server.tool(
    "calculate-bmi",
    {
      weightKg: z.number(),
      heightM: z.number()
    },
    async ({ weightKg, heightM }) => ({
      content: [{
        type: "text",
        text: String(weightKg / (heightM * heightM))
      }]
    })
  );
  
  // Async tool with external API call
    // this is a simple tool that fetches the weather from an external API
    // it uses the fetch API to get the weather data
  server.tool(
    "fetch-weather",
    { city: z.string() },
    async ({ city }) => {
      const response = await fetch(`https://api.weather.com/${city}`);
      const data = await response.text();
      return {
        content: [{ type: "text", text: data }]
      };
    }
  );
const app = express();

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: {[sessionId: string]: SSEServerTransport} = {};

app.get("/sse", async (_: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});