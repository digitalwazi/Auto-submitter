# Playwright Automation Service

Standalone Playwright service for form and comment automation.

## Quick Start

```bash
npm install
npm start
```

## Environment Variables

```
PORT=3001
AUTH_TOKEN=your-secret-token-here
```

## Endpoints

### Health Check
```
GET /health
```

### Submit Form
```
POST /submit-form
Authorization: Bearer YOUR_TOKEN

{
  "url": "https://example.com/contact",
  "formFields": {...},
  "submissionData": {
    "name": "John Doe",
    "email": "john@example.com",
    "message": "Hello!"
  }
}
```

### Submit Comment
```
POST /submit-comment
Authorization: Bearer YOUR_TOKEN

{
  "url": "https://example.com/blog/post",
  "commentFields": {...},
  "submissionData": {
    "name": "John Doe",
    "email": "john@example.com",
    "message": "Great post!"
  }
}
```

## Deploy to Render

1. Push to GitHub
2. Connect to Render
3. Select Docker environment
4. Add environment variables
5. Deploy!

Service will be available at: `https://your-service.onrender.com`
