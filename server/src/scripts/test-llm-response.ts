#!/usr/bin/env tsx

import { streamText } from 'ai';
import { getModel } from '../services/llm.service.js';

/**
 * Test script to verify LLM API responses and token counting
 *
 * Run with: pnpm tsx src/scripts/test-llm-response.ts
 */

async function testLLMResponse() {
  console.log('Testing LLM response structure...\n');

  const model = getModel('gpt-5-mini');

  const result = streamText({
    model,
    prompt: 'Say hello in 5 words or less',
  });

  // Consume the stream
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta' && part.text) {
      process.stdout.write(part.text);
    }
  }

  console.log('\n\nWaiting for final results...\n');

  // Get usage stats
  const usage = await result.usage;
  const text = await result.text;
  const steps = await result.steps;

  console.log('=== USAGE OBJECT ===');
  console.log(JSON.stringify(usage, null, 2));

  console.log('\n=== FINAL TEXT ===');
  console.log(text);

  console.log('\n=== STEPS ===');
  console.log(`Total steps: ${steps?.length || 0}`);

  console.log('\n=== TOKEN EXTRACTION ===');
  console.log(`usage.inputTokens: ${usage.inputTokens || 'undefined'}`);
  console.log(`usage.outputTokens: ${usage.outputTokens || 'undefined'}`);
  console.log(`usage.totalTokens: ${usage.totalTokens || 'undefined'}`);

  // Check for alternative property names
  // biome-ignore lint/suspicious/noExplicitAny: Debugging script to inspect unknown usage object properties
  const usageObj = usage as any;
  console.log('\n=== ALL USAGE PROPERTIES ===');
  console.log(Object.keys(usageObj));
}

testLLMResponse()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });
