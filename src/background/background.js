// Req Runner Background Service Worker (Non-module version)
// Standard importScripts for non-module service workers
importScripts('../lib/supabase-client.js');

let supabaseClient = null;

// Initialization
chrome.runtime.onInstalled.addListener(() => {
    console.log('Req Runner Extension Installed!');
});

// Helper: Get Supabase Client
async function getSupabase() {
    if (supabaseClient) return supabaseClient;
    const { supabaseUrl, supabaseKey } = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey']);
    
    if (!supabaseUrl || !supabaseKey) {
        console.warn('Supabase credentials missing in storage');
        return null;
    }

    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded in background!');
        return null;
    }

    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
    return supabaseClient;
}

// Helper: Gemini API Call
async function callGemini(prompt) {
    const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
    if (!geminiApiKey) throw new Error('Gemini API key missing. Please check your settings.');

    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text;
}

// Orchestrate AI tasks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateReferral') {
        handleReferral(request.data).then(sendResponse);
        return true; 
    } else if (request.action === 'getMapping') {
        handleGetMapping(request.data).then(sendResponse);
        return true;
    } else if (request.action === 'saveToMemoryBank') {
        handleSaveToMemoryBank(request.data).then(sendResponse);
        return true;
    }
});

async function handleReferral(data) {
    const { connections, jobTitle, company } = data;
    try {
        const client = await getSupabase();
        let tagline = "Enthusiastic job seeker";
        
        if (client) {
            const { data: profile } = await client.from('user_profile').select('tagline').single();
            if (profile?.tagline) tagline = profile.tagline;
        }

        const prompt = `
            You are a professional networking expert. 
            Generate a short, friendly, and effective LinkedIn outreach message for a referral.
            
            JOB: ${jobTitle} at ${company}
            MY TAGLINE: ${tagline}
            PEOPLE I KNOW THERE: ${connections.join(', ')}
            
            Generate a message I can send to one of these people. Keep it under 300 characters.
        `;
        
        const message = await callGemini(prompt);
        return { message };
    } catch (error) {
        console.error('Referral Error:', error);
        return { error: error.message };
    }
}

async function handleGetMapping(data) {
    const { schema, jobTitle } = data;
    try {
        const client = await getSupabase();
        const { rr_profile } = await chrome.storage.local.get('rr_profile');
        let userData = { 
            userProfile: rr_profile || { firstName: "Emmanuel", lastName: "Vayleux" }, 
            starStories: [], 
            memoryBank: [] 
        };

        if (client) {
            // Merge with Supabase data if available, but let Local Profile win for primary fields
            const { data: starStories } = await client.from('star_stories').select('*');
            const { data: memoryBank } = await client.from('memory_bank').select('*');
            userData.starStories = starStories || [];
            userData.memoryBank = memoryBank || [];
        }

        const prompt = `
            You are an AI career assistant. Map the user's data to the job application form schema.
            
            FORM SCHEMA: ${JSON.stringify(schema)}
            USER DATA: ${JSON.stringify(userData)}
            
            Returns valid JSON with:
            1. "mapping": { "fieldId": "answer" }
            2. "unknownFields": [ field objects that couldn't be answered ]
            
            Return ONLY raw JSON.
        `;
        
        const response = await callGemini(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { mapping: {}, unknownFields: [] };
    } catch (error) {
        console.error('Mapping Error:', error);
        return { error: error.message };
    }
}

async function handleSaveToMemoryBank(data) {
    const { question, answer } = data;
    try {
        const client = await getSupabase();
        if (!client) throw new Error('Supabase not configured');

        // Note: For simplicity without full Auth, we'll use a placeholder or check session
        const { data: { session } } = await client.auth.getSession();
        const userId = session?.user?.id || null;

        await client.from('memory_bank').upsert({
            user_id: userId,
            question,
            answer
        });
        
        return { success: true };
    } catch (error) {
        console.error('Save Error:', error);
        return { error: error.message };
    }
}
