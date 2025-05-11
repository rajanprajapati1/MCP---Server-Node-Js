import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// Load environment variables
config();

// Initialize Google AI
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Initialize MCP client
const mcpClient = new Client({
  name: "api-client",
  version: "1.0.0",
});

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

let tools = [];

// Connect to MCP server
async function connectToMcp() {
  try {
    await mcpClient.connect(new SSEClientTransport(new URL("http://localhost:3001/sse")));
    console.log("Connected to MCP server");
    
    // Get available tools
    const toolsResponse = await mcpClient.listTools();
    tools = toolsResponse.tools.map(tool => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: tool.inputSchema.type,
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required
        }
      };
    });
    
    console.log(`Loaded ${tools.length} tools from MCP server`);
    return true;
  } catch (error) {
    console.error("Failed to connect to MCP server:", error);
    return false;
  }
}

// Store chat sessions
const chatSessions = {};

// Create a new chat session
app.post('/api/chat/session', (req, res) => {
  const sessionId = Date.now().toString();
  chatSessions[sessionId] = {
    history: [],
    createdAt: new Date()
  };
  res.json({ sessionId });
});

// List available sessions
app.get('/api/chat/sessions', (req, res) => {
  const sessions = Object.keys(chatSessions).map(id => ({
    id,
    createdAt: chatSessions[id].createdAt,
    messageCount: chatSessions[id].history.length
  }));
  res.json({ sessions });
});

// Get session history
app.get('/api/chat/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!chatSessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ history: chatSessions[sessionId].history });
});

// Send message to chat
app.post('/api/chat/message', async (req, res) => {
  const { sessionId, message } = req.body;
  
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'Session ID and message are required' });
  }
  
  if (!chatSessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    // Add user message to history
    chatSessions[sessionId].history.push({
      role: "user",
      parts: [{ text: message, type: "text" }]
    });
    
    // Get response from Gemini
    let complete = false;
    let fullResponse = "";
    let toolCalls = [];
    
    // Process the initial response and any tool calls
    while (!complete) {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: chatSessions[sessionId].history,
        config: {
          tools: [{ functionDeclarations: tools }]
        }
      });
      
      const functionCall = response.candidates[0].content.parts[0].functionCall;
      const responseText = response.candidates[0].content.parts[0].text;
      
      if (functionCall) {
        // Handle tool call
        console.log("Calling tool:", functionCall.name);
        
        // Add tool call to history
        chatSessions[sessionId].history.push({
          role: "model",
          parts: [{ 
            text: `Calling tool: ${functionCall.name}`,
            type: "text" 
          }]
        });
        
        // Record tool call for response
        toolCalls.push({
          name: functionCall.name,
          args: functionCall.args
        });
        
        // Execute the tool call
        const toolResult = await mcpClient.callTool({
          name: functionCall.name,
          arguments: functionCall.args
        });
        
        // Add tool result to history
        chatSessions[sessionId].history.push({
          role: "user",
          parts: [{ 
            text: "Tool result: " + toolResult.content[0].text,
            type: "text"
          }]
        });
      } else {
        // Final response without tool call
        chatSessions[sessionId].history.push({
          role: "model",
          parts: [{ text: responseText, type: "text" }]
        });
        
        fullResponse = responseText;
        complete = true;
      }
    }
    
    res.json({ 
      reply: fullResponse,
      toolCalls,
      history: chatSessions[sessionId].history 
    });
    
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get available tools
app.get('/api/tools', (req, res) => {
  res.json({ tools });
});

// Start the server
const PORT = process.env.PORT || 3002;

// Connect to MCP server then start API server
connectToMcp().then((connected) => {
  if (connected) {
    app.listen(PORT, () => {
      console.log(`API server running on http://localhost:${PORT}`);
    });
  } else {
    console.error("Failed to start API server: Could not connect to MCP server");
    process.exit(1);
  }
});