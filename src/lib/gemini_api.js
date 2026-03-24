// Gemini API helper
export async function generateContent(prompt) {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  
  if (!geminiApiKey) {
    throw new Error('Gemini API key not found. Please set it in the extension settings.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export async function generateReferralMessage(connections, tagline, jobTitle, company) {
  const prompt = `
    I am applying for the position of "${jobTitle}" at "${company}". 
    My tagline is: "${tagline}"
    These are my connections at the company: ${connections.join(', ')}
    
    Generate a short, professional, and friendly referral request message that I can send to one of these connections. 
    The message should be easy to copy and paste. Format it clearly.
  `;
  return await generateContent(prompt);
}
