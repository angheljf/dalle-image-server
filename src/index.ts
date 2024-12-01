#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { isValidGenerateImageArgs } from "./types.js";

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

class DalleImageServer {
  private server: Server;
  private openai: OpenAI;

  constructor() {
    this.server = new Server({
      name: "dalle-image-server",
      version: "0.1.0"
    }, {
      capabilities: {
        resources: {},
        tools: {}
      }
    });

    this.openai = new OpenAI({
      apiKey: API_KEY,
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    this.setupResourceHandlers();
    this.setupToolHandlers();
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async () => ({
        resources: [] // No static resources for this server
      })
    );
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: [{
          name: "generate_image",
          description: "Generate an image using DALL·E 2 based on a text description",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Text description of the image to generate"
              },
              size: {
                type: "string",
                description: "Size of the image (256x256, 512x512, or 1024x1024)",
                enum: ["256x256", "512x512", "1024x1024"]
              }
            },
            required: ["prompt"]
          }
        }]
      })
    );
  
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        if (request.params.name !== "generate_image") {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
        }
  
        if (!isValidGenerateImageArgs(request.params.arguments)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Invalid image generation arguments"
          );
        }
  
        const { prompt, size = "512x512" } = request.params.arguments;
  
        try {
          const response = await this.openai.images.generate({
            prompt,
            n: 1,
            size: size as "256x256" | "512x512" | "1024x1024",
          });
  
          const imageUrl = response.data[0].url;
  
          return {
            content: [{
              type: "text",
              text: `Image generated successfully!
  
  To view the image:
  1. Copy the following URL: ${imageUrl}
  2. Paste it into a web browser's address bar
  3. Press Enter to load the image
  
  Image details:
  - Prompt: "${prompt}"
  - Size: ${size}
  - Direct link: ${imageUrl}
  
  Note: The generated image will be available for a limited time.`
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `DALL·E API error: ${error.message}`
            }],
            isError: true,
          }
        }
      }
    );
  }
  

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error("DALL·E Image MCP server running on stdio");
  }
}


const server = new DalleImageServer();
server.run().catch(console.error);