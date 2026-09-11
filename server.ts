import express from 'express'
import path from 'path'
import { createServer as createViteServer } from 'vite'
import { extractDocumentWithGemini, type ExtractDocumentPayload } from './src/server/geminiExtractor'

async function startServer() {
  const app = express()
  const PORT = 3000

  // Allow larger payload for document upload base64
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ extended: true, limit: '50mb' }))

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    })
  })

  // Secure Server-side Document Extraction
  app.post('/api/extract-document', async (req, res) => {
    try {
      const { documentId, fileName, mimeType, fileBase64, categoryHint } = req.body as ExtractDocumentPayload

      if (!documentId || !fileName || !fileBase64) {
        res.status(400).json({
          error: 'Missing required parameters: documentId, fileName, or fileBase64',
        })
        return
      }

      if (!process.env.GEMINI_API_KEY) {
        // Provide helpful feedback when key is not configured
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please configure it in your environment to use Real AI Extraction.',
          isConfigError: true,
        })
        return
      }

      const extractionResult = await extractDocumentWithGemini({
        documentId,
        fileName,
        mimeType: mimeType || 'application/pdf',
        fileBase64,
        categoryHint,
      })

      res.json(extractionResult)
    } catch (error) {
      console.error('Extraction error in /api/extract-document:', error)
      const message = error instanceof Error ? error.message : 'Unknown extraction error'
      res.status(500).json({
        error: `Server extraction failed: ${message}`,
      })
    }
  })

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(process.cwd(), 'dist')
    app.use(express.static(distPath))
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Insurly full-stack server running on http://0.0.0.0:${PORT}`)
  })
}

startServer()
