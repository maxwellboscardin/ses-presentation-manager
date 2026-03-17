/**
 * api-extract.js — Server-side AI extraction with model escalation.
 * Haiku → Sonnet → Opus based on confidence thresholds.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'haiku', escalateBelow: 0.8 },
  { id: 'claude-sonnet-4-5-20250929', label: 'sonnet', escalateBelow: 0.7 },
  { id: 'claude-opus-4-6', label: 'opus', escalateBelow: null },
];

function buildSystemPrompt(dataPointSchema, contractId) {
  return `You are a data extraction assistant for insurance portfolio presentations.

Your task: Extract structured data from the user's input and return it as JSON matching the target schema.

TARGET DATA POINT:
- Label: ${dataPointSchema.label}
- Category: ${dataPointSchema.category}
- Data Type: ${dataPointSchema.dataType}
- Expected Format: ${dataPointSchema.format}
- JSON Path: ${dataPointSchema.jsonPath}
- Contract: ${contractId}

INSTRUCTIONS:
1. Parse the input (image, text, CSV, or PDF content) and extract the value matching the target data point.
2. Return ONLY valid JSON in this exact structure:
{
  "data": <extracted value matching the expected format>,
  "confidence": <number 0-1, your confidence in the extraction>,
  "needsEscalation": <boolean, true if the input is ambiguous, multi-table, or you're unsure>,
  "reasoning": "<brief explanation of how you extracted the value>"
}

CONFIDENCE GUIDELINES:
- 0.9-1.0: Clear, unambiguous single value that exactly matches the expected format
- 0.7-0.9: Reasonable match but some interpretation required
- 0.5-0.7: Multiple possible values, had to guess which one applies
- Below 0.5: Very unsure, input doesn't clearly contain the target data

Set needsEscalation to true if:
- The input contains multiple tables or data sections
- The target value could be in multiple places
- The format doesn't clearly match what's expected
- You had to make assumptions about which value to extract

Return ONLY the JSON object, no markdown fences, no extra text.`;
}

function buildUserContent(input, inputType) {
  if (inputType === 'image') {
    // input is base64 data URI like "data:image/png;base64,..."
    const match = input.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return [{ type: 'text', text: input }];

    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1],
          data: match[2],
        },
      },
      { type: 'text', text: 'Extract the target data point from this image.' },
    ];
  }

  const prefix = {
    pdf: 'Extract the target data point from this PDF content:\n\n',
    csv: 'Extract the target data point from this CSV data:\n\n',
    text: 'Extract the target data point from this text:\n\n',
  };

  return [{ type: 'text', text: (prefix[inputType] || '') + input }];
}

async function callModel(modelConfig, systemPrompt, userContent) {
  const response = await client.messages.create({
    model: modelConfig.id,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Parse the JSON response
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      data: null,
      confidence: 0,
      needsEscalation: true,
      reasoning: `Failed to parse model response: ${text.slice(0, 200)}`,
    };
  }
}

export async function handleExtract(req, res) {
  const { input, inputType, dataPointSchema, contractId } = req.body;

  if (!input || !inputType || !dataPointSchema || !contractId) {
    return res.status(400).json({ error: 'Missing required fields: input, inputType, dataPointSchema, contractId' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const systemPrompt = buildSystemPrompt(dataPointSchema, contractId);
  const userContent = buildUserContent(input, inputType);
  const escalationPath = [];

  let result = null;

  for (const model of MODELS) {
    try {
      result = await callModel(model, systemPrompt, userContent);
      escalationPath.push({ model: model.label, confidence: result.confidence });

      // Check if we should escalate
      const shouldEscalate =
        model.escalateBelow !== null &&
        (result.confidence < model.escalateBelow || result.needsEscalation);

      if (!shouldEscalate) break;
    } catch (err) {
      escalationPath.push({ model: model.label, error: err.message });
      // If a model fails, try the next one
      if (model === MODELS[MODELS.length - 1]) {
        return res.status(500).json({
          error: `All models failed. Last error: ${err.message}`,
          escalationPath,
        });
      }
    }
  }

  res.json({
    data: result.data,
    confidence: result.confidence,
    model: escalationPath[escalationPath.length - 1]?.model || 'unknown',
    reasoning: result.reasoning,
    escalationPath,
  });
}
