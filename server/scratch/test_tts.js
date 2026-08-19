async function testTTS() {
  const apiKey = 'sk_ud1gi7rq_1OVSp4aQJEg9zDn7dJMmd5Zl';
  const model = 'bulbul:v3'; // The model user asked for

  try {
    console.log('Sending request to Sarvam TTS...');
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: ['Hello, this is a test of Sarvam TTS.'],
        target_language_code: 'en-IN',
        speaker: 'ritu',
        model: model,
        enable_preprocessing: true,
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
  } catch (error) {
    console.error('Error:', error);
  }
}

testTTS();
