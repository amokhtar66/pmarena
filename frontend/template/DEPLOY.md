# Deploying the PMarena Recording Template

This guide explains how to build and deploy the custom recording template for LiveKit egress.

## Build the template

1. Navigate to the template directory:
```bash
cd pmarena/frontend/template
```

2. Install dependencies:
```bash
npm install
```

3. Build the template:
```bash
npm run build
```

The build output will be in the `dist` directory.

## Deployment Options

### Option 1: Deploy to Vercel (Recommended)

1. Install Vercel CLI if not already installed:
```bash
npm install -g vercel
```

2. Deploy to Vercel:
```bash
vercel
```

3. Follow the prompts to complete deployment.

4. After deployment, note the URL provided by Vercel (e.g., `https://pmarena-recording-template.vercel.app`).

### Option 2: Deploy to Netlify

1. Install Netlify CLI if not already installed:
```bash
npm install -g netlify-cli
```

2. Deploy to Netlify:
```bash
netlify deploy
```

3. Follow the prompts to complete deployment.

### Option 3: Deploy to GitHub Pages

1. Create a GitHub repository for the template.
2. Push the template code to the repository.
3. Configure GitHub Pages to serve from the `dist` directory.

## Configure Environment Variable

Once deployed, you need to set the `RECORDING_TEMPLATE_URL` environment variable to point to your deployed template URL:

### For Local Development

1. Add the environment variable to your `.env` file:
```
RECORDING_TEMPLATE_URL=https://your-deployed-template-url.com
```

### For Production (Railway)

1. In the Railway dashboard, go to your project.
2. Navigate to "Variables" section.
3. Add a new variable:
   - Key: `RECORDING_TEMPLATE_URL`
   - Value: `https://your-deployed-template-url.com`
4. Deploy your application to apply the changes.

## Testing the Template

To test if your template is working correctly:

1. Start a recording through your application.
2. Check the recording output to verify that:
   - Participants with cameras off are displayed with their identity information
   - Screen shares are properly displayed
   - The layout adjusts correctly based on content

## Troubleshooting

- **Black Screen Issues**: If you still see black screens, verify that your template is correctly deployed and the URL is accessible.
- **Template Not Loading**: Check browser console logs for any errors related to CORS or resource loading.
- **Recording Not Starting**: Verify that the `START_RECORDING` and `END_RECORDING` console logs are properly implemented. 