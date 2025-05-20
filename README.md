# Stateset MCP Server

A Model Context Protocol server for the StateSet API.

This server provides integration with StateSet's issue operations system through MCP, allowing LLMs to interact with StateSet.

## Usage

Ensure the following environment variables are set before running the server:

- `STATESET_API_KEY` – your API key (required)
- `STATESET_BASE_URL` – base URL for the StateSet API (defaults to `https://api.stateset.io/v1`)
- `REQUESTS_PER_HOUR` – rate limit for outgoing requests (defaults to `1000`)

Install dependencies with `npm install` and start the server using:

```bash
npm start
```
