import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import {
    readFileContent,
    listDirectory,
    writeFileContent,
    createDirectory,
    deleteFileOrDirectory,
    launchApplication,
    searchFiles,
    getSystemInfo
} from "./Tools/systemTools.js";
import { sendEmail, verifyEmailConnection } from "./Tools/emailTools.js";

const server = new McpServer({
    name: "MCP_SERVER",
    version: "1.0.0"
});

const app = express();



// Original example tool
server.tool(
    "addTwoNumbers",
    "Add two numbers",
    {
        a: z.number(),
        b: z.number()
    },
    async (arg) => {
        const { a, b } = arg;
        return {
            content: [
                {
                    type: "text",
                    text: `The sum of ${a} and ${b} is ${a + b}`
                }
            ]
        }
    }
);

// Register file system tools
server.tool(
    "readFile",
    "Read content of a file at the specified path",
    {
        filePath: z.string().describe("Full path to the file to read")
    },
    async (arg) => readFileContent(arg.filePath)
);

server.tool(
    "listDirectory",
    "List files and folders in a directory",
    {
        directoryPath: z.string().describe("Path to the directory to list contents from")
    },
    async (arg) => listDirectory(arg.directoryPath)
);

server.tool(
    "writeFile",
    "Write content to a file",
    {
        filePath: z.string().describe("Full path to the file to write"),
        content: z.string().describe("Content to write to the file")
    },
    async (arg) => writeFileContent(arg.filePath, arg.content)
);

server.tool(
    "createDirectory",
    "Create a new directory",
    {
        directoryPath: z.string().describe("Path of the directory to create")
    },
    async (arg) => createDirectory(arg.directoryPath)
);

server.tool(
    "deleteItem",
    "Delete a file or directory",
    {
        itemPath: z.string().describe("Path to the file or directory to delete")
    },
    async (arg) => deleteFileOrDirectory(arg.itemPath)
);

server.tool(
    "launchApp",
    "Launch an application",
    {
        appName: z.string().describe("Name or path of the application to launch")
    },
    async (arg) => launchApplication(arg.appName)
);

server.tool(
    "searchFiles",
    "Search for files and directories containing a term",
    {
        directory: z.string().describe("Directory to start the search from"),
        searchTerm: z.string().describe("Term to search for in file and directory names")
    },
    async (arg) => searchFiles(arg.directory, arg.searchTerm)
);

server.tool(
    "getSystemInfo",
    "Get information about the system",
    {},
    async () => getSystemInfo()
);

// Register email tools
server.tool(
    "sendEmail",
    "Send an email using SMTP",
    {
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject"),
        text: z.string().describe("Email plain text body"),
        html: z.string().optional().describe("Optional HTML body")
    },
    async (arg) => sendEmail(arg)
);

server.tool(
    "verifyEmailConnection",
    "Verify SMTP connection is working",
    {},
    async () => verifyEmailConnection()
);

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports = {};

app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
    });
    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).send('No transport found for sessionId');
    }
});

app.listen(3001, () => {
    console.log("Server is running on http://localhost:3001");
});