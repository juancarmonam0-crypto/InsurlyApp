import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI, Type } from 'https://esm.sh/@google/genai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured on Edge Function environment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { documentId, fileName, mimeType, storagePath, fileBase64, categoryHint } = await req.json()

    let base64Data = fileBase64
    let effectiveMime = mimeType || 'application/pdf'

    // If storagePath provided, download directly from private Supabase Storage
    if (!base64Data && storagePath) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { data, error: downloadError } = await supabase.storage
        .from('insurance-documents')
        .download(storagePath)

      if (downloadError || !data) {
        return new Response(
          JSON.stringify({ error: `Failed to download file from private storage: ${downloadError?.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      effectiveMime = data.type || effectiveMime
      const arrayBuffer = await data.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i])
      }
      base64Data = btoa(binary)
    }

    if (!base64Data) {
      return new Response(
        JSON.stringify({ error: 'Missing file content: neither storagePath nor fileBase64 provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    })

    if (effectiveMime.includes('pdf')) effectiveMime = 'application/pdf'
    else if (effectiveMime.includes('png')) effectiveMime = 'image/png'
    else if (effectiveMime.includes('jpeg') || effectiveMime.includes('jpg')) effectiveMime = 'image/jpeg'
    else if (effectiveMime.includes('webp')) effectiveMime = 'image/webp'
    else effectiveMime = 'application/pdf'

    const prompt = `Classify this insurance document (filename: "${fileName || 'document'}"${categoryHint ? `, hint: ${categoryHint}` : ''}) and extract all candidate insurance facts into JSON.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: effectiveMime, data: base64Data } },
            { text: prompt },
          ],
        },
      ],
      config: {
        systemInstruction: `You are Insurly's AI Commercial Insurance Document Intelligence Engine.
Extract canonical fields: business.legalName, business.dba, business.entityType, business.stateOfFormation, business.annualRevenue, business.naicsCode, business.employeeCount, business.yearsInBusiness, business.fein, business.description, location.addressLine1, location.city, location.state, location.postalCode, location.occupancy, currentInsurance.carrierName, currentInsurance.effectiveDate, currentInsurance.expirationDate, currentInsurance.limits, currentInsurance.premium, loss.date, loss.amount, loss.description, loss.status, vehicle.year, vehicle.make, vehicle.model, vehicle.vin, vehicle.usage.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING },
            classificationConfidence: { type: Type.NUMBER },
            fields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  rawLabel: { type: Type.STRING },
                  rawValue: { type: Type.STRING },
                  proposedCanonicalField: { type: Type.STRING },
                  canonicalField: { type: Type.STRING },
                  entityType: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  page: { type: Type.INTEGER },
                  evidenceText: { type: Type.STRING },
                  extractionMethod: { type: Type.STRING },
                  status: { type: Type.STRING },
                },
                required: ['id', 'rawLabel', 'rawValue', 'proposedCanonicalField', 'canonicalField', 'entityType', 'confidence'],
              },
            },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['documentType', 'classificationConfidence', 'fields'],
        },
      },
    })

    const parsed = JSON.parse(response.text?.trim() || '{}')

    const result = {
      documentId: documentId || 'doc-extracted',
      documentType: parsed.documentType || 'unknown',
      classificationConfidence: parsed.classificationConfidence || 0.85,
      fields: (parsed.fields || []).map((f: any, i: number) => ({
        id: f.id || `fact-${i + 1}`,
        rawLabel: f.rawLabel,
        rawValue: f.rawValue,
        proposedCanonicalField: f.proposedCanonicalField || f.canonicalField,
        canonicalField: f.canonicalField,
        entityType: f.entityType || 'business',
        normalizedValue: f.rawValue,
        confidence: f.confidence || 0.85,
        page: f.page || 1,
        evidenceText: f.evidenceText || '',
        extractionMethod: 'gemini_edge_function',
        status: f.status || 'valid',
        warnings: [],
      })),
      warnings: parsed.warnings || [],
      providerMetadata: {
        providerName: 'SupabaseEdgeFunctionGemini',
        model: 'gemini-2.5-flash',
      },
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Edge Function error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
