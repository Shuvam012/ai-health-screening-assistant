/**
 * Integration test for the full WebSocket flow.
 * Tests: create call → connect WS → receive greeting → send audio → receive response → end call → get report
 */
const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('=== AI Health Screening Backend Integration Test ===\n');

  // Step 1: Create a call
  console.log('1. Creating call...');
  const createRes = await fetch('http://localhost:3001/api/calls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'en' }),
  });
  const createData = await createRes.json();
  const callId = createData.call.id;
  console.log(`   ✓ Call created: ${callId}\n`);

  // Step 2: Connect WebSocket
  console.log('2. Connecting WebSocket...');
  const ws = new WebSocket(`ws://localhost:3001/ws/call/${callId}`);

  const messages = [];

  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('   ✓ WebSocket connected\n');
      resolve();
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('WS connection timeout')), 5000);
  });

  // Collect messages
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);
    console.log(`   ← Server: ${msg.type}${msg.text ? ` - "${msg.text.substring(0, 80)}..."` : ''}`);
  });

  // Wait for greeting
  await sleep(2000);
  console.log(`\n3. Received greeting: ${messages.length > 0 ? '✓' : '✗'}`);
  if (messages.length > 0 && messages[0].type === 'ai.greeting') {
    console.log(`   Greeting text: "${messages[0].text.substring(0, 100)}..."`);
    console.log(`   Has audio: ${messages[0].audio ? 'Yes' : 'No'}\n`);
  }

  // Step 4: Send audio turn (simulated)
  console.log('4. Sending audio turn...');
  ws.send(JSON.stringify({ type: 'audio.start' }));
  console.log('   → audio.start');
  
  // Send fake audio data (mock STT doesn't care about actual audio content)
  const fakeAudio = Buffer.from('fake audio data for testing').toString('base64');
  ws.send(JSON.stringify({ type: 'audio.chunk', data: fakeAudio }));
  console.log('   → audio.chunk (fake data)');
  
  ws.send(JSON.stringify({ type: 'audio.end' }));
  console.log('   → audio.end');

  // Wait for response
  await sleep(3000);
  
  const processingMsg = messages.find(m => m.type === 'ai.processing');
  const transcriptMsg = messages.find(m => m.type === 'transcript');
  const responseMsg = messages.find(m => m.type === 'ai.response');

  console.log(`\n5. Pipeline results:`);
  console.log(`   Processing indicator: ${processingMsg ? '✓' : '✗'}`);
  console.log(`   User transcript: ${transcriptMsg ? '✓ "' + transcriptMsg.text + '"' : '✗'}`);
  console.log(`   AI response: ${responseMsg ? '✓ "' + responseMsg.text.substring(0, 80) + '..."' : '✗'}`);
  console.log(`   Response has audio: ${responseMsg && responseMsg.audio ? 'Yes' : 'No'}\n`);

  // Step 6: Send second turn
  console.log('6. Sending second audio turn...');
  messages.length = 0; // clear
  ws.send(JSON.stringify({ type: 'audio.start' }));
  ws.send(JSON.stringify({ type: 'audio.chunk', data: fakeAudio }));
  ws.send(JSON.stringify({ type: 'audio.end' }));
  await sleep(3000);
  
  const response2 = messages.find(m => m.type === 'ai.response');
  console.log(`   Second AI response: ${response2 ? '✓ "' + response2.text.substring(0, 80) + '..."' : '✗'}\n`);

  // Step 7: Test invalid message
  console.log('7. Testing invalid message...');
  messages.length = 0;
  ws.send('this is not json');
  await sleep(500);
  const errorMsg = messages.find(m => m.type === 'error');
  console.log(`   Error response: ${errorMsg ? '✓ "' + errorMsg.message + '"' : '✗'}\n`);

  // Step 8: End call
  console.log('8. Ending call...');
  messages.length = 0;
  ws.send(JSON.stringify({ type: 'call.end' }));
  await sleep(3000);
  
  const endedMsg = messages.find(m => m.type === 'call.ended');
  console.log(`   Call ended: ${endedMsg ? '✓' : '✗'}`);
  console.log(`   Report available: ${endedMsg ? endedMsg.reportAvailable : 'unknown'}\n`);

  ws.close();

  // Step 9: Get call details
  console.log('9. Getting call details...');
  const callRes = await fetch(`http://localhost:3001/api/calls/${callId}`);
  const callData = await callRes.json();
  console.log(`   Status: ${callData.call.status}`);
  console.log(`   Collected data: ${JSON.stringify(callData.call.collectedData)}`);
  console.log(`   Total turns: ${callData.call.metadata.totalTurns}\n`);

  // Step 10: Get report
  console.log('10. Getting health report...');
  const reportRes = await fetch(`http://localhost:3001/api/calls/${callId}/report`);
  const reportData = await reportRes.json();
  
  if (reportData.success) {
    console.log('   ✓ Report retrieved successfully');
    console.log(`   Patient name: ${reportData.report.patientName}`);
    console.log(`   Main concern: ${reportData.report.mainConcern}`);
    console.log(`   Completeness: ${reportData.report.completeness}`);
    console.log(`   Summary: ${reportData.report.summary}`);
    console.log(`   Disclaimer: ${reportData.report.disclaimer.substring(0, 60)}...`);
  } else {
    console.log(`   ✗ Report error: ${reportData.error}`);
  }

  // Step 11: Test validation - invalid callId
  console.log('\n11. Testing invalid callId...');
  const invalidRes = await fetch('http://localhost:3001/api/calls/invalid-id');
  const invalidData = await invalidRes.json();
  console.log(`   Status: ${invalidRes.status} (expected 400)`);
  console.log(`   Error: ${JSON.stringify(invalidData)}`);

  // Step 12: Test 404
  console.log('\n12. Testing non-existent call...');
  const notFoundRes = await fetch('http://localhost:3001/api/calls/000000000000000000000000');
  const notFoundData = await notFoundRes.json();
  console.log(`   Status: ${notFoundRes.status} (expected 404)`);
  console.log(`   Error: ${notFoundData.error}`);

  console.log('\n=== Test Complete ===');
}

test().catch(console.error);
