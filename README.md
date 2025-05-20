# Stateset MCP Server

A Model Context Protocol server for the StateSet API.

This server provides integration with StateSet's issue operations system through MCP, allowing LLMs to interact with StateSet.

## Usage

Ensure the following environment variables are set before running the server:

- `STATESET_API_KEY` – your API key
- `STATESET_BASE_URL` – base URL for the StateSet API
- `REQUESTS_PER_HOUR` – rate limit for outgoing requests (default `1000`)

Start the server with `node index.ts` or `ts-node index.ts`.
